"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * SHA-256 token hash runs in Node (crypto). Returns raw cancel token once — send via email in production.
 */
export const deleteAccountRequest = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const crypto = await import("crypto");
    const raw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");

    await ctx.runMutation(internal.users.applyDeletionRequest, {
      userId,
      tokenHash,
    });

    return { cancelToken: raw };
  },
});
