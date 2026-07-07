/**
 * Owner slot / table grid: bookings for today, summary counts, walk-in conflict hints.
 */

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import { bookingAppliesToTable } from "./model/sessionRate";
import { bookingWindowMs, effectiveBookingDurationMin } from "./model/bookingDuration";
import {
  dateYmdInTimeZone,
  zonedWallTimeToUtcMs,
} from "@a3/utils/timezone";

const TWO_H_MS = 2 * 60 * 60 * 1000;
const SIXTY_MIN_MS = 60 * 60 * 1000;

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
    if (owner.clubId === null) {
      return null;
    }
    const clubId = owner.clubId;
    const club = await ctx.db.get(clubId);
    if (!club) {
      return null;
    }

    const now = Date.now();
    const todayYmd = dateYmdInTimeZone(now, club.timezone);

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();

    const todaysBookings = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", clubId).eq("requestedDate", todayYmd),
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
      {
        label: string;
        startMs: number;
        durationMin: number;
        openEnded: boolean;
      }
    > = {};

    for (const table of tables) {
      for (const b of confirmed) {
        if (!bookingAppliesToTable(b, table)) continue;
        const { startMs, endMs } = bookingWindowMs(
          b,
          club.timezone,
          club.minBillMinutes,
        );
        const overlapsNext2h = endMs > now && startMs < now + TWO_H_MS;
        if (overlapsNext2h) {
          const durationMin = effectiveBookingDurationMin(b, club.minBillMinutes);
          const openEnded = b.openEnded === true;
          bookingTagByTableId[table._id] = {
            label: `${formatBookedTime(startMs, club.timezone)} · ${openEnded ? "Open" : `${durationMin}m`}`,
            startMs,
            durationMin,
            openEnded,
          };
          break;
        }
      }
    }

    type ActiveSessionMeta = {
      sessionId: import("./_generated/dataModel").Id<"sessions">;
      startTime: number;
      isGuest: boolean;
      customerName: string;
      playerCount: number;
      playMode: "casual" | "versus";
      losersPay: boolean;
      assignedPlayDurationMin: number | null;
      assignedPlayOpenEnded: boolean;
    };

    const activeSessionByTableId: Record<string, ActiveSessionMeta> = {};
    for (const t of tables) {
      if (t.currentSessionId === undefined) continue;
      const s = await ctx.db.get(t.currentSessionId);
      if (!s || s.status !== "active") continue;
      const participantList = s.participants ?? [];
      const playerCount =
        participantList.length > 0
          ? participantList.length
          : s.isGuest
            ? 1
            : 1;
      let customerName: string;
      if (participantList.length > 1) {
        const primary =
          participantList.find((p) => p.customerId === s.customerId) ??
          participantList[0];
        customerName = `${primary?.displayName ?? "Group"} +${participantList.length - 1}`;
      } else if (s.isGuest) {
        customerName = (s.guestName ?? "").trim() || "Walk-in";
      } else if (s.customerId) {
        const u = await ctx.db.get(s.customerId);
        customerName = u?.name ?? "[Deleted Customer]";
      } else {
        customerName = "Customer";
      }
      activeSessionByTableId[t._id] = {
        sessionId: s._id,
        startTime: s.startTime,
        isGuest: s.isGuest,
        customerName,
        playerCount,
        playMode: s.playMode ?? "casual",
        losersPay: s.losersPay === true,
        assignedPlayDurationMin: s.assignedPlayDurationMin ?? null,
        assignedPlayOpenEnded: s.assignedPlayOpenEnded === true,
      };
    }

    return {
      clubId,
      clubName: club.name,
      currency: club.currency,
      timezone: club.timezone,
      bookingSettingsEnabled: club.bookingSettings.enabled,
      slotDurationOptions: club.bookingSettings.slotDurationOptions,
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
      activeSessionByTableId,
    };
  },
});

export const getWalkInBookingConflict = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, { tableId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId === null) {
      return { hasConflict: false as const };
    }
    const clubId = owner.clubId;
    const club = await ctx.db.get(clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== clubId) {
      throw new Error("DATA_003: Table not found");
    }

    const now = Date.now();
    const todayYmd = dateYmdInTimeZone(now, club.timezone);

    const todays = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", clubId).eq("requestedDate", todayYmd),
      )
      .collect();
    const confirmed = todays.filter((b) => b.status === "confirmed");

    for (const b of confirmed) {
      if (!bookingAppliesToTable(b, table)) continue;
      const { startMs, endMs } = bookingWindowMs(
        b,
        club.timezone,
        club.minBillMinutes,
      );
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
