"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const adminExportAllUsersData = action({
  args: {
    roleFilter: v.optional(
      v.union(v.literal("admin"), v.literal("owner"), v.literal("customer")),
    ),
  },
  handler: async (ctx, { roleFilter }) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const payload = await ctx.runQuery(internal.dataExports.buildAdminUsersExport, {
      adminId,
      roleFilter,
    });

    await ctx.runMutation(internal.dataExportMutations.logAdminExport, {
      adminId,
      exportKind: "all_users",
      detail: JSON.stringify({
        roleFilter: roleFilter ?? "all",
        userCount: payload.userCount,
        truncated: payload.truncated,
      }),
    });

    return payload;
  },
});

export const adminExportUserData = action({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const payload = await ctx.runQuery(
      internal.dataExports.buildAdminSingleUserExport,
      { adminId, targetUserId },
    );

    await ctx.runMutation(internal.dataExportMutations.logAdminExport, {
      adminId,
      exportKind: "single_user",
      targetUserId,
      detail: JSON.stringify({ targetUserId }),
    });

    return payload;
  },
});

export const ownerExportClubMembersData = action({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    return ctx.runQuery(internal.dataExports.buildClubMembersExport, {
      ownerId,
      clubId,
    });
  },
});
