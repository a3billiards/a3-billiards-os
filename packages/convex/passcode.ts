/**
 * Owner settings passcode — internal DB helpers and admin clear mutation.
 * Crypto (bcrypt) lives in passcodeActions.ts (Node actions).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { requireAdmin, requireViewer } from "./model/viewer";

export type { PasscodePermissions } from "./model/passcodePermissions";
export {
  ownerUnrestrictedPermissions,
  permissionsFromStaffRole,
} from "./model/passcodePermissions";

export const getOwnerVerifyContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const uid = await getAuthUserId(ctx);
    if (uid === null) return null;
    const u = await ctx.db.get(uid);
    if (!u || u.role !== "owner") return null;
    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", uid))
      .unique();
    if (!club) return null;
    return {
      userId: uid,
      clubId: club._id,
      settingsPasscodeSet: u.settingsPasscodeSet,
      settingsPasscodeHash: u.settingsPasscodeHash ?? null,
    };
  },
});

export const getUserEmailForPasscode = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const authed = await getAuthUserId(ctx);
    if (authed !== userId) return null;
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "owner") return null;
    return { email: u.email ?? null };
  },
});

export const getStaffRoleForClub = internalQuery({
  args: {
    staffRoleId: v.id("staffRoles"),
    clubId: v.id("clubs"),
  },
  handler: async (ctx, { staffRoleId, clubId }) => {
    const role = await ctx.db.get(staffRoleId);
    if (!role || role.clubId !== clubId) return null;
    return role;
  },
});

export const applySetupPasscode = internalMutation({
  args: {
    userId: v.id("users"),
    passcodeHash: v.string(),
  },
  handler: async (ctx, { userId, passcodeHash }) => {
    const authed = await getAuthUserId(ctx);
    if (authed === null || authed !== userId) {
      throw new Error("AUTH_001: Not authenticated");
    }
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    if (u.settingsPasscodeSet && u.settingsPasscodeHash) {
      throw new Error("PASSCODE_003: Passcode already set");
    }
    await ctx.db.patch(userId, {
      settingsPasscodeHash: passcodeHash,
      settingsPasscodeSet: true,
    });
  },
});

export const clearPasscodeStateForOwner = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const authed = await getAuthUserId(ctx);
    if (authed === null || authed !== userId) {
      throw new Error("AUTH_001: Not authenticated");
    }
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    await ctx.db.patch(userId, {
      settingsPasscodeHash: undefined,
      settingsPasscodeSet: false,
    });
  },
});

/**
 * Admin clears owner settings passcode; owner must set a new PIN on next Settings access.
 */
export const clearPasscode = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const admin = requireAdmin(await requireViewer(ctx));
    const target = await ctx.db.get(targetUserId);
    if (!target) {
      throw new Error("DATA_003: User not found");
    }
    if (target.role !== "owner") {
      throw new Error("PERM_001: Target must be a club owner");
    }

    const hadPasscode = target.settingsPasscodeSet ? "true" : "false";
    await ctx.db.patch(targetUserId, {
      settingsPasscodeHash: undefined,
      settingsPasscodeSet: false,
    });

    await ctx.db.insert("adminAuditLog", {
      adminId: admin.userId,
      action: "passcode_reset",
      targetUserId,
      previousValue: hadPasscode,
      newValue: "cleared",
      createdAt: Date.now(),
    });

    return { success: true as const };
  },
});
