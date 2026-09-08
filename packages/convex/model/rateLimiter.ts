/**
 * Rate limits:
 * - OTP `sendOtp`: sliding 60-minute window, max 5 dispatches / phone (see convex/otp.ts) → OTP_003.
 * - MFA generation: sliding window, max 5 / normalized email / rolling hour → RATE_001.
 * - Generic fixed-window limiter (`enforceFixedWindowLimit`) for endpoints without a
 *   natural domain table to count from (geocoding, registration, support) → RATE_001.
 *
 * NOTE ON IP-BASED LIMITING: Convex function calls (queries/mutations/actions) do not
 * expose the client IP; only HTTP actions receive request headers, and Convex does not
 * populate a trustworthy client IP there. We therefore rate-limit by the strongest
 * available identity — authenticated userId, or the natural resource key (email/phone) —
 * which is the OWASP-recommended approach for authenticated/business endpoints.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";

const HOUR_MS = 3_600_000;

// Defaults for the generic fixed-window limiter. Callers may override per endpoint.
export const GEOCODE_LIMIT_PER_HOUR = 30;
export const OWNER_REGISTER_LIMIT_PER_HOUR = 5;
export const SUPPORT_REQUEST_LIMIT_PER_HOUR = 10;

/**
 * Generic fixed-window rate limiter backed by the `rateLimits` table (one row per key).
 * Throws RATE_001 with a human-readable retry hint once `limit` is reached inside the
 * current window. Safe to call from any mutation; actions should call it via the
 * `internal.rateLimit.consumeFixedWindow` wrapper.
 *
 * Fixed-window is used (rather than storing one row per hit) so each key stays a single
 * bounded row — this itself is a resilience measure against table bloat / abuse.
 */
export async function enforceFixedWindowLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number = HOUR_MS,
  now: number = Date.now(),
): Promise<void> {
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  // No row yet, or the previous window has fully elapsed → start a fresh window.
  if (!row || now >= row.windowStartMs + windowMs) {
    if (row) {
      await ctx.db.patch(row._id, {
        windowStartMs: now,
        count: 1,
        expiresAt: now + windowMs,
      });
    } else {
      await ctx.db.insert("rateLimits", {
        key,
        windowStartMs: now,
        count: 1,
        expiresAt: now + windowMs,
      });
    }
    return;
  }

  if (row.count >= limit) {
    const retryMin = Math.max(
      1,
      Math.ceil((row.windowStartMs + windowMs - now) / 60_000),
    );
    throw new Error(
      `RATE_001: Too many requests. Please wait ${retryMin} minute(s) and try again.`,
    );
  }

  await ctx.db.patch(row._id, {
    count: row.count + 1,
    expiresAt: now + windowMs,
  });
}

/** Max WhatsApp OTP dispatches per phone per UTC hour (fixed window). */
export const OTP_SEND_LIMIT_PER_UTC_HOUR = 5;

/** Max MFA code emails per rolling hour per admin email (sliding window). */
export const MFA_SEND_LIMIT_PER_SLIDING_HOUR = 5;

/** Max owner email verification sends per rolling hour per email (sliding window). */
export const OWNER_EMAIL_VERIFY_SEND_LIMIT_PER_SLIDING_HOUR = 5;

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
    const hasUnusedActive = recent.some(
      (r) => !r.used && r.expiresAt > now,
    );
    if (hasUnusedActive) {
      return;
    }
    throw new Error(
      "RATE_001: MFA code generation rate limit exceeded — try again later",
    );
  }
}

/**
 * Sliding window: owner email verification sends in the last rolling hour.
 * Exceeding the limit → RATE_001.
 */
export async function checkOwnerEmailVerificationSendSlidingWindowPerEmail(
  ctx: QueryCtx | MutationCtx,
  emailNormalized: string,
  now: number = Date.now(),
): Promise<void> {
  const cutoff = now - HOUR_MS;

  const recent = await ctx.db
    .query("ownerEmailVerificationCodes")
    .withIndex("by_email_normalized_createdAt", (q) =>
      q.eq("emailNormalized", emailNormalized).gt("createdAt", cutoff),
    )
    .collect();

  if (recent.length >= OWNER_EMAIL_VERIFY_SEND_LIMIT_PER_SLIDING_HOUR) {
    throw new Error(
      "RATE_001: Verification email rate limit exceeded — try again later",
    );
  }
}
