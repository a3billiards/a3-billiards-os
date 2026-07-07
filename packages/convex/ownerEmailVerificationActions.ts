"use node";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const BCRYPT_ROUNDS = 10;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Called after owner registration or from the resend button. */
export const sendOwnerEmailVerificationCode = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const emailNormalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      throw new Error("DATA_001: Invalid email address");
    }

    const profile = await ctx.runQuery(
      internal.ownerEmailVerification.getOwnerPasswordAccountByEmail,
      { emailNormalized },
    );

    if (profile === null) {
      return { success: true as const };
    }

    if (profile.emailVerified) {
      return { success: true as const };
    }

    const digits = randomInt(100_000, 1_000_000).toString();
    const codeHash = await bcrypt.hash(digits, BCRYPT_ROUNDS);

    const { email: sendTo } = await ctx.runMutation(
      internal.ownerEmailVerification.storeOwnerEmailVerificationCode,
      {
        ownerId: profile.ownerId,
        emailNormalized,
        codeHash,
      },
    );

    await ctx.runAction(internal.notificationsFcm.sendOwnerEmailVerificationEmail, {
      email: sendTo,
      code: digits,
    });

    return { success: true as const };
  },
});

export const verifyOwnerEmailCode = action({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { email, code }) => {
    const emailNormalized = normalizeEmail(email);
    const normalizedCode = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error("AUTH_009: Verification code invalid or expired");
    }

    const profile = await ctx.runQuery(
      internal.ownerEmailVerification.getOwnerPasswordAccountByEmail,
      { emailNormalized },
    );
    if (profile === null) {
      throw new Error("AUTH_009: Verification code invalid or expired");
    }
    if (profile.emailVerified) {
      return { verified: true as const };
    }

    const attemptKey = `owner_email:${profile.ownerId}`;
    await ctx.runQuery(internal.authAttemptLimit.assertNotLocked, {
      key: attemptKey,
    });

    const candidates = await ctx.runQuery(
      internal.ownerEmailVerification.listActiveOwnerEmailVerificationCandidates,
      { ownerId: profile.ownerId },
    );

    for (const row of candidates) {
      const match = await bcrypt.compare(normalizedCode, row.codeHash);
      if (match) {
        await ctx.runMutation(internal.authAttemptLimit.clear, { key: attemptKey });
        await ctx.runMutation(internal.ownerEmailVerification.markOwnerEmailVerified, {
          ownerId: profile.ownerId,
          recordId: row._id,
          passwordAccountId: profile.passwordAccountId,
          emailNormalized,
        });
        return { verified: true as const };
      }
    }

    await ctx.runMutation(internal.authAttemptLimit.recordFailed, {
      key: attemptKey,
    });
    throw new Error("AUTH_009: Verification code invalid or expired");
  },
});
