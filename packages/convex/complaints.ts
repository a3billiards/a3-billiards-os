/**
 * Complaints: file / retract (owner club), admin dismiss, club list, customer active
 * (cross-club), admin list. Mutations keep `users.complaints[]` in sync for reactive UI.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { OwnerViewer } from "./model/viewer";
import { requireOwner, requireViewer } from "./model/viewer";
import { parseIndiaE164OrThrow } from "./model/phoneRegistration";

export type complaintType =
  | "violent_behaviour"
  | "theft"
  | "runaway_without_payment"
  | "late_credit_payment";

export const COMPLAINT_TYPE_LABELS: Record<complaintType, string> = {
  violent_behaviour: "Violent Behaviour",
  theft: "Theft",
  runaway_without_payment: "Runaway Without Payment",
  late_credit_payment: "Late Credit Payment",
};

/** @deprecated Use COMPLAINT_TYPE_LABELS */
export const TYPE_LABELS = COMPLAINT_TYPE_LABELS;

const complaintTypeV = v.union(
  v.literal("violent_behaviour"),
  v.literal("theft"),
  v.literal("runaway_without_payment"),
  v.literal("late_credit_payment"),
);

function typeLabel(t: complaintType): string {
  return COMPLAINT_TYPE_LABELS[t];
}

const AUTH_001 = "AUTH_001: Not authorized.";

async function requireAdminViewer(ctx: QueryCtx | MutationCtx) {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "admin") {
    throw new Error(AUTH_001);
  }
  return viewer;
}

/** Owner must own `clubId`; optional staff role must belong to club and pass tab + file gate. */
async function assertOwnerClubComplaintsView(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  const viewer = await requireViewer(ctx);
  const owner = requireOwner(viewer);
  if (owner.clubId !== clubId) {
    throw new Error(AUTH_001);
  }
  const club = await ctx.db.get(clubId);
  if (!club || club.ownerId !== owner.userId) {
    throw new Error(AUTH_001);
  }
  if (!roleId) return;
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error(AUTH_001);
  }
  if (!role.allowedTabs.includes("complaints")) {
    throw new Error(
      "Your current role does not have access to the Complaints tab.",
    );
  }
}

/**
 * File / retract: caller is club owner (`club.ownerId`) and scoped to `clubId`;
 * if `roleId` is set it must belong to this club (see `fileComplaint` / `retractComplaint` for `canFileComplaints`).
 */
async function assertOwnerActsForClub(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
): Promise<OwnerViewer> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "owner") {
    throw new Error(AUTH_001);
  }
  const club = await ctx.db.get(clubId);
  if (!club) {
    throw new Error(AUTH_001);
  }
  if (club.ownerId !== viewer.userId || viewer.clubId !== clubId) {
    throw new Error(AUTH_001);
  }
  return viewer;
}

function assertRoleIdBelongsAndCanFile(
  roleId: Id<"staffRoles"> | undefined,
  role: Doc<"staffRoles"> | null,
  clubId: Id<"clubs">,
): void {
  if (!roleId) return;
  if (!role || role.clubId !== clubId) {
    throw new Error(AUTH_001);
  }
  if (!role.canFileComplaints) {
    throw new Error(
      "Your current role does not have permission to file complaints.",
    );
  }
}

function activeComplaintsForUser(
  rows: Doc<"complaints">[],
): Doc<"complaints">[] {
  return rows.filter((c) => c.removedAt == null);
}

/** Active (non-retracted) complaint count — used by session start flows. */
export async function countActiveComplaintsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const rows = await ctx.db
    .query("complaints")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return activeComplaintsForUser(rows).length;
}

