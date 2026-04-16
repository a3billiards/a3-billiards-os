/**
 * Special-rate overlap detection (PRD / owner settings).
 * Windows use HH:MM in club local semantics; midnight-crossing when end < start.
 */

import { hhmmToMinutes } from "./timezone";

export type SpecialRateWindow = {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
};

const DAY_MIN = 0;
const DAY_MAX = 24 * 60;

/** Half-open minute intervals [from, to) covering one calendar day slice. */
function minuteIntervalsForRateOnDay(
  rate: SpecialRateWindow,
  _dayIndex: number,
): [number, number][] {
  const s = hhmmToMinutes(rate.startTime);
  const e = hhmmToMinutes(rate.endTime);
  if (e > s) {
    return [[s, e]];
  }
  if (e < s) {
    return [
      [s, DAY_MAX],
      [DAY_MIN, e],
    ];
  }
  return [];
}

function intervalsOverlap(
  a: [number, number],
  b: [number, number],
): boolean {
  const [a0, a1] = a;
  const [b0, b1] = b;
  return Math.max(a0, b0) < Math.min(a1, b1);
}

/** True if two special rates overlap on at least one shared day. */
/** Customer booking grid: warn if slot list may be stale after this idle time. */
export const STALE_SLOT_WARNING_MS = 120_000;

/** Display HH:MM (24h wall) as 12-hour label (en-US). */
export function formatHhmm12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function doRatesOverlap(a: SpecialRateWindow, b: SpecialRateWindow): boolean {
  const daysA = new Set(a.daysOfWeek);
  const shared = b.daysOfWeek.filter((d) => daysA.has(d));
  if (shared.length === 0) return false;
  const intA = minuteIntervalsForRateOnDay(a, 0);
  const intB = minuteIntervalsForRateOnDay(b, 0);
  for (const ia of intA) {
    for (const ib of intB) {
      if (intervalsOverlap(ia, ib)) return true;
    }
  }
  return false;
}
