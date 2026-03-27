/** IST timezone helpers. TDD §timezone.ts */
 
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;  // UTC+5:30
 
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