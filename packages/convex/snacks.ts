import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";

function normalizeSnackName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function ensurePositivePrice(price: number): void {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("DATA_002: Snack price must be a positive number");
  }
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

export const listSnacks = query({
  args: {
    clubId: v.id("clubs"),
  },
  handler: async (ctx, { clubId }) => {
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
      .filter((snack) => snack.isDeleted !== true)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listAvailableSnacks = query({
  args: {
    clubId: v.id("clubs"),
  },
  handler: async (ctx, { clubId }) => {
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
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createSnack = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    price: v.number(),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, name, price, roleId }) => {
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
    });
  },
});

export const updateSnack = mutation({
  args: {
    snackId: v.id("snacks"),
    name: v.string(),
    price: v.number(),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { snackId, name, price, roleId }) => {
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
    items: v.array(
      v.object({
        snackId: v.id("snacks"),
        qty: v.number(),
      }),
    ),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { sessionId, items, roleId }) => {
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
    for (const item of items) {
      ensurePositiveQty(item.qty);
      const snack = await ctx.db.get(item.snackId);
      if (!snack || snack.clubId !== owner.clubId || snack.isDeleted === true) {
        throw new Error("Snack item no longer available");
      }
      if (snack.isAvailable !== true) {
        throw new Error("Snack item no longer available");
      }
      nextOrders.push({
        snackId: snack._id,
        name: snack.name,
        qty: item.qty,
        priceAtOrder: snack.price,
      });
    }

    await ctx.db.patch(sessionId, {
      snackOrders: nextOrders,
      updatedAt: Date.now(),
    });

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
