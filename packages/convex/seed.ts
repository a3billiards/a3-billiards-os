/**
 * One-shot seed actions. Run with:
 *   npx convex run seed:seedOwnerUser '{"email":"...","password":"...","name":"..."}'
 *
 * Dev owner + club + optional table (no onboarding website):
 *   From packages/convex (recommended on Windows — avoids PowerShell mangling JSON):
 *     pnpm seed:test-owner
 *   Edits: ../../scripts/convex-seed/seed-test-owner-with-club.json (repo root) then re-run.
 *
 *   Bash / zsh (inline JSON):
 *     npx convex run seed:seedTestOwnerWithClub '{"email":"owner@test.local","password":"testpass12","name":"Test Owner","clubName":"Demo Club","withTable":true}'
 *
 * Club only for an existing owner userId (e.g. after Google registration):
 *     pnpm seed:test-club -- <users_document_id>
 *     (or edit scripts/convex-seed/seed-test-club-for-user.json at repo root, then pnpm seed:test-club with no args)
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

export const insertMinimalTestClubForOwner = internalMutation({
  args: {
    userId: v.id("users"),
    clubName: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userId, clubName, address },
  ): Promise<{ clubId: Id<"clubs">; status: "created" | "already_exists" }> => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.role !== "owner") {
      throw new Error("User must have role owner");
    }

    const existing = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
    if (existing !== null) {
      return { clubId: existing._id, status: "already_exists" };
    }

    const now = Date.now();
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    const clubId = await ctx.db.insert("clubs", {
      ownerId: userId,
      name: clubName?.trim() || "Test Club",
      address: address?.trim() || "1 Test Street, Test City",
      subscriptionStatus: "active",
      subscriptionExpiresAt: now + yearMs,
      baseRatePerMin: 2,
      currency: "INR",
      minBillMinutes: 10,
      timezone: "Asia/Kolkata",
      createdAt: now,
      specialRates: [],
      isDiscoverable: false,
      bookingSettings: {
        enabled: false,
        maxAdvanceDays: 7,
        minAdvanceMinutes: 60,
        slotDurationOptions: [30, 60, 90, 120],
        cancellationWindowMin: 30,
        approvalDeadlineMin: 60,
        bookableTableTypes: [],
      },
    });
    return { clubId, status: "created" };
  },
});

export const insertTestTableForClub = internalMutation({
  args: {
    clubId: v.id("clubs"),
    label: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { clubId, label },
  ): Promise<{ tableId: Id<"tables">; status: "created" | "already_exists" }> => {
    const club = await ctx.db.get(clubId);
    if (!club) {
      throw new Error("Club not found");
    }
    const first = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .first();
    if (first !== null) {
      return { tableId: first._id, status: "already_exists" };
    }
    const tableId = await ctx.db.insert("tables", {
      clubId,
      label: label?.trim() || "Table 1",
      isActive: true,
      tableType: "8-ball",
    });
    return { tableId, status: "created" };
  },
});

type OwnerSeedResult = {
  status: "created" | "already_exists" | "password_reset" | "role_upgraded";
  userId: Id<"users">;
};

type ClubSeedResult = { clubId: Id<"clubs">; status: "created" | "already_exists" };

type TableSeedResult = { tableId: Id<"tables">; status: "created" | "already_exists" };

/** Email/password owner plus minimal `clubs` row (and optional first table). */
export const seedTestOwnerWithClub = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    clubName: v.optional(v.string()),
    address: v.optional(v.string()),
    withTable: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    owner: OwnerSeedResult & { email: string };
    club: ClubSeedResult;
    table: TableSeedResult | null;
  }> => {
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const passwordHash = await new Scrypt().hash(args.password);
    const owner: OwnerSeedResult = await ctx.runMutation(
      internal.seed.insertOwnerUserWithPassword,
      {
        email: args.email,
        passwordHash,
        name: args.name,
      },
    );
    const club: ClubSeedResult = await ctx.runMutation(
      internal.seed.insertMinimalTestClubForOwner,
      {
        userId: owner.userId,
        clubName: args.clubName,
        address: args.address,
      },
    );
    let table: TableSeedResult | null = null;
    if (args.withTable === true) {
      table = await ctx.runMutation(internal.seed.insertTestTableForClub, {
        clubId: club.clubId,
      });
    }
    return {
      owner: {
        status: owner.status,
        userId: owner.userId,
        email: args.email.trim().toLowerCase(),
      },
      club,
      table,
    };
  },
});

/** Test club (and optional table) for an existing user — e.g. Google-registered owner. */
export const seedTestClubForUserId = internalAction({
  args: {
    userId: v.id("users"),
    clubName: v.optional(v.string()),
    address: v.optional(v.string()),
    withTable: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ club: ClubSeedResult; table: TableSeedResult | null }> => {
    const club: ClubSeedResult = await ctx.runMutation(
      internal.seed.insertMinimalTestClubForOwner,
      {
        userId: args.userId,
        clubName: args.clubName,
        address: args.address,
      },
    );
    let table: TableSeedResult | null = null;
    if (args.withTable === true) {
      table = await ctx.runMutation(internal.seed.insertTestTableForClub, {
        clubId: club.clubId,
      });
    }
    return { club, table };
  },
});
