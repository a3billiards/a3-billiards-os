/**
 * One-shot seed actions. Run with:
 *   npx convex run seed:seedOwnerUser '{"email":"...","password":"...","name":"..."}'
 *
 * These are internal actions — not exposed to the client.
 */

import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const patchUserRole = internalMutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("owner"), v.literal("customer")) },
  handler: async (ctx, { userId, role }) => {
    await ctx.db.patch(userId, { role });
  },
});

/**
 * Creates (or idempotently returns) an owner user with email+password auth.
 *
 * Usage:
 *   npx convex run seed:seedOwnerUser '{"email":"owner@example.com","password":"mypassword","name":"Owner"}'
 */
export const seedOwnerUser = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (
    ctx,
    { email, password, name },
  ): Promise<{
    status: "created" | "already_exists" | "role_upgraded";
    userId: Id<"users">;
    email: string;
  }> => {
    const normalized = email.trim().toLowerCase();

    const existing = await ctx.runQuery(internal.seed.findUserByEmail, { email: normalized });
    if (existing) {
      if (existing.role !== "owner") {
        await ctx.runMutation(internal.seed.patchUserRole, {
          userId: existing._id,
          role: "owner",
        });
        return { status: "role_upgraded", userId: existing._id, email: normalized };
      }
      return { status: "already_exists", userId: existing._id, email: normalized };
    }

    const now = Date.now();
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: normalized, secret: password },
      profile: {
        email: normalized,
        name: name.trim(),
        age: 18,
        phoneVerified: false,
        role: "owner",
        isFrozen: false,
        settingsPasscodeSet: false,
        complaints: [],
        fcmTokens: [],
        consentGiven: true,
        consentGivenAt: now,
        createdAt: now,
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    return { status: "created", userId: user._id, email: normalized };
  },
});
