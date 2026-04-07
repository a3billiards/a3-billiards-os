/**
 * Owner session start (walk-in). Rate + currency locked on session row (sessions.ratePerMin, sessions.currency).
 * sessionLogs has no rateSnapshot field in schema — locked values live on sessions (TDD §sessions).
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import { resolveRatePerMinAtSessionStart } from "./model/sessionRate";

export const startWalkInSession = mutation({
  args: {
    tableId: v.id("tables"),
    guestName: v.optional(v.string()),
  },
  handler: async (ctx, { tableId, guestName }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (!table.isActive) {
      throw new Error("SESSION_003: Table is inactive");
    }
    if (table.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Table is already occupied");
    }

    const now = Date.now();
    const ratePerMin = resolveRatePerMinAtSessionStart(club, now);
    const minBillMinutes = club.minBillMinutes;
    const currency = club.currency;

    const name = (guestName ?? "Walk-in").trim() || "Walk-in";

    const sessionId = await ctx.db.insert("sessions", {
      tableId,
      clubId: owner.clubId,
      customerId: undefined,
      guestName: name,
      guestAge: undefined,
      isGuest: true,
      startTime: now,
      endTime: undefined,
      billableMinutes: undefined,
      ratePerMin,
      minBillMinutes,
      currency,
      snackOrders: [],
      billTotal: undefined,
      discount: undefined,
      paymentMethod: undefined,
      paymentStatus: "pending",
      status: "active",
      cancellationReason: undefined,
      timerAlertMinutes: undefined,
      timerAlertFiredAt: undefined,
      creditResolvedAt: undefined,
      creditResolvedMethod: undefined,
      staffAcknowledgedComplaint: undefined,
      acknowledgedByRoleId: undefined,
      acknowledgedAt: undefined,
      bookingId: undefined,
      discountAppliedByRoleId: undefined,
      discountAppliedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(tableId, { currentSessionId: sessionId });

    return { sessionId };
  },
});
