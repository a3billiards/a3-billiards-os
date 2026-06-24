/**
 * Kitchen order fulfillment (PRD v28 §7.10) — operational tracker only; no billing impact.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { assertStaffTabAllowed } from "./model/staffTabAccess";
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
        items: o.items,
        status: o.status,
        createdAt: o.createdAt,
        preparingAt: o.preparingAt ?? null,
        readyAt: o.readyAt ?? null,
        servedAt: o.servedAt ?? null,
      })),
      timezone: club.timezone,
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
    await assertKitchenAccess(ctx, order.clubId, roleId);

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

    if (next === "ready") {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyKitchenOrderReady,
        { orderId },
      );
    }

    return { ok: true as const, status: next };
  },
});
