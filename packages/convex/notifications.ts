/**
 * Admin Notification Center: recipient preview, rate-limit read, history,
 * and internal helpers for broadcast actions.
 *
 * Public broadcast action: `notificationsActions.sendAdminBroadcast`.
 * FCM: `notificationsFcm.sendFcmNotification`; fan-in helper `deliverFcm` + `notify*` internal actions below.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireViewer } from "./model/viewer";
import { computeBookingUnixTime } from "@a3/utils/timezone";

const targetTypeV = v.union(
  v.literal("all"),
  v.literal("role"),
  v.literal("selected"),
);
const targetRoleV = v.union(v.literal("owner"), v.literal("customer"));

function throwErr(message: string): never {
  throw new Error(message);
}

async function requireAdminViewer(ctx: Parameters<typeof requireViewer>[0]) {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "admin") {
    throwErr("AUTH_001: Admin authentication required");
  }
  return viewer;
}

/** Resolve users who will receive a broadcast (with ≥1 token). */
function resolveRecipientUsers(
  allUsers: Doc<"users">[],
  args: {
    targetType: "all" | "role" | "selected";
    targetRole?: "owner" | "customer";
    targetUserIds?: Id<"users">[];
  },
): Doc<"users">[] {
  const { targetType, targetRole, targetUserIds } = args;
  if (targetType === "all") {
    return allUsers.filter(
      (u) => !u.isFrozen && u.fcmTokens.length > 0,
    );
  }
  if (targetType === "role") {
    if (targetRole !== "owner" && targetRole !== "customer") return [];
    return allUsers.filter(
      (u) =>
        u.role === targetRole &&
        !u.isFrozen &&
        u.fcmTokens.length > 0,
    );
  }
  // selected — include frozen; require explicit ids
  if (!targetUserIds || targetUserIds.length === 0) return [];
  const idSet = new Set(targetUserIds);
  return allUsers.filter(
    (u) => idSet.has(u._id) && u.fcmTokens.length > 0,
  );
}

export const getRecipientCount = query({
  args: {
    targetType: targetTypeV,
    targetRole: v.optional(targetRoleV),
    targetUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    await requireAdminViewer(ctx);
    const all = await ctx.db.query("users").collect();
    if (args.targetType === "selected") {
      const ids = args.targetUserIds ?? [];
      let count = 0;
      for (const id of ids) {
        const u = await ctx.db.get(id);
        if (u && u.fcmTokens.length > 0) count += 1;
      }
      return { count };
    }
    const recipients = resolveRecipientUsers(all, args);
    return { count: recipients.length };
  },
});

export const checkBroadcastRateLimit = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, { adminId }) => {
    const viewer = await requireAdminViewer(ctx);
    if (viewer.userId !== adminId) {
      throwErr("AUTH_001: Admin authentication required");
    }
    const now = Date.now();
    const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
    const hourEnd = hourStart + 3_600_000;
    const rows = await ctx.db
      .query("adminNotifications")
      .withIndex("by_sentByAdmin_createdAt", (q) =>
        q.eq("sentByAdminId", adminId).gte("createdAt", hourStart),
      )
      .filter((q) => q.lt(q.field("createdAt"), hourEnd))
      .collect();
    const used = rows.length;
    const remainingCount = Math.max(0, 10 - used);
    const allowed = remainingCount > 0;
    const resetsAt = hourEnd;
    const minutesUntilReset = Math.ceil((hourEnd - now) / 60_000);
    return { allowed, remainingCount, resetsAt, minutesUntilReset };
  },
});

export const getAdminNotificationHistory = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit: limitArg }) => {
    await requireAdminViewer(ctx);
    const limit = Math.min(Math.max(limitArg ?? 20, 1), 50);

    let minCreatedAtExclusive: number | undefined;
    if (cursor !== undefined && cursor.length > 0) {
      const parts = cursor.split(":");
      const ts = Number(parts[0]);
      if (!Number.isNaN(ts)) minCreatedAtExclusive = ts;
    }

    let q = ctx.db
      .query("adminNotifications")
      .withIndex("by_createdAt", (iq) =>
        minCreatedAtExclusive !== undefined
          ? iq.lt("createdAt", minCreatedAtExclusive)
          : iq.gte("createdAt", 0),
      )
      .order("desc");

    const batch = await q.take(limit + 1);
    const hasMore = batch.length > limit;
    const slice = hasMore ? batch.slice(0, limit) : batch;
    const nextCursor =
      hasMore && slice.length > 0
        ? `${slice[slice.length - 1].createdAt}:${slice[slice.length - 1]._id}`
        : null;

    const adminIds = [...new Set(slice.map((n) => n.sentByAdminId))];
    const adminNameById = new Map<string, string>();
    for (const aid of adminIds) {
      const u = await ctx.db.get(aid);
      adminNameById.set(aid, u?.name ?? "Unknown");
    }

    const notifications = slice.map((n) => {
      const entries = Object.entries(n.deliveryStatus);
      let sentCount = 0;
      let failedCount = 0;
      for (const [, s] of entries) {
        if (s === "sent" || s === "delivered") sentCount += 1;
        else if (s === "failed") failedCount += 1;
      }
      return {
        _id: n._id,
        title: n.title,
        body: n.body,
        targetType: n.targetType,
        targetRole: n.targetRole ?? null,
        targetUserIds: n.targetUserIds ?? null,
        sentByName: adminNameById.get(n.sentByAdminId) ?? "Unknown",
        createdAt: n.createdAt,
        totalRecipients: entries.length,
        sentCount,
        failedCount,
        deliveryStatus: n.deliveryStatus,
      };
    });

    return { notifications, nextCursor };
  },
});

/** Recipient rows for an admin broadcast action (internal). */
export const internalListBroadcastRecipientUsers = internalQuery({
  args: {
    targetType: targetTypeV,
    targetRole: v.optional(targetRoleV),
    targetUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("users").collect();
    return resolveRecipientUsers(all, args).map((u) => ({
      userId: u._id,
      fcmTokens: u.fcmTokens,
    }));
  },
});

export const internalCountBroadcastsInHour = internalQuery({
  args: {
    adminId: v.id("users"),
    hourStart: v.number(),
    hourEnd: v.number(),
  },
  handler: async (ctx, { adminId, hourStart, hourEnd }) => {
    const rows = await ctx.db
      .query("adminNotifications")
      .withIndex("by_sentByAdmin_createdAt", (q) =>
        q.eq("sentByAdminId", adminId).gte("createdAt", hourStart),
      )
      .filter((q) => q.lt(q.field("createdAt"), hourEnd))
      .collect();
    return { count: rows.length };
  },
});

export const internalInsertAdminBroadcast = internalMutation({
  args: {
    sentByAdminId: v.id("users"),
    title: v.string(),
    body: v.string(),
    targetType: targetTypeV,
    targetRole: v.optional(targetRoleV),
    targetUserIds: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("adminNotifications", {
      sentByAdminId: args.sentByAdminId,
      title: args.title,
      body: args.body,
      targetType: args.targetType,
      targetRole: args.targetRole,
      targetUserIds: args.targetUserIds,
      deliveryStatus: {},
      createdAt: args.createdAt,
    });
    return { notificationId: id };
  },
});

export const updateDeliveryStatus = internalMutation({
  args: {
    notificationId: v.id("adminNotifications"),
    deliveryStatus: v.record(
      v.string(),
      v.union(
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, { notificationId, deliveryStatus }) => {
    await ctx.db.patch(notificationId, { deliveryStatus });
  },
});

/** @deprecated Use `internal.notifications.updateDeliveryStatus` */
export const internalPatchAdminBroadcastDelivery = updateDeliveryStatus;

export const internalAssertAdmin = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "admin") {
      throw new Error("AUTH_001: Admin authentication required");
    }
    return { ok: true as const };
  },
});

