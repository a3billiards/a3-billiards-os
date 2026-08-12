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
  parseGenericE164OrThrow,
  throwIfPhoneUnavailableForNewAccount,
} from "./model/phoneRegistration";
import {
  assertAgeYears,
  assertDevicePushToken,
  assertEmailNormalized,
  assertTrimmedLength,
  MAX_NAME_LEN,
} from "./model/inputValidation";
import { requireAdminWithMfa, requireCustomer, requireOwner, requireViewer } from "./model/viewer";
import { ownerCanViewCustomer } from "./model/customerClubAccess";

const PASSWORD_PROVIDER = "password" as const;

const PASSWORD_RESET_HOUR_MS = 3_600_000;
const MAX_PASSWORD_RESETS_PER_HOUR = 3;
const USER_SEARCH_MAX_RAW = 200;

function throwErr(message: string): never {
  throw new Error(message);
}

function isValidEmailFormat(email: string): boolean {
  try {
    assertEmailNormalized(email);
    return true;
  } catch {
    return false;
  }
}

async function requireAdminViewer(ctx: QueryCtx | MutationCtx) {
  return requireAdminWithMfa(ctx);
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
    // Customer phone+password logins use E.164 as providerAccountId — do not remap to email.
    if (acc.providerAccountId.startsWith("+")) continue;
    if (oldEmail === undefined || acc.providerAccountId === oldEmail) {
      await ctx.db.patch(acc._id, { providerAccountId: newEmail });
      return;
    }
  }

  const first = accounts[0];
  if (first && !first.providerAccountId.startsWith("+")) {
    await ctx.db.patch(first._id, { providerAccountId: newEmail });
  }
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

const preferredLocaleV = v.union(
  v.literal("en"),
  v.literal("hi"),
  v.literal("ar"),
  v.literal("kn"),
  v.literal("ml"),
  v.literal("ta"),
  v.literal("te"),
  v.literal("fr"),
  v.literal("de"),
);

export const updatePreferredLocale = mutation({
  args: { locale: preferredLocaleV },
  handler: async (ctx, { locale }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throwErr("AUTH_001: Not authenticated");
    }
    await ctx.db.patch(userId, { preferredLocale: locale });
    return { locale };
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
      patch.name = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
        normalizeWs: true,
      });
    }

    if (age !== undefined) {
      patch.age = assertAgeYears(age);
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
      const normalized = assertEmailNormalized(email);
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
    assertAgeYears(age);

    const trimmed = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
      normalizeWs: true,
    });

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
      age: assertAgeYears(age),
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

    if (viewer.role === "admin" && targetId !== viewer.userId) {
      // Admin editing another user requires MFA (same bar as freeze/audit mutations).
      await requireAdminViewer(ctx);
    } else if (viewer.role !== "admin" && viewer.userId !== targetId) {
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
      patch.name = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
        normalizeWs: true,
      });
    }

    if (email !== undefined) {
      const normalized = assertEmailNormalized(email);
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
      const normalizedPhone = parseGenericE164OrThrow(phone);
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

/** Admin cancels a pending owner/customer account deletion while the user row still exists. */
export const adminCancelDeletion = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewer = await requireAdminViewer(ctx);
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role === "admin") {
      throwErr("Admin accounts cannot have deletion cancelled this way.");
    }
    if (target.deletionRequestedAt === undefined) {
      return { ok: true as const };
    }

    const now = Date.now();
    await ctx.db.patch(targetUserId, {
      deletionRequestedAt: undefined,
      deletionCancelToken: undefined,
    });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "deletion_cancelled",
      targetUserId,
      createdAt: now,
    });

    return { ok: true as const };
  },
});

/** Admin ends an owner club's A3 Billiards OS subscription (sets club status to frozen). */
export const adminEndClubSubscription = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewer = await requireAdminViewer(ctx);
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role !== "owner") {
      throwErr("Only owner accounts have a club subscription to end.");
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", targetUserId))
      .unique();
    if (!club) throwErr("Owner has no club on file.");

    if (club.subscriptionStatus === "frozen") {
      return { ok: true as const, alreadyEnded: true as const };
    }

    const previous = club.subscriptionStatus;
    const now = Date.now();
    await ctx.db.patch(club._id, { subscriptionStatus: "frozen" });

    // End live broadcasts so owners are not stuck unable to stop IVS after freeze.
    const liveStreams = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) =>
        q.eq("clubId", club._id).eq("status", "live"),
      )
      .collect();
    const stoppedChannelArns = new Set<string>();
    for (const stream of liveStreams) {
      await ctx.db.patch(stream._id, {
        status: "ended",
        endedAt: now,
        endedReason: "admin_force_ended",
      });
      await ctx.db.insert("liveStreamModerationLog", {
        clubId: club._id,
        liveStreamId: stream._id,
        adminId: viewer.userId,
        reason: "Subscription ended by admin",
        endedAt: now,
      });
      const channelArn = stream.ivsChannelArn ?? club.ivsChannelArn ?? "";
      if (channelArn && !stoppedChannelArns.has(channelArn)) {
        stoppedChannelArns.add(channelArn);
        await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, {
          channelArn,
        });
      }
    }

    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "subscription_ended",
      targetUserId,
      previousValue: previous,
      newValue: "frozen",
      notes: `Club: ${club.name}`,
      createdAt: now,
    });

    return { ok: true as const, alreadyEnded: false as const };
  },
});

