/**
 * Public actions + internal helpers supporting the phoneOtp credential provider.
 *
 * - sendLoginOtp:   issues a WhatsApp OTP for an EXISTING phone account (login).
 * - sendSignupOtp:  issues a WhatsApp OTP for a NEW phone (signup, must not be taken).
 * - findAccountByPhone (internal): used by the phoneOtp provider to determine
 *   whether the phone already has an authAccount row.
 */

import bcrypt from "bcryptjs";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { dispatchWhatsAppOtp } from "./model/otp";
import { throwIfPhoneUnavailableForNewAccount } from "./model/phoneRegistration";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const OTP_RATE_LIMIT_WINDOW_MS = Number(
  process.env.OTP_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000,
);
const OTP_RATE_LIMIT_MAX_PER_WINDOW = Number(
  process.env.OTP_RATE_LIMIT_MAX_PER_WINDOW ?? 5,
);

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

export const findAccountByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    return await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "phoneOtp").eq("providerAccountId", phone),
      )
      .unique();
  },
});

/** Sends an OTP for SIGN-IN to an existing phone account. */
export const sendLoginOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    if (!E164_REGEX.test(phone)) {
      throw new Error("OTP_005: Invalid E.164 phone number format");
    }

    const user = await ctx.runQuery(internal.otp.findUserByPhone, { phone });
    if (!user) {
      throw new Error(
        "AUTH_009: No account found for this phone. Please sign up first.",
      );
    }
    if (user.isFrozen) {
      throw new Error("AUTH_002: Account is frozen");
    }
    if (user.deletionRequestedAt !== undefined) {
      throw new Error("AUTH_006: Account pending deletion");
    }

    const count = await ctx.runMutation(internal.otp.countRecentDispatches, {
      phone,
      windowMs: OTP_RATE_LIMIT_WINDOW_MS,
    });
    if (count >= OTP_RATE_LIMIT_MAX_PER_WINDOW) {
      throw new Error(
        "OTP_003: Too many OTP requests. Please wait before requesting another code.",
      );
    }

    const rawCode = randomSixDigitString();
    const otpHash = bcrypt.hashSync(rawCode, 10);
    const { recordId } = await ctx.runMutation(internal.otp.storeOtpRecord, {
      phone,
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    try {
      await dispatchWhatsAppOtp(phone, rawCode);
    } catch (e) {
      await ctx.runMutation(internal.otp.deleteOtpRecord, { recordId });
      throw e;
    }

    return { sent: true as const };
  },
});

/** Sends an OTP for SIGN-UP to a phone that is NOT registered yet. */
export const sendSignupOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    if (!E164_REGEX.test(phone)) {
      throw new Error("OTP_005: Invalid E.164 phone number format");
    }

    const existing = await ctx.runQuery(internal.otp.findUserByPhone, { phone });
    throwIfPhoneUnavailableForNewAccount(existing);

    const count = await ctx.runMutation(internal.otp.countRecentDispatches, {
      phone,
      windowMs: OTP_RATE_LIMIT_WINDOW_MS,
    });
    if (count >= OTP_RATE_LIMIT_MAX_PER_WINDOW) {
      throw new Error(
        "OTP_003: Too many OTP requests. Please wait before requesting another code.",
      );
    }

    const rawCode = randomSixDigitString();
    const otpHash = bcrypt.hashSync(rawCode, 10);
    const { recordId } = await ctx.runMutation(internal.otp.storeOtpRecord, {
      phone,
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    try {
      await dispatchWhatsAppOtp(phone, rawCode);
    } catch (e) {
      await ctx.runMutation(internal.otp.deleteOtpRecord, { recordId });
      throw e;
    }

    return { sent: true as const };
  },
});
