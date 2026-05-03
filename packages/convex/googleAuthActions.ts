"use node";

/**
 * Google ID token verification (JWKS via google-auth-library).
 * Steps 1–3: verify token, find existing user, return session target or pendingProfile.
 */

import { OAuth2Client } from "google-auth-library";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** Supports multiple iOS apps (customer + owner) via comma-separated IDs. */
function expandGoogleClientIds(raw: string | undefined): string[] {
  if (raw === undefined || raw.length === 0) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function googleAudiences(): string[] {
  const ids = [
    ...expandGoogleClientIds(process.env.GOOGLE_IOS_CLIENT_ID),
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  return ids;
}

function throwGoogleAuth(): never {
  throw new Error("GOOGLE_AUTH_001: Audience mismatch or invalid Google ID token");
}

async function verifyIdTokenClaims(idToken: string): Promise<{
  googleId: string;
  email: string | null;
  name: string;
}> {
  const audience = googleAudiences();
  if (audience.length === 0) {
    throw new Error(
      "DATA_001: Missing Google client ID env (GOOGLE_IOS_CLIENT_ID comma-separated for multiple iOS apps, GOOGLE_ANDROID_CLIENT_ID, and/or GOOGLE_WEB_CLIENT_ID)",
    );
  }

  const client = new OAuth2Client();
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience });
  } catch {
    throwGoogleAuth();
  }

  const payload = ticket.getPayload();
  if (!payload?.sub) throwGoogleAuth();

  return {
    googleId: payload.sub,
    email: payload.email ?? null,
    name: payload.name?.trim() || "Google User",
  };
}

/**
 * Step 1 only: validate `idToken` against Google-issued keys and configured audiences.
 * Throws GOOGLE_AUTH_001 on failure.
 */
export const verifyGoogleToken = action({
  args: { idToken: v.string() },
  handler: async (_ctx, { idToken }) => {
    return await verifyIdTokenClaims(idToken);
  },
});

/**
 * Same as `verifyGoogleToken` but internal — invoked from the Google
 * ConvexCredentials provider's `authorize` callback via `ctx.runAction`.
 */
export const verifyGoogleTokenInternal = internalAction({
  args: { idToken: v.string() },
  handler: async (_ctx, { idToken }) => {
    return await verifyIdTokenClaims(idToken);
  },
});

/**
 * Full sign-in probe: verify token, find user by googleId then email, link googleId when matched by email.
 * New users: `{ isNewUser: true, pendingProfile }` only — no DB row yet.
 */
type ResolveGoogleSignInResult =
  | { isNewUser: false; userId: Id<"users"> }
  | {
      isNewUser: true;
      pendingProfile: {
        googleId: string;
        email: string | null;
        name: string;
      };
    };

export const resolveGoogleSignIn = action({
  args: { idToken: v.string() },
  handler: async (ctx, { idToken }): Promise<ResolveGoogleSignInResult> => {
    const { googleId, email, name } = await verifyIdTokenClaims(idToken);

    const existing: Doc<"users"> | null = await ctx.runQuery(
      internal.googleAuth.findExistingGoogleUser,
      {
        googleId,
        email: email ?? undefined,
      },
    );

    if (existing) {
      if (existing.isFrozen) {
        throw new Error("AUTH_002: Account is frozen");
      }
      if (existing.deletionRequestedAt !== undefined) {
        throw new Error("AUTH_006: Account pending deletion");
      }
      if (!existing.googleId) {
        await ctx.runMutation(internal.googleAuth.linkGoogleId, {
          userId: existing._id,
          googleId,
        });
      }
      return { isNewUser: false as const, userId: existing._id };
    }

    return {
      isNewUser: true as const,
      pendingProfile: {
        googleId,
        email,
        name,
      },
    };
  },
});

/** Same shape as `resolveGoogleSignIn`, but only `role === "owner"` accounts qualify. */
export type ResolveOwnerGoogleSignInResult = ResolveGoogleSignInResult;

/**
 * Owner app: verify token, find an **owner** by googleId or email, link googleId when needed,
 * or return `pendingProfile` for in-app registration (TDD §3.2).
 */
export const resolveOwnerGoogleSignIn = action({
  args: { idToken: v.string() },
  handler: async (ctx, { idToken }): Promise<ResolveOwnerGoogleSignInResult> => {
    const { googleId, email, name } = await verifyIdTokenClaims(idToken);

    const existing: Doc<"users"> | null = await ctx.runQuery(
      internal.googleAuth.findExistingGoogleUser,
      {
        googleId,
        email: email ?? undefined,
      },
    );

    if (existing) {
      if (existing.role !== "owner") {
        throw new Error(
          "OWNER_001: This Google account is not registered as an owner account.",
        );
      }
      if (existing.isFrozen) {
        throw new Error("AUTH_002: Account is frozen");
      }
      if (existing.deletionRequestedAt !== undefined) {
        throw new Error("AUTH_006: Account pending deletion");
      }
      if (!existing.googleId) {
        await ctx.runMutation(internal.googleAuth.linkGoogleId, {
          userId: existing._id,
          googleId,
        });
      }
      return { isNewUser: false as const, userId: existing._id };
    }

    return {
      isNewUser: true as const,
      pendingProfile: {
        googleId,
        email,
        name,
      },
    };
  },
});

function throwReg(message: string): never {
  throw new Error(message);
}

/**
 * Step 4: after consent + phone + age + OTP on the client, persist customer + Google link.
 */
export const completeGoogleRegistration = action({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: Id<"users"> }> => {
    if (!args.consentGiven) throwReg("AUTH_005: Consent not given");
    if (args.age < 18) throwReg("AUTH_007: Must be 18 or older");
    return await ctx.runMutation(internal.googleAuth.createGoogleUser, args);
  },
});

/**
 * Owner app: after consent + phone + age on the client, persist `role=owner` + Google link.
 *
 * Does **not** create a Convex Auth JWT session — the client must call
 * `signIn("googleOwner", { idToken })` afterward. Returns `{ userId }` for debugging;
 * the credentials provider resolves the user by `googleId` / `authAccounts` on sign-in.
 */
export const completeOwnerGoogleRegistration = action({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: Id<"users"> }> => {
    if (!args.consentGiven) throwReg("AUTH_005: Consent not given");
    if (args.age < 18) throwReg("AUTH_007: Must be 18 or older");
    return await ctx.runMutation(internal.googleAuth.createOwnerGoogleUser, args);
  },
});
