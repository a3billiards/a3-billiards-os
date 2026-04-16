"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const BCRYPT_ROUNDS = 10;

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

    await ctx.runAction(internal.notificationsFcm.sendMfaEmail, {
      email,
      code: digits,
    });

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
