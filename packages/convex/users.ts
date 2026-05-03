/**
 * User profile API: queries, mutations, and account lifecycle.
 * Deletion token hashing runs in an action (crypto in actions only).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  parseIndiaE164OrThrow,
  throwIfPhoneUnavailableForNewAccount,
} from "./model/phoneRegistration";
import { requireCustomer, requireOwner, requireViewer } from "./model/viewer";

const PASSWORD_PROVIDER = "password" as const;

const PASSWORD_RESET_HOUR_MS = 3_600_000;
const MAX_PASSWORD_RESETS_PER_HOUR = 3;
const USER_SEARCH_MAX_RAW = 200;

function throwErr(message: string): never {
  throw new Error(message);
}

/** Generic E.164: + then 7–15 digits (ITU-T E.164 subset). */
function parseGenericE164OrThrow(raw: string): string {
  const phone = raw.trim();
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throwErr(
      "DATA_001: Phone must be E.164 (+ followed by 7–15 digits, no spaces)",
    );
  }
  return phone;
}

function isValidEmailFormat(email: string): boolean {
  const t = email.trim();
  return t.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

async function requireAdminViewer(ctx: QueryCtx | MutationCtx) {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "admin") {
    throwErr("AUTH_001: Admin authentication required");
  }
  return viewer;
}

type PublicUser = Omit<
  Doc<"users">,
  "settingsPasscodeHash" | "deletionCancelToken"
>;

/** Public / cross-role safe user shape (no secrets). */
export function sanitizeUser(user: Doc<"users"> | null): PublicUser | null {
  if (user === null) return null;
  const {
    settingsPasscodeHash: _h,
    deletionCancelToken: _t,
    ...rest
  } = user;
  return rest;
}

async function ownerCanViewCustomer(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  targetUserId: Id<"users">,
): Promise<boolean> {
  const sessionLink = await ctx.db
    .query("sessionLogs")
    .withIndex("by_customer_club", (q) =>
      q.eq("customerId", targetUserId).eq("clubId", clubId),
    )
    .first();
  if (sessionLink) return true;

  const booking = await ctx.db
    .query("bookingLogs")
    .withIndex("by_customer", (q) => q.eq("customerId", targetUserId))
    .filter((q) => q.eq(q.field("clubId"), clubId))
    .first();
  if (booking) return true;

  const complaint = await ctx.db
    .query("complaints")
    .withIndex("by_reportedByClubId", (q) =>
      q.eq("reportedByClubId", clubId),
    )
    .filter((q) => q.eq(q.field("userId"), targetUserId))
    .first();
  return complaint !== null;
}

async function syncPasswordProviderAccountId(
  ctx: MutationCtx,
  userId: Id<"users">,
  oldEmail: string | undefined,
  newEmail: string,
): Promise<void> {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER),
    )
    .collect();

  if (accounts.length === 0) return;

  for (const acc of accounts) {
    if (oldEmail === undefined || acc.providerAccountId === oldEmail) {
      await ctx.db.patch(acc._id, { providerAccountId: newEmail });
      return;
    }
  }

  await ctx.db.patch(accounts[0]._id, { providerAccountId: newEmail });
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return sanitizeUser(user);
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetId }) => {
    const viewer = await requireViewer(ctx);
    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");

    if (viewer.role === "admin") {
      return sanitizeUser(target);
    }

    if (viewer.role === "customer") {
      if (viewer.userId !== targetId) {
        throwErr("PERM_001: Cannot access another user's data");
      }
      return sanitizeUser(target);
    }

    // owner
    const owner = requireOwner(viewer);
    if (target.role !== "customer") {
      if (targetId === owner.userId) {
        return sanitizeUser(target);
      }
      throwErr("PERM_001: Cannot access this user");
    }
    if (owner.clubId === null) {
      throwErr("AUTH_008: No club found for owner account");
    }
    const ok = await ownerCanViewCustomer(ctx, owner.clubId, targetId);
    if (!ok) throwErr("PERM_001: Cannot access this user");
    return sanitizeUser(target);
  },
});

