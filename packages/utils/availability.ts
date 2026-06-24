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

export type HoursWindow = {
  open: string;
  close: string;
  daysOfWeek: number[];
};

/** True when close is on the same calendar day as open (not overnight). */
export function isSimpleSameDayHoursWindow(open: string, close: string): boolean {
  return hhmmToMinutes(close) >= hhmmToMinutes(open);
}

const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatDaysList(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .filter((d) => days.includes(d))
    .map((d) => DAY_LABELS_SHORT[d] ?? String(d))
    .join(", ");
}

/**
 * PRD: bookable hours must fall within operating hours (same-day windows).
 * Overnight operating/bookable windows skip time-of-day comparison (v1).
 */
export function validateBookableWithinOperating(
  operating: HoursWindow,
  bookable: HoursWindow,
): { ok: true } | { ok: false; message: string } {
  for (const d of bookable.daysOfWeek) {
    if (!operating.daysOfWeek.includes(d)) {
      return {
        ok: false,
        message: `Bookable days must be a subset of operating days. ${DAY_LABELS_SHORT[d] ?? d} is not in your operating schedule (${formatDaysList(operating.daysOfWeek)}).`,
      };
    }
  }
  if (
    isSimpleSameDayHoursWindow(operating.open, operating.close) &&
    isSimpleSameDayHoursWindow(bookable.open, bookable.close)
  ) {
    const oOpen = hhmmToMinutes(operating.open);
    const oClose = hhmmToMinutes(operating.close);
    const bOpen = hhmmToMinutes(bookable.open);
    const bClose = hhmmToMinutes(bookable.close);
    if (bOpen < oOpen || bClose > oClose) {
      return {
        ok: false,
        message: `Bookable hours (${formatHhmm12h(bookable.open)}–${formatHhmm12h(bookable.close)}) must be within operating hours (${formatHhmm12h(operating.open)}–${formatHhmm12h(operating.close)}). Adjust times or widen operating hours under Club Profile.`,
      };
    }
  }
  return { ok: true };
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
