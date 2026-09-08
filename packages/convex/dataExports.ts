/**
 * Bulk data exports for admin (all users) and owners (club members).
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import {
  adminAllUsersCsv,
  adminSingleUserCsv,
  clubMembersCsv,
  suggestExportFilename,
} from "./model/dataExportCsv";

const ADMIN_EXPORT_MAX = 1500;

const BOOKING_STATUSES = [
  "pending_approval",
  "confirmed",
  "rejected",
  "cancelled_by_customer",
  "cancelled_by_club",
  "completed",
  "expired",
] as const;

async function assertAdminMfa(
  ctx: QueryCtx,
  adminId: Id<"users">,
): Promise<Doc<"users">> {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("AUTH_001: Admin authentication required");
  }
  if (!admin.adminMfaVerifiedAt) {
    throw new Error("AUTH_003: Admin MFA verification required");
  }
  return admin;
}

async function sessionSummaryForUser(ctx: QueryCtx, userId: Id<"users">) {
  const logs = await ctx.db
    .query("sessionLogs")
    .withIndex("by_customer", (q) => q.eq("customerId", userId))
    .collect();
  const total = logs.length;
  const lastDate =
    logs.length > 0
      ? new Date(Math.max(...logs.map((l) => l.startTime))).toISOString()
      : null;
  return { total, lastDate };
}

async function bookingSummaryForUser(ctx: QueryCtx, userId: Id<"users">) {
  const logs = await ctx.db
    .query("bookingLogs")
    .withIndex("by_customer", (q) => q.eq("customerId", userId))
    .collect();
  const total = logs.length;
  const byStatus: Record<string, number> = {};
  for (const l of logs) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
  }
  return { total, byStatus };
}

async function complaintCountForUser(ctx: QueryCtx, userId: Id<"users">) {
  const complaints = await ctx.db
    .query("complaints")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return complaints.filter((c) => c.removedAt === undefined).length;
}

async function ownerClubBlock(ctx: QueryCtx, userId: Id<"users">) {
  const club = await ctx.db
    .query("clubs")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .unique();
  if (!club) return null;
  return {
    clubId: club._id,
    clubName: club.name,
    subscriptionStatus: club.subscriptionStatus,
    subscriptionExpiresAt: club.subscriptionExpiresAt
      ? new Date(club.subscriptionExpiresAt).toISOString()
      : null,
  };
}

async function buildAdminUserRow(ctx: QueryCtx, user: Doc<"users">) {
  const [sessionHistory, bookingHistory, complaintCount, ownerClub] =
    await Promise.all([
      sessionSummaryForUser(ctx, user._id),
      bookingSummaryForUser(ctx, user._id),
      complaintCountForUser(ctx, user._id),
      user.role === "owner" ? ownerClubBlock(ctx, user._id) : Promise.resolve(null),
    ]);

  return {
    userId: user._id,
    role: user.role,
    name: user.name,
    phone: user.phone ?? null,
    email: user.email ?? null,
    age: user.age ?? null,
    phoneVerified: user.phoneVerified === true,
    isFrozen: user.isFrozen === true,
    consentGiven: user.consentGiven === true,
    consentGivenAt: user.consentGivenAt
      ? new Date(user.consentGivenAt).toISOString()
      : null,
    accountCreatedAt: new Date(user.createdAt).toISOString(),
    deletionRequestedAt: user.deletionRequestedAt
      ? new Date(user.deletionRequestedAt).toISOString()
      : null,
    sessionHistory,
    bookingHistory,
    complaintCount,
    ownerClub,
  };
}

async function collectClubMemberIds(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
): Promise<Id<"users">[]> {
  const ids = new Set<Id<"users">>();

  for (const session of await ctx.db
    .query("sessions")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .collect()) {
    if (session.customerId && !session.isGuest) {
      ids.add(session.customerId);
    }
  }

  for (const complaint of await ctx.db
    .query("complaints")
    .withIndex("by_reportedByClubId", (q) => q.eq("reportedByClubId", clubId))
    .collect()) {
    if (complaint.removedAt === undefined) {
      ids.add(complaint.userId);
    }
  }

  for (const status of BOOKING_STATUSES) {
    for (const booking of await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("clubId", clubId).eq("status", status))
      .collect()) {
      ids.add(booking.customerId);
    }
  }

  return [...ids];
}

async function clubSessionSummary(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
) {
  const logs = await ctx.db
    .query("sessionLogs")
    .withIndex("by_customer_club", (q) =>
      q.eq("customerId", userId).eq("clubId", clubId),
    )
    .collect();
  const total = logs.length;
  const lastDate =
    logs.length > 0
      ? new Date(Math.max(...logs.map((l) => l.startTime))).toISOString()
      : null;
  return { total, lastDate };
}

async function buildClubMemberRow(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "customer") {
    return null;
  }

  const [sessionHistory, stats, complaints] = await Promise.all([
    clubSessionSummary(ctx, clubId, userId),
    ctx.db
      .query("customerBookingStats")
      .withIndex("by_customer_club", (q) =>
        q.eq("customerId", userId).eq("clubId", clubId),
      )
      .unique(),
    ctx.db
      .query("complaints")
      .withIndex("by_reportedByClubId", (q) => q.eq("reportedByClubId", clubId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect(),
  ]);

  const activeComplaints = complaints.filter((c) => c.removedAt === undefined);

  return {
    userId: user._id,
    name: user.name,
    phone: user.phone ?? null,
    email: user.email ?? null,
    age: user.age ?? null,
    phoneVerified: user.phoneVerified === true,
    accountCreatedAt: new Date(user.createdAt).toISOString(),
    sessionHistoryAtClub: sessionHistory,
    bookingStatsAtClub: {
      totalBookings: stats?.totalBookings ?? 0,
      noShowCount: stats?.noShowCount ?? 0,
      lateCancellationCount: stats?.lateCancellationCount ?? 0,
    },
    complaintsAtClub: activeComplaints.length,
  };
}

export const buildAdminUsersExport = internalQuery({
  args: {
    adminId: v.id("users"),
    roleFilter: v.optional(
      v.union(v.literal("admin"), v.literal("owner"), v.literal("customer")),
    ),
  },
  handler: async (ctx, { adminId, roleFilter }) => {
    await assertAdminMfa(ctx, adminId);

    let users = await ctx.db.query("users").collect();
    if (roleFilter) {
      users = users.filter((u) => u.role === roleFilter);
    }
    users.sort((a, b) => b.createdAt - a.createdAt);

    const totalUsers = users.length;
    const truncated = totalUsers > ADMIN_EXPORT_MAX;
    const slice = users.slice(0, ADMIN_EXPORT_MAX);

    const rows = [];
    for (const user of slice) {
      rows.push(await buildAdminUserRow(ctx, user));
    }

    const exportedAt = new Date().toISOString();
    const roleLabel = roleFilter ?? "all";

    return {
      exportType: "admin_all_users" as const,
      format: "csv" as const,
      exportedAt,
      roleFilter: roleLabel,
      userCount: rows.length,
      totalUsers,
      truncated,
      filename: suggestExportFilename("a3-users-export"),
      csv: adminAllUsersCsv({
        exportedAt,
        roleFilter: roleLabel,
        userCount: rows.length,
        totalUsers,
        truncated,
        users: rows,
      }),
      users: rows,
      note: "Platform-wide user summary. Sensitive billing detail from individual club databases is not included.",
    };
  },
});

export const buildAdminSingleUserExport = internalQuery({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, { adminId, targetUserId }) => {
    await assertAdminMfa(ctx, adminId);
    const user = await ctx.db.get(targetUserId);
    if (!user) {
      throw new Error("DATA_003: User not found");
    }
    const userRow = await buildAdminUserRow(ctx, user);
    const exportedAt = new Date().toISOString();
    return {
      exportType: "admin_single_user" as const,
      format: "csv" as const,
      exportedAt,
      filename: suggestExportFilename(`a3-user-${targetUserId}`),
      csv: adminSingleUserCsv({ exportedAt, user: userRow }),
      user: userRow,
      note: "Platform-wide user summary. Sensitive billing detail from individual club databases is not included.",
    };
  },
});

export const buildClubMembersExport = internalQuery({
  args: {
    ownerId: v.id("users"),
    clubId: v.id("clubs"),
  },
  handler: async (ctx, { ownerId, clubId }) => {
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    const club = await ctx.db.get(clubId);
    if (!club || club.ownerId !== ownerId) {
      throw new Error("AUTH_001: Not authorized for this club");
    }

    const memberIds = await collectClubMemberIds(ctx, clubId);
    const members = [];
    for (const userId of memberIds) {
      const row = await buildClubMemberRow(ctx, clubId, userId);
      if (row) members.push(row);
    }
    members.sort((a, b) => a.name.localeCompare(b.name));

    const exportedAt = new Date().toISOString();
    return {
      exportType: "owner_club_members" as const,
      format: "csv" as const,
      exportedAt,
      clubId,
      clubName: club.name,
      memberCount: members.length,
      filename: suggestExportFilename("a3-club-members"),
      csv: clubMembersCsv({
        exportedAt,
        clubName: club.name,
        memberCount: members.length,
        members,
      }),
      members,
      note: "Club-scoped customer data only. Activity at other clubs is excluded.",
    };
  },
});