/** Per-recipient names for expanded history (capped). */
export const getNotificationRecipientBreakdown = query({
  args: { notificationId: v.id("adminNotifications") },
  handler: async (ctx, { notificationId }) => {
    await requireAdminViewer(ctx);
    const doc = await ctx.db.get(notificationId);
    if (!doc) return null;

    const many = doc.targetType === "all" || doc.targetType === "role";
    const cap = many ? 20 : 500;

    const delivered: { userId: string; name: string }[] = [];
    const failed: { userId: string; name: string }[] = [];
    let moreDelivered = 0;
    let moreFailed = 0;

    for (const [userIdStr, status] of Object.entries(doc.deliveryStatus)) {
      const userId = userIdStr as Id<"users">;
      const user = await ctx.db.get(userId);
      const name = user?.name ?? "Unknown user";
      if (status === "sent" || status === "delivered") {
        if (delivered.length < cap) delivered.push({ userId: userIdStr, name });
        else moreDelivered += 1;
      } else if (status === "failed") {
        if (failed.length < cap) failed.push({ userId: userIdStr, name });
        else moreFailed += 1;
      }
    }

    return { delivered, failed, moreDelivered, moreFailed };
  },
});

// ── FCM helpers (internal actions → HTTP v1 in `notificationsFcm`) ─────────

function formatDateLabel(startMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(startMs));
}

function formatTimeLabel(startMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startMs));
}

function normalizeTableTypeLabel(value: string | undefined): string {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : "table";
}

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});

export const getClubOwner = internalQuery({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const club = await ctx.db.get(clubId);
    if (!club) return null;
    return ctx.db.get(club.ownerId);
  },
});

export const getBookingForNotification = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;
    const club = await ctx.db.get(booking.clubId);
    if (!club) return null;
    const customer = await ctx.db.get(booking.customerId);
    const owner = await ctx.db.get(club.ownerId);
    const log = await ctx.db
      .query("bookingLogs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
      .unique();
    return { booking, club, customer, owner, log };
  },
});

export const cleanupStaleTokens = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Safety net (see crons). Invalid FCM tokens are removed inline in `notificationsFcm`
    // when sends fail (UNREGISTERED / INVALID_ARGUMENT). No full-table scan here — avoids O(users) cost.
    return { ok: true as const, scanned: 0 };
  },
});

export const deliverFcm = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Record<string, "sent" | "failed">> => {
    if (args.tokens.length === 0) return {};
    return await ctx.runAction(internal.notificationsFcm.sendFcmNotification, {
      tokens: args.tokens,
      title: args.title,
      body: args.body,
      data: args.data,
    });
  },
});

export const sendAdminBroadcastPush = internalAction({
  args: {
    notificationId: v.id("adminNotifications"),
    title: v.string(),
    body: v.string(),
    tokenMap: v.array(
      v.object({ userId: v.string(), tokens: v.array(v.string()) }),
    ),
  },
  handler: async (ctx, { notificationId, title, body, tokenMap }) => {
    const deliveryStatus: Record<string, "sent" | "failed"> = {};
    let sentCount = 0;
    let failedCount = 0;
    for (const { userId, tokens } of tokenMap) {
      if (tokens.length === 0) {
        deliveryStatus[userId] = "failed";
        continue;
      }
      const results = await ctx.runAction(
        internal.notificationsFcm.sendFcmNotification,
        {
          tokens,
          title,
          body,
          data: { type: "admin_broadcast" },
        },
      );
      const anySent = Object.values(results).some((r) => r === "sent");
      deliveryStatus[userId] = anySent ? "sent" : "failed";
      for (const t of tokens) {
        if (results[t] === "sent") sentCount += 1;
        else failedCount += 1;
      }
    }
    await ctx.runMutation(internal.notifications.updateDeliveryStatus, {
      notificationId,
      deliveryStatus,
    });
    return { sentCount, failedCount };
  },
});

