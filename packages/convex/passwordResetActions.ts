"use node";

import {
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { createHash, randomUUID } from "crypto";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const PASSWORD_PROVIDER = "password" as const;
const MIN_PASSWORD_LENGTH = 8;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Request password reset: UUID token, SHA-256 + 1h expiry, Resend email.
 * Max 3 requests per user per rolling hour. No email enumeration (always returns success).
 */
export const requestReset = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const profile = await ctx.runQuery(
      internal.passwordReset.getUserForPasswordReset,
      { email },
    );

    if (profile === null) {
      return { success: true as const };
    }

    const rawToken = randomUUID();
    const tokenHash = sha256Hex(rawToken);

    await ctx.runMutation(internal.passwordReset.insertPasswordResetToken, {
      userId: profile.userId,
      tokenHash,
    });

    const baseUrl =
      process.env.PASSWORD_RESET_URL ??
      "https://a3billiards.com/reset-password";
    const resetLink = `${baseUrl.replace(/\/$/, "")}?token=${encodeURIComponent(rawToken)}`;

    await ctx.runAction(internal.notificationsFcm.sendPasswordResetEmail, {
      email: profile.providerAccountId,
      resetLink,
    });

    return { success: true as const };
  },
});

/**
 * Validates the email-link token (hash + expiry), then deletes it (single-use) and
 * returns a short-lived `completionToken` for `resetPassword`.
 */
export const verifyResetToken = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const trimmed = token.trim();
    if (!trimmed) {
      return { valid: false as const };
    }

    const tokenHash = sha256Hex(trimmed);
    const main = await ctx.runQuery(
      internal.passwordReset.getMainResetTokenByHash,
      { tokenHash },
    );

    if (!main) {
      return { valid: false as const };
    }
    if (main.used || main.type !== "accountPassword") {
      return { valid: false as const };
    }
    if (Date.now() > main.expiresAt) {
      return { valid: false as const };
    }

    const completionRaw = randomUUID();
    const continuationHash = sha256Hex(completionRaw);

    await ctx.runMutation(
      internal.passwordReset.transitionMainTokenToContinuation,
      {
        mainTokenId: main._id,
        continuationTokenHash: continuationHash,
      },
    );

    return { valid: true as const, completionToken: completionRaw };
  },
});

/**
 * Completes reset: consumes completion token (single-use delete), updates Convex Auth password, invalidates sessions.
 */
export const resetPassword = action({
  args: {
    completionToken: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { completionToken, newPassword }) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `DATA_002: Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const trimmed = completionToken.trim();
    if (!trimmed) {
      throw new Error("PASSWORD_001: Invalid reset token");
    }

    const continuationHash = sha256Hex(trimmed);
    const { userId } = await ctx.runMutation(
      internal.passwordReset.consumeContinuation,
      { tokenHash: continuationHash },
    );

    const accountId = await ctx.runQuery(
      internal.passwordReset.getPasswordProviderAccountId,
      { userId },
    );
    if (!accountId) {
      throw new Error("PASSWORD_002: No password login for this account");
    }

    await modifyAccountCredentials(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: accountId, secret: newPassword },
    });

    await invalidateSessions(ctx, { userId });

    return { success: true as const };
  },
});

/**
 * Change password while signed in (email/password accounts). Current session stays valid.
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `DATA_002: Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const accountId = await ctx.runQuery(
      internal.passwordReset.getPasswordProviderAccountId,
      { userId },
    );
    if (!accountId) {
      throw new Error(
        "Your account uses Google Sign-In. Password management is handled by Google.",
      );
    }

    try {
      await retrieveAccount(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: accountId, secret: currentPassword },
      });
    } catch {
      throw new Error("Current password is incorrect.");
    }

    if (currentPassword === newPassword) {
      throw new Error("New password must be different");
    }

    await modifyAccountCredentials(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: accountId, secret: newPassword },
    });

    return { success: true as const };
  },
});
