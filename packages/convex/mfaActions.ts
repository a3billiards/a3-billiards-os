"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const BCRYPT_ROUNDS = 10;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`DATA_001: Missing ${name}`);
  return v;
}

/**
 * Admin-only MFA send: bcrypt hash + 10m expiry (mutation), Resend email,
 * sliding window 5 sends per email per rolling hour (RATE_001).
 */
export const generateMfaCode = action({
  args: {},
  handler: async (ctx) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const digits = randomInt(100_000, 1_000_000).toString();
    const codeHash = await bcrypt.hash(digits, BCRYPT_ROUNDS);

    const { email } = await ctx.runMutation(internal.mfa.storeMfaCode, {
      adminId,
      codeHash,
    });

    const resend = new Resend(requireEnv("RESEND_API_KEY"));
    const from =
      process.env.RESEND_FROM ?? "A3 Billiards <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Your A3 Billiards admin verification code",
      text: `Your verification code is ${digits}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    });
    if (error) {
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      throw new Error(`EMAIL_001: ${msg}`);
    }

    return { success: true as const };
  },
});

/**
 * Verifies MFA code (bcrypt) and marks the record used. AUTH_003 if wrong or expired.
 */
export const verifyMfaCode = action({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const normalized = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalized)) {
      throw new Error("AUTH_003: MFA code invalid or expired");
    }

    const candidates = await ctx.runQuery(
      internal.mfa.listActiveMfaCandidates,
      { adminId },
    );

    for (const row of candidates) {
      const match = await bcrypt.compare(normalized, row.codeHash);
      if (match) {
        await ctx.runMutation(internal.mfa.consumeMfaCode, {
          recordId: row._id,
        });
        return { mfaVerified: true as const };
      }
    }

    throw new Error("AUTH_003: MFA code invalid or expired");
  },
});
