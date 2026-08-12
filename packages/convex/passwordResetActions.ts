"use node";

import {
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { createHash, randomUUID } from "crypto";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { assertStrongPasswordOrThrow } from "./model/passwordPolicy";
import { convexSiteOrigin } from "./model/convexSiteOrigin";
import { assertEmailNormalized } from "./model/inputValidation";

const PASSWORD_PROVIDER = "password" as const;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Builds the password reset link.
 * Priority: PASSWORD_RESET_URL env var → Convex site URL /reset-password
 * Falls back to the Convex HTTP endpoint so the link always works even if
 * ONBOARDING_WEB_URL is not configured.
 */
function buildResetLink(rawToken: string): string {
  if (process.env.PASSWORD_RESET_URL) {
    const base = process.env.PASSWORD_RESET_URL.replace(/\/$/, "");
    return `${base}?token=${encodeURIComponent(rawToken)}`;
  }
  const site = convexSiteOrigin();
  return `${site}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Request password reset: UUID token, SHA-256 + 1h expiry, Resend email.
 * Max 3 requests per user per rolling hour. No email enumeration (always returns success).
 */
export const requestReset = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = assertEmailNormalized(email);
    const profile = await ctx.runQuery(
      internal.passwordReset.getUserForPasswordReset,
      { email: normalizedEmail },
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

    const resetLink = buildResetLink(rawToken);

    await ctx.runAction(internal.notificationsFcm.sendPasswordResetEmail, {
      email: profile.deliveryEmail,
      resetLink,
    });

    return { success: true as const };
  },
});

/** Authenticated user requests reset link to their profile email (customers without email cannot use this). */
export const requestResetForMe = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const profile = await ctx.runQuery(
      internal.passwordReset.getUserForPasswordResetByUserId,
      { userId },
    );

    if (profile === null) {
      throw new Error(
        "PASSWORD_002: Add an email to your profile to receive a password reset link.",
      );
    }

    const rawToken = randomUUID();
    const tokenHash = sha256Hex(rawToken);

    await ctx.runMutation(internal.passwordReset.insertPasswordResetToken, {
      userId: profile.userId,
      tokenHash,
    });

    const resetLink = buildResetLink(rawToken);

    await ctx.runAction(internal.notificationsFcm.sendPasswordResetEmail, {
      email: profile.deliveryEmail,
      resetLink,
    });

    return { success: true as const, email: profile.deliveryEmail };
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
    assertStrongPasswordOrThrow(newPassword);

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
      const email = await ctx.runQuery(internal.adminAuth.getUserEmailForPassword, {
        userId,
      });
      if (!email) {
        throw new Error("PASSWORD_002: No password login for this account");
      }
      const passwordHash = await new Scrypt().hash(newPassword);
      await ctx.runMutation(internal.adminAuth.insertPasswordAccountForUser, {
        userId,
        email,
        passwordHash,
      });
    } else {
      await modifyAccountCredentials(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: accountId, secret: newPassword },
      });
    }

    await invalidateSessions(ctx, { userId });

    return { success: true as const };
  },
});

/** Internal version of verifyResetToken — callable from httpAction. */
export const verifyResetTokenInternal = internalAction({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ valid: boolean; completionToken?: string }> => {
    const trimmed = token.trim();
    if (!trimmed) return { valid: false };
    const tokenHash = sha256Hex(trimmed);
    const main = await ctx.runQuery(
      internal.passwordReset.getMainResetTokenByHash,
      { tokenHash },
    );
    if (!main || main.used || main.type !== "accountPassword") return { valid: false };
    if (Date.now() > main.expiresAt) return { valid: false };
    const completionRaw = randomUUID();
    const continuationHash = sha256Hex(completionRaw);
    await ctx.runMutation(
      internal.passwordReset.transitionMainTokenToContinuation,
      { mainTokenId: main._id, continuationTokenHash: continuationHash },
    );
    return { valid: true, completionToken: completionRaw };
  },
});

/** Internal version of resetPassword — callable from httpAction. */
export const resetPasswordInternal = internalAction({
  args: { completionToken: v.string(), newPassword: v.string() },
  handler: async (ctx, { completionToken, newPassword }): Promise<{ success: boolean }> => {
    assertStrongPasswordOrThrow(newPassword);
    const trimmed = completionToken.trim();
    if (!trimmed) throw new Error("PASSWORD_001: Invalid reset token");
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
      const email = await ctx.runQuery(internal.adminAuth.getUserEmailForPassword, { userId });
      if (!email) throw new Error("PASSWORD_002: No password login for this account");
      const passwordHash = await new Scrypt().hash(newPassword);
      await ctx.runMutation(internal.adminAuth.insertPasswordAccountForUser, {
        userId, email, passwordHash,
      });
    } else {
      await modifyAccountCredentials(ctx, {
        provider: "password" as const,
        account: { id: accountId, secret: newPassword },
      });
    }
    await invalidateSessions(ctx, { userId });
    return { success: true };
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
    assertStrongPasswordOrThrow(newPassword);

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
        "No login password set. Set one from Profile or sign in with WhatsApp OTP.",
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