export const updateCustomerProfile = mutation({
  args: {
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { name, age, email }) => {
    const customer = requireCustomer(await requireViewer(ctx));
    const targetId = customer.userId;
    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");

    const patch: Partial<Doc<"users">> = {};

    if (name !== undefined) {
      const t = name.trim();
      if (t.length < 2 || t.length > 100) {
        throwErr("Name must be between 2 and 100 characters.");
      }
      patch.name = t;
    }

    if (age !== undefined) {
      if (!Number.isInteger(age) || age < 18) {
        throwErr("AUTH_007: You must be 18 or older.");
      }
      patch.age = age;
    }

    if (email !== undefined) {
      const googleLinked = Boolean(target.googleId);
      const hasCapturedEmail =
        target.email !== undefined &&
        target.email !== null &&
        String(target.email).trim().length > 0;
      if (googleLinked && hasCapturedEmail) {
        throwErr("Email cannot be changed for Google Sign-In accounts.");
      }
      const normalized = email.trim().toLowerCase();
      if (!isValidEmailFormat(normalized)) {
        throwErr("DATA_001: Invalid email format");
      }
      const dup = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .first();
      if (dup && dup._id !== targetId) {
        throwErr("This email is already registered to another account.");
      }
      const oldEmail = target.email;
      patch.email = normalized;
      await syncPasswordProviderAccountId(ctx, targetId, oldEmail, normalized);
    }

    if (Object.keys(patch).length === 0) {
      return { updated: true as const };
    }

    await ctx.db.patch(targetId, patch);
    return { updated: true as const };
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (ctx, { name, age, consentGiven }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throwErr("AUTH_001: Not authenticated");
    if (!consentGiven) throwErr("AUTH_005: Consent not given");
    if (age < 18) throwErr("AUTH_007: Must be 18 or older");

    const trimmed = name.trim();
    if (trimmed.length === 0) throwErr("DATA_001: Name is required");

    const existing = await ctx.db.get(userId);
    if (!existing) {
      throwErr(
        "DATA_003: User profile not initialized — sign in via auth before completing profile",
      );
    }
    if (existing.role !== "customer") {
      throwErr("PERM_001: Profile completion is only for customer accounts");
    }

    const now = Date.now();
    await ctx.db.patch(userId, {
      name: trimmed,
      age,
      consentGiven: true,
      consentGivenAt: now,
    });
    const updated = await ctx.db.get(userId);
    return sanitizeUser(updated);
  },
});

export const updateUser = mutation({
  args: {
    userId: v.optional(v.id("users")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { userId: argUserId, name, email, phone }) => {
    const viewer = await requireViewer(ctx);
    const targetId = argUserId ?? viewer.userId;

    if (viewer.role !== "admin" && viewer.userId !== targetId) {
      throwErr("PERM_001: Cannot update another user");
    }

    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");

    if (
      viewer.role === "customer" &&
      phone !== undefined &&
      target.phoneVerified === true
    ) {
      throwErr("PERM_001: Phone number can only be changed by an admin");
    }

    const patch: Partial<Doc<"users">> = {};

    if (name !== undefined) {
      const t = name.trim();
      if (t.length === 0) throwErr("DATA_001: Name is required");
      patch.name = t;
    }

    if (email !== undefined) {
      const normalized = email.trim().toLowerCase();
      const dup = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .first();
      if (dup && dup._id !== targetId) {
        throwErr("CLUB_003: Email already registered");
      }
      const oldEmail = target.email;
      patch.email = normalized;
      await syncPasswordProviderAccountId(ctx, targetId, oldEmail, normalized);
    }

    if (phone !== undefined) {
      const normalizedPhone = parseIndiaE164OrThrow(phone);
      const dup = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
        .first();
      if (dup !== null && dup._id !== targetId) {
        throwIfPhoneUnavailableForNewAccount(dup);
      }
      if (target.phone !== normalizedPhone) {
        patch.phone = normalizedPhone;
      }
    }

    if (Object.keys(patch).length === 0) {
      return sanitizeUser(target);
    }

    await ctx.db.patch(targetId, patch);
    const updated = await ctx.db.get(targetId);
    return sanitizeUser(updated);
  },
});

export const adminFreezeUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewer = await requireAdminViewer(ctx);
    if (targetUserId === viewer.userId) {
      throwErr("You cannot freeze your own account.");
    }
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role === "admin") {
      throwErr("Admin accounts cannot be frozen.");
    }
    if (target.isFrozen) {
      return { ok: true as const };
    }

    const now = Date.now();
    await ctx.db.patch(targetUserId, { isFrozen: true });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "user_freeze",
      targetUserId,
      previousValue: "false",
      newValue: "true",
      createdAt: now,
    });

    return { ok: true as const };
  },
});

export const adminUnfreezeUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewer = await requireAdminViewer(ctx);
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (!target.isFrozen) {
      return { ok: true as const };
    }

    const now = Date.now();
    await ctx.db.patch(targetUserId, { isFrozen: false });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "user_unfreeze",
      targetUserId,
      previousValue: "true",
      newValue: "false",
      createdAt: now,
    });

    return { ok: true as const };
  },
});

/** Remove a stale FCM token from whichever user row still holds it (FCM UNREGISTERED). */
// TODO: add a by_fcmToken index for O(1) lookup when user count grows
export const removeStaleToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      const tokens = u.fcmTokens ?? [];
      if (!tokens.includes(token)) continue;
      await ctx.db.patch(u._id, {
        fcmTokens: tokens.filter((t) => t !== token),
      });
      // FCM tokens are unique per device; first match is the only owner row.
      return;
    }
  },
});

