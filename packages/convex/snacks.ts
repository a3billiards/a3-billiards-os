import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import {
  assertTrimmedLength,
  assertFiniteInRange,
  MAX_SNACK_NAME_LEN,
} from "./model/inputValidation";

function normalizeSnackName(name: string): string {
  return assertTrimmedLength("Snack name", name, 1, MAX_SNACK_NAME_LEN, {
    normalizeWs: true,
  });
}

function ensurePositivePrice(price: number): void {
  assertFiniteInRange("Snack price", price, 0.01, 1_000_000);
}

function ensurePositiveQty(qty: number): void {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error("DATA_002: Snack qty must be a positive integer");
  }
}

async function assertSnacksTabPermission(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  if (!roleId) return;
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error("PERM_001: Staff role not found");
  }
  if (!role.allowedTabs.includes("snacks")) {
    throw new Error("PERM_001: Snacks tab not allowed for active role");
  }
}

import { assertStaffTabAllowed } from "./model/staffTabAccess";
import { insertKitchenOrderForSnackBatch } from "./kitchenOrders";

type SnackFulfillmentType = "counter" | "kitchen";

function resolveSnackFulfillmentType(
  snack: { fulfillmentType?: SnackFulfillmentType },
): SnackFulfillmentType {
  return snack.fulfillmentType ?? "counter";
}

const snackFulfillmentTypeValidator = v.union(
  v.literal("counter"),
  v.literal("kitchen"),
);

export const listSnacks = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Cannot access another club's data");
    }
    await assertStaffTabAllowed(ctx, clubId, "snacks", roleId);

    const snacks = await ctx.db
      .query("snacks")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();

    return snacks
      .filter((snack) => snack.isDeleted !== true)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listAvailableSnacks = query({
  args: {
    clubId: v.id("clubs"),
    fulfillmentType: v.optional(snackFulfillmentTypeValidator),
  },
  handler: async (ctx, { clubId, fulfillmentType }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Cannot access another club's data");
    }

    const snacks = await ctx.db
      .query("snacks")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();

    return snacks
      .filter((snack) => snack.isDeleted !== true && snack.isAvailable === true)
      .filter(
        (snack) =>
          fulfillmentType === undefined ||
          resolveSnackFulfillmentType(snack) === fulfillmentType,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createSnack = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    price: v.number(),
    fulfillmentType: v.optional(snackFulfillmentTypeValidator),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, name, price, fulfillmentType, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Cannot access another club's data");
    }
    await assertSnacksTabPermission(ctx, clubId, roleId);

    const cleanedName = normalizeSnackName(name);
    if (!cleanedName) {
      throw new Error("DATA_002: Snack name is required");
    }
    ensurePositivePrice(price);

    return await ctx.db.insert("snacks", {
      clubId,
      name: cleanedName,
      price,
      isAvailable: true,
      isDeleted: false,
      fulfillmentType: fulfillmentType ?? "counter",
    });
  },
});

export const updateSnack = mutation({
  args: {
    snackId: v.id("snacks"),
    name: v.string(),
    price: v.number(),
    fulfillmentType: v.optional(snackFulfillmentTypeValidator),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { snackId, name, price, fulfillmentType, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);

    const snack = await ctx.db.get(snackId);
    if (!snack || snack.clubId !== owner.clubId) {
      throw new Error("DATA_003: Snack item not found");
    }
    if (snack.isDeleted === true) {
      throw new Error("DATA_003: Cannot edit deleted snack item");
    }
    await assertSnacksTabPermission(ctx, owner.clubId, roleId);

    const cleanedName = normalizeSnackName(name);
    if (!cleanedName) {
      throw new Error("DATA_002: Snack name is required");
    }
    ensurePositivePrice(price);

    await ctx.db.patch(snackId, {
      name: cleanedName,
      price,
      ...(fulfillmentType !== undefined ? { fulfillmentType } : {}),
    });
    return { success: true as const };
  },
});

export const toggleSnackAvailability = mutation({
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
    await assertSnacksTabPermission(ctx, owner.clubId, roleId);

    await ctx.db.patch(snackId, {
      isAvailable: !snack.isAvailable,
    });
    return { success: true as const };
  },
});

export const deleteSnack = mutation({
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
    await assertSnacksTabPermission(ctx, owner.clubId, roleId);

    if (snack.isDeleted !== true) {
      await ctx.db.patch(snackId, {
        isDeleted: true,
      });
    }

    return { success: true as const };
  },
});

export const addSnacksToSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    fulfillmentType: snackFulfillmentTypeValidator,
    items: v.array(
      v.object({
        snackId: v.id("snacks"),
        qty: v.number(),
      }),
    ),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { sessionId, fulfillmentType, items, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);

    const session = await ctx.db.get(sessionId);
    if (!session || session.clubId !== owner.clubId) {
      throw new Error("DATA_003: Session not found");
    }
    await assertSnacksTabPermission(ctx, owner.clubId, roleId);

    if (items.length === 0) {
      throw new Error("DATA_002: Select at least one snack item");
    }

    if (session.status === "cancelled") {
      throw new Error("Cannot add snacks to a cancelled session");
    }
    if (session.status === "completed" && session.paymentStatus === "paid") {
      throw new Error("Cannot add snacks after session is paid");
    }

    const nextOrders = [...session.snackOrders];
    const batchItems: {
      snackId: Id<"snacks">;
      name: string;
      qty: number;
      priceAtOrder: number;
    }[] = [];
    for (const item of items) {
      ensurePositiveQty(item.qty);
      const snack = await ctx.db.get(item.snackId);
      if (!snack || snack.clubId !== owner.clubId || snack.isDeleted === true) {
        throw new Error("Snack item no longer available");
      }
      if (snack.isAvailable !== true) {
        throw new Error("Snack item no longer available");
      }
      if (resolveSnackFulfillmentType(snack) !== fulfillmentType) {
        throw new Error(
          `DATA_002: Selected items must be ${fulfillmentType === "kitchen" ? "kitchen" : "counter"} items`,
        );
      }
      const line = {
        snackId: snack._id,
        name: snack.name,
        qty: item.qty,
        priceAtOrder: snack.price,
      };
      nextOrders.push(line);
      batchItems.push(line);
    }

    await ctx.db.patch(sessionId, {
      snackOrders: nextOrders,
      updatedAt: Date.now(),
    });

    if (fulfillmentType === "kitchen" && batchItems.length > 0) {
      await insertKitchenOrderForSnackBatch(ctx, {
        clubId: session.clubId,
        sessionId,
        tableId: session.tableId,
        items: batchItems,
      });
    }

    return { success: true as const };
  },
});

export const getSessionSnackEligibility = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    const session = await ctx.db.get(sessionId);
    if (!session || session.clubId !== owner.clubId) {
      throw new Error("DATA_003: Session not found");
    }
    return {
      status: session.status,
      paymentStatus: session.paymentStatus,
    };
  },
});
