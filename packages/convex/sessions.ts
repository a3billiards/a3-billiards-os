/**
 * Cross-cutting session mutations (TDD §7B.1 admin force-end) and customer session queries.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireCustomer, requireViewer } from "./model/viewer";

export const forceEndSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    reason: v.string(),
  },
  handler: async (ctx, { sessionId, reason }) => {
    const viewer = await requireViewer(ctx);
    const actor = await ctx.db.get(viewer.userId);
    if (!actor || actor.role !== "admin") {
      throw new Error("AUTH_001: Admin authentication required");
    }

    const trimmed = reason.trim();
    if (trimmed.length === 0 || trimmed.length > 300) {
      throw new Error("DATA_001: Reason must be 1–300 characters");
    }

    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "active") {
      throw new Error("FORCE_001: Session not found or not active.");
    }

    const table = await ctx.db.get(session.tableId);
    const now = Date.now();

    await ctx.db.patch(sessionId, {
      status: "cancelled",
      cancellationReason: "admin_force_end",
      endTime: now,
      updatedAt: now,
    });

    if (table !== null && table.currentSessionId === sessionId) {
      await ctx.db.patch(table._id, {
        currentSessionId: undefined,
        tableLock: undefined,
        tableLockExpiry: undefined,
      });
    }

    const log = await ctx.db
      .query("sessionLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    if (log !== null) {
      await ctx.db.patch(log._id, {
        status: "cancelled",
        endTime: now,
        updatedAt: now,
      });
    }

    const audit: {
      adminId: Id<"users">;
      action: "session_force_end";
      targetUserId?: typeof session.customerId;
      previousValue?: string;
      newValue?: string;
      notes: string;
      createdAt: number;
    } = {
      adminId: viewer.userId,
      action: "session_force_end",
      previousValue: "active",
      newValue: "cancelled",
      notes: trimmed,
      createdAt: now,
    };
    if (session.customerId !== undefined) {
      audit.targetUserId = session.customerId;
    }
    await ctx.db.insert("adminAuditLog", audit);

    return { success: true as const };
  },
});

/** Customer session history rows (central `sessionLogs`), newest first. */
export const getCustomerSessionHistory = query({
  args: {
    customerId: v.id("users"),
    clubId: v.optional(v.id("clubs")),
  },
  handler: async (ctx, { customerId, clubId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    if (viewer.userId !== customerId) {
      throw new Error("PERM_001: Cannot access another user's data");
    }

    const rows =
      clubId !== undefined
        ? await ctx.db
            .query("sessionLogs")
            .withIndex("by_customer_club", (q) =>
              q.eq("customerId", customerId).eq("clubId", clubId),
            )
            .collect()
        : await ctx.db
            .query("sessionLogs")
            .withIndex("by_customer", (q) => q.eq("customerId", customerId))
            .collect();

    rows.sort((a, b) => b.startTime - a.startTime);

    return rows.map((r) => ({
      _id: r._id,
      sessionId: r.sessionId,
      clubId: r.clubId,
      clubName: r.clubName,
      tableLabel: r.tableLabel,
      startTime: r.startTime,
      endTime: r.endTime ?? null,
      billTotal: r.billTotal ?? null,
      currency: r.currency ?? null,
      paymentStatus: r.paymentStatus,
      paymentMethod: r.paymentMethod ?? null,
      status: r.status,
      creditResolvedAt: r.creditResolvedAt ?? null,
      creditResolvedMethod: r.creditResolvedMethod ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

/** Full club `sessions` row for bill breakdown (after sessionLog ownership check). */
export const getSessionDetail = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    const log = await ctx.db
      .query("sessionLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!log || log.customerId !== viewer.userId) {
      return null;
    }

    let session: Doc<"sessions"> | Doc<"sessions_archive"> | null =
      await ctx.db.get(sessionId);
    let resolvedFromArchive = false;
    if (!session) {
      session = await ctx.db
        .query("sessions_archive")
        .withIndex("by_archived_sessionId", (q) =>
          q.eq("archivedSessionId", sessionId),
        )
        .first();
      resolvedFromArchive = session !== null;
    }
    if (!session) {
      return null;
    }

    return {
      sessionId,
      archived: resolvedFromArchive,
      startTime: session.startTime,
      endTime: session.endTime ?? null,
      billableMinutes: session.billableMinutes ?? null,
      ratePerMin: session.ratePerMin,
      minBillMinutes: session.minBillMinutes,
      currency: session.currency,
      snackOrders: session.snackOrders.map((o) => ({
        snackId: String(o.snackId),
        name: o.name,
        qty: o.qty,
        priceAtOrder: o.priceAtOrder,
      })),
      billTotal: session.billTotal ?? null,
      discount: session.discount ?? null,
      paymentMethod: session.paymentMethod ?? null,
      paymentStatus: session.paymentStatus,
      status: session.status,
      creditResolvedAt: session.creditResolvedAt ?? null,
      creditResolvedMethod: session.creditResolvedMethod ?? null,
      cancellationReason: session.cancellationReason ?? null,
    };
  },
});

/** Session archiver cron (TDD §7). Runs daily at 04:00 UTC; archives only on UTC day 1. */
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function sessionRowToArchiveInsert(
  s: Doc<"sessions">,
): Omit<Doc<"sessions_archive">, "_id" | "_creationTime"> {
  return {
    archivedSessionId: s._id,
    tableId: s.tableId,
    clubId: s.clubId,
    customerId: s.customerId,
    guestName: s.guestName,
    guestAge: s.guestAge,
    isGuest: s.isGuest,
    startTime: s.startTime,
    endTime: s.endTime,
    billableMinutes: s.billableMinutes,
    ratePerMin: s.ratePerMin,
    minBillMinutes: s.minBillMinutes,
    currency: s.currency,
    snackOrders: s.snackOrders,
    billTotal: s.billTotal,
    discount: s.discount,
    paymentMethod: s.paymentMethod,
    paymentStatus: s.paymentStatus,
    status: s.status,
    cancellationReason: s.cancellationReason,
    timerAlertMinutes: s.timerAlertMinutes,
    timerAlertFiredAt: s.timerAlertFiredAt,
    creditResolvedAt: s.creditResolvedAt,
    creditResolvedMethod: s.creditResolvedMethod,
    staffAcknowledgedComplaint: s.staffAcknowledgedComplaint,
    acknowledgedByRoleId: s.acknowledgedByRoleId,
    acknowledgedAt: s.acknowledgedAt,
    bookingId: s.bookingId,
    discountAppliedByRoleId: s.discountAppliedByRoleId,
    discountAppliedAt: s.discountAppliedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export const archiveIfFirstOfMonth = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Only execute on the 1st of the month (UTC) — Convex has no monthly cron primitive.
    if (new Date().getUTCDate() !== 1) return;

    const cutoff = Date.now() - TWO_YEARS_MS;
    const clubs = await ctx.db.query("clubs").collect();

    for (const club of clubs) {
      for (const status of ["completed", "cancelled"] as const) {
        const rows = await ctx.db
          .query("sessions")
          .withIndex("by_club_status", (q) =>
            q.eq("clubId", club._id).eq("status", status),
          )
          .collect();

        for (const s of rows) {
          const end = s.endTime ?? s.startTime;
          if (end >= cutoff) continue;

          await ctx.db.insert(
            "sessions_archive",
            sessionRowToArchiveInsert(s),
          );
          await ctx.db.delete(s._id);
        }
      }
    }
  },
});
