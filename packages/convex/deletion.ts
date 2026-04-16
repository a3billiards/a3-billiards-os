/**
 * DPDP-aligned account deletion: soft-delete, auto-cancel bookings, cancel token,
 * purge cron, and export helpers.
 *
 * // Per PRD §14.8: restored accounts do NOT get their cancelled bookings back.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** SHA-256 hex of UTF-8 string; matches Node `createHash("sha256").update(s, "utf8").digest("hex")`. */
async function sha256Utf8Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function syncBookingLog(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  patch: Partial<Doc<"bookingLogs">>,
): Promise<void> {
  const log = await ctx.db
    .query("bookingLogs")
    .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
    .unique();
  if (!log) return;
  await ctx.db.patch(log._id, patch);
}

async function deleteAuthForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const s of sessions) {
    const refresh = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
      .collect();
    for (const t of refresh) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(s._id);
  }

  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const acc of accounts) {
    const verifs = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", acc._id))
      .collect();
    for (const row of verifs) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.delete(acc._id);
  }
}

async function deleteClubScopedData(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
): Promise<void> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .collect();
  for (const s of sessions) {
    await ctx.db.delete(s._id);
  }

  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_club_date", (q) => q.eq("clubId", clubId))
    .collect();
  for (const b of bookings) {
    await ctx.db.delete(b._id);
  }

  const tables = await ctx.db
    .query("tables")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .collect();
  for (const t of tables) {
    await ctx.db.delete(t._id);
  }

  const snacks = await ctx.db
    .query("snacks")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .collect();
  for (const s of snacks) {
    await ctx.db.delete(s._id);
  }

  const roles = await ctx.db
    .query("staffRoles")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .collect();
  for (const r of roles) {
    await ctx.db.delete(r._id);
  }

  const archived = await ctx.db
    .query("sessions_archive")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .collect();
  for (const a of archived) {
    await ctx.db.delete(a._id);
  }

  const counts = await ctx.db.query("cancellationCounts").collect();
  for (const c of counts) {
    if (c.clubId === clubId) {
      await ctx.db.delete(c._id);
    }
  }

  const stats = await ctx.db.query("customerBookingStats").collect();
  for (const st of stats) {
    if (st.clubId === clubId) {
      await ctx.db.delete(st._id);
    }
  }

  await ctx.db.delete(clubId);
}

async function purgeOwnerUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const club = await ctx.db
    .query("clubs")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .unique();
  if (club) {
    await deleteClubScopedData(ctx, club._id);
  }

  const receipts = await ctx.db
    .query("paymentReceipts")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  for (const p of receipts) {
    await ctx.db.delete(p._id);
  }

  await deleteAuthForUser(ctx, userId);
  await ctx.db.delete(userId);
}

async function purgeCustomerUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  // DPDP erasure removes the central `users` row. Transactional records (sessionLogs,
  // sessions in club DB) stay for audit; foreign keys become stale per PRD.
  const exports = await ctx.db
    .query("dataExportRequests")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const e of exports) {
    await ctx.db.delete(e._id);
  }

  const resets = await ctx.db
    .query("passwordResetTokens")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const r of resets) {
    await ctx.db.delete(r._id);
  }

  await deleteAuthForUser(ctx, userId);
  await ctx.db.delete(userId);
}

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});

export const getClubById = internalQuery({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => ctx.db.get(clubId),
});

export const getSessionLogSummary = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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
  },
});

export const getBookingLogSummary = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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
  },
});

export const getComplaintCount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const complaints = await ctx.db
      .query("complaints")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return complaints.filter((c) => c.removedAt === undefined).length;
  },
});

export const getOwnerClubExportSummary = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
    if (!club) {
      return null;
    }
    return {
      clubName: club.name,
      subscriptionStatus: club.subscriptionStatus,
      subscriptionExpiresAt: club.subscriptionExpiresAt,
    };
  },
});

export const getCustomerForExportEnqueue = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "customer") {
      return null;
    }
    return { email: u.email ?? null };
  },
});

export const getUserProfileForDeletionFlow = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) return null;
    return {
      role: u.role,
      isFrozen: u.isFrozen,
      deletionRequestedAt: u.deletionRequestedAt ?? null,
      email: u.email ?? null,
      name: u.name,
    };
  },
});

