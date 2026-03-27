/** Client-side booking slot helpers. TDD §getAvailableSlots */
 
/** 5 minutes — stale slot warning timer. PRD §8.4 Step 4a */
export const STALE_SLOT_WARNING_MS = 5 * 60 * 1000;
 
/** Convert minute-offset from midnight to "9:00 AM" label */
export function minutesToTimeLabel(minutes: number): string {
  const h = Math.floor((minutes % 1440) / 60);
  const m = (minutes % 1440) % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,"0")} ${period}`;
}
 
/** Build a slot label: slotRangeLabel(540, 60) → "9:00 AM – 10:00 AM" */
export function slotRangeLabel(startMinute: number, duration: number): string {
  return `${minutesToTimeLabel(startMinute)} – ${minutesToTimeLabel(startMinute + duration)}`;
}
 
/** True if user has been on time-selection step > 5 minutes */
export function isSlotSelectionStale(stepEnteredAt: number): boolean {
  return Date.now() - stepEnteredAt >= STALE_SLOT_WARNING_MS;
}
 
/** Ms remaining until stale warning fires (for setTimeout) */
export function msUntilStaleWarning(stepEnteredAt: number): number {
  return Math.max(0, STALE_SLOT_WARNING_MS - (Date.now() - stepEnteredAt));
}
 
/**
 * Zero-gap overlap check.
 * [0,60] and [60,120] do NOT overlap — per TDD zero-gap rule.
 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}