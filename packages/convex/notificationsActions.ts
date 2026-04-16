"use node";

/**
 * Admin broadcast action (Node.js entry — delegates FCM to notificationsFcm).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const targetTypeV = v.union(
  v.literal("all"),
  v.literal("role"),
  v.literal("selected"),
);
const targetRoleV = v.union(v.literal("owner"), v.literal("customer"));

type BroadcastRecipientRow = { userId: Id<"users">; fcmTokens: string[] };

type SendBroadcastResult = {
  notificationId: Id<"adminNotifications">;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
};

export const sendAdminBroadcast = action({
  args: {
    title: v.string(),
    body: v.string(),
    targetType: targetTypeV,
    targetRole: v.optional(targetRoleV),
    targetUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<SendBroadcastResult> => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Admin authentication required");
    }
    await ctx.runQuery(internal.notifications.internalAssertAdmin, {
      userId: adminId,
    });

    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length === 0) {
      throw new Error("DATA_001: Title is required");
    }
    if (body.length === 0) {
      throw new Error("DATA_001: Message is required");
    }
    if (title.length > 100) {
      throw new Error("DATA_001: Title must be at most 100 characters");
    }
    if (body.length > 500) {
      throw new Error("DATA_001: Message must be at most 500 characters");
    }

    if (args.targetType === "role") {
      if (args.targetRole !== "owner" && args.targetRole !== "customer") {
        throw new Error("DATA_001: targetRole is required for role broadcasts");
      }
    }
    if (args.targetType === "selected") {
      if (!args.targetUserIds || args.targetUserIds.length === 0) {
        throw new Error("DATA_001: Select at least one user");
      }
    }

    const now = Date.now();
    const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
    const hourEnd = hourStart + 3_600_000;

    // Note: fixed-window check is eventually consistent. ±1 over limit is acceptable at this low volume.
    const { count } = await ctx.runQuery(
      internal.notifications.internalCountBroadcastsInHour,
      { adminId, hourStart, hourEnd },
    );
    if (count >= 10) {
      const next = new Date(hourEnd).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
      throw new Error(
        `RATE_001: Broadcast limit reached. You can send up to 10 notifications per hour. Next send available at ${next}.`,
      );
    }

    const recipientRows: BroadcastRecipientRow[] = await ctx.runQuery(
      internal.notifications.internalListBroadcastRecipientUsers,
      {
        targetType: args.targetType,
        targetRole: args.targetRole,
        targetUserIds: args.targetUserIds,
      },
    );

    const recipientCount = recipientRows.length;

    const { notificationId } = await ctx.runMutation(
      internal.notifications.internalInsertAdminBroadcast,
      {
        sentByAdminId: adminId,
        title,
        body,
        targetType: args.targetType,
        targetRole: args.targetRole,
        targetUserIds: args.targetUserIds,
        createdAt: Date.now(),
      },
    );

    const tokenMap = recipientRows.map((row) => ({
      userId: row.userId.toString(),
      tokens: row.fcmTokens,
    }));

    const hasAnyToken = tokenMap.some((m) => m.tokens.length > 0);
    if (!hasAnyToken) {
      return {
        notificationId,
        recipientCount,
        sentCount: 0,
        failedCount: 0,
      };
    }

    const { sentCount, failedCount } = await ctx.runAction(
      internal.notifications.sendAdminBroadcastPush,
      {
        notificationId,
        title,
        body,
        tokenMap,
      },
    );

    return { notificationId, recipientCount, sentCount, failedCount };
  },
});
