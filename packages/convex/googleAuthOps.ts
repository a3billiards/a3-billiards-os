/**
 * Internal DB operations for the Google Sign-In credentials provider
 * (see googleCredentialsProvider.ts). Separated so the provider's
 * authorize callback can invoke them via ctx.runMutation.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type ResolveOrLinkGoogleUserResult =
  | { outcome: "existing"; userId: Id<"users"> }
  | {
      outcome: "newUser";
      pendingProfile: {
        googleId: string;
        email: string | null;
        name: string;
      };
    };

/**
 * Given verified Google claims, either:
 * - return `{ outcome: "existing", userId }` and ensure `authAccounts` has a google row, or
 * - return `{ outcome: "newUser", pendingProfile }` when no matching account exists (client routes to registration).
 *
 * When `requireOwnerRole` is true (Owner app `googleOwner` provider), non-owner accounts
 * never receive a Google link; `OWNER_001` is thrown instead.
 */
export const resolveOrLinkGoogleUser = internalMutation({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    requireOwnerRole: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { googleId, email, name, requireOwnerRole },
  ): Promise<ResolveOrLinkGoogleUserResult> => {
    const displayName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : "Google User";

    let user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .unique();

    if (user !== null && requireOwnerRole === true && user.role !== "owner") {
      throw new Error(
        "OWNER_001: This Google account is not registered as an owner account.",
      );
    }

    if (!user && email) {
      const normalized = email.trim().toLowerCase();
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (byEmail) {
        if (requireOwnerRole === true && byEmail.role !== "owner") {
          throw new Error(
            "OWNER_001: This Google account is not registered as an owner account.",
          );
        }
        user = byEmail;
        if (!byEmail.googleId) {
          await ctx.db.patch(byEmail._id, { googleId });
        }
      }
    }

    if (!user) {
      return {
        outcome: "newUser" as const,
        pendingProfile: {
          googleId,
          email: email ?? null,
          name: displayName,
        },
      };
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

    return { outcome: "existing" as const, userId: user._id };
  },
});