export const notifyBookingApproved = internalAction({
  args: {
    bookingId: v.id("bookings"),
    confirmedTableLabel: v.optional(v.string()),
  },
  handler: async (ctx, { bookingId, confirmedTableLabel }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const dateStr = formatDateLabel(startMs, club.timezone);
    const timeStr = formatTimeLabel(startMs, club.timezone);
    let body = `Your booking at ${club.name} on ${dateStr} at ${timeStr} has been confirmed.`;
    if (confirmedTableLabel) {
      body += ` You've been assigned ${confirmedTableLabel}.`;
    }
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Confirmed",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyBookingRejected = internalAction({
  args: {
    bookingId: v.id("bookings"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { bookingId, rejectionReason }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { club } = row;
    let body = `Your booking request at ${club.name} was declined.`;
    const r = rejectionReason?.trim();
    if (r) body += ` Reason: ${r}`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Declined",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyBookingCancelledByClub = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const body = `Your booking at ${club.name} on ${formatDateLabel(startMs, club.timezone)} at ${formatTimeLabel(startMs, club.timezone)} was cancelled by the club.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Cancelled",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyBookingExpiredNoOwnerResponse = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { club } = row;
    const body = `Your booking request at ${club.name} expired — the club didn't respond in time.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Expired",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyNoShowCustomerNormal = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const timeStr = formatTimeLabel(startMs, club.timezone);
    const body = `Your booking at ${club.name} at ${timeStr} has expired because you did not arrive within 30 minutes of the start time.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Expired",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyNoShowCustomerFrozenClub = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { club } = row;
    const body = `Your booking at ${club.name} could not be honoured. The club is currently unavailable.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Could Not Be Honoured",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyBookingReminderCustomer = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.customer) return;
    const tokens = row.customer.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const timeStr = formatTimeLabel(startMs, club.timezone);
    const body = `Reminder: Your booking at ${club.name} is in 1 hour (${timeStr}). See you there!`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Reminder",
      body,
      data: { deepLink: `a3customer://booking/${bookingId}` },
    });
  },
});

export const notifyBookingReminderOwner = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.owner) return;
    const tokens = row.owner.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club, customer } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const timeStr = formatTimeLabel(startMs, club.timezone);
    const name = customer?.name ?? "Customer";
    const body = `Reminder: ${name} has a booking at ${timeStr} in 1 hour.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Upcoming Booking",
      body,
      data: { screen: "bookings", tab: "upcoming" },
    });
  },
});

export const notifyNewBookingRequest = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.owner) return;
    const tokens = row.owner.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club, customer } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const dateStr = formatDateLabel(startMs, club.timezone);
    const timeStr = formatTimeLabel(startMs, club.timezone);
    const tt = normalizeTableTypeLabel(booking.tableType);
    const name = customer?.name ?? "Customer";
    const body = `${name} requested ${tt} on ${dateStr} at ${timeStr}.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "New Booking Request",
      body,
      data: { screen: "bookings", tab: "pending" },
    });
  },
});

export const notifyOwnerCustomerCancelledBooking = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.owner || !row.log) return;
    const tokens = row.owner.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { log, customer } = row;
    const name = customer?.name ?? "Customer";
    const body = `${name} cancelled their booking for ${log.requestedDate} at ${log.requestedStartTime}.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Cancelled",
      body,
      data: { screen: "bookings", tab: "history" },
    });
  },
});

export const notifyOwnerCustomerNoShow = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.owner) return;
    const tokens = row.owner.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club, customer } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const timeStr = formatTimeLabel(startMs, club.timezone);
    const name = customer?.name ?? "Customer";
    const body = `${name} didn't show up for their ${timeStr} booking.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Customer No-Show",
      body,
      data: { screen: "bookings", tab: "history" },
    });
  },
});

export const notifyOwnerApprovalDeadlineHalf = internalAction({
  args: { bookingId: v.id("bookings"), remainingMinutes: v.number() },
  handler: async (ctx, { bookingId, remainingMinutes }) => {
    const row = await ctx.runQuery(
      internal.notifications.getBookingForNotification,
      { bookingId },
    );
    if (!row?.owner) return;
    const tokens = row.owner.fcmTokens ?? [];
    if (tokens.length === 0) return;
    const { booking, club, customer } = row;
    const startMs = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const name = customer?.name ?? "Customer";
    const body = `Pending booking from ${name} for ${formatDateLabel(startMs, club.timezone)} at ${formatTimeLabel(startMs, club.timezone)} needs your response. Expires in ${remainingMinutes} minutes.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens,
      title: "Booking Needs Response",
      body,
      data: { screen: "bookings", tab: "pending" },
    });
  },
});

export const notifyOwnerBookingAutoCancelledCustomerDeletion = internalAction({
  args: {
    ownerTokens: v.array(v.string()),
    customerName: v.string(),
    requestedDate: v.string(),
    requestedStartTime: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.ownerTokens.length === 0) return;
    const body = `${args.customerName}'s account has been deleted. Their booking for ${args.requestedDate} at ${args.requestedStartTime} has been automatically cancelled.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens: args.ownerTokens,
      title: "Booking Auto-Cancelled",
      body,
      data: { screen: "bookings", tab: "history" },
    });
  },
});

