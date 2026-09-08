import type { Doc } from "../_generated/dataModel";
import { zonedWallTimeToUtcMs } from "@a3/utils/timezone";

export type BookingDurationFields = Pick<
  Doc<"bookings">,
  "requestedDurationMin" | "confirmedDurationMin" | "openEnded"
>;

/** Minutes used for slot blocking / overlap checks. Open-ended uses min billable window. */
export function effectiveBookingDurationMin(
  booking: BookingDurationFields,
  minBillMinutes = 30,
): number {
  if (booking.openEnded === true) return minBillMinutes;
  return booking.confirmedDurationMin ?? booking.requestedDurationMin;
}

export function bookingWindowMs(
  booking: Pick<
    Doc<"bookings">,
    | "requestedDate"
    | "requestedStartTime"
    | "requestedDurationMin"
    | "confirmedDurationMin"
    | "openEnded"
  >,
  timezone: string,
  minBillMinutes = 30,
): { startMs: number; endMs: number } {
  const startMs = zonedWallTimeToUtcMs(
    booking.requestedDate,
    booking.requestedStartTime,
    timezone,
  );
  const durationMin = effectiveBookingDurationMin(booking, minBillMinutes);
  return { startMs, endMs: startMs + durationMin * 60_000 };
}
