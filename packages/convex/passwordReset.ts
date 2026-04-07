/**
 * Internal helpers for account password reset (email link + completion token).
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

const HOUR_MS = 3_600_000;
const MAX_RESET_REQUESTS_PER_HOUR = 3;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const getUserForPasswordReset = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!user) return null;
    const acc = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "password"),
      )
      .unique();
    if (!acc) return null;
    return { userId: user._id, providerAccountId: acc.providerAccountId };
  },
});

export const insertPasswordResetToken = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
  },
  handler: async (ctx, { userId, tokenHash }) => {
    const cutoff = Date.now() - HOUR_MS;
    const rows = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const recent = rows.filter((r) => r.createdAt >= cutoff);
    if (recent.length >= MAX_RESET_REQUESTS_PER_HOUR) {
      throw new Error("RATE_001: Password reset rate limit exceeded");
    }

    const now = Date.now();
    await ctx.db.insert("passwordResetTokens", {
      userId,
      tokenHash,
      type: "accountPassword",
      expiresAt: now + HOUR_MS,
      used: false,
      createdAt: now,
    });
  },
});

export const getMainResetTokenByHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    return await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
  },
});

export const transitionMainTokenToContinuation = internalMutation({
  args: {
    mainTokenId: v.id("passwordResetTokens"),
    continuationTokenHash: v.string(),
  },
  handler: async (ctx, { mainTokenId, continuationTokenHash }) => {
    const main = await ctx.db.get(mainTokenId);
    if (!main) {
      throw new Error("PASSWORD_001: Invalid reset token");
    }
    if (main.type !== "accountPassword") {
      throw new Error("PASSWORD_001: Invalid reset token");
    }
    if (main.used) {
      throw new Error("PASSWORD_001: Invalid reset token");
    }
    if (Date.now() > main.expiresAt) {
      await ctx.db.delete(mainTokenId);
      throw new Error("PASSWORD_001: Invalid reset token");
    }

    await ctx.db.delete(mainTokenId);

    const now = Date.now();
    await ctx.db.insert("passwordResetContinuations", {
      userId: main.userId,
      tokenHash: continuationTokenHash,
      expiresAt: now + 15 * 60_000,
      createdAt: now,
    });
  },
});

export const consumeContinuation = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const row = await ctx.db
      .query("passwordResetContinuations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!row) {
      throw new Error("PASSWORD_001: Invalid reset token");
    }
    if (Date.now() > row.expiresAt) {
      await ctx.db.delete(row._id);
      throw new Error("PASSWORD_001: Invalid reset token");
    }
    await ctx.db.delete(row._id);
    return { userId: row.userId as Id<"users"> };
  },
});

export const getPasswordProviderAccountId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const acc = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password"),
      )
      .unique();
    return acc?.providerAccountId ?? null;
  },
});
