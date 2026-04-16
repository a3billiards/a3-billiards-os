/**
 * WhatsApp OTP: sliding-window dispatch limits, bcrypt codes, verify + optional phoneVerified.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { throwIfPhoneUnavailableForNewAccount } from "./model/phoneRegistration";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function randomSixDigitString(): string {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error("DATA_001: Secure random unavailable");
  }
  const buf = new Uint32Array(1);
  c.getRandomValues(buf);
  const n = 100_000 + (buf[0]! % 900_000);
  return String(n);
}

export const findUserByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
  },
});

export const countRecentDispatches = internalMutation({
  args: {
    phone: v.string(),
    windowMs: v.number(),
  },
  handler: async (ctx, { phone, windowMs }) => {
    // TODO: periodic cleanup of old otpRecords to prevent table bloat — could be added to the daily fcmCleanup cron.
    const since = Date.now() - windowMs;
    const records = await ctx.db
      .query("otpRecords")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .filter((q) => q.gte(q.field("createdAt"), since))
      .collect();
    return records.length;
  },
});

export const storeOtpRecord = internalMutation({
  args: {
    phone: v.string(),
    otpHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { phone, otpHash, expiresAt }) => {
    const recordId = await ctx.db.insert("otpRecords", {
      phone,
      otpHash,
      attempts: 0,
      expiresAt,
      used: false,
      createdAt: Date.now(),
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

export const attemptVerify = internalMutation({
  args: {
    phone: v.string(),
    code: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { phone, code, userId }) => {
    const now = Date.now();

    const rows = await ctx.db
      .query("otpRecords")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .filter((q) => q.eq(q.field("used"), false))
      .collect();

    const active = rows
      .filter((r) => r.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!active) {
      throw new Error(
        "OTP_002: OTP expired or not found. Please request a new code.",
      );
    }

    if (active.cooldownUntil !== undefined && now < active.cooldownUntil) {
      const waitMs = active.cooldownUntil - now;
      const waitMins = Math.ceil(waitMs / 60_000);
      throw new Error(
        `OTP_001: Too many failed attempts. Please wait ${waitMins} minute(s) before trying again.`,
      );
    }

    const bcrypt = await import("bcryptjs");
    const isValid = await bcrypt.compare(code, active.otpHash);

    if (!isValid) {
      const newAttempts = active.attempts + 1;

      if (newAttempts >= 3) {
        await ctx.db.patch(active._id, {
          attempts: newAttempts,
          cooldownUntil: now + 5 * 60 * 1000,
        });
        throw new Error(
          "OTP_001: Too many failed attempts. Please wait 5 minutes before trying again.",
        );
      }

      await ctx.db.patch(active._id, { attempts: newAttempts });
      const remaining = 3 - newAttempts;
      throw new Error(
        `Incorrect code. ${remaining} attempt(s) remaining.`,
      );
    }

    await ctx.db.patch(active._id, { used: true });

    if (userId !== undefined) {
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new Error("DATA_003: User not found");
      }
      if (user.phone !== undefined && user.phone !== phone) {
        throw new Error(
          "PERM_001: Phone does not match this account for verification",
        );
      }
      await ctx.db.patch(userId, { phoneVerified: true });
    }

    return { verified: true as const, phone };
  },
});

export const sendOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    if (!E164_REGEX.test(phone)) {
      throw new Error("OTP_005: Invalid E.164 phone number format");
    }

    const existing = await ctx.runQuery(internal.otp.findUserByPhone, {
      phone,
    });
    throwIfPhoneUnavailableForNewAccount(existing);

    const count = await ctx.runMutation(internal.otp.countRecentDispatches, {
      phone,
      windowMs: 60 * 60 * 1000,
    });
    if (count >= 5) {
      throw new Error(
        "OTP_003: Too many OTP requests. Please wait before requesting another code.",
      );
    }

    const bcrypt = await import("bcryptjs");
    const rawCode = randomSixDigitString();
    const otpHash = await bcrypt.hash(rawCode, 10);
    const now = Date.now();

    const { recordId } = await ctx.runMutation(internal.otp.storeOtpRecord, {
      phone,
      otpHash,
      expiresAt: now + 10 * 60 * 1000,
    });

    try {
      const { dispatchWhatsAppOtp } = await import("./model/otp");
      await dispatchWhatsAppOtp(phone, rawCode);
    } catch (e) {
      await ctx.runMutation(internal.otp.deleteOtpRecord, { recordId });
      throw e;
    }

    return { sent: true as const };
  },
});

export const verifyOtp = action({
  args: {
    phone: v.string(),
    code: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (
    ctx,
    { phone, code, userId },
  ): Promise<{ verified: true; phone: string }> => {
    if (!E164_REGEX.test(phone)) {
      throw new Error("OTP_005: Invalid E.164 phone number format");
    }
    const normalized = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalized)) {
      throw new Error(
        "OTP_002: Please enter the 6-digit code sent to your phone.",
      );
    }

    return await ctx.runMutation(internal.otp.attemptVerify, {
      phone,
      code: normalized,
      userId,
    });
  },
});