export const notifySessionTimerAlert = internalAction({
  args: {
    ownerTokens: v.array(v.string()),
    tableLabel: v.string(),
    minutes: v.number(),
  },
  handler: async (ctx, { ownerTokens, tableLabel, minutes }) => {
    if (ownerTokens.length === 0) return;
    const body = `Table ${tableLabel} alert: ${minutes} minutes reached.`;
    await ctx.runAction(internal.notifications.deliverFcm, {
      tokens: ownerTokens,
      title: "Table Alert",
      body,
      data: { screen: "slots" },
    });
  },
});

const GRACE_MS = 24 * 60 * 60 * 1000;

function formatSubscriptionExpiryDate(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function formatFreezeInstant(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

function formatRenewalDayMonthYear(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export const internalGetClubDoc = internalQuery({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => ctx.db.get(clubId),
});

export const sendSubscriptionReminderEmail = internalAction({
  args: {
    clubId: v.id("clubs"),
    ownerId: v.id("users"),
    daysUntil: v.number(),
  },
  handler: async (ctx, { clubId, ownerId, daysUntil }) => {
    const club = await ctx.runQuery(internal.notifications.internalGetClubDoc, {
      clubId,
    });
    if (!club || club.ownerId !== ownerId) return;
    const owner = await ctx.runQuery(internal.notifications.getUserById, {
      userId: ownerId,
    });
    if (!owner?.email) return;
    const expiryDate = formatSubscriptionExpiryDate(
      club.subscriptionExpiresAt,
      club.timezone,
    );
    await ctx.runAction(
      internal.notificationsFcm.sendSubscriptionReminderEmail,
      {
        email: owner.email,
        clubName: club.name,
        expiryDate,
        daysUntil,
      },
    );
  },
});

export const sendSubscriptionGraceEmail = internalAction({
  args: {
    clubId: v.id("clubs"),
    ownerId: v.id("users"),
  },
  handler: async (ctx, { clubId, ownerId }) => {
    const club = await ctx.runQuery(internal.notifications.internalGetClubDoc, {
      clubId,
    });
    if (!club || club.ownerId !== ownerId) return;
    const owner = await ctx.runQuery(internal.notifications.getUserById, {
      userId: ownerId,
    });
    if (!owner?.email) return;
    const freezeAt = club.subscriptionExpiresAt + GRACE_MS;
    const freezeTime = formatFreezeInstant(freezeAt, club.timezone);
    await ctx.runAction(
      internal.notificationsFcm.sendSubscriptionGracePeriodEmail,
      {
        email: owner.email,
        clubName: club.name,
        freezeTime,
      },
    );
  },
});

export const sendRenewalConfirmationEmail = internalAction({
  args: {
    ownerId: v.id("users"),
    clubId: v.id("clubs"),
    clubName: v.string(),
    newExpiresAt: v.number(),
  },
  handler: async (ctx, { ownerId, clubId, clubName, newExpiresAt }) => {
    const club = await ctx.runQuery(internal.notifications.internalGetClubDoc, {
      clubId,
    });
    if (!club || club.ownerId !== ownerId) return;
    const owner = await ctx.runQuery(internal.notifications.getUserById, {
      userId: ownerId,
    });
    if (!owner?.email) return;
    const newExpiryDate = formatRenewalDayMonthYear(
      newExpiresAt,
      club.timezone,
    );
    await ctx.runAction(
      internal.notificationsFcm.sendRenewalConfirmationEmail,
      {
        email: owner.email,
        clubName,
        newExpiryDate,
      },
    );
  },
});
