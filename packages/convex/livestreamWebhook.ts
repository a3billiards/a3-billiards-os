"use node";

/**
 * Inbound AWS EventBridge → Convex webhook handler (TDD v1.9 §5).
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const handleIvsEventWebhook = internalAction({
  args: {
    rawBody: v.string(),
    secretHeader: v.string(),
  },
  handler: async (ctx, { rawBody, secretHeader }) => {
    const expected = process.env.AWS_EVENTBRIDGE_WEBHOOK_SECRET?.trim();
    if (!expected || secretHeader !== expected) {
      throw new Error("PERM_001: Invalid webhook secret");
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody) as unknown;
    } catch {
      throw new Error("DATA_002: Invalid webhook JSON");
    }

    await ctx.runMutation(internal.livestream.processIvsEventBridgeEvent, {
      event,
    });
  },
});
