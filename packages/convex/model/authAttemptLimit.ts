/**
 * Brute-force protection for password login and short-code verification flows.
 * Mirrors the OTP attempt/cooldown pattern in convex/otp.ts.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";

export const PASSWORD_LOGIN_MAX_ATTEMPTS = 5;
export const PASSWORD_LOGIN_COOLDOWN_MS = 15 * 60 * 1000;

export const CODE_VERIFY_MAX_ATTEMPTS = 3;
export const CODE_VERIFY_COOLDOWN_MS = 5 * 60 * 1000;

type LimitConfig = {
  maxAttempts: number;
  cooldownMs: number;
};

const DEFAULT_CONFIG: LimitConfig = {
  maxAttempts: CODE_VERIFY_MAX_ATTEMPTS,
  cooldownMs: CODE_VERIFY_COOLDOWN_MS,
};

export async function assertAuthAttemptAllowed(
  ctx: QueryCtx | MutationCtx,
  key: string,
  config: LimitConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): Promise<void> {
  const row = await ctx.db
    .query("authVerifyAttempts")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!row) return;

  if (row.cooldownUntil !== undefined && now < row.cooldownUntil) {
    const waitMins = Math.ceil((row.cooldownUntil - now) / 60_000);
    throw new Error(
      `RATE_001: Too many failed attempts. Please wait ${waitMins} minute(s) before trying again.`,
    );
  }
}

export async function recordAuthAttemptFailure(
  ctx: MutationCtx,
  key: string,
  config: LimitConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): Promise<void> {
  const row = await ctx.db
    .query("authVerifyAttempts")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!row) {
    const failedAttempts = 1;
    await ctx.db.insert("authVerifyAttempts", {
      key,
      failedAttempts,
      cooldownUntil:
        failedAttempts >= config.maxAttempts
          ? now + config.cooldownMs
          : undefined,
      updatedAt: now,
    });
    return;
  }

  const failedAttempts = row.failedAttempts + 1;
  await ctx.db.patch(row._id, {
    failedAttempts,
    cooldownUntil:
      failedAttempts >= config.maxAttempts
        ? now + config.cooldownMs
        : row.cooldownUntil,
    updatedAt: now,
  });
}

export async function clearAuthAttempts(
  ctx: MutationCtx,
  key: string,
): Promise<void> {
  const row = await ctx.db
    .query("authVerifyAttempts")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (row) {
    await ctx.db.delete(row._id);
  }
}
