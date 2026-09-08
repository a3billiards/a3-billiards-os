/**
 * Owner desk: find registered customers for walk-in / slot allotment.
 *
 * Platform-wide customer search is intentional (desk must find first-time visitors
 * who registered on the app). Access control: authenticated owner + clubId scope
 * check only; see ACCESS_CONTROL_MATRIX "users (desk lookup)".
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { parseGenericE164OrThrow } from "./model/phoneRegistration";
import { requireOwner, requireViewer } from "./model/viewer";

const NAME_SEARCH_MAX = 40;

export const searchCustomersByName = query({
  args: {
    clubId: v.id("clubs"),
    nameQuery: v.string(),
  },
  handler: async (ctx, { clubId, nameQuery }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Owner only");
    }

    const q = nameQuery.trim().toLowerCase();
    if (q.length < 2) {
      return { users: [] as const };
    }

    const batch = await ctx.db.query("users").order("desc").take(500);
    const matches = batch
      .filter(
        (u) =>
          u.role === "customer" &&
          u.phoneVerified === true &&
          u.name.toLowerCase().includes(q),
      )
      .slice(0, NAME_SEARCH_MAX)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        phone: u.phone ?? null,
      }));

    return { users: matches };
  },
});

export const getCustomerForWalkIn = query({
  args: {
    clubId: v.id("clubs"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { clubId, customerId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Owner only");
    }

    const user = await ctx.db.get(customerId);
    if (!user || user.role !== "customer" || !user.phoneVerified) {
      return { ok: false as const, message: "Customer not found or not verified." };
    }
    return {
      ok: true as const,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone ?? null,
      },
    };
  },
});

/** Parse QR payload: `a3customer:<userId>` or E.164 phone. */
export const resolveCustomerQrPayload = query({
  args: {
    clubId: v.id("clubs"),
    payload: v.string(),
  },
  handler: async (ctx, { clubId, payload }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Owner only");
    }

    const trimmed = payload.trim();
    const customerPrefix = "a3customer:";
    if (trimmed.startsWith(customerPrefix)) {
      const id = trimmed.slice(customerPrefix.length).trim() as Id<"users">;
      const user = await ctx.db.get(id);
      if (!user || user.role !== "customer" || !user.phoneVerified) {
        return { ok: false as const, message: "Invalid customer QR code." };
      }
      return {
        ok: true as const,
        user: { _id: user._id, name: user.name, phone: user.phone ?? null },
      };
    }

    try {
      const normalized = parseGenericE164OrThrow(trimmed);
      const user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", normalized))
        .first();
      if (!user || user.role !== "customer" || !user.phoneVerified) {
        return { ok: false as const, message: "No verified customer for this QR." };
      }
      return {
        ok: true as const,
        user: { _id: user._id, name: user.name, phone: user.phone ?? null },
      };
    } catch {
      return { ok: false as const, message: "Unrecognized QR code." };
    }
  },
});
