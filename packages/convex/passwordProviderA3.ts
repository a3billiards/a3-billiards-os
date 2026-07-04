/**
 * Password provider (fork of @convex-dev/auth Password) with server-side guards
 * after successful credential verification: frozen + pending-deletion block sign-in (TDD §1.3).
 */
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import { assertStrongPasswordOrThrow } from "./model/passwordPolicy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PasswordConfig = Record<string, any>;

export function A3Password(config: PasswordConfig = {}) {
  const provider = config.id ?? "password";
  return ConvexCredentials({
    id: "password",
    authorize: async (params, ctx) => {
      const profile =
        config.profile?.(params, ctx) ?? defaultProfile(params);
      const email = String(profile.email ?? "").trim().toLowerCase();
      if (!email) {
        throw new Error("Missing email");
      }
      const flow = params.flow;
      const secret = params.password;
      let account;
      let user;
      if (flow === "signUp") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signUp` flow");
        }
        const passwordStr = String(secret);
        const created = await createAccount(ctx, {
          provider,
          account: { id: email, secret: passwordStr },
          profile,
          shouldLinkViaEmail: config.verify !== undefined,
          shouldLinkViaPhone: false,
        });
        ({ account, user } = created);
        // Guard: if user is null the previous signup attempt left an orphaned
        // authAccounts row (actions are non-transactional). Clean it up so the
        // user can immediately retry with the same email.
        if (!user) {
          await ctx.runMutation(internal.users.deleteOrphanedAuthAccount, {
            accountId: account._id,
          });
          throw new Error(
            "SIGNUP_RETRY: A previous incomplete registration was cleaned up. Please tap Create Account again.",
          );
        }
      } else if (flow === "signIn") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signIn` flow");
        }

        let retrieved;
        try {
          retrieved = await retrieveAccount(ctx, {
            provider,
            account: { id: email, secret: String(secret) },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("InvalidAccountId")) {
            const diag = await ctx.runQuery(
              internal.adminAuth.diagnoseAdminPasswordLogin,
              { email },
            );
            if (diag.ok === false && diag.reason === "no_password_account") {
              throw new Error(
                "AUTH_010: No password login for this admin account. Set a password via seed or password reset.",
              );
            }
            if (diag.ok === false && diag.reason === "wrong_user_link") {
              throw new Error(
                "DATA_002: Password login for this email is linked to a different user",
              );
            }
            throw new Error("AUTH_001: Invalid credentials");
          }
          if (msg.includes("InvalidSecret")) {
            throw new Error("AUTH_001: Invalid credentials");
          }
          throw e;
        }

        if (retrieved === null) {
          throw new Error("AUTH_001: Invalid credentials");
        }
        ({ account, user } = retrieved);
        if (user.isFrozen) {
          throw new Error("AUTH_002: Account is frozen");
        }
        if (user.deletionRequestedAt !== undefined) {
          throw new Error("AUTH_006: Account pending deletion");
        }
        if (user.role === "owner" && !account.emailVerified) {
          throw new Error(
            "AUTH_009: Email not verified — enter the code we sent to your inbox",
          );
        }
        if (user.role === "admin") {
          await ctx.runMutation(internal.mfa.internalClearAdminMfaOnPasswordSignIn, {
            userId: user._id,
          });
        }
      } else if (flow === "reset") {
        if (!config.reset) {
          throw new Error(`Password reset is not enabled for ${provider}`);
        }
        const { account } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        return await signInViaProvider(ctx, config.reset, {
          accountId: account._id,
          params,
        });
      } else if (flow === "reset-verification") {
        if (!config.reset) {
          throw new Error(`Password reset is not enabled for ${provider}`);
        }
        if (params.newPassword === undefined) {
          throw new Error(
            "Missing `newPassword` param for `reset-verification` flow",
          );
        }
        const result = await signInViaProvider(ctx, config.reset, { params });
        if (result === null) {
          throw new Error("Invalid code");
        }
        const { userId, sessionId } = result;
        const newSecret = String(params.newPassword ?? "");
        await modifyAccountCredentials(ctx, {
          provider,
          account: { id: email, secret: newSecret },
        });
        await invalidateSessions(ctx, { userId, except: [sessionId] });
        return { userId, sessionId };
      } else if (flow === "email-verification") {
        if (!config.verify) {
          throw new Error(`Email verification is not enabled for ${provider}`);
        }
        const { account: acc } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        return await signInViaProvider(ctx, config.verify, {
          accountId: acc._id,
          params,
        });
      } else {
        throw new Error(
          "Missing `flow` param, it must be one of " +
            '"signUp", "signIn", "reset", "reset-verification" or ' +
            '"email-verification"!',
        );
      }
      if (config.verify && !account.emailVerified) {
        return await signInViaProvider(ctx, config.verify, {
          accountId: account._id,
          params,
        });
      }
      if (!user) throw new Error("AUTH_001: User record not found");
      return { userId: user._id };
    },
    crypto: {
      async hashSecret(password: string) {
        return await new Scrypt().hash(password);
      },
      async verifySecret(password: string, hash: string) {
        return await new Scrypt().verify(hash, password);
      },
    },
    extraProviders: [config.reset, config.verify],
    ...config,
  });
}

function defaultProfile(params: Record<string, unknown>) {
  const flow = params.flow;
  if (flow === "signUp" || flow === "reset-verification") {
    const password =
      flow === "signUp" ? params.password : params.newPassword;
    if (!password || typeof password !== "string") {
      throw new Error("Invalid password");
    }
    assertStrongPasswordOrThrow(String(password));
  }
  // Include ALL non-optional users-table fields. On signUp the client passes
  // name / age / consentGiven / phone as extra params so the user row is fully
  // populated in the same atomic createAccount call — no separate createUser
  // mutation needed, which avoids the "not authenticated" race condition.
  const now = Date.now();
  return {
    email: params.email as string,
    name: typeof params.name === "string" ? params.name.trim() : "",
    age: typeof params.age === "number" ? params.age : 0,
    phone: typeof params.phone === "string" ? params.phone : undefined,
    phoneVerified: false,
    fcmTokens: [] as string[],
    settingsPasscodeSet: false,
    complaints: [] as string[],
    isFrozen: false,
    role: "customer" as const,
    consentGiven: params.consentGiven === true,
    consentGivenAt: params.consentGiven === true ? now : undefined,
    createdAt: now,
  };
}
