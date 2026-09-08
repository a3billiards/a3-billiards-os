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
  args: { forceResend: v.optional(v.boolean()) },
  handler: async (ctx, { forceResend }) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const user = await ctx.runQuery(internal.deletion.getUserById, {
      userId: adminId,
    });
    if (!user || user.role !== "admin") {
      throw new Error("MFA_001: Not an admin");
    }
    if (user.adminMfaVerifiedAt) {
      return { success: true as const, alreadyVerified: true as const };
    }

    if (forceResend !== true) {
      const hasActive = await ctx.runQuery(internal.mfa.hasActiveMfaCode, {
        adminId,
      });
      if (hasActive) {
        return { success: true as const, reusedExisting: true as const };
      }
    }

    const digits = randomInt(100_000, 1_000_000).toString();
    const codeHash = await bcrypt.hash(digits, BCRYPT_ROUNDS);

    let email: string;
    try {
      ({ email } = await ctx.runMutation(internal.mfa.storeMfaCode, {
        adminId,
        codeHash,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("RATE_001")) {
        const stillActive = await ctx.runQuery(internal.mfa.hasActiveMfaCode, {
          adminId,
        });
        if (stillActive) {
          return { success: true as const, reusedExisting: true as const };
        }
      }
      throw e;
    }

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

    const attemptKey = `mfa:${adminId}`;
    await ctx.runQuery(internal.authAttemptLimit.assertNotLocked, {
      key: attemptKey,
    });

    const candidates = await ctx.runQuery(
      internal.mfa.listActiveMfaCandidates,
      { adminId },
    );

    for (const row of candidates) {
      const match = await bcrypt.compare(normalized, row.codeHash);
      if (match) {
        await ctx.runMutation(internal.authAttemptLimit.clear, { key: attemptKey });
        await ctx.runMutation(internal.mfa.consumeMfaCode, {
          recordId: row._id,
        });
        return { mfaVerified: true as const };
      }
    }

    await ctx.runMutation(internal.authAttemptLimit.recordFailed, {
      key: attemptKey,
    });
    throw new Error("AUTH_003: MFA code invalid or expired");
  },
});
