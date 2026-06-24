import { addCalendarDaysYmd, zonedWallTimeToUtcMs } from "@a3/utils/timezone";

export function countDaysInclusive(
  dateFrom: string,
  dateTo: string,
  timeZone: string,
): number {
  if (dateFrom.localeCompare(dateTo) > 0) return 0;
  let n = 0;
  let cur = dateFrom;
  while (cur.localeCompare(dateTo) <= 0 && n < 400) {
    n += 1;
    cur = addCalendarDaysYmd(cur, 1, timeZone);
  }
  return n;
}

export function firstOfMonthYmd(todayYmd: string): string {
  return `${todayYmd.slice(0, 7)}-01`;
}

export function startOfLastMonthYmd(todayYmd: string): string {
  const y = Number(todayYmd.slice(0, 4));
  const mo = Number(todayYmd.slice(5, 7));
  if (mo === 1) return `${y - 1}-12-01`;
  return `${y}-${String(mo - 1).padStart(2, "0")}-01`;
}

export function endOfLastMonthYmd(todayYmd: string, tz: string): string {
  const firstThis = firstOfMonthYmd(todayYmd);
  return addCalendarDaysYmd(firstThis, -1, tz);
}

export function ymdToDate(ymd: string, tz: string): Date {
  return new Date(zonedWallTimeToUtcMs(ymd, "12:00", tz));
}

export type DateRangeChip = "7" | "30" | "this" | "last";

export function dateRangeForChip(
  kind: DateRangeChip,
  todayYmd: string,
  timeZone: string,
): { from: string; to: string } {
  const to = todayYmd;
  if (kind === "7") {
    return { from: addCalendarDaysYmd(to, -6, timeZone), to };
  }
  if (kind === "30") {
    return { from: addCalendarDaysYmd(to, -29, timeZone), to };
  }
  if (kind === "this") {
    return { from: firstOfMonthYmd(to), to };
  }
  const end = endOfLastMonthYmd(to, timeZone);
  const start = startOfLastMonthYmd(to);
  return { from: start, to: end };
}
