import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireViewer } from "./model/viewer";

function startOfTodayUtcMs(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export const getAdminDashboard = query({
  args: { refreshKey: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (viewer.role !== "admin") {
      throw new Error("AUTH_001: Admin authentication required");
    }
    const me = await ctx.db.get(viewer.userId);
    if (!me?.adminMfaVerifiedAt) {
      throw new Error("AUTH_003: Admin MFA verification required");
    }

    void args.refreshKey;
    const fetchedAt = Date.now();
    const startToday = startOfTodayUtcMs(fetchedAt);
    const endToday = startToday + 86_400_000;

    const [
      allUsers,
      activeSubs,
      graceSubs,
      activeSessionsRows,
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
        .withIndex("by_status", (q) => q.eq("status", "active"))
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

    const totalUsers = allUsers.filter((u) => u.deletionRequestedAt == null).length;
    const activeClubs = activeSubs.length + graceSubs.length;
    const activeSessions = activeSessionsRows.length;

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