/** Club id + name for admin filter picker (v1 full scan). */
export const listClubs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminViewer(ctx);
    const clubs = await ctx.db.query("clubs").collect();
    return clubs
      .map((c) => ({ _id: c._id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// TODO: add compound index on [type, removedAt] for efficient type+status filtering at scale
export const getAdminComplaints = query({
  args: {
    typeFilter: v.optional(complaintTypeV),
    statusFilter: v.optional(
      v.union(v.literal("active"), v.literal("dismissed")),
    ),
    clubFilter: v.optional(v.id("clubs")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminViewer(ctx);

    let rows: Doc<"complaints">[];
    if (args.clubFilter !== undefined) {
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_reportedByClubId", (q) =>
          q.eq("reportedByClubId", args.clubFilter!),
        )
        .collect();
    } else {
      rows = await ctx.db.query("complaints").collect();
    }

    const scoped = rows.filter((c) => {
      if (args.typeFilter !== undefined && c.type !== args.typeFilter) {
        return false;
      }
      if (args.dateFrom !== undefined && c.createdAt < args.dateFrom) {
        return false;
      }
      if (args.dateTo !== undefined && c.createdAt > args.dateTo) {
        return false;
      }
      return true;
    });

    const activeCount = scoped.filter((c) => c.removedAt == null).length;
    const dismissedCount = scoped.filter((c) => c.removedAt != null).length;

    let filtered = scoped;
    if (args.statusFilter === "active") {
      filtered = scoped.filter((c) => c.removedAt == null);
    } else if (args.statusFilter === "dismissed") {
      filtered = scoped.filter((c) => c.removedAt != null);
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);
    const totalCount = filtered.length;

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    let offset = 0;
    if (args.cursor !== undefined && args.cursor.length > 0) {
      const n = parseInt(args.cursor, 10);
      if (!Number.isNaN(n) && n >= 0) {
        offset = n;
      }
    }
    const slice = filtered.slice(offset, offset + limit);
    const nextCursor =
      offset + limit < filtered.length ? String(offset + limit) : null;

    const complaints = await Promise.all(
      slice.map(async (c) => {
        const customerDoc = await ctx.db.get(c.userId);
        const clubDoc = await ctx.db.get(c.reportedByClubId);

        let dismissedBy: {
          _id: Id<"users">;
          name: string;
          role: string;
        } | null = null;
        if (c.removedAt != null && c.removedById !== undefined) {
          const rb = await ctx.db.get(c.removedById);
          if (rb) {
            dismissedBy = {
              _id: rb._id,
              name: rb.name,
              role: rb.role,
            };
          }
        }

        const status: "active" | "dismissed" =
          c.removedAt == null ? "active" : "dismissed";

        return {
          _id: c._id,
          type: c.type,
          typeLabel: typeLabel(c.type),
          description: c.description,
          status,
          createdAt: c.createdAt,
          removedAt: c.removedAt ?? null,
          dismissalReason: c.dismissalReason ?? null,
          customer: customerDoc
            ? {
                _id: customerDoc._id,
                name: customerDoc.name,
                phone: customerDoc.phone ?? null,
              }
            : {
                _id: null,
                name: "[Deleted User]",
                phone: null as string | null,
              },
          club: clubDoc
            ? { _id: clubDoc._id, name: clubDoc.name }
            : { _id: c.reportedByClubId, name: "[Deleted Club]" },
          dismissedBy,
          sessionId: c.sessionId ?? null,
        };
      }),
    );

    return {
      complaints,
      nextCursor,
      totalCount,
      activeCount,
      dismissedCount,
      sourceCount: rows.length,
    };
  },
});

export const adminDismissComplaint = mutation({
  args: {
    complaintId: v.id("complaints"),
    dismissalReason: v.string(),
  },
  handler: async (ctx, { complaintId, dismissalReason }) => {
    const viewer = await requireAdminViewer(ctx);

    const complaint = await ctx.db.get(complaintId);
    if (!complaint) {
      throw new Error("Complaint not found.");
    }
    if (complaint.removedAt != null) {
      throw new Error("This complaint has already been dismissed.");
    }

    const reason = dismissalReason.trim();
    if (reason.length === 0) {
      throw new Error("Dismissal reason is required.");
    }
    if (reason.length > 500) {
      throw new Error("Dismissal reason must be at most 500 characters.");
    }

    const now = Date.now();
    await ctx.db.patch(complaintId, {
      removedAt: now,
      removedById: viewer.userId,
      dismissalReason: reason,
    });

    const user = await ctx.db.get(complaint.userId);
    if (user) {
      const prev = user.complaints ?? [];
      const nextComplaints = prev.filter((id) => id !== complaintId);
      if (nextComplaints.length !== prev.length) {
        await ctx.db.patch(user._id, { complaints: nextComplaints });
      }
    }

    await ctx.db.insert("adminAuditLog", {
      adminId: viewer.userId,
      action: "complaint_dismiss",
      targetUserId: complaint.userId,
      previousValue: typeLabel(complaint.type),
      newValue: "dismissed",
      notes: reason,
      createdAt: now,
    });

    return { dismissed: true as const };
  },
});

/** Gate Complaints tab UI (no throw). */
export const getComplaintsTabAccess = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    try {
      const viewer = await requireViewer(ctx);
      if (viewer.role !== "owner") {
        return { canView: false, canFile: false };
      }
      if (viewer.clubId !== clubId) {
        return { canView: false, canFile: false };
      }
      const club = await ctx.db.get(clubId);
      if (!club || club.ownerId !== viewer.userId) {
        return { canView: false, canFile: false };
      }
      if (!roleId) {
        return { canView: true, canFile: true };
      }
      const role = await ctx.db.get(roleId);
      if (!role || role.clubId !== clubId) {
        return { canView: false, canFile: false };
      }
      const canView = role.allowedTabs.includes("complaints");
      return {
        canView,
        canFile: canView && role.canFileComplaints,
      };
    } catch {
      return { canView: false, canFile: false };
    }
  },
});

