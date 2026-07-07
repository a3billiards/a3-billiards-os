/** Map slot duration minutes to i18n key under common.slotDurationChips.* */
const DURATION_KEY_BY_MIN: Record<number, string> = {
  30: "common.slotDurationChips.min30",
  60: "common.slotDurationChips.hour1",
  90: "common.slotDurationChips.hour1_5",
  120: "common.slotDurationChips.hours2",
  180: "common.slotDurationChips.hours3",
};

export function slotDurationI18nKey(minutes: number): string | undefined {
  return DURATION_KEY_BY_MIN[minutes];
}

export function formatSlotDurationLabel(
  minutes: number,
  openEnded: boolean,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (openEnded) return t("common.slotDurationChips.open");
  const key = slotDurationI18nKey(minutes);
  if (key) return t(key);
  return t("ownerApp.bookings.durationMinutesFallback", { count: minutes });
}

export function formatBookingSlotTag(
  startMs: number,
  durationMin: number,
  openEnded: boolean,
  timeZone: string,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startMs));
  const duration = formatSlotDurationLabel(durationMin, openEnded, t);
  return t("ownerApp.slots.bookingTag", { time, duration });
}
