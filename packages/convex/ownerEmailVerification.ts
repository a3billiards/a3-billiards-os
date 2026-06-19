/**
 * Owner onboarding email verification — internal DB helpers.
 * Public entrypoints: ownerEmailVerificationActions.ts (Node — bcrypt + Resend).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { checkOwnerEmailVerificationSendSlidingWindowPerEmail } from "./model/rateLimiter";

const PASSWORD_PROVIDER = "password" as const;

export const getOwnerPasswordAccountByEmail = internalQuery({
  args: { emailNormalized: v.string() },
  handler: async (ctx, { emailNormalized }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailNormalized))
      .unique();
    if (!user || user.role !== "owner") {
      return null;
    }

    const passwordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", emailNormalized),
      )
      .unique();

    if (!passwordAccount || passwordAccount.userId !== user._id) {
      return null;
    }

    return {
      ownerId: user._id,
      email: user.email ?? emailNormalized,
      passwordAccountId: passwordAccount._id,
      emailVerified: Boolean(passwordAccount.emailVerified),
    };
  },
});

export const isOwnerEmailVerified = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const user = await ctx.db.get(ownerId);
    if (!user || user.role !== "owner" || !user.email) {
      return false;
    }

    const emailNormalized = user.email.trim().toLowerCase();
    const passwordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", emailNormalized),
      )
      .unique();

    if (!passwordAccount || passwordAccount.userId !== ownerId) {
      return false;
    }

    return Boolean(passwordAccount.emailVerified);
  },
});

export const storeOwnerEmailVerificationCode = internalMutation({
  args: {
    ownerId: v.id("users"),
    emailNormalized: v.string(),
    codeHash: v.string(),
  },
  handler: async (ctx, { ownerId, emailNormalized, codeHash }) => {
    const user = await ctx.db.get(ownerId);
    if (!user || user.role !== "owner") {
      throw new Error("PERM_001: Owner account required");
    }
    if ((user.email ?? "").trim().toLowerCase() !== emailNormalized) {
      throw new Error("DATA_001: Email does not match owner account");
    }

    await checkOwnerEmailVerificationSendSlidingWindowPerEmail(ctx, emailNormalized);

    const existing = await ctx.db
      .query("ownerEmailVerificationCodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) => q.eq(q.field("used"), false))
      .collect();
    for (const row of existing) {
      await ctx.db.patch(row._id, { used: true });
    }

    const now = Date.now();
    await ctx.db.insert("ownerEmailVerificationCodes", {
      ownerId,
      emailNormalized,
      codeHash,
      expiresAt: now + 600_000,
      used: false,
      createdAt: now,
    });

    return { email: user.email ?? emailNormalized };
  },
});

export const listActiveOwnerEmailVerificationCandidates = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const now = Date.now();
    return await ctx.db
      .query("ownerEmailVerificationCodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) =>
        q.and(
          q.eq(q.field("used"), false),
          q.gt(q.field("expiresAt"), now),
        ),
      )
      .collect();
  },
});

export const markOwnerEmailVerified = internalMutation({
  args: {
    ownerId: v.id("users"),
    recordId: v.id("ownerEmailVerificationCodes"),
    passwordAccountId: v.id("authAccounts"),
    emailNormalized: v.string(),
  },
  handler: async (
    ctx,
    { ownerId, recordId, passwordAccountId, emailNormalized },
  ) => {
    const record = await ctx.db.get(recordId);
    if (!record || record.ownerId !== ownerId) {
      throw new Error("AUTH_009: Verification code invalid or expired");
    }
    if (record.used || Date.now() > record.expiresAt) {
      throw new Error("AUTH_009: Verification code invalid or expired");
    }

    await ctx.db.patch(recordId, { used: true });
    await ctx.db.patch(passwordAccountId, { emailVerified: emailNormalized });
  },
});

export const clearOwnerEmailVerification = internalMutation({
  args: { ownerId: v.id("users"), passwordAccountId: v.id("authAccounts") },
  handler: async (ctx, { ownerId, passwordAccountId }) => {
    const existing = await ctx.db
      .query("ownerEmailVerificationCodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) => q.eq(q.field("used"), false))
      .collect();
    for (const row of existing) {
      await ctx.db.patch(row._id, { used: true });
    }
    await ctx.db.patch(passwordAccountId, { emailVerified: undefined });
  },
});
