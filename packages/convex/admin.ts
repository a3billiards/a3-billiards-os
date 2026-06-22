import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAdminWithMfa } from "./model/viewer";

function startOfTodayUtcMs(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function loadAllActiveSessions(ctx: QueryCtx): Promise<Doc<"sessions">[]> {
  const clubs = await ctx.db.query("clubs").collect();
  const rows: Doc<"sessions">[] = [];

  for (const club of clubs) {
    const clubSessions = await ctx.db
      .query("sessions")
      .withIndex("by_club_status", (q) =>
        q.eq("clubId", club._id).eq("status", "active"),
      )
      .collect();
    rows.push(...clubSessions);
  }

  rows.sort((a, b) => b.startTime - a.startTime);
  return rows;
}

export const getAdminDashboard = query({
  args: { refreshKey: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminWithMfa(ctx);
    void args.refreshKey;
    const fetchedAt = Date.now();
    const startToday = startOfTodayUtcMs(fetchedAt);
    const endToday = startToday + 86_400_000;

    const [
      allUsers,
      activeSubs,
      graceSubs,
      paidCompletedRows,
      complaintsOpen,
      pendingBookings,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db
        .query("clubs")
        .withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", "active"))
        .collect(),
      ctx.db
        .query("clubs")
        .withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", "grace"))
        .collect(),
      ctx.db
        .query("sessionLogs")
        .withIndex("by_status_payment", (q) =>
          q.eq("status", "completed").eq("paymentStatus", "paid"),
        )
        .collect(),
      ctx.db
        .query("complaints")
        .filter((q) => q.eq(q.field("removedAt"), undefined))
        .collect(),
      ctx.db
        .query("bookings")
        .withIndex("by_global_status", (q) => q.eq("status", "pending_approval"))
        .collect(),
    ]);

    const activeSessionRows = await loadAllActiveSessions(ctx);

    const totalUsers = allUsers.filter((u) => u.deletionRequestedAt == null).length;
    const activeClubs = activeSubs.length + graceSubs.length;
    const activeSessions = activeSessionRows.length;

    let revenueAllTime = 0;
    let revenueToday = 0;
    for (const row of paidCompletedRows) {
      const amt = row.billTotal ?? 0;
      revenueAllTime += amt;
      const end = row.endTime;
      if (end !== undefined && end >= startToday && end < endToday) {
        revenueToday += amt;
      }
    }

    return {
      totalUsers,
      activeClubs,
      activeSessions,
      revenue: {
        allTime: revenueAllTime,
        today: revenueToday,
      },
      openComplaints: complaintsOpen.length,
      pendingBookings: pendingBookings.length,
      fetchedAt,
    };
  },
});

const AUDIT_ACTION_LABELS: Record<string, string> = {
  phone_update: "Phone updated",
  admin_profile_edit: "Admin profile edited",
  user_freeze: "User frozen",
  user_unfreeze: "User unfrozen",
  password_reset: "Password reset",
  passcode_reset: "Passcode reset",
  role_change: "Role changed",
  complaint_dismiss: "Complaint dismissed",
  session_force_end: "Session force-ended",
};

export const getAdminAuditLog = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit: limitArg }) => {
    await requireAdminWithMfa(ctx);
    const limit = Math.min(Math.max(limitArg ?? 30, 1), 50);

    let minCreatedAtExclusive: number | undefined;
    if (cursor !== undefined && cursor.length > 0) {
      const parts = cursor.split(":");
      const ts = Number(parts[0]);
      if (!Number.isNaN(ts)) minCreatedAtExclusive = ts;
    }

    const batch = await ctx.db
      .query("adminAuditLog")
      .withIndex("by_createdAt", (iq) =>
        minCreatedAtExclusive !== undefined
          ? iq.lt("createdAt", minCreatedAtExclusive)
          : iq.gte("createdAt", 0),
      )
      .order("desc")
      .take(limit + 1);

    const hasMore = batch.length > limit;
    const slice = hasMore ? batch.slice(0, limit) : batch;
    const nextCursor =
      hasMore && slice.length > 0
        ? `${slice[slice.length - 1].createdAt}:${slice[slice.length - 1]._id}`
        : null;

    const userIds = new Set<string>();
    for (const row of slice) {
      userIds.add(row.adminId);
      if (row.targetUserId) userIds.add(row.targetUserId);
    }

    const nameById = new Map<string, string>();
    for (const uid of userIds) {
      const u = await ctx.db.get(uid as Id<"users">);
      nameById.set(uid, u?.name ?? "Unknown");
    }

    const entries = slice.map((row) => ({
      _id: row._id,
      action: row.action,
      actionLabel: AUDIT_ACTION_LABELS[row.action] ?? row.action,
      adminId: row.adminId,
      adminName: nameById.get(row.adminId) ?? "Unknown",
      targetUserId: row.targetUserId ?? null,
      targetUserName:
        row.targetUserId !== undefined
          ? (nameById.get(row.targetUserId) ?? "Unknown")
          : null,
      previousValue: row.previousValue ?? null,
      newValue: row.newValue ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
    }));

    return { entries, nextCursor };
  },
});

