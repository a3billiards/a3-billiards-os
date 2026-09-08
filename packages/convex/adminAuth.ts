/**
 * Admin login prerequisites: password authAccounts must use normalized email as
 * providerAccountId (same as onboarding web). Google-only owners cannot use the
 * admin app until a password account exists.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const PASSWORD_PROVIDER = "password" as const;

type AuthCtx = QueryCtx | MutationCtx;

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function passwordAccountForEmail(ctx: AuthCtx, emailNormalized: string) {
  return await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", emailNormalized),
    )
    .unique();
}

export const findUserByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizeAdminEmail(email)))
      .unique();
  },
});

export const insertPasswordAccountForUser = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, { userId, email, passwordHash }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("DATA_003: User not found");
    }

    const normalized = normalizeAdminEmail(email);
    if (user.email !== normalized) {
      await ctx.db.patch(userId, { email: normalized });
    }

    const existing = await passwordAccountForEmail(ctx, normalized);
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error(
          "DATA_002: Password login for this email is linked to a different user account",
        );
      }
      await ctx.db.patch(existing._id, { secret: passwordHash });
      return { created: false as const };
    }

    await ctx.db.insert("authAccounts", {
      userId,
      provider: PASSWORD_PROVIDER,
      providerAccountId: normalized,
      secret: passwordHash,
    });
    return { created: true as const };
  },
});

export const getPasswordAccountForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await passwordAccountForEmail(ctx, normalizeAdminEmail(email));
  },
});

export const getUserEmailForPassword = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user?.email) return null;
    return normalizeAdminEmail(user.email);
  },
});

/** Validates owner can become admin (email + password auth linked to same user). */
export const assertOwnerReadyForAdminPromotion = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("DATA_003: User not found");
    }
    if (!user.email || user.email.trim().length === 0) {
      throw new Error(
        "PROMOTE_003: Owner must have an email address before promotion to admin",
      );
    }

    const normalized = normalizeAdminEmail(user.email);
    if (user.email !== normalized) {
      await ctx.db.patch(userId, { email: normalized });
    }

    const passwordAcc = await passwordAccountForEmail(ctx, normalized);
    if (!passwordAcc) {
      throw new Error(
        "PROMOTE_003: Owner must have email+password login before promotion. Complete onboarding web registration or set a password first.",
      );
    }
    if (passwordAcc.userId !== userId) {
      throw new Error(
        "DATA_002: Password login for this email is linked to a different user account",
      );
    }

    await ctx.db.patch(userId, { adminMfaVerifiedAt: undefined });
  },
});

export type AdminPasswordCheck =
  | { ok: true; userId: Id<"users">; user: Doc<"users"> }
  | { ok: false; reason: "no_user" | "not_admin" | "no_password_account" | "wrong_user_link" };

export const diagnoseAdminPasswordLogin = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<AdminPasswordCheck> => {
    const normalized = normalizeAdminEmail(email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!user) return { ok: false, reason: "no_user" };
    if (user.role !== "admin") return { ok: false, reason: "not_admin" };

    const passwordAcc = await passwordAccountForEmail(ctx, normalized);
    if (!passwordAcc) return { ok: false, reason: "no_password_account" };
    if (passwordAcc.userId !== user._id) {
      return { ok: false, reason: "wrong_user_link" };
    }

    return { ok: true, userId: user._id, user };
  },
});
