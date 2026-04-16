/**
 * Client-side rate preview for booking confirmation (server recomputes on submit).
 */

import type { RateRule } from "./billing";
import {
  dayOfWeekInTimeZone,
  hhmmToMinutes,
  minutesFromMidnightInTimeZone,
  zonedWallTimeToUtcMs,
} from "./timezone";

function minutesInWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

export function resolveBookingRatePerMin(
  baseRatePerMin: number,
  specialRates: RateRule[],
  timeZone: string,
  dateYmd: string,
  timeHm: string,
): number {
  const startMs = zonedWallTimeToUtcMs(dateYmd, timeHm, timeZone);
  const dow = dayOfWeekInTimeZone(startMs, timeZone);
  const nowMin = minutesFromMidnightInTimeZone(startMs, timeZone);
  for (const rule of specialRates) {
    if (!rule.daysOfWeek.includes(dow)) continue;
    const s = hhmmToMinutes(rule.startTime);
    const e = hhmmToMinutes(rule.endTime);
    if (minutesInWindow(nowMin, s, e)) {
      return rule.ratePerMin;
    }
  }
  return baseRatePerMin;
}