export const getClubComplaints = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    await assertOwnerClubComplaintsView(ctx, clubId, roleId);
    const rows = await ctx.db
      .query("complaints")
      .withIndex("by_reportedByClubId", (q) =>
        q.eq("reportedByClubId", clubId),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const u = await ctx.db.get(c.userId);
        const status: "active" | "retracted" =
          c.removedAt == null ? "active" : "retracted";
        return {
          _id: c._id,
          type: c.type as complaintType,
          typeLabel: typeLabel(c.type),
          description: c.description,
          status,
          createdAt: c.createdAt,
          removedAt: c.removedAt ?? null,
          dismissalReason: c.dismissalReason ?? null,
          sessionId: c.sessionId ?? null,
          customer: u
            ? {
                _id: u._id,
                name: u.name,
                phone: u.phone ?? null,
              }
            : {
                _id: null,
                name: "[Deleted User]",
                phone: null as string | null,
              },
        };
      }),
    );
    return enriched;
  },
});

export const getCustomerActiveComplaints = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    requireOwner(await requireViewer(ctx));
    const rows = await ctx.db
      .query("complaints")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const active = activeComplaintsForUser(rows);
    const complaints = await Promise.all(
      active.map(async (c) => {
        const club = await ctx.db.get(c.reportedByClubId);
        return {
          _id: c._id,
          type: c.type as complaintType,
          typeLabel: typeLabel(c.type),
          clubName: club?.name ?? "[Deleted Club]",
          createdAt: c.createdAt,
        };
      }),
    );
    return {
      hasComplaints: complaints.length > 0,
      complaints,
    };
  },
});

/** E.164 phone lookup for filing complaints (central `users` table). */
export const searchCustomerByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const viewer = await requireViewer(ctx);
    requireOwner(viewer);
    let normalized: string;
    try {
      normalized = parseIndiaE164OrThrow(phone);
    } catch {
      return {
        ok: false as const,
        code: "invalid_phone" as const,
        message:
          "Enter a valid phone in E.164 format (e.g. +91 followed by 10 digits).",
      };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .first();
    if (!user) {
      return {
        ok: false as const,
        code: "not_found" as const,
        message:
          "No registered customer found with this number. Complaints can only be filed against registered customers.",
      };
    }
    if (user.role !== "customer") {
      return {
        ok: false as const,
        code: "not_customer" as const,
        message: "This account is not a customer account.",
      };
    }
    if (!user.phoneVerified) {
      return {
        ok: false as const,
        code: "not_verified" as const,
        message:
          "Complaints cannot be filed against guest sessions. The customer must be registered.",
      };
    }
    const active = activeComplaintsForUser(
      await ctx.db
        .query("complaints")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    );
    return {
      ok: true as const,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone ?? normalized,
        role: user.role,
        phoneVerified: user.phoneVerified,
        activeComplaintCount: active.length,
      },
    };
  },
});

