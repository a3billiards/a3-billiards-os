"use node";

/**
 * Google ID token verification (JWKS via google-auth-library).
 * Steps 1–3: verify token, find existing user, return session target or pendingProfile.
 */

import { OAuth2Client } from "google-auth-library";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

function googleAudiences(): string[] {
  const ids = [
    process.env.GOOGLE_IOS_CLIENT_ID,
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
      "DATA_001: Missing Google client ID env (GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID, and/or GOOGLE_WEB_CLIENT_ID)",
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
