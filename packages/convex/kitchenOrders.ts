/**
 * Kitchen order fulfillment (PRD v28 §7.10) — operational tracker only; no billing impact.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { assertStaffTabAllowed, isChefKitchenRole } from "./model/staffTabAccess";
import { compareYmd, toClubDate } from "@a3/utils/timezone";
import { internal } from "./_generated/api";

type KitchenStatus = "pending" | "preparing" | "ready" | "served";

const NEXT_STATUS: Record<
  Exclude<KitchenStatus, "served">,
  KitchenStatus
> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

async function assertKitchenAccess(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  const viewer = await requireViewer(ctx);
  requireOwner(viewer);
  if (viewer.clubId !== clubId) {
    throw new Error("PERM_001: Cannot access another club's data");
  }
  await assertStaffTabAllowed(ctx, clubId, "kitchen", roleId);
}

async function assertChefKitchenAccess(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  const viewer = await requireViewer(ctx);
  requireOwner(viewer);
  if (viewer.clubId !== clubId) {
    throw new Error("PERM_001: Cannot access another club's data");
  }
  if (!roleId) {
    throw new Error("PERM_001: Switch to Chef role to manage kitchen orders");
  }
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error("PERM_001: Staff role not found");
  }
  if (!isChefKitchenRole(role.allowedTabs)) {
    throw new Error("PERM_001: Only Chef role can manage kitchen orders");
  }
}

export async function insertKitchenOrderForSnackBatch(
  ctx: MutationCtx,
  args: {
    clubId: Id<"clubs">;
    sessionId: Id<"sessions">;
    tableId: Id<"tables">;
    items: {
      snackId: Id<"snacks">;
      name: string;
      qty: number;
      priceAtOrder: number;
    }[];
  },
): Promise<Id<"kitchenOrders">> {
  const now = Date.now();
  const orderId = await ctx.db.insert("kitchenOrders", {
    clubId: args.clubId,
    sessionId: args.sessionId,
    tableId: args.tableId,
    items: args.items,
    status: "pending",
    createdAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.notifyKitchenNewOrder, {
    orderId,
  });
  return orderId;
}

export const listKitchenMenuItems = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    await assertKitchenAccess(ctx, clubId, roleId);

    const snacks = await ctx.db
      .query("snacks")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();

    return snacks
      .filter((snack) => snack.isDeleted !== true)
      .filter((snack) => (snack.fulfillmentType ?? "counter") === "kitchen")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((snack) => ({
        snackId: snack._id,
        name: snack.name,
        price: snack.price,
        isAvailable: snack.isAvailable === true,
      }));
  },
});

export const listKitchenOrders = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
    todayYmd: v.optional(v.string()),
  },
  handler: async (ctx, { clubId, roleId, todayYmd }) => {
    await assertKitchenAccess(ctx, clubId, roleId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");

    const role = roleId ? await ctx.db.get(roleId) : null;
    const chefMode = role ? isChefKitchenRole(role.allowedTabs) : false;
    const ownerView = !roleId;
    if (!chefMode && !ownerView) {
      return { orders: [], timezone: club.timezone, viewMode: "none" as const };
    }

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    const tableLabelById = new Map(tables.map((t) => [t._id, t.label]));

    const activeStatuses: KitchenStatus[] = ["pending", "preparing", "ready"];
    const orders: Doc<"kitchenOrders">[] = [];

    for (const status of activeStatuses) {
      const rows = await ctx.db
        .query("kitchenOrders")
        .withIndex("by_club_status", (q) =>
          q.eq("clubId", clubId).eq("status", status),
        )
        .collect();
      orders.push(...rows);
    }

    const servedTodayYmd =
      todayYmd ?? toClubDate(Date.now(), club.timezone);
    const served = await ctx.db
      .query("kitchenOrders")
      .withIndex("by_club_status", (q) =>
        q.eq("clubId", clubId).eq("status", "served"),
      )
      .collect();
    for (const row of served) {
      if (row.servedAt == null) continue;
      const ymd = toClubDate(row.servedAt, club.timezone);
      if (compareYmd(ymd, servedTodayYmd) === 0) {
        orders.push(row);
      }
    }

    orders.sort((a, b) => {
      const statusOrder: Record<KitchenStatus, number> = {
        pending: 0,
        preparing: 1,
        ready: 2,
        served: 3,
      };
      const sd = statusOrder[a.status] - statusOrder[b.status];
      if (sd !== 0) return sd;
      return a.createdAt - b.createdAt;
    });

    return {
      orders: orders.map((o) => ({
        orderId: o._id,
        sessionId: o.sessionId,
        tableId: o.tableId,
        tableLabel: tableLabelById.get(o.tableId) ?? "[Removed table]",
        items: o.items.map((item) => ({
          snackId: item.snackId,
          name: item.name,
          qty: item.qty,
        })),
        status: o.status,
        unavailablePending: o.unavailablePending === true,
        unavailableConfirmed: o.unavailableConfirmed === true,
        createdAt: o.createdAt,
        preparingAt: o.preparingAt ?? null,
        readyAt: o.readyAt ?? null,
        servedAt: o.servedAt ?? null,
      })),
      timezone: club.timezone,
      viewMode: chefMode ? ("chef" as const) : ("owner" as const),
    };
  },
});

export const advanceKitchenOrder = mutation({
  args: {
    orderId: v.id("kitchenOrders"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { orderId, roleId }) => {
    const viewer = await requireViewer(ctx);
    requireOwner(viewer);

    const order = await ctx.db.get(orderId);
    if (!order || order.clubId !== viewer.clubId) {
      throw new Error("DATA_003: Kitchen order not found");
    }

    const club = await ctx.db.get(order.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await assertChefKitchenAccess(ctx, order.clubId, roleId);

    if (order.status === "served") {
      throw new Error("DATA_002: Order is already served");
    }

    const next = NEXT_STATUS[order.status];
    const now = Date.now();
    const patch: Partial<Doc<"kitchenOrders">> = { status: next };

    if (next === "preparing") {
      patch.preparingAt = now;
      patch.preparingByRoleId = roleId;
    } else if (next === "ready") {
      patch.readyAt = now;
      patch.readyByRoleId = roleId;
    } else if (next === "served") {
      patch.servedAt = now;
      patch.servedByRoleId = roleId;
    }

    await ctx.db.patch(orderId, patch);

    if (next === "preparing" || next === "ready" || next === "served") {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyKitchenOrderStatus,
        { orderId, status: next },
      );
    }

    return { ok: true as const, status: next };
  },
});

async function assertOwnerConfirmAccess(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  const viewer = await requireViewer(ctx);
  requireOwner(viewer);
  if (viewer.clubId !== clubId) {
    throw new Error("PERM_001: Cannot access another club's data");
  }
  if (roleId) {
    const role = await ctx.db.get(roleId);
    if (role && isChefKitchenRole(role.allowedTabs)) {
      throw new Error("PERM_001: Switch to owner mode to confirm unavailable items");
    }
  }
}

export const requestKitchenOrderUnavailable = mutation({
  args: {
    orderId: v.id("kitchenOrders"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { orderId, roleId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("DATA_003: Kitchen order not found");

    const club = await ctx.db.get(order.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await assertChefKitchenAccess(ctx, order.clubId, roleId);

    if (order.status !== "pending") {
      throw new Error("DATA_002: Only pending orders can be marked unavailable");
    }
    if (order.unavailablePending === true) {
      throw new Error("DATA_002: Unavailable already reported for this order");
    }
    if (order.unavailableConfirmed === true) {
      throw new Error("DATA_002: Order already confirmed unavailable");
    }

    await ctx.db.patch(orderId, { unavailablePending: true });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.notifyKitchenOrderUnavailable,
      { orderId },
    );

    return { ok: true as const };
  },
});

export const confirmKitchenOrderUnavailable = mutation({
  args: {
    orderId: v.id("kitchenOrders"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { orderId, roleId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("DATA_003: Kitchen order not found");

    const club = await ctx.db.get(order.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await assertOwnerConfirmAccess(ctx, order.clubId, roleId);

    if (order.unavailablePending !== true) {
      throw new Error("DATA_002: No pending unavailable report for this order");
    }
    if (order.unavailableConfirmed === true) {
      throw new Error("DATA_002: Order already confirmed unavailable");
    }

    await ctx.db.patch(orderId, { unavailableConfirmed: true });

    const snackIds = new Set(order.items.map((i) => i.snackId));
    for (const snackId of snackIds) {
      const snack = await ctx.db.get(snackId);
      if (snack && snack.clubId === order.clubId && snack.isDeleted !== true) {
        await ctx.db.patch(snackId, { isAvailable: false });
      }
    }

    return { ok: true as const };
  },
});

export const toggleKitchenSnackAvailability = mutation({
  args: {
    snackId: v.id("snacks"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { snackId, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);

    const snack = await ctx.db.get(snackId);
    if (!snack || snack.clubId !== owner.clubId) {
      throw new Error("DATA_003: Snack item not found");
    }
    if (snack.isDeleted === true) {
      throw new Error("DATA_003: Cannot toggle deleted snack item");
    }
    if ((snack.fulfillmentType ?? "counter") !== "kitchen") {
      throw new Error("DATA_002: Only kitchen items can be toggled here");
    }

    const club = await ctx.db.get(snack.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await assertChefKitchenAccess(ctx, snack.clubId, roleId);

    const isAvailable = snack.isAvailable !== true;
    await ctx.db.patch(snackId, { isAvailable });
    return { success: true as const, isAvailable };
  },
});
