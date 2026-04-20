/**
 * One-shot seed actions. Run with:
 *   npx convex run seed:seedOwnerUser '{"email":"...","password":"...","name":"..."}'
 *
 * These are internal — not exposed to the client.
 *
 * NOTE: We deliberately bypass `createAccount` from `@convex-dev/auth` because
 * its user-upsert helper strips `phoneVerified`/`emailVerified` from the
 * profile (translating them into `*VerificationTime` timestamps) — but our
 * A3 schema requires `phoneVerified: v.boolean()`. We therefore insert the
 * `users` and `authAccounts` rows directly and hash the password with the
 * same Scrypt implementation used by `A3Password`.
 */

import { v } from "convex/values";
import { Scrypt } from "lucia";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const findPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
  },
});

export const insertOwnerUserWithPassword = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
  },
  handler: async (
    ctx,
    { email, passwordHash, name },
  ): Promise<{
    status: "created" | "already_exists" | "password_reset" | "role_upgraded";
    userId: Id<"users">;
  }> => {
    const normalized = email.trim().toLowerCase();
    const now = Date.now();

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    let status: "created" | "already_exists" | "password_reset" | "role_upgraded";

    if (user) {
      if (user.role !== "owner") {
        await ctx.db.patch(user._id, { role: "owner" });
        status = "role_upgraded";
      } else {
        status = "already_exists";
      }
    } else {
      const userId = await ctx.db.insert("users", {
        email: normalized,
        name: name.trim(),
        age: 18,
        phoneVerified: false,
        role: "owner",
        isFrozen: false,
        settingsPasscodeSet: false,
        complaints: [],
        fcmTokens: [],
        consentGiven: true,
        consentGivenAt: now,
        createdAt: now,
      });
      user = await ctx.db.get(userId);
      if (!user) throw new Error("Failed to insert owner user");
      status = "created";
    }

    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", normalized),
      )
      .unique();

    if (existingAccount) {
      if (existingAccount.userId !== user._id) {
        throw new Error("Existing password account linked to a different user");
      }
      await ctx.db.patch(existingAccount._id, { secret: passwordHash });
      if (status === "already_exists") status = "password_reset";
    } else {
      await ctx.db.insert("authAccounts", {
        userId: user._id,
        provider: "password",
        providerAccountId: normalized,
        secret: passwordHash,
      });
    }

    return { status, userId: user._id };
  },
});

/**
 * Creates (or idempotently resets password on) an owner user with
 * email+password auth. Password is hashed with Scrypt — the same algorithm
 * `A3Password` uses for verification at sign-in time.
 */
export const seedOwnerUser = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (
    ctx,
    { email, password, name },
  ): Promise<{
    status: "created" | "already_exists" | "password_reset" | "role_upgraded";
    userId: Id<"users">;
    email: string;
  }> => {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const passwordHash = await new Scrypt().hash(password);
    const result = await ctx.runMutation(internal.seed.insertOwnerUserWithPassword, {
      email,
      passwordHash,
      name,
    });

    return {
      status: result.status,
      userId: result.userId,
      email: email.trim().toLowerCase(),
    };
  },
});
