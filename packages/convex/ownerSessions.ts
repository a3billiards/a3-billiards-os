/**
 * Owner session start (walk-in). Rate + currency locked on session row.
 * Table lock: acquire via ownerSessionActions.acquireTableLock (UUID in action);
 * startWalkInSession requires matching lock token + non-expired tableLockExpiry.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireOwnerWithClub, requireViewer } from "./model/viewer";
import { bookingAppliesToTable, resolveRatePerMinAtSessionStart } from "./model/sessionRate";
import { computeBookingUnixTime, dateYmdInTimeZone } from "@a3/utils/timezone";
import { countActiveComplaintsForUser } from "./complaints";

/**
 * Called only from acquireTableLock action (server-side UUID).
 */
export const applyTableLock = internalMutation({
  args: {
    ownerUserId: v.id("users"),
    tableId: v.id("tables"),
    lockToken: v.string(),
    tableLockExpiry: v.number(),
  },
  handler: async (ctx, { ownerUserId, tableId, lockToken, tableLockExpiry }) => {
    const user = await ctx.db.get(ownerUserId);
    if (!user || user.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    if (user.isFrozen) {
      throw new Error("AUTH_002: Account is frozen");
    }
    if (user.deletionRequestedAt !== undefined) {
      throw new Error("AUTH_006: Account pending deletion");
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerUserId))
      .unique();
    if (!club) {
      throw new Error("AUTH_008: No club found for owner account");
    }
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== club._id) {
      throw new Error("DATA_003: Table not found");
    }
    if (!table.isActive) {
      throw new Error("SESSION_003: Table is inactive");
    }
    if (table.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Table is already occupied");
    }

    const now = Date.now();
    if (table.tableLockExpiry !== undefined && table.tableLockExpiry > now) {
      throw new Error(
        "SESSION_002: Table lock held by another flow — please retry",
      );
    }

    await ctx.db.patch(tableId, {
      tableLock: lockToken,
      tableLockExpiry,
    });
  },
});

export const releaseTableLock = mutation({
  args: {
    tableId: v.id("tables"),
    lockToken: v.string(),
  },
  handler: async (ctx, { tableId, lockToken }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (table.tableLock === lockToken) {
      await ctx.db.patch(tableId, {
        tableLock: undefined,
        tableLockExpiry: undefined,
      });
    }
    return { success: true as const };
  },
});

export const startWalkInSession = mutation({
  args: {
    tableId: v.id("tables"),
    lockToken: v.string(),
    guestName: v.optional(v.string()),
    forceStartDespiteConflict: v.optional(v.boolean()),
    customerId: v.optional(v.id("users")),
    roleId: v.optional(v.id("staffRoles")),
    staffAcknowledgedComplaint: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const {
      tableId,
      lockToken,
      guestName,
      forceStartDespiteConflict,
      customerId,
      roleId,
      staffAcknowledgedComplaint,
    } = args;
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);
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
    const todayYmd = dateYmdInTimeZone(now, club.timezone);
    const confirmedToday = (
      await ctx.db
        .query("bookings")
        .withIndex("by_club_date", (q) =>
          q.eq("clubId", owner.clubId).eq("requestedDate", todayYmd),
        )
        .collect()
    ).filter((b) => b.status === "confirmed");
    if (!forceStartDespiteConflict) {
      for (const booking of confirmedToday) {
        if (!bookingAppliesToTable(booking, table)) continue;
        const startMs = computeBookingUnixTime(
          booking.requestedDate,
          booking.requestedStartTime,
          club.timezone,
        );
        if (startMs > now && startMs <= now + 60 * 60_000) {
          const customer = await ctx.db.get(booking.customerId);
          return {
            hasUpcomingBooking: true as const,
            bookingTime: booking.requestedStartTime,
            customerName: customer?.name ?? "Customer",
          };
        }
      }
    }

    if (
      table.tableLock !== lockToken ||
      table.tableLockExpiry === undefined ||
      table.tableLockExpiry <= now
    ) {
      throw new Error(
        "SESSION_002: Table lock invalid or expired — please retry",
      );
    }

    if (customerId !== undefined && guestName !== undefined) {
      throw new Error(
        "DATA_001: Provide either a registered customer or a guest name, not both",
      );
    }

    const ratePerMin = resolveRatePerMinAtSessionStart(club, now);
    const minBillMinutes = club.minBillMinutes;
    const currency = club.currency;

    let sessionCustomerId: typeof customerId = undefined;
    let sessionGuestName: string | undefined;
    let sessionGuestAge: number | undefined;
    let sessionIsGuest = true;
    let complaintAck: {
      staffAcknowledgedComplaint?: boolean;
      acknowledgedByRoleId?: typeof roleId;
      acknowledgedAt?: number;
    } = {};

    if (customerId !== undefined) {
      const customer = await ctx.db.get(customerId);
      if (!customer || customer.role !== "customer") {
        throw new Error("DATA_003: Customer not found");
      }
      if (!customer.phoneVerified) {
        throw new Error(
          "Complaints cannot be filed against guest sessions. The customer must be registered.",
        );
      }
      const n = await countActiveComplaintsForUser(ctx, customerId);
      if (n > 0) {
        if (!staffAcknowledgedComplaint) {
          throw new Error(
            "COMPLAINT_001: This customer has active complaints. Acknowledge before starting the session.",
          );
        }
        complaintAck = {
          staffAcknowledgedComplaint: true,
          acknowledgedByRoleId: roleId,
          acknowledgedAt: now,
        };
      }
      sessionCustomerId = customerId;
      sessionGuestName = undefined;
      sessionGuestAge = customer.age;
      sessionIsGuest = false;
    } else {
      const name = (guestName ?? "Walk-in").trim() || "Walk-in";
      sessionGuestName = name;
    }

    const sessionId = await ctx.db.insert("sessions", {
      tableId,
      clubId: owner.clubId,
      customerId: sessionCustomerId,
      guestName: sessionGuestName,
      guestAge: sessionGuestAge,
      isGuest: sessionIsGuest,
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
      staffAcknowledgedComplaint: complaintAck.staffAcknowledgedComplaint,
      acknowledgedByRoleId: complaintAck.acknowledgedByRoleId,
      acknowledgedAt: complaintAck.acknowledgedAt,
      bookingId: undefined,
      discountAppliedByRoleId: undefined,
      discountAppliedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(tableId, {
      currentSessionId: sessionId,
      tableLock: undefined,
      tableLockExpiry: undefined,
    });

    return { sessionId, hasUpcomingBooking: false as const };
  },
});
