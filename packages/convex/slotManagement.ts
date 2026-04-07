/**
 * Owner slot / table grid: bookings for today, summary counts, walk-in conflict hints.
 */

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import { bookingAppliesToTable } from "./model/sessionRate";
import {
  dateYmdInTimeZone,
  zonedWallTimeToUtcMs,
} from "@a3/utils/timezone";

const TWO_H_MS = 2 * 60 * 60 * 1000;
const SIXTY_MIN_MS = 60 * 60 * 1000;

function bookingUtcWindow(
  booking: Doc<"bookings">,
  clubTimeZone: string,
): { startMs: number; endMs: number } {
  const startMs = zonedWallTimeToUtcMs(
    booking.requestedDate,
    booking.requestedStartTime,
    clubTimeZone,
  );
  const endMs = startMs + booking.requestedDurationMin * 60_000;
  return { startMs, endMs };
}

function formatBookedTime(startMs: number, clubTimeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: clubTimeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startMs));
}

export const getSlotDashboard = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }

    const now = Date.now();
    const todayYmd = dateYmdInTimeZone(now, club.timezone);

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", owner.clubId))
      .collect();

    const todaysBookings = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", owner.clubId).eq("requestedDate", todayYmd),
      )
      .collect();

    const pendingCount = todaysBookings.filter(
      (b) => b.status === "pending_approval",
    ).length;
    const confirmedTodayCount = todaysBookings.filter(
      (b) => b.status === "confirmed",
    ).length;
    const completedTodayCount = todaysBookings.filter(
      (b) => b.status === "completed",
    ).length;

    const confirmed = todaysBookings.filter((b) => b.status === "confirmed");

    const bookingTagByTableId: Record<
      string,
      { label: string; startMs: number }
    > = {};

    for (const table of tables) {
      for (const b of confirmed) {
        if (!bookingAppliesToTable(b, table)) continue;
        const { startMs, endMs } = bookingUtcWindow(b, club.timezone);
        const overlapsNext2h = endMs > now && startMs < now + TWO_H_MS;
        if (overlapsNext2h) {
          bookingTagByTableId[table._id] = {
            label: `Booked ${formatBookedTime(startMs, club.timezone)}`,
            startMs,
          };
          break;
        }
      }
    }

    return {
      clubId: owner.clubId,
      currency: club.currency,
      bookingSettingsEnabled: club.bookingSettings.enabled,
      todayYmd,
      bookingSummary: {
        pending: pendingCount,
        confirmedToday: confirmedTodayCount,
        completedToday: completedTodayCount,
      },
      tables: tables.map((t) => ({
        _id: t._id,
        label: t.label,
        tableType: t.tableType ?? "",
        floor: t.floor,
        isActive: t.isActive,
        currentSessionId: t.currentSessionId,
      })),
      bookingTagByTableId,
    };
  },
});

export const getWalkInBookingConflict = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, { tableId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }

    const now = Date.now();
    const todayYmd = dateYmdInTimeZone(now, club.timezone);

    const todays = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", owner.clubId).eq("requestedDate", todayYmd),
      )
      .collect();
    const confirmed = todays.filter((b) => b.status === "confirmed");

    for (const b of confirmed) {
      if (!bookingAppliesToTable(b, table)) continue;
      const { startMs, endMs } = bookingUtcWindow(b, club.timezone);
      const overlapsNext60m = endMs > now && startMs < now + SIXTY_MIN_MS;
      if (overlapsNext60m) {
        return {
          hasConflict: true as const,
          message: `This table has a confirmed booking at ${formatBookedTime(startMs, club.timezone)}. Starting a walk-in may overlap with an arriving customer.`,
          bookingId: b._id,
        };
      }
    }

    return { hasConflict: false as const };
  },
});