export const adminPromoteToAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewer = await requireAdminViewer(ctx);
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role === "admin") {
      throwErr("PROMOTE_002: User is already an admin.");
    }
    if (target.role === "customer") {
      throwErr(
        "PROMOTE_001: Customers cannot be promoted. A new owner account must be registered via the Onboarding Website.",
      );
    }

    const now = Date.now();
    await ctx.db.patch(targetUserId, { role: "admin" });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "role_change",
      targetUserId,
      previousValue: "owner",
      newValue: "admin",
      createdAt: now,
    });

    return { ok: true as const };
  },
});

// TODO: migrate to Convex full-text search index when user count exceeds ~10,000
export const searchUsers = query({
  args: {
    searchText: v.optional(v.string()),
    roleFilter: v.optional(
      v.union(
        v.literal("admin"),
        v.literal("owner"),
        v.literal("customer"),
      ),
    ),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminViewer(ctx);

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const q = (args.searchText ?? "").trim().toLowerCase();

    const batch = await ctx.db.query("users").order("desc").take(USER_SEARCH_MAX_RAW + 1);
    const resultCapped = batch.length > USER_SEARCH_MAX_RAW;
    const raw = resultCapped ? batch.slice(0, USER_SEARCH_MAX_RAW) : batch;

    let filtered = raw;
    if (args.roleFilter !== undefined) {
      filtered = filtered.filter((u) => u.role === args.roleFilter);
    }
    if (q.length > 0) {
      filtered = filtered.filter((u) => {
        const name = u.name.toLowerCase();
        const phone = (u.phone ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      });
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);

    let offset = 0;
    if (args.cursor !== undefined && args.cursor.length > 0) {
      const n = parseInt(args.cursor, 10);
      if (!Number.isNaN(n) && n >= 0) {
        offset = n;
      }
    }

    const slice = filtered.slice(offset, offset + limit);
    const users = slice.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email ?? null,
      phone: u.phone ?? null,
      role: u.role,
      isFrozen: u.isFrozen,
      phoneVerified: u.phoneVerified,
      complaintCount: u.complaints.length,
      deletionRequested: u.deletionRequestedAt != null,
      createdAt: u.createdAt,
    }));

    const nextCursor =
      offset + limit < filtered.length ? String(offset + limit) : null;

    return {
      users,
      nextCursor,
      totalCount: filtered.length,
      resultCapped,
    };
  },
});

export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdminViewer(ctx);

    const u = await ctx.db.get(userId);
    if (!u) return null;

    const complaintDocs = await ctx.db
      .query("complaints")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    complaintDocs.sort((a, b) => b.createdAt - a.createdAt);

    const complaints = await Promise.all(
      complaintDocs.map(async (c) => {
        const club = await ctx.db.get(c.reportedByClubId);
        return {
          _id: c._id,
          type: c.type,
          description: c.description,
          reportedByClubId: c.reportedByClubId,
          clubName: club?.name ?? "Unknown club",
          createdAt: c.createdAt,
          removedAt: c.removedAt ?? null,
        };
      }),
    );

    const sessionRows = await ctx.db
      .query("sessionLogs")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .collect();

    const seenClub = new Set<string>();
    const clubAffiliations: { clubId: Id<"clubs">; clubName: string }[] = [];
    for (const row of sessionRows) {
      const key = row.clubId;
      if (seenClub.has(key)) continue;
      seenClub.add(key);
      clubAffiliations.push({ clubId: row.clubId, clubName: row.clubName });
      if (clubAffiliations.length >= 20) break;
    }

    const activeSessions = sessionRows
      .filter((r) => r.status === "active")
      .map((r) => ({
        sessionId: r.sessionId,
        clubName: r.clubName,
        tableLabel: r.tableLabel,
        startTime: r.startTime,
      }));

    let ownedClub: {
      clubId: Id<"clubs">;
      name: string;
      subscriptionStatus: "active" | "grace" | "frozen";
    } | null = null;
    if (u.role === "owner") {
      const club = await ctx.db
        .query("clubs")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique();
      if (club) {
        ownedClub = {
          clubId: club._id,
          name: club.name,
          subscriptionStatus: club.subscriptionStatus,
        };
      }
    }

    return {
      user: {
        _id: u._id,
        name: u.name,
        email: u.email ?? null,
        phone: u.phone ?? null,
        role: u.role,
        isFrozen: u.isFrozen,
        phoneVerified: u.phoneVerified,
        age: u.age,
        consentGiven: u.consentGiven,
        consentGivenAt: u.consentGivenAt ?? null,
        deletionRequestedAt: u.deletionRequestedAt ?? null,
        settingsPasscodeSet: u.role === "owner" ? u.settingsPasscodeSet : false,
        createdAt: u.createdAt,
      },
      complaints,
      clubAffiliations,
      activeSessions,
      ownedClub,
    };
  },
});

