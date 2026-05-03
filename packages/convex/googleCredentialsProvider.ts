/**
 * Google Sign-In credentials provider for Convex Auth.
 *
 * The React Native app calls `signIn("google", { idToken })` or
 * `signIn("googleOwner", { idToken })` after the native Google Sign-In library
 * returns an ID token. This provider:
 *   1. Verifies the ID token against Google's JWKS (via google-auth-library
 *      in a Node action — see googleAuthActions.ts).
 *   2. Looks up the matching user by googleId, falling back to email.
 *   3. Inserts an `authAccounts` row binding provider="google" to the user
 *      so Convex Auth can attach a session.
 *   4. Returns `{ userId }` — Convex Auth handles session creation.
 *
 * If no user exists, returns `newUser` from the internal mutation and this
 * layer throws `GOOGLE_AUTH_NEW_USER` with JSON payload (clients that probe
 * first should never hit this for new users).
 *
 * Throws:
 *   - GOOGLE_AUTH_001   — idToken missing or signature/audience invalid
 *   - GOOGLE_AUTH_NEW_USER — no matching account (legacy; prefer resolve* actions first)
 *   - OWNER_001         — Google account exists but is not an owner (googleOwner only)
 *   - AUTH_002          — user account frozen
 *   - AUTH_006          — user account pending deletion
 */

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function createA3GoogleProvider(options: {
  providerId: "google" | "googleOwner";
  requireOwnerRole: boolean;
}) {
  return ConvexCredentials({
    id: options.providerId,
    authorize: async (params, ctx) => {
      const idToken = params.idToken;
      if (typeof idToken !== "string" || idToken.length === 0) {
        throw new Error("GOOGLE_AUTH_001: Missing idToken");
      }

      const claims = await ctx.runAction(
        internal.googleAuthActions.verifyGoogleTokenInternal,
        { idToken },
      );

      const result = await ctx.runMutation(
        internal.googleAuthOps.resolveOrLinkGoogleUser,
        {
          googleId: claims.googleId,
          email: claims.email ?? undefined,
          name: claims.name,
          requireOwnerRole: options.requireOwnerRole,
        },
      );

      if (result.outcome === "newUser") {
        throw new Error(
          `GOOGLE_AUTH_NEW_USER: ${JSON.stringify(result.pendingProfile)}`,
        );
      }

      return { userId: result.userId as Id<"users"> };
    },
    crypto: {
      async hashSecret() {
        return "";
      },
      async verifySecret() {
        return true;
      },
    },
  });
}

/** Customer app + generic Google sign-in (`signIn("google", …)`). */
export function A3Google() {
  return createA3GoogleProvider({
    providerId: "google",
    requireOwnerRole: false,
  });
}

/** Owner app only (`signIn("googleOwner", …)`). Rejects non-owner Google accounts. */
export function A3GoogleOwner() {
  return createA3GoogleProvider({
    providerId: "googleOwner",
    requireOwnerRole: true,
  });
}
