/**
 * Pool-side customer registration: owner verifies a new customer's phone via WhatsApp OTP,
 * then creates a customer `users` row (no Convex Auth credentials yet — customer can link
 * Google / email later; desk row is for verified identity at the club).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { parseIndiaE164OrThrow, throwIfPhoneUnavailableForNewAccount } from "./model/phoneRegistration";

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

/**
 * Owner-only: send WhatsApp OTP to register a **new** customer phone at the desk.
 * Rejects if the number is already on an active account (same rules as customer signup).
 */
export const ownerSendDeskCustomerRegistrationOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const authId = await getAuthUserId(ctx);
    if (authId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const gate = await ctx.runQuery(
      internal.ownerDeskCustomerMutations.assertOwnerHasClub,
      { userId: authId },
    );
    if (!gate.ok) {
      throw new Error(
        gate.reason === "not_owner"
          ? "PERM_001: Only club owners can register customers at the desk"
          : gate.reason === "no_club"
            ? "AUTH_008: No club found for owner account"
            : "AUTH_002: Account is not eligible",
      );
    }

    if (!E164_REGEX.test(phone)) {
      throw new Error("OTP_005: Invalid E.164 phone number format");
    }
    const normalized = parseIndiaE164OrThrow(phone);

    const existing = await ctx.runQuery(internal.otp.findUserByPhone, {
      phone: normalized,
    });
    throwIfPhoneUnavailableForNewAccount(existing);

    const count = await ctx.runMutation(internal.otp.countRecentDispatches, {
      phone: normalized,
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
      phone: normalized,
      otpHash,
      expiresAt: now + 10 * 60 * 1000,
    });

    try {
      const { dispatchWhatsAppOtp } = await import("./model/otp");
      await dispatchWhatsAppOtp(normalized, rawCode);
    } catch (e) {
      await ctx.runMutation(internal.otp.deleteOtpRecord, { recordId });
      throw e;
    }

    return { sent: true as const };
  },
});

/**
 * Owner-only: verify OTP and create the customer profile (phone verified).
 */
export const ownerCompleteDeskCustomerRegistration = action({
  args: {
    phone: v.string(),
    code: v.string(),
    name: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> }> => {
    const authId = await getAuthUserId(ctx);
    if (authId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const gate = await ctx.runQuery(
      internal.ownerDeskCustomerMutations.assertOwnerHasClub,
      { userId: authId },
    );
    if (!gate.ok) {
      throw new Error(
        gate.reason === "not_owner"
          ? "PERM_001: Only club owners can register customers at the desk"
          : gate.reason === "no_club"
            ? "AUTH_008: No club found for owner account"
            : "AUTH_002: Account is not eligible",
      );
    }

    const normalized = parseIndiaE164OrThrow(args.phone);
    const normalizedCode = args.code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error(
        "OTP_002: Please enter the 6-digit code sent to the customer's phone.",
      );
    }

    await ctx.runMutation(internal.otp.attemptVerify, {
      phone: normalized,
      code: normalizedCode,
      userId: undefined,
    });

    return await ctx.runMutation(
      internal.ownerDeskCustomerMutations.insertDeskRegisteredCustomer,
      {
        phone: normalized,
        name: args.name,
        age: args.age,
        consentGiven: args.consentGiven,
      },
    );
  },
});