export const ownerDeletionPreflight = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "owner") {
      return { ok: false as const, error: "PERM_001: Owner only" };
    }
    if (user.deletionRequestedAt !== undefined) {
      return {
        ok: false as const,
        error: "DATA_002: A deletion request is already in progress.",
      };
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
    if (!club) {
      return { ok: false as const, error: "DATA_003: Club not found" };
    }

    const active = await ctx.db
      .query("sessions")
      .withIndex("by_club_status", (q) =>
        q.eq("clubId", club._id).eq("status", "active"),
      )
      .first();
    if (active) {
      return {
        ok: false as const,
        error:
          "DELETE_001: Please end all active sessions before deleting your account.",
      };
    }

    const completed = await ctx.db
      .query("sessions")
      .withIndex("by_club_status", (q) =>
        q.eq("clubId", club._id).eq("status", "completed"),
      )
      .collect();
    const creditOutstanding = completed.some(
      (s) =>
        s.paymentStatus === "credit" && s.creditResolvedAt === undefined,
    );
    if (creditOutstanding) {
      return {
        ok: false as const,
        error:
          "DELETE_002: Please resolve all outstanding credits before deleting your account.",
      };
    }

    const confirmed = await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) =>
        q.eq("clubId", club._id).eq("status", "confirmed"),
      )
      .first();
    if (confirmed) {
      return {
        ok: false as const,
        error:
          "DELETE_003: Please cancel all confirmed bookings before deleting your account.",
      };
    }

    return { ok: true as const, clubId: club._id, userId };
  },
});

export const setOwnerDeletionRequested = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
    clubId: v.id("clubs"),
  },
  handler: async (ctx, { userId, tokenHash, clubId }) => {
    const now = Date.now();
    const club = await ctx.db.get(clubId);
    if (!club || club.ownerId !== userId) {
      throw new Error("DATA_003: Club not found");
    }

    await ctx.db.patch(userId, {
      deletionRequestedAt: now,
      deletionCancelToken: tokenHash,
    });

    const pendingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) =>
        q.eq("clubId", clubId).eq("status", "pending_approval"),
      )
      .collect();

    for (const booking of pendingBookings) {
      await ctx.db.patch(booking._id, {
        status: "cancelled_by_club",
        updatedAt: now,
      });
      await syncBookingLog(ctx, booking._id, {
        status: "cancelled_by_club",
        updatedAt: now,
      });
    }

    if (pendingBookings.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.deletion.notifyOwnerDeletionCancelledBookings,
        {
          bookingIds: pendingBookings.map((b) => b._id),
          clubName: club.name,
        },
      );
    }
  },
});

export const setCustomerDeletionRequested = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
  },
  handler: async (ctx, { userId, tokenHash }) => {
    const now = Date.now();
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("DATA_003: User not found");
    }

    await ctx.db.patch(userId, {
      deletionRequestedAt: now,
      deletionCancelToken: tokenHash,
    });

    const customerLogs = await ctx.db
      .query("bookingLogs")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .collect();
    const activeLogs = customerLogs.filter(
      (l) =>
        l.status === "pending_approval" || l.status === "confirmed",
    );

    const notifyRows: {
      bookingId: Id<"bookings">;
      clubId: Id<"clubs">;
      requestedDate: string;
      requestedStartTime: string;
    }[] = [];

    for (const log of activeLogs) {
      await ctx.db.patch(log._id, {
        status: "cancelled_by_customer",
        updatedAt: now,
      });
      const booking = await ctx.db.get(log.bookingId);
      if (booking) {
        await ctx.db.patch(booking._id, {
          status: "cancelled_by_customer",
          updatedAt: now,
        });
      }
      notifyRows.push({
        bookingId: log.bookingId,
        clubId: log.clubId,
        requestedDate: log.requestedDate,
        requestedStartTime: log.requestedStartTime,
      });
    }

    if (notifyRows.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.deletion.notifyCustomerDeletionCancelledBookings,
        {
          customerId: userId,
          bookingLogs: notifyRows,
        },
      );
    }
  },
});

export const applyCancellation = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("deletionCancelToken"), tokenHash))
      .first();

    if (!user) {
      throw new Error(
        "Cancellation link is invalid or has already been used.",
      );
    }
    if (user.deletionRequestedAt === undefined) {
      throw new Error("No pending deletion found for this account.");
    }

    if (Date.now() > user.deletionRequestedAt + THIRTY_DAYS_MS) {
      throw new Error(
        "This cancellation link has expired. The account has already been deleted.",
      );
    }

    // Per PRD §14.8: restored accounts do NOT get their cancelled bookings back.
    await ctx.db.patch(user._id, {
      deletionRequestedAt: undefined,
      deletionCancelToken: undefined,
    });
  },
});

