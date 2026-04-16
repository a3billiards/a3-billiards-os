/**
 * Staff role CRUD for owner settings. Active role is device-local; `setActiveRole` validates only.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { assertMutationClubScope, requireOwner, requireViewer } from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";

const TAB_VALUES = [
  "slots",
  "snacks",
  "financials",
  "complaints",
  "bookings",
] as const;

function assertAllowedTabs(tabs: string[]): void {
  if (tabs.length === 0) {
    throw new Error("STAFF_001: A role must have at least one allowed tab.");
  }
  for (const t of tabs) {
    if (!TAB_VALUES.includes(t as (typeof TAB_VALUES)[number])) {
      throw new Error(`DATA_002: Invalid tab "${t}"`);
    }
  }
}

async function requireOwnerClubWritable(ctx: MutationCtx, clubId: Id<"clubs">) {
  const viewer = await requireViewer(ctx);
  assertMutationClubScope(viewer, clubId);
  const club = await ctx.db.get(clubId);
  if (!club) throw new Error("DATA_003: Club not found");
  assertClubSubscriptionWritable(club);
  return viewer;
}

export const listStaffRoles = query({
  args: {},
  handler: async (ctx) => {
    const owner = requireOwner(await requireViewer(ctx));
    return ctx.db
      .query("staffRoles")
      .withIndex("by_club", (q) => q.eq("clubId", owner.clubId))
      .collect();
  },
});

export const createRole = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    allowedTabs: v.array(v.string()),
    allowedTableIds: v.optional(v.array(v.id("tables"))),
    canFileComplaints: v.boolean(),
    canApplyDiscount: v.boolean(),
    maxDiscountPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwnerClubWritable(ctx, args.clubId);
    const n = args.name.trim();
    if (n.length === 0) throw new Error("DATA_002: Role name is required");
    assertAllowedTabs(args.allowedTabs);
    if (
      args.allowedTableIds !== undefined &&
      args.allowedTableIds.length > 0
    ) {
      for (const tid of args.allowedTableIds) {
        const t = await ctx.db.get(tid);
        if (!t || t.clubId !== args.clubId) {
          throw new Error("DATA_003: Table not found");
        }
      }
    }
    const maxDisc =
      args.maxDiscountPercent !== undefined
        ? Math.min(100, Math.max(0, args.maxDiscountPercent))
        : args.canApplyDiscount
          ? 10
          : undefined;

    const roleId = await ctx.db.insert("staffRoles", {
      clubId: args.clubId,
      name: n,
      allowedTabs: args.allowedTabs,
      allowedTableIds:
        args.allowedTableIds && args.allowedTableIds.length > 0
          ? args.allowedTableIds
          : undefined,
      canFileComplaints: args.canFileComplaints,
      canApplyDiscount: args.canApplyDiscount,
      maxDiscountPercent: args.canApplyDiscount ? maxDisc : undefined,
    });
    return { roleId };
  },
});

export const updateRole = mutation({
  args: {
    roleId: v.id("staffRoles"),
    name: v.optional(v.string()),
    allowedTabs: v.optional(v.array(v.string())),
    allowedTableIds: v.optional(v.array(v.id("tables"))),
    canFileComplaints: v.optional(v.boolean()),
    canApplyDiscount: v.optional(v.boolean()),
    maxDiscountPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = requireOwner(await requireViewer(ctx));
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== owner.clubId) {
      throw new Error("DATA_003: Staff role not found");
    }
    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    const patch: Partial<Doc<"staffRoles">> = {};
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (n.length === 0) throw new Error("DATA_002: Role name is required");
      patch.name = n;
    }
    if (args.allowedTabs !== undefined) {
      assertAllowedTabs(args.allowedTabs);
      patch.allowedTabs = args.allowedTabs;
    }
    if (args.allowedTableIds !== undefined) {
      if (args.allowedTableIds.length > 0) {
        for (const tid of args.allowedTableIds) {
          const t = await ctx.db.get(tid);
          if (!t || t.clubId !== owner.clubId) {
            throw new Error("DATA_003: Table not found");
          }
        }
        patch.allowedTableIds = args.allowedTableIds;
      } else {
        patch.allowedTableIds = undefined;
      }
    }
    if (args.canFileComplaints !== undefined) {
      patch.canFileComplaints = args.canFileComplaints;
    }
    if (args.canApplyDiscount !== undefined) {
      patch.canApplyDiscount = args.canApplyDiscount;
    }
    if (args.maxDiscountPercent !== undefined) {
      patch.maxDiscountPercent = Math.min(
        100,
        Math.max(0, args.maxDiscountPercent),
      );
    }
    await ctx.db.patch(args.roleId, patch);
    return { ok: true as const };
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("staffRoles") },
  handler: async (ctx, { roleId }) => {
    const owner = requireOwner(await requireViewer(ctx));
    const role = await ctx.db.get(roleId);
    if (!role || role.clubId !== owner.clubId) {
      throw new Error("DATA_003: Staff role not found");
    }
    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await ctx.db.delete(roleId);
    return { deleted: true as const };
  },
});

/** Validates role belongs to club. Active role is stored client-side only. */
export const setActiveRole = mutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    const viewer = await requireViewer(ctx);
    requireOwner(viewer);
    assertMutationClubScope(viewer, clubId);
    if (roleId === undefined) {
      return { ok: true as const, unrestricted: true as const };
    }
    const role = await ctx.db.get(roleId);
    if (!role || role.clubId !== clubId) {
      throw new Error("DATA_003: Staff role not found");
    }
    return { ok: true as const, roleId };
  },
});
