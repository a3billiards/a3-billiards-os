/**
 * Internal wrappers for the generic fixed-window rate limiter (see model/rateLimiter.ts).
 *
 * Node actions (which cannot touch the database directly) call
 * `internal.rateLimit.consumeFixedWindow` to enforce a limit; plain mutations can call
 * `enforceFixedWindowLimit` from the model helper directly.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { enforceFixedWindowLimit } from "./model/rateLimiter";

/**
 * Records one hit against `key` and throws RATE_001 if the fixed window is exhausted.
 * Callable from actions via `ctx.runMutation(internal.rateLimit.consumeFixedWindow, …)`.
 */
export const consumeFixedWindow = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { key, limit, windowMs }) => {
    await enforceFixedWindowLimit(ctx, key, limit, windowMs);
    return { ok: true as const };
  },
});

/**
 * Daily cleanup of expired rate-limit rows so the table stays small.
 * Batched via `.take()` to bound the work per run (resilience: never an unbounded scan).
 */
export const cleanupExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("rateLimits")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(500);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return { deleted: stale.length };
  },
});
