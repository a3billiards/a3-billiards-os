"use node";

/**
 * WhatsApp OTP send + verify (bcrypt). Rate limit: fixed UTC hour per phone (mutation).
 */

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { parseIndiaE164OrThrow } from "./model/phoneRegistration";

const BCRYPT_ROUNDS = 10;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`DATA_001: Missing ${name}`);
  return val;
}

async function dispatchWhatsAppOtp(phone: string, code: string): Promise<void> {
  const phoneId = requireEnv("WHATSAPP_PHONE_ID");
  const token = requireEnv("WHATSAPP_API_TOKEN");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/^\+/, ""),
        type: "template",
        template: {
          name: "otp_verification",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OTP_004: WhatsApp API error (${res.status})${body ? ` — ${body.slice(0, 200)}` : ""}`,
    );
  }
}

/**
 * Fixed window: max 5 sends per phone per UTC hour (registerOtpSend). Exceed → OTP_003.
 */
export const sendOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone: rawPhone }) => {
    const phone = parseIndiaE164OrThrow(rawPhone);
    const digits = randomInt(100_000, 1_000_000).toString();
    const otpHash = await bcrypt.hash(digits, BCRYPT_ROUNDS);

    const { recordId } = await ctx.runMutation(internal.otp.registerOtpSend, {
      phone,
      otpHash,
    });

    try {
      await dispatchWhatsAppOtp(phone, digits);
    } catch (e) {
      await ctx.runMutation(internal.otp.deleteOtpRecord, { recordId });
      throw e;
    }

    return { success: true as const };
  },
});

/**
 * Per OTP instance: max 3 wrong guesses → invalidate + 5m cooldown → OTP_001.
 * After 10m TTL → OTP_002. Wrong code (attempts 1–2) → OTP_002 (incorrect).
 * New `sendOtp` issues a fresh instance; old cooldown rows do not block the new OTP.
 */
export const verifyOtp = action({
  args: { phone: v.string(), code: v.string() },
  handler: async (ctx, { phone: rawPhone, code }) => {
    const phone = parseIndiaE164OrThrow(rawPhone);
    const normalized = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalized)) {
      throw new Error("OTP_002: OTP is incorrect");
    }

    const now = Date.now();
    const rows = await ctx.runQuery(internal.otp.getRecentOtpsForPhone, {
      phone,
      limit: 24,
    });

    // Newest-first: first match is the current OTP instance.
    const active = rows.find((r) => !r.used && r.expiresAt > now);

    if (!active) {
      if (
        rows.some(
          (r) => r.cooldownUntil !== undefined && r.cooldownUntil > now,
        )
      ) {
        throw new Error(
          "OTP_001: Too many failed OTP attempts — try again after cooldown",
        );
      }
      const hadExpiredUnused = rows.some(
        (r) => !r.used && r.expiresAt <= now,
      );
      if (hadExpiredUnused) {
        throw new Error("OTP_002: OTP has expired");
      }
      throw new Error("OTP_002: OTP is incorrect");
    }

    const match = await bcrypt.compare(normalized, active.otpHash);
    if (match) {
      await ctx.runMutation(internal.otp.markOtpUsed, {
        recordId: active._id,
      });
      return { verified: true as const };
    }

    const bump = await ctx.runMutation(internal.otp.bumpOtpWrongAttempt, {
      recordId: active._id,
    });
    if (bump.outcome === "locked") {
      throw new Error(
        "OTP_001: Too many failed OTP attempts — try again after cooldown",
      );
    }
    throw new Error("OTP_002: OTP is incorrect");
  },
});
