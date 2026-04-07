/** IST timezone helpers. TDD §timezone.ts */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/** YYYY-MM-DD for `utcMs` interpreted in IANA `timeZone` (e.g. Asia/Kolkata). */
export function dateYmdInTimeZone(utcMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(utcMs))
    .slice(0, 10);
}

const weekdayToIndex: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Day of week 0=Sun … 6=Sat in IANA `timeZone`. */
export function dayOfWeekInTimeZone(utcMs: number, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  })
    .format(new Date(utcMs))
    .slice(0, 3)
    .toLowerCase();
  return weekdayToIndex[wd] ?? 0;
}

/** Minutes from midnight 0–1439 in IANA `timeZone`. */
export function minutesFromMidnightInTimeZone(
  utcMs: number,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/** Parse HH:MM to minutes 0–1439. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return h * 60 + m;
}

function zonedParts(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? "0"),
    month: Number(parts.find((p) => p.type === "month")?.value ?? "0"),
    day: Number(parts.find((p) => p.type === "day")?.value ?? "0"),
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

/**
 * Wall-clock `dateYmd` + `timeHm` (HH:MM) in IANA `timeZone` → UTC ms.
 * Iterative alignment handles DST where applicable.
 */
export function zonedWallTimeToUtcMs(
  dateYmd: string,
  timeHm: string,
  timeZone: string,
): number {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const [h, min] = timeHm.split(":").map(Number);
  let utc = Date.UTC(y, mo - 1, d, h, min, 0, 0);
  for (let i = 0; i < 30; i++) {
    const p = zonedParts(utc, timeZone);
    if (
      p.year === y &&
      p.month === mo &&
      p.day === d &&
      p.hour === h &&
      p.minute === min
    ) {
      return utc;
    }
    const want = Date.UTC(y, mo - 1, d, h, min, 0, 0);
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    utc += want - got;
  }
  return utc;
}
 
/** Current time as IST Date */
export function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}
 
/** UTC ms → "YYYY-MM-DD" string in IST */
export function toISTDateString(utcMs: number): string {
  const d = new Date(utcMs + IST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
 
/** UTC ms → minutes from midnight IST (e.g. 3:30 AM UTC = 540 mins IST) */
export function toISTMinutes(utcMs: number): number {
  const d = new Date(utcMs + IST_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
 
/** YYYY-MM-DD + minute offset → UTC ms */
export function istMinutesToUtcMs(dateString: string, minuteFromMidnight: number): number {
  const [y, mo, d] = dateString.split("-").map(Number);
  const istMidnight = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
  return istMidnight + minuteFromMidnight * 60_000;
}
 
/** Array of YYYY-MM-DD strings for the next N days in IST */
export function nextNDaysIST(n: number, fromUtcMs = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => toISTDateString(fromUtcMs + i * 86_400_000));
}
 
/** Human label: "Today", "Tomorrow", or "Mon 14" */
export function dateLabel(dateString: string, todayString: string): string {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  if (dateString === todayString) return "Today";
  const tomorrowMs = new Date(todayString + "T00:00:00+05:30").getTime() + 86_400_000;
  if (dateString === toISTDateString(tomorrowMs)) return "Tomorrow";
  const d = new Date(dateString + "T00:00:00+05:30");
  return `${days[d.getDay()]} ${d.getDate()}`;
}