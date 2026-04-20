/**
 * Internal DB operations for the Google Sign-In credentials provider
 * (see googleCredentialsProvider.ts). Separated so the provider's
 * authorize callback can invoke them via ctx.runMutation.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Given verified Google claims, return the userId for an existing account or
 * throw GOOGLE_AUTH_NEW_USER. When matched by email, we link the googleId
 * onto the user and insert an `authAccounts` row so Convex Auth can attach
 * a session to this provider.
 */
export const resolveOrLinkGoogleUser = internalMutation({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { googleId, email }) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .unique();

    if (!user && email) {
      const normalized = email.trim().toLowerCase();
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (byEmail) {
        user = byEmail;
        if (!byEmail.googleId) {
          await ctx.db.patch(byEmail._id, { googleId });
        }
      }
    }

    if (!user) {
      throw new Error("GOOGLE_AUTH_NEW_USER: No account found for this Google user");
    }
    if (user.isFrozen) {
      throw new Error("AUTH_002: Account is frozen");
    }
    if (user.deletionRequestedAt !== undefined) {
      throw new Error("AUTH_006: Account pending deletion");
    }

    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "google").eq("providerAccountId", googleId),
      )
      .unique();

    if (!existingAccount) {
      await ctx.db.insert("authAccounts", {
        userId: user._id,
        provider: "google",
        providerAccountId: googleId,
      });
    } else if (existingAccount.userId !== user._id) {
      throw new Error("DATA_002: Google account already linked to another user");
    }

    return { userId: user._id };
  },
});
