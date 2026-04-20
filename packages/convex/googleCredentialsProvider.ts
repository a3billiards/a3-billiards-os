/**
 * Google Sign-In credentials provider for Convex Auth.
 *
 * The React Native app calls `signIn("google", { idToken })` after the native
 * Google Sign-In library returns an ID token. This provider:
 *   1. Verifies the ID token against Google's JWKS (via google-auth-library
 *      in a Node action — see googleAuthActions.ts).
 *   2. Looks up the matching user by googleId, falling back to email.
 *   3. Inserts an `authAccounts` row binding provider="google" to the user
 *      so Convex Auth can attach a session.
 *   4. Returns `{ userId }` — Convex Auth handles session creation.
 *
 * Throws:
 *   - GOOGLE_AUTH_001   — idToken missing or signature/audience invalid
 *   - GOOGLE_AUTH_NEW_USER — no matching account (client should route to register)
 *   - AUTH_002          — user account frozen
 *   - AUTH_006          — user account pending deletion
 */

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export function A3Google() {
  return ConvexCredentials({
    id: "google",
    authorize: async (params, ctx) => {
      const idToken = params.idToken;
      if (typeof idToken !== "string" || idToken.length === 0) {
        throw new Error("GOOGLE_AUTH_001: Missing idToken");
      }

      const claims = await ctx.runAction(
        internal.googleAuthActions.verifyGoogleTokenInternal,
        { idToken },
      );

      const { userId } = await ctx.runMutation(
        internal.googleAuthOps.resolveOrLinkGoogleUser,
        {
          googleId: claims.googleId,
          email: claims.email ?? undefined,
        },
      );

      return { userId: userId as Id<"users"> };
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
