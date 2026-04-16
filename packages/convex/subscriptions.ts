/**
 * Club subscription lifecycle: active → grace → frozen; renewal reminders (cron).
 * Renewal formula (TDD §4.6): newExpiresAt = max(subscriptionExpiresAt, now) + purchasedPeriod.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";

export const checkExpiry = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
    const REMINDER_7D_MS = 7 * 24 * 60 * 60 * 1000;
    const REMINDER_1D_MS = 1 * 24 * 60 * 60 * 1000;

    const activeClubs = await ctx.db
      .query("clubs")
      .withIndex("by_subscriptionStatus", (q) =>
        q.eq("subscriptionStatus", "active"),
      )
      .collect();
    const graceClubs = await ctx.db
      .query("clubs")
      .withIndex("by_subscriptionStatus", (q) =>
        q.eq("subscriptionStatus", "grace"),
      )
      .collect();

    for (const club of activeClubs) {
      if (now >= club.subscriptionExpiresAt) {
        await ctx.db.patch(club._id, { subscriptionStatus: "grace" });
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.sendSubscriptionGraceEmail,
          {
            clubId: club._id,
            ownerId: club.ownerId,
          },
        );
        continue;
      }

      const timeUntilExpiry = club.subscriptionExpiresAt - now;

      // Cron runs daily at 00:00 UTC. The 24h window guard ensures each reminder fires exactly once. No separate sent-flag needed for reminders.
      // Window guard: cron fires daily, window = 24h, so each reminder fires exactly once per club per expiry cycle.
      const in7DayWindow =
        timeUntilExpiry <= REMINDER_7D_MS &&
        timeUntilExpiry > REMINDER_7D_MS - 86_400_000;
      const in1DayWindow =
        timeUntilExpiry <= REMINDER_1D_MS &&
        timeUntilExpiry > REMINDER_1D_MS - 86_400_000;
      // Mutually exclusive windows so a club ~24h from expiry gets only the 1-day reminder.
      if (in7DayWindow && !in1DayWindow) {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.sendSubscriptionReminderEmail,
          {
            clubId: club._id,
            ownerId: club.ownerId,
            daysUntil: 7,
          },
        );
      } else if (in1DayWindow) {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.sendSubscriptionReminderEmail,
          {
            clubId: club._id,
            ownerId: club.ownerId,
            daysUntil: 1,
          },
        );
      }
    }

    for (const club of graceClubs) {
      if (now >= club.subscriptionExpiresAt + GRACE_PERIOD_MS) {
        await ctx.db.patch(club._id, { subscriptionStatus: "frozen" });
      }
    }
  },
});

export const getSubscriptionStatus = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "owner") return null;

    const club = await ctx.db.get(clubId);
    if (!club || club.ownerId !== userId) return null;

    return {
      subscriptionStatus: club.subscriptionStatus,
      subscriptionExpiresAt: club.subscriptionExpiresAt,
      isFrozen: club.subscriptionStatus === "frozen",
      isGrace: club.subscriptionStatus === "grace",
      renewUrl: "https://register.a3billiards.com/renew",
    };
  },
});
