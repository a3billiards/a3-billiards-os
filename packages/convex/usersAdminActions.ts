"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHash, randomBytes } from "crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Admin-initiated account password reset: token + Resend (same link flow as self-service).
 */
export const adminResetUserPassword = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const adminRow = await ctx.runQuery(internal.deletion.getUserById, {
      userId: adminId,
    });
    if (!adminRow || adminRow.role !== "admin") {
      throw new Error("AUTH_001: Admin authentication required");
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);

    const { toEmail } = await ctx.runMutation(
      internal.users.internalAdminPreparePasswordReset,
      {
        adminId,
        targetUserId: userId,
        tokenHash,
      },
    );

    const baseUrl =
      process.env.PASSWORD_RESET_URL ??
      "https://a3billiards.com/reset-password";
    const resetLink = `${baseUrl.replace(/\/$/, "")}?token=${encodeURIComponent(rawToken)}`;

    await ctx.runAction(internal.notificationsFcm.sendPasswordResetEmail, {
      email: toEmail,
      resetLink,
    });

    return { sent: true as const };
  },
});