export const getAdminActiveSessions = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit: limitArg }) => {
    await requireAdminWithMfa(ctx);
    const limit = Math.min(Math.max(limitArg ?? 30, 1), 50);

    const rows = await loadAllActiveSessions(ctx);

    let offset = 0;
    if (cursor !== undefined && cursor.length > 0) {
      const n = parseInt(cursor, 10);
      if (!Number.isNaN(n) && n >= 0) offset = n;
    }

    const slice = rows.slice(offset, offset + limit);
    const nextCursor =
      offset + limit < rows.length ? String(offset + limit) : null;

    const sessions = await Promise.all(
      slice.map(async (s) => {
        const [club, table, customer] = await Promise.all([
          ctx.db.get(s.clubId),
          ctx.db.get(s.tableId),
          s.customerId !== undefined ? ctx.db.get(s.customerId) : null,
        ]);
        const isGuest = s.isGuest || s.customerId === undefined;
        return {
          sessionId: s._id,
          customerId: s.customerId ?? null,
          customerName: isGuest
            ? (s.guestName?.trim() || "Walk-in")
            : (customer?.name ?? "Unknown"),
          customerPhone: isGuest ? null : (customer?.phone ?? null),
          isGuest,
          clubId: s.clubId,
          clubName: club?.name ?? "Unknown club",
          tableLabel: table?.label ?? "Table",
          startTime: s.startTime,
          currency: s.currency,
        };
      }),
    );

    return { sessions, nextCursor, totalCount: rows.length };
  },
});

export const getAdminPendingBookings = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit: limitArg }) => {
    await requireAdminWithMfa(ctx);
    const limit = Math.min(Math.max(limitArg ?? 30, 1), 50);

    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_global_status", (q) => q.eq("status", "pending_approval"))
      .collect();
    rows.sort((a, b) =>
      a.requestedDate === b.requestedDate
        ? a.requestedStartTime.localeCompare(b.requestedStartTime)
        : a.requestedDate.localeCompare(b.requestedDate),
    );

    let offset = 0;
    if (cursor !== undefined && cursor.length > 0) {
      const n = parseInt(cursor, 10);
      if (!Number.isNaN(n) && n >= 0) offset = n;
    }

    const slice = rows.slice(offset, offset + limit);
    const nextCursor =
      offset + limit < rows.length ? String(offset + limit) : null;

    const bookings = await Promise.all(
      slice.map(async (b) => {
        const [customer, club] = await Promise.all([
          ctx.db.get(b.customerId),
          ctx.db.get(b.clubId),
        ]);
        return {
          bookingId: b._id,
          customerId: b.customerId,
          customerName: customer?.name ?? "Unknown",
          customerPhone: customer?.phone ?? null,
          clubId: b.clubId,
          clubName: club?.name ?? "Unknown club",
          tableType: b.tableType,
          requestedDate: b.requestedDate,
          requestedStartTime: b.requestedStartTime,
          requestedDurationMin: b.requestedDurationMin,
          estimatedCost: b.estimatedCost ?? null,
          currency: b.currency,
          notes: b.notes ?? null,
          createdAt: b.createdAt,
        };
      }),
    );

    return { bookings, nextCursor, totalCount: rows.length };
  },
});
