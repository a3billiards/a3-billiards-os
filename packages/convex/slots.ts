/**
 * Owner table management (add / rename / type / disable / re-enable).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  assertMutationClubScope,
  requireOwnerWithClub,
  requireViewer,
} from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";

async function loadOwnerClub(ctx: MutationCtx) {
  const owner = requireOwnerWithClub(await requireViewer(ctx));
  const club = await ctx.db.get(owner.clubId);
  if (!club) throw new Error("DATA_003: Club not found");
  assertClubSubscriptionWritable(club);
  return { owner, club };
}

export const listTablesForSettings = query({
  args: {},
  handler: async (ctx) => {
    const owner = requireOwnerWithClub(await requireViewer(ctx));
    return ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", owner.clubId))
      .collect();
  },
});

export const addTable = mutation({
  args: {
    clubId: v.id("clubs"),
    label: v.string(),
    tableType: v.optional(v.string()),
    floor: v.optional(v.string()),
  },
  handler: async (ctx, { clubId, label, tableType, floor }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    const t = label.trim();
    if (t.length === 0 || t.length > 50) {
      throw new Error("DATA_002: Table label must be 1–50 characters");
    }
    const tt = tableType?.trim().toLowerCase();
    const fl = floor?.trim();

    const tableId = await ctx.db.insert("tables", {
      clubId,
      label: t,
      isActive: true,
      tableType: tt && tt.length > 0 ? tt : undefined,
      floor: fl && fl.length > 0 ? fl : undefined,
    });
    return { tableId };
  },
});

export const renameTable = mutation({
  args: {
    tableId: v.id("tables"),
    label: v.string(),
  },
  handler: async (ctx, { tableId, label }) => {
    const { owner } = await loadOwnerClub(ctx);
    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    const t = label.trim();
    if (t.length === 0 || t.length > 50) {
      throw new Error("DATA_002: Table label must be 1–50 characters");
    }
    await ctx.db.patch(tableId, { label: t });
    return { ok: true as const };
  },
});

export const updateTableType = mutation({
  args: {
    tableId: v.id("tables"),
    tableType: v.string(),
  },
  handler: async (ctx, { tableId, tableType }) => {
    const { owner } = await loadOwnerClub(ctx);
    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    const tt = tableType.trim().toLowerCase();
    await ctx.db.patch(tableId, {
      tableType: tt.length > 0 ? tt : undefined,
    });
    return { ok: true as const };
  },
});

export const disableTable = mutation({
  args: { tableId: v.id("tables") },
  handler: async (ctx, { tableId }) => {
    const { owner } = await loadOwnerClub(ctx);
    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (table.currentSessionId != null) {
      throw new Error(
        "Cannot disable a table with an active session. End or cancel the session first.",
      );
    }
    await ctx.db.patch(tableId, { isActive: false });
    return { ok: true as const };
  },
});

export const enableTable = mutation({
  args: { tableId: v.id("tables") },
  handler: async (ctx, { tableId }) => {
    const { owner } = await loadOwnerClub(ctx);
    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    await ctx.db.patch(tableId, { isActive: true });
    return { ok: true as const };
  },
});
