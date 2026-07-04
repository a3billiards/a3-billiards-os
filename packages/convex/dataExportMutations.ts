import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const logAdminExport = internalMutation({
  args: {
    adminId: v.id("users"),
    exportKind: v.union(v.literal("all_users"), v.literal("single_user")),
    targetUserId: v.optional(v.id("users")),
    detail: v.string(),
  },
  handler: async (ctx, { adminId, exportKind, targetUserId, detail }) => {
    await ctx.db.insert("adminAuditLog", {
      adminId,
      action: "data_export",
      targetUserId,
      newValue: `${exportKind}:${detail}`,
      createdAt: Date.now(),
    });
  },
});
