/**
 * Internal DB helpers for admin MFA (bcrypt hashes stored in adminMfaCodes.codeHash).
 * Public entrypoints: mfaActions.ts (Node runtime — crypto + Resend).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { checkMfaSendSlidingWindowPerEmail } from "./model/rateLimiter";

export const storeMfaCode = internalMutation({
  args: {
    adminId: v.id("users"),
    codeHash: v.string(),
  },
  handler: async (ctx, { adminId, codeHash }) => {
    const authed = await getAuthUserId(ctx);
    if (authed === null) {
      throw new Error("AUTH_001: Not authenticated");
    }
    if (authed !== adminId) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const user = await ctx.db.get(adminId);
    if (!user || user.role !== "admin") {
      throw new Error("MFA_001: Not an admin");
    }
    if (!user.email) {
      throw new Error("DATA_001: Admin email required for MFA");
    }

    const emailNormalized = user.email.trim().toLowerCase();
    await checkMfaSendSlidingWindowPerEmail(ctx, emailNormalized);

    const existing = await ctx.db
      .query("adminMfaCodes")
      .withIndex("by_admin", (q) => q.eq("adminId", adminId))
      .filter((q) => q.eq(q.field("used"), false))
      .collect();
    for (const c of existing) {
      await ctx.db.patch(c._id, { used: true });
    }

    const now = Date.now();
    await ctx.db.insert("adminMfaCodes", {
      adminId,
      emailNormalized,
      codeHash,
      expiresAt: now + 600_000,
      used: false,
      createdAt: now,
    });

    await ctx.db.patch(adminId, { adminMfaVerifiedAt: undefined });

    return { email: user.email };
  },
});

export const listActiveMfaCandidates = internalQuery({
  args: { adminId: v.id("users") },
  handler: async (ctx, { adminId }) => {
    const now = Date.now();
    return await ctx.db
      .query("adminMfaCodes")
      .withIndex("by_admin", (q) => q.eq("adminId", adminId))
      .filter((q) =>
        q.and(
          q.eq(q.field("used"), false),
          q.gt(q.field("expiresAt"), now),
        ),
      )
      .collect();
  },
});

export const consumeMfaCode = internalMutation({
  args: { recordId: v.id("adminMfaCodes") },
  handler: async (ctx, { recordId }) => {
    const authed = await getAuthUserId(ctx);
    if (authed === null) {
      throw new Error("AUTH_001: Not authenticated");
    }
    const record = await ctx.db.get(recordId);
    if (!record || record.adminId !== authed) {
      throw new Error("AUTH_003: MFA code invalid or expired");
    }
    if (record.used || Date.now() > record.expiresAt) {
      throw new Error("AUTH_003: MFA code invalid or expired");
    }
    await ctx.db.patch(recordId, { used: true });
    await ctx.db.patch(record.adminId, { adminMfaVerifiedAt: Date.now() });
  },
});
