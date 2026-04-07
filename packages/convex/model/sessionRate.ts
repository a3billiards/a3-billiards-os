/**
 * Lock session billing rate at start (PRD): specialRates override baseRatePerMin
 * when startTime falls in a matching day + time window (midnight-crossing supported).
 */

import type { Doc } from "../_generated/dataModel";
import {
  dayOfWeekInTimeZone,
  hhmmToMinutes,
  minutesFromMidnightInTimeZone,
} from "@a3/utils/timezone";

function normalizeTableType(t: string | undefined): string {
  return (t ?? "").trim().toLowerCase();
}

function minutesInWindow(
  nowMin: number,
  startMin: number,
  endMin: number,
): boolean {
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

/**
 * Returns ratePerMin locked for this session start instant.
 */
export function resolveRatePerMinAtSessionStart(
  club: Doc<"clubs">,
  startTimeUtcMs: number,
): number {
  const tz = club.timezone;
  const dow = dayOfWeekInTimeZone(startTimeUtcMs, tz);
  const nowMin = minutesFromMidnightInTimeZone(startTimeUtcMs, tz);

  for (const rule of club.specialRates) {
    if (!rule.daysOfWeek.includes(dow)) continue;
    const s = hhmmToMinutes(rule.startTime);
    const e = hhmmToMinutes(rule.endTime);
    if (minutesInWindow(nowMin, s, e)) {
      return rule.ratePerMin;
    }
  }
  return club.baseRatePerMin;
}

export function bookingAppliesToTable(
  booking: Doc<"bookings">,
  table: Doc<"tables">,
): boolean {
  if (booking.confirmedTableId !== undefined) {
    return booking.confirmedTableId === table._id;
  }
  return (
    normalizeTableType(booking.tableType) ===
    normalizeTableType(table.tableType)
  );
}
