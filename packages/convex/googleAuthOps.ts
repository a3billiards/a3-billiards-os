/**
 * Internal DB operations for the Google Sign-In credentials provider
 * (see googleCredentialsProvider.ts). Separated so the provider's
 * authorize callback can invoke them via ctx.runMutation.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function ownerHasPasswordAccount(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string | undefined,
): Promise<boolean> {
  if (email === undefined || email.trim().length === 0) return false;
  const normalized = email.trim().toLowerCase();
  const passwordAccount = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "password").eq("providerAccountId", normalized),
    )
    .unique();
  return passwordAccount !== null && passwordAccount.userId === userId;
}

/** Google-only owner stub from an earlier app sign-in (no club, no password). */
async function isStaleGoogleOnlyOwnerStub(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const row = await ctx.db.get(userId);
  if (row === null || row.role !== "owner") return false;

  const club = await ctx.db
    .query("clubs")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .first();
  if (club !== null) return false;

  const passwordAccount = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "password"),
    )
    .first();

  const googleAccount = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "google"),
    )
    .first();

  return googleAccount !== null && passwordAccount === null;
}

async function deleteUserIfOrphaned(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const row = await ctx.db.get(userId);
  if (row === null) return;

  const club = await ctx.db
    .query("clubs")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .first();
  if (club !== null) return;

  for (const provider of ["google", "password", "phoneOtp"] as const) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", provider),
      )
      .first();
    if (account !== null) return;
  }

  await ctx.db.delete(userId);
}

/** Move a Google link onto the target user; clears stale owner stubs from earlier app sign-ins. */
export async function ensureGoogleLinkedToUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    googleId: string;
    email?: string;
    requireOwnerRole?: boolean;
  },
): Promise<void> {
  const user = await ctx.db.get(args.userId);
  if (user === null) {
    throw new Error("AUTH_001: Not authenticated");
  }

  const webOwnerWithPassword =
    args.requireOwnerRole === true &&
    user.role === "owner" &&
    (await ownerHasPasswordAccount(ctx, args.userId, args.email));

  const googleIdConflict = await ctx.db
    .query("users")
    .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
    .unique();

  if (googleIdConflict !== null && googleIdConflict._id !== args.userId) {
    if (
      webOwnerWithPassword &&
      (await isStaleGoogleOnlyOwnerStub(ctx, googleIdConflict._id))
    ) {
      await ctx.db.patch(googleIdConflict._id, { googleId: undefined });
    } else {
      throw new Error("DATA_002: Google account already linked to another user");
    }
  }

  const existingAccount = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "google").eq("providerAccountId", args.googleId),
    )
    .unique();

  if (existingAccount === null) {
    await ctx.db.insert("authAccounts", {
      userId: args.userId,
      provider: "google",
      providerAccountId: args.googleId,
    });
  } else if (existingAccount.userId !== args.userId) {
    const linkedUser = await ctx.db.get(existingAccount.userId);
    const staleGoogleStub =
      linkedUser !== null &&
      (await isStaleGoogleOnlyOwnerStub(ctx, linkedUser._id));

    if (linkedUser === null) {
      await ctx.db.delete(existingAccount._id);
      await ctx.db.insert("authAccounts", {
        userId: args.userId,
        provider: "google",
        providerAccountId: args.googleId,
      });
    } else if (webOwnerWithPassword && staleGoogleStub) {
      if (linkedUser.googleId === args.googleId) {
        await ctx.db.patch(linkedUser._id, { googleId: undefined });
      }
      await ctx.db.patch(existingAccount._id, { userId: args.userId });
      await deleteUserIfOrphaned(ctx, linkedUser._id);
    } else {
      throw new Error("DATA_002: Google account already linked to another user");
    }
  }

  if (!user.googleId) {
    await ctx.db.patch(args.userId, { googleId: args.googleId });
  }
}

export const linkGoogleIdForUser = internalMutation({
  args: {
    userId: v.id("users"),
    googleId: v.string(),
    email: v.optional(v.string()),
    requireOwnerRole: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureGoogleLinkedToUser(ctx, args);
  },
});

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

    let user = null;

    if (requireOwnerRole === true && email) {
      const normalized = email.trim().toLowerCase();
      const webOwner = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (
        webOwner !== null &&
        webOwner.role === "owner" &&
        (await ownerHasPasswordAccount(ctx, webOwner._id, email))
      ) {
        user = webOwner;
      }
    }

    if (user === null) {
      user = await ctx.db
        .query("users")
        .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
        .unique();
    }

    if (user !== null && requireOwnerRole === true && user.role !== "owner") {
      if (user.role === "admin") {
        throw new Error(
          "ADMIN_001: This account is an admin. Use the Admin app with email and password.",
        );
      }
      throw new Error(
        "OWNER_001: This Google account is not registered as an owner account.",
      );
    }

    if (user === null && email) {
      const normalized = email.trim().toLowerCase();
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (byEmail) {
        if (requireOwnerRole === true && byEmail.role !== "owner") {
          if (byEmail.role === "admin") {
            throw new Error(
              "ADMIN_001: This account is an admin. Use the Admin app with email and password.",
            );
          }
          throw new Error(
            "OWNER_001: This Google account is not registered as an owner account.",
          );
        }
        user = byEmail;
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

    await ensureGoogleLinkedToUser(ctx, {
      userId: user._id,
      googleId,
      email,
      requireOwnerRole,
    });

    return { outcome: "existing" as const, userId: user._id };
  },
});
