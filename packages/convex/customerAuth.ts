/**
 * Customer login password (phone + password) helpers.
 * Password authAccounts use providerAccountId = E.164 phone (not email).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";

const PASSWORD_PROVIDER = "password" as const;
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const hasLoginPassword = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const acc = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER),
      )
      .unique();
    return acc !== null;
  },
});

/** True when Profile may offer "Create login password" (voluntary — never shown at owner desk). */
export const canCreateLoginPassword = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "customer") return false;
    if (user.googleId) return false;
    if (user.isFrozen || user.deletionRequestedAt !== undefined) return false;
    const phone = user.phone?.trim();
    if (!phone || !E164_REGEX.test(phone)) return false;
    const acc = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER),
      )
      .unique();
    return acc === null;
  },
});

export const getCustomerForPasswordSetup = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "customer") return null;
    if (user.isFrozen || user.deletionRequestedAt !== undefined) return null;
    if (user.googleId) return null;
    const phone = user.phone?.trim();
    if (!phone || !E164_REGEX.test(phone)) return null;

    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER),
      )
      .unique();

    return {
      phone,
      hasPassword: existing !== null,
    };
  },
});

export const insertCustomerPasswordAccount = internalMutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, { userId, phone, passwordHash }) => {
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER),
      )
      .unique();

    if (existing) {
      if (existing.userId !== userId) {
        throw new Error("PASSWORD_004: Phone login already linked elsewhere");
      }
      await ctx.db.patch(existing._id, {
        providerAccountId: phone,
        secret: passwordHash,
      });
      return { accountId: existing._id as Id<"authAccounts"> };
    }

    const phoneTaken = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", phone),
      )
      .unique();
    if (phoneTaken && phoneTaken.userId !== userId) {
      throw new Error("PASSWORD_004: Phone login already linked elsewhere");
    }

    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: PASSWORD_PROVIDER,
      providerAccountId: phone,
      secret: passwordHash,
    });
    return { accountId };
  },
});