/**
 * Save a push token (FCM or Expo) for the current authenticated user.
 * Called on app launch after permissions are granted. De-duplicates automatically.
 * Pass `remove: true` to unregister the token on logout / permission revoked.
 */
export const saveFcmToken = mutation({
  args: { token: v.string(), remove: v.optional(v.boolean()) },
  handler: async (ctx, { token, remove }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const user = await ctx.db.get(userId);
    if (!user) return;
    const safeToken = assertDevicePushToken(token);
    const existing = user.fcmTokens ?? [];
    if (remove) {
      if (!existing.includes(safeToken)) return;
      await ctx.db.patch(userId, {
        fcmTokens: existing.filter((t) => t !== safeToken),
      });
    } else {
      if (existing.includes(safeToken)) return;
      await ctx.db.patch(userId, { fcmTokens: [...existing, safeToken] });
    }
  },
});

/**
 * Deletes an orphaned authAccounts row (account exists but linked user was never created
 * or was deleted). Called from the password provider when createAccount returns user=null.
 */
export const deleteOrphanedAuthAccount = internalMutation({
  args: { accountId: v.id("authAccounts") },
  handler: async (ctx, { accountId }) => {
    const row = await ctx.db.get(accountId);
    if (!row) return;
    const linkedUser = row.userId ? await ctx.db.get(row.userId) : null;
    if (linkedUser) return; // user exists — don't touch it
    await ctx.db.delete(accountId);
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

    await ctx.runMutation(internal.adminAuth.assertOwnerReadyForAdminPromotion, {
      userId: targetUserId,
    });

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

/** Super-admin only: demote an admin back to owner. */
export const adminDemoteToOwner = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewer = await requireAdminViewer(ctx);
    const viewerUser = await ctx.db.get(viewer.userId);
    if (!viewerUser?.isSuperAdmin) {
      throwErr("PERM_001: Super admin only");
    }
    if (targetUserId === viewer.userId) {
      throwErr("DEMOTE_001: Cannot demote your own account");
    }

    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role !== "admin") {
      throwErr("DEMOTE_002: User is not an admin");
    }
    if (target.isSuperAdmin) {
      throwErr("DEMOTE_003: Cannot demote a super admin");
    }

    const now = Date.now();
    await ctx.db.patch(targetUserId, {
      role: "owner",
      adminMfaVerifiedAt: undefined,
    });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "role_change",
      targetUserId,
      previousValue: "admin",
      newValue: "owner",
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
    activeClubsOnly: v.optional(v.boolean()),
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

    if (args.activeClubsOnly) {
      const ownersOnly = await Promise.all(
        filtered.map(async (u) => {
          if (u.role !== "owner") return null;
          const club = await ctx.db
            .query("clubs")
            .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
            .unique();
          if (
            !club ||
            (club.subscriptionStatus !== "active" &&
              club.subscriptionStatus !== "grace")
          ) {
            return null;
          }
          return u;
        }),
      );
      filtered = ownersOnly.filter((u): u is (typeof filtered)[number] => u !== null);
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
    const users = await Promise.all(
      slice.map(async (u) => {
        let clubName: string | null = null;
        let subscriptionStatus: "active" | "grace" | "frozen" | null = null;
        if (u.role === "owner") {
          const club = await ctx.db
            .query("clubs")
            .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
            .unique();
          clubName = club?.name ?? null;
          subscriptionStatus = club?.subscriptionStatus ?? null;
        }
        return {
          _id: u._id,
          name: u.name,
          email: u.email ?? null,
          phone: u.phone ?? null,
          role: u.role,
          isFrozen: u.isFrozen,
          phoneVerified: u.phoneVerified,
          complaintCount: u.complaints.length,
          deletionRequested: u.deletionRequestedAt != null,
          hasPushToken: u.fcmTokens.length > 0,
          createdAt: u.createdAt,
          clubName,
          subscriptionStatus,
        };
      }),
    );

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

    let hasPasswordLogin = false;
    if (u.email) {
      const normalized = u.email.trim().toLowerCase();
      const passwordAcc = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", normalized),
        )
        .unique();
      hasPasswordLogin = passwordAcc?.userId === u._id;
    }

    return {
      user: {
        _id: u._id,
        name: u.name,
        email: u.email ?? null,
        phone: u.phone ?? null,
        role: u.role,
        isSuperAdmin: u.isSuperAdmin === true,
        hasPasswordLogin,
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
      const t = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
        normalizeWs: true,
      });
      patch.name = t;
      prevSnap.name = target.name;
      newSnap.name = t;
    }

    if (age !== undefined) {
      const validAge = assertAgeYears(age);
      patch.age = validAge;
      prevSnap.age = String(target.age);
      newSnap.age = String(validAge);
    }

    if (email !== undefined) {
      const normalized = assertEmailNormalized(email);
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

    // Always deliver to profile email — providerAccountId may be an E.164 phone for customers.
    return {
      toEmail: normalizedEmail,
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