export const adminEditUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { userId: targetId, name, age, email }) => {
    const viewer = await requireAdminViewer(ctx);
    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");

    const patch: Partial<Doc<"users">> = {};
    const prevSnap: Record<string, string> = {};
    const newSnap: Record<string, string> = {};

    if (name !== undefined) {
      const t = name.trim();
      if (t.length < 2 || t.length > 100) {
        throwErr("DATA_001: Name must be 2–100 characters");
      }
      patch.name = t;
      prevSnap.name = target.name;
      newSnap.name = t;
    }

    if (age !== undefined) {
      if (age < 18) throwErr("AUTH_007: Must be 18 or older");
      patch.age = age;
      prevSnap.age = String(target.age);
      newSnap.age = String(age);
    }

    if (email !== undefined) {
      const normalized = email.trim().toLowerCase();
      if (!isValidEmailFormat(normalized)) {
        throwErr("DATA_001: Invalid email format");
      }
      const dup = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .first();
      if (dup !== null && dup._id !== targetId) {
        throwErr(
          "This email address is already registered to another account.",
        );
      }
      const oldEmail = target.email;
      patch.email = normalized;
      prevSnap.email = oldEmail ?? "";
      newSnap.email = normalized;
      await syncPasswordProviderAccountId(ctx, targetId, oldEmail, normalized);
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true as const };
    }

    const now = Date.now();
    await ctx.db.patch(targetId, patch);
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "admin_profile_edit",
      targetUserId: targetId,
      previousValue: JSON.stringify(prevSnap),
      newValue: JSON.stringify(newSnap),
      createdAt: now,
    });

    return { ok: true as const };
  },
});

export const adminUpdatePhone = mutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
  },
  handler: async (ctx, { userId: targetId, phone }) => {
    const viewer = await requireAdminViewer(ctx);
    const normalized = parseGenericE164OrThrow(phone);

    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");

    const dup = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .first();
    if (dup !== null && dup._id !== targetId) {
      throwErr("Phone number is already registered to another account.");
    }

    const prev = target.phone ?? "";
    const now = Date.now();
    await ctx.db.patch(targetId, {
      phone: normalized,
      phoneVerified: true,
    });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "phone_update",
      targetUserId: targetId,
      previousValue: prev,
      newValue: normalized,
      createdAt: now,
    });

    return { ok: true as const };
  },
});

export const adminResetOwnerPasscode = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetId }) => {
    const viewer = await requireAdminViewer(ctx);
    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role !== "owner") {
      throwErr("PERM_001: Passcode reset applies to owners only");
    }

    const now = Date.now();
    await ctx.db.patch(targetId, {
      settingsPasscodeHash: undefined,
      settingsPasscodeSet: false,
    });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "passcode_reset",
      targetUserId: targetId,
      previousValue: "set",
      newValue: "cleared",
      createdAt: now,
    });

    return { ok: true as const };
  },
});

export const internalAdminPreparePasswordReset = internalMutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    tokenHash: v.string(),
  },
  handler: async (ctx, { adminId, targetUserId, tokenHash }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("AUTH_001: Admin authentication required");
    }

    const target = await ctx.db.get(targetUserId);
    if (!target?.email) {
      throw new Error(
        "Cannot reset password: this user has no email address on file.",
      );
    }

    const normalizedEmail = target.email.trim().toLowerCase();
    const cutoff = Date.now() - PASSWORD_RESET_HOUR_MS;
    const rows = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_userId", (q) => q.eq("userId", targetUserId))
      .collect();
    const recent = rows.filter((r) => r.createdAt >= cutoff);
    if (recent.length >= MAX_PASSWORD_RESETS_PER_HOUR) {
      throw new Error("RATE_001: Password reset rate limit exceeded");
    }

    const now = Date.now();
    await ctx.db.insert("passwordResetTokens", {
      userId: targetUserId,
      tokenHash,
      type: "accountPassword",
      expiresAt: now + PASSWORD_RESET_HOUR_MS,
      used: false,
      createdAt: now,
    });

    await ctx.db.insert("adminAuditLog", {
      adminId,
      action: "password_reset",
      targetUserId,
      createdAt: now,
    });

    const acc = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", targetUserId).eq("provider", PASSWORD_PROVIDER),
      )
      .first();

    return {
      toEmail: acc?.providerAccountId ?? normalizedEmail,
    };
  },
});

export const getOwnerExportContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "owner") return null;
    return {
      role: u.role,
      email: u.email ?? null,
      lastExportAt: u.ownerDataExportRequestedAt ?? null,
      name: u.name,
    };
  },
});