export const redeemCancellationToken = internalAction({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256Utf8Hex(token);
    await ctx.runMutation(internal.deletion.applyCancellation, { tokenHash });
    return { cancelled: true as const };
  },
});

export const enqueueCustomerDataExport = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const prior = await ctx.db
      .query("dataExportRequests")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const recent = prior.filter((r) => r.requestedAt > now - EXPORT_COOLDOWN_MS);
    if (recent.length > 0) {
      throw new Error(
        "RATE_001: You can only request a data export once every 24 hours.",
      );
    }
    await ctx.db.insert("dataExportRequests", { userId, requestedAt: now });
    await ctx.scheduler.runAfter(
      0,
      internal.deletionActions.generateAndSendDataExport,
      { userId },
    );
  },
});

export const enqueueOwnerDataExport = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    const now = Date.now();
    const last = u.ownerDataExportRequestedAt;
    if (last !== undefined && now - last < EXPORT_COOLDOWN_MS) {
      throw new Error(
        "EXPORT_001: You can request one data export every 24 hours. Please try again later.",
      );
    }
    await ctx.db.patch(userId, { ownerDataExportRequestedAt: now });
    await ctx.scheduler.runAfter(
      0,
      internal.deletionActions.generateAndSendDataExport,
      { userId },
    );
  },
});

export const notifyOwnerDeletionCancelledBookings = internalAction({
  args: {
    bookingIds: v.array(v.id("bookings")),
    clubName: v.string(),
  },
  handler: async (ctx, { bookingIds, clubName }) => {
    const body = `Your booking request at ${clubName} has been cancelled because the club is closing.`;
    for (const bookingId of bookingIds) {
      const row = await ctx.runQuery(
        internal.notifications.getBookingForNotification,
        { bookingId },
      );
      if (!row?.customer) continue;
      const tokens = row.customer.fcmTokens ?? [];
      if (tokens.length === 0) continue;
      await ctx.runAction(internal.notifications.deliverFcm, {
        tokens,
        title: "Booking Cancelled",
        body,
        data: { deepLink: "a3customer://bookings" },
      });
    }
  },
});

export const notifyCustomerDeletionCancelledBookings = internalAction({
  args: {
    customerId: v.id("users"),
    bookingLogs: v.array(
      v.object({
        bookingId: v.id("bookings"),
        clubId: v.id("clubs"),
        requestedDate: v.string(),
        requestedStartTime: v.string(),
      }),
    ),
  },
  handler: async (ctx, { customerId, bookingLogs }) => {
    const customer = await ctx.runQuery(internal.deletion.getUserById, {
      userId: customerId,
    });
    const customerName = customer?.name ?? "Customer";

    for (const row of bookingLogs) {
      const club = await ctx.runQuery(internal.deletion.getClubById, {
        clubId: row.clubId,
      });
      const owner = club
        ? await ctx.runQuery(internal.deletion.getUserById, {
            userId: club.ownerId,
          })
        : null;
      const tokens = owner?.fcmTokens ?? [];
      if (tokens.length === 0) continue;
      await ctx.runAction(internal.notifications.notifyOwnerBookingAutoCancelledCustomerDeletion, {
        ownerTokens: tokens,
        customerName,
        requestedDate: row.requestedDate,
        requestedStartTime: row.requestedStartTime,
      });
    }
  },
});

export const purgeSoftDeleted = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - THIRTY_DAYS_MS;
    const allUsers = await ctx.db.query("users").collect();
    const toPurge = allUsers.filter(
      (u) =>
        u.deletionRequestedAt !== undefined && u.deletionRequestedAt <= cutoff,
    );

    for (const u of toPurge) {
      try {
        if (u.role === "owner") {
          await purgeOwnerUser(ctx, u._id);
        } else if (u.role === "customer") {
          await purgeCustomerUser(ctx, u._id);
        } else {
          await deleteAuthForUser(ctx, u._id);
          await ctx.db.delete(u._id);
        }
      } catch (e) {
        console.error("purgeSoftDeleted: failed for user", u._id, e);
      }
    }

    const complaints = await ctx.db.query("complaints").collect();
    for (const c of complaints) {
      const subject = await ctx.db.get(c.userId);
      // Orphaned after subject hard-delete: retain ≥90 days from complaint filing (DPDP).
      if (!subject && now - c.createdAt >= NINETY_DAYS_MS) {
        await ctx.db.delete(c._id);
      }
    }

    return { purged: toPurge.length };
  },
});
