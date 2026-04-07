/**
 * User profile API: queries, mutations, and account lifecycle.
 * Deletion token hashing runs in an action (crypto in actions only).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  parseIndiaE164OrThrow,
  throwIfPhoneUnavailableForNewAccount,
} from "./model/phoneRegistration";
import { requireAdmin, requireOwner, requireViewer } from "./model/viewer";

const PASSWORD_PROVIDER = "password" as const;

function throwErr(message: string): never {
  throw new Error(message);
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
    const ok = await ownerCanViewCustomer(ctx, owner.clubId, targetId);
    if (!ok) throwErr("PERM_001: Cannot access this user");
    return sanitizeUser(target);
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

    if (viewer.role === "customer" && phone !== undefined) {
      throwErr("PERM_001: Phone number can only be changed by an admin");
    }

    const target = await ctx.db.get(targetId);
    if (!target) throwErr("DATA_003: User not found");

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
      patch.phone = normalizedPhone;
    }

    if (Object.keys(patch).length === 0) {
      return sanitizeUser(target);
    }

    await ctx.db.patch(targetId, patch);
    const updated = await ctx.db.get(targetId);
    return sanitizeUser(updated);
  },
});

export const freezeUser = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const viewer = requireAdmin(await requireViewer(ctx));
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.isFrozen) {
      return sanitizeUser(target);
    }

    await ctx.db.patch(targetUserId, { isFrozen: true });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "user_freeze",
      targetUserId,
      previousValue: "false",
      newValue: "true",
      createdAt: Date.now(),
    });

    const updated = await ctx.db.get(targetUserId);
    return sanitizeUser(updated);
  },
});

export const applyDeletionRequest = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
  },
  handler: async (ctx, { userId, tokenHash }) => {
    await ctx.db.patch(userId, {
      deletionRequestedAt: Date.now(),
      deletionCancelToken: tokenHash,
    });
  },
});

export const promoteToAdmin = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const viewer = requireAdmin(await requireViewer(ctx));
    const target = await ctx.db.get(targetUserId);
    if (!target) throwErr("DATA_003: User not found");
    if (target.role === "customer") {
      throwErr("PROMOTE_001: Customers cannot be promoted. Register via Onboarding Website.");
    }
    if (target.role === "admin") {
      throwErr("PROMOTE_002: User is already an admin.");
    }
    if (target.role !== "owner") {
      throwErr("PROMOTE_001: Customers cannot be promoted. Register via Onboarding Website.");
    }

    const prev = target.role;
    await ctx.db.patch(targetUserId, { role: "admin" });
    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "role_change",
      targetUserId,
      previousValue: prev,
      newValue: "admin",
      createdAt: Date.now(),
    });

    const updated = await ctx.db.get(targetUserId);
    return sanitizeUser(updated);
  },
});