export const getRecentCustomerSessionsForComplaint = query({
  args: {
    clubId: v.id("clubs"),
    customerId: v.id("users"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, customerId, roleId }) => {
    await assertOwnerClubComplaintsView(ctx, clubId, roleId);
    const rows = await ctx.db
      .query("sessions")
      .withIndex("by_club_customer", (q) =>
        q.eq("clubId", clubId).eq("customerId", customerId),
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    rows.sort(
      (a, b) => (b.endTime ?? b.startTime) - (a.endTime ?? a.startTime),
    );
    const slice = rows.slice(0, 10);
    return Promise.all(
      slice.map(async (s) => {
        const table = await ctx.db.get(s.tableId);
        return {
          sessionId: s._id,
          tableLabel: table?.label ?? "—",
          endTime: s.endTime ?? s.startTime,
          billTotal: s.billTotal ?? null,
          currency: s.currency,
        };
      }),
    );
  },
});

export const fileComplaint = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.id("users"),
    type: complaintTypeV,
    description: v.string(),
    sessionId: v.optional(v.id("sessions")),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    await assertOwnerActsForClub(ctx, args.clubId);
    const roleDoc = args.roleId ? await ctx.db.get(args.roleId) : null;
    assertRoleIdBelongsAndCanFile(args.roleId, roleDoc, args.clubId);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new Error("Customer account not found.");
    }
    if (target.role !== "customer") {
      throw new Error("Complaints can only be filed against customer accounts.");
    }

    const desc = args.description.trim();
    if (desc.length === 0) {
      throw new Error("Description is required.");
    }
    if (desc.length > 4000) {
      throw new Error("Description must be at most 4000 characters.");
    }

    if (args.sessionId !== undefined) {
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.clubId !== args.clubId) {
        throw new Error("Session does not belong to this club.");
      }
    }

    const now = Date.now();
    const complaintId = await ctx.db.insert("complaints", {
      userId: args.userId,
      reportedByClubId: args.clubId,
      sessionId: args.sessionId ?? undefined,
      type: args.type,
      description: desc,
      createdAt: now,
    });

    const nextComplaints = [...(target.complaints ?? []), complaintId];
    await ctx.db.patch(args.userId, { complaints: nextComplaints });
    return { complaintId };
  },
});

export const retractComplaint = mutation({
  args: {
    complaintId: v.id("complaints"),
    dismissalReason: v.optional(v.string()),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { complaintId, dismissalReason, roleId }) => {
    const complaint = await ctx.db.get(complaintId);
    if (!complaint) {
      throw new Error("Complaint not found.");
    }

    const ownerViewer = await assertOwnerActsForClub(
      ctx,
      complaint.reportedByClubId,
    );

    const roleDoc = roleId ? await ctx.db.get(roleId) : null;
    assertRoleIdBelongsAndCanFile(roleId, roleDoc, complaint.reportedByClubId);

    if (complaint.removedAt != null) {
      throw new Error("This complaint has already been retracted.");
    }

    let reasonTrimmed: string | undefined;
    if (dismissalReason !== undefined) {
      const t = dismissalReason.trim();
      if (t.length > 500) {
        throw new Error("Reason must be at most 500 characters.");
      }
      reasonTrimmed = t.length > 0 ? t : undefined;
    }

    const now = Date.now();
    await ctx.db.patch(complaintId, {
      removedAt: now,
      removedById: ownerViewer.userId,
      dismissalReason: reasonTrimmed ?? undefined,
    });

    const user = await ctx.db.get(complaint.userId);
    if (user) {
      const prev = user.complaints ?? [];
      const nextComplaints = prev.filter((id) => id !== complaintId);
      if (nextComplaints.length !== prev.length) {
        await ctx.db.patch(user._id, { complaints: nextComplaints });
      }
    }

    return { retracted: true as const };
  },
});
