"use node";

/**
 * Table lock token MUST be generated here (Node crypto), not in a mutation.
 */

import { randomUUID } from "crypto";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const STANDARD_LOCK_MS = 30_000;
const OTP_FLOW_LOCK_MS = 180_000;

export const acquireTableLock = action({
  args: {
    tableId: v.id("tables"),
    /** New customer OTP verification path: 3-minute lock window */
    otpFlow: v.optional(v.boolean()),
  },
  handler: async (ctx, { tableId, otpFlow }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const lockToken = randomUUID();
    const ttl = otpFlow === true ? OTP_FLOW_LOCK_MS : STANDARD_LOCK_MS;

    await ctx.runMutation(internal.ownerSessions.applyTableLock, {
      ownerUserId: userId,
      tableId,
      lockToken,
      tableLockExpiry: Date.now() + ttl,
    });

    return { lockToken };
  },
});
