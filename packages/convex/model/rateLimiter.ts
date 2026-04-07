/**
 * Rate limits:
 * - OTP `sendOtp`: fixed window, max 5 / phone / hour, bucket resets at top of each UTC hour → OTP_003.
 * - MFA generation: sliding window, max 5 / normalized email / rolling hour → RATE_001.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";

const HOUR_MS = 3_600_000;

/** Max WhatsApp OTP dispatches per phone per UTC hour (fixed window). */
export const OTP_SEND_LIMIT_PER_UTC_HOUR = 5;

/** Max MFA code emails per rolling hour per admin email (sliding window). */
export const MFA_SEND_LIMIT_PER_SLIDING_HOUR = 5;

function utcHourStartMs(now: number): number {
  return Math.floor(now / HOUR_MS) * HOUR_MS;
}

/**
 * Counts successful OTP registrations in the current UTC hour `[hourStart, hourStart + 1h)`.
 * Exceeding the limit → OTP_003.
 */
export async function checkOtpSendFixedWindowUtcHour(
  ctx: QueryCtx | MutationCtx,
  phone: string,
  now: number = Date.now(),
): Promise<void> {
  const hourStart = utcHourStartMs(now);
  const hourEnd = hourStart + HOUR_MS;

  const rows = await ctx.db
    .query("otpRecords")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .collect();

  const sendsThisHour = rows.filter(
    (r) => r.createdAt >= hourStart && r.createdAt < hourEnd,
  ).length;

  if (sendsThisHour >= OTP_SEND_LIMIT_PER_UTC_HOUR) {
    throw new Error(
      "OTP_003: OTP dispatch rate limit exceeded — max 5 sends per phone per hour",
    );
  }
}

/**
 * Sliding window: MFA sends in the last rolling hour for this normalized email.
 * Exceeding the limit → RATE_001.
 */
export async function checkMfaSendSlidingWindowPerEmail(
  ctx: QueryCtx | MutationCtx,
  emailNormalized: string,
  now: number = Date.now(),
): Promise<void> {
  const cutoff = now - HOUR_MS;

  const recent = await ctx.db
    .query("adminMfaCodes")
    .withIndex("by_email_normalized_createdAt", (q) =>
      q
        .eq("emailNormalized", emailNormalized)
        .gt("createdAt", cutoff),
    )
    .collect();

  if (recent.length >= MFA_SEND_LIMIT_PER_SLIDING_HOUR) {
    throw new Error(
      "RATE_001: MFA code generation rate limit exceeded — try again later",
    );
  }
}
