/**
 * OTP records: fixed-window send limits (see model/rateLimiter), verify via otpActions (bcrypt).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { checkOtpSendFixedWindowUtcHour } from "./model/rateLimiter";

const OTP_TTL_MS = 600_000; // 10 minutes
const COOLDOWN_MS = 300_000; // 5 minutes after 3 wrong attempts

export const registerOtpSend = internalMutation({
  args: {
    phone: v.string(),
    otpHash: v.string(),
  },
  handler: async (ctx, { phone, otpHash }) => {
    const now = Date.now();
    await checkOtpSendFixedWindowUtcHour(ctx, phone, now);

    const rows = await ctx.db
      .query("otpRecords")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .collect();

    for (const r of rows) {
      if (!r.used && r.expiresAt > now) {
        await ctx.db.patch(r._id, { used: true });
      }
    }

    const recordId = await ctx.db.insert("otpRecords", {
      phone,
      otpHash,
      attempts: 0,
      expiresAt: now + OTP_TTL_MS,
      used: false,
      createdAt: now,
    });

    return { recordId };
  },
});

export const deleteOtpRecord = internalMutation({
  args: { recordId: v.id("otpRecords") },
  handler: async (ctx, { recordId }) => {
    await ctx.db.delete(recordId);
  },
});

export const getRecentOtpsForPhone = internalQuery({
  args: { phone: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { phone, limit = 24 }) => {
    return await ctx.db
      .query("otpRecords")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .order("desc")
      .take(limit);
  },
});

export const bumpOtpWrongAttempt = internalMutation({
  args: { recordId: v.id("otpRecords") },
  handler: async (ctx, { recordId }) => {
    const r = await ctx.db.get(recordId);
    if (!r || r.used) {
      return { outcome: "noop" as const };
    }

    const next = r.attempts + 1;
    if (next >= 3) {
      await ctx.db.patch(recordId, {
        attempts: next,
        used: true,
        cooldownUntil: Date.now() + COOLDOWN_MS,
      });
      return { outcome: "locked" as const };
    }

    await ctx.db.patch(recordId, { attempts: next });
    return { outcome: "retry" as const };
  },
});

export const markOtpUsed = internalMutation({
  args: { recordId: v.id("otpRecords") },
  handler: async (ctx, { recordId }) => {
    const r = await ctx.db.get(recordId);
    if (!r) {
      throw new Error("OTP_002: OTP has expired");
    }
    if (r.used || Date.now() > r.expiresAt) {
      throw new Error("OTP_002: OTP has expired");
    }
    await ctx.db.patch(recordId, { used: true });
  },
});
