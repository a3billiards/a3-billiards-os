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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PasswordConfig = Record<string, any>;

export function A3Password(config: PasswordConfig = {}) {
  const provider = config.id ?? "password";
  return ConvexCredentials({
    id: "password",
    authorize: async (params, ctx) => {
      const profile =
        config.profile?.(params, ctx) ?? defaultProfile(params);
      const email = String(profile.email ?? "").trim();
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
      } else if (flow === "signIn") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signIn` flow");
        }
        const retrieved = await retrieveAccount(ctx, {
          provider,
          account: { id: email, secret: String(secret) },
        });
        if (retrieved === null) {
          throw new Error("Invalid credentials");
        }
        ({ account, user } = retrieved);
        if (user.isFrozen) {
          throw new Error("AUTH_002: Account is frozen");
        }
        if (user.deletionRequestedAt !== undefined) {
          throw new Error("AUTH_006: Account pending deletion");
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
    if (!password || String(password).length < 8) {
      throw new Error("Invalid password");
    }
  }
  return {
    email: params.email as string,
  };
}
