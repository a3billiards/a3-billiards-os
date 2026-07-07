/**
 * Internal wrappers for auth brute-force limits (callable from Node actions).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  assertAuthAttemptAllowed,
  clearAuthAttempts,
  CODE_VERIFY_COOLDOWN_MS,
  CODE_VERIFY_MAX_ATTEMPTS,
  PASSWORD_LOGIN_COOLDOWN_MS,
  PASSWORD_LOGIN_MAX_ATTEMPTS,
  recordAuthAttemptFailure,
} from "./model/authAttemptLimit";

const codeVerifyConfig = {
  maxAttempts: CODE_VERIFY_MAX_ATTEMPTS,
  cooldownMs: CODE_VERIFY_COOLDOWN_MS,
};

const passwordLoginConfig = {
  maxAttempts: PASSWORD_LOGIN_MAX_ATTEMPTS,
  cooldownMs: PASSWORD_LOGIN_COOLDOWN_MS,
};

export const assertNotLocked = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await assertAuthAttemptAllowed(ctx, key, codeVerifyConfig);
    return { ok: true as const };
  },
});

export const recordFailed = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await recordAuthAttemptFailure(ctx, key, codeVerifyConfig);
    return { ok: true as const };
  },
});

export const clear = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await clearAuthAttempts(ctx, key);
    return { ok: true as const };
  },
});

export const assertPasswordLoginNotLocked = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await assertAuthAttemptAllowed(
      ctx,
      `login:${email.trim().toLowerCase()}`,
      passwordLoginConfig,
    );
    return { ok: true as const };
  },
});

export const recordPasswordLoginFailed = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await recordAuthAttemptFailure(
      ctx,
      `login:${email.trim().toLowerCase()}`,
      passwordLoginConfig,
    );
    return { ok: true as const };
  },
});

export const clearPasswordLoginAttempts = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await clearAuthAttempts(ctx, `login:${email.trim().toLowerCase()}`);
    return { ok: true as const };
  },
});
