"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Links a phone+password login to the signed-in customer (same userId as phoneOtp).
 * Safe for owner desk-registered customers: adds password alongside existing phoneOtp row.
 */
export const setupLoginPassword = action({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `DATA_002: Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const profile = await ctx.runQuery(
      internal.customerAuth.getCustomerForPasswordSetup,
      { userId },
    );
    if (profile === null) {
      throw new Error("PERM_001: Cannot set a login password for this account");
    }
    if (profile.hasPassword) {
      throw new Error(
        "PASSWORD_003: Login password already set. Use Change Password in Profile.",
      );
    }

    const passwordHash = await new Scrypt().hash(password);
    await ctx.runMutation(internal.customerAuth.insertCustomerPasswordAccount, {
      userId,
      phone: profile.phone,
      passwordHash,
    });

    return { success: true as const };
  },
});
