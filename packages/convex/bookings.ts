import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  bookingAppliesToTable,
  resolveRatePerMinAtSessionStart,
} from "./model/sessionRate";
import {
  assertMutationClubScope,
  getClubForViewer,
  requireCustomer,
  requireOwner,
  requireViewer,
} from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import {
  addCalendarDaysYmd,
  computeBookingUnixTime,
  dateYmdInTimeZone,
  dayOfWeekInTimeZone,
  hhmmToMinutes,
  zonedWallTimeToUtcMs,
} from "@a3/utils/timezone";
import { getApplicableRate } from "@a3/utils/billing";
import { countActiveComplaintsForUser } from "./complaints";

function normalizeTableType(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseHHMM(s: string): number {
  return hhmmToMinutes(s);
}

function formatHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Bookable wall clock in club TZ; supports overnight windows (open > close). */
function withinBookableWallClock(
  startMin: number,
  durationMin: number,
  openMin: number,
  closeMin: number,
): boolean {
  const endMin = startMin + durationMin;
  if (openMin <= closeMin) {
    return startMin >= openMin && endMin <= closeMin;
  }
  if (startMin >= openMin) {
    return endMin <= 1440 + closeMin;
  }
  if (startMin < closeMin) {
    return endMin <= closeMin;
  }
  return false;
}

function enumerateSlotStartMinutes(
  openMin: number,
  closeMin: number,
  durationMin: number,
  step: number,
): number[] {
  const out: number[] = [];
  if (openMin <= closeMin) {
    for (let t = openMin; t + durationMin <= closeMin; t += step) {
      out.push(t);
    }
    return out;
  }
  for (let t = openMin; t < 1440; t += step) {
    if (withinBookableWallClock(t, durationMin, openMin, closeMin)) {
      out.push(t);
    }
  }
  for (let t = 0; t < closeMin; t += step) {
    if (withinBookableWallClock(t, durationMin, openMin, closeMin)) {
      out.push(t);
    }
  }
  return out;
}

function overlaps(
  newStartMs: number,
  newEndMs: number,
  existingStartMs: number,
  existingEndMs: number,
): boolean {
  // Zero-gap rule: adjacent bookings are allowed.
  return !(newEndMs <= existingStartMs || newStartMs >= existingEndMs);
}

function bookingWindowMs(
  booking: Doc<"bookings">,
  timezone: string,
): { startMs: number; endMs: number } {
  const startMs = zonedWallTimeToUtcMs(
    booking.requestedDate,
    booking.requestedStartTime,
    timezone,
  );
  return {
    startMs,
    endMs: startMs + booking.requestedDurationMin * 60_000,
  };
}

async function syncBookingLog(
  ctx: Pick<MutationCtx, "db">,
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

function assertBookingTransition(
  current: Doc<"bookings">["status"],
  allowedFrom: Doc<"bookings">["status"][],
): void {
  if (!allowedFrom.includes(current)) {
    throw new Error("BOOKING_006: Invalid state transition");
  }
}

/** Same rules as submitBooking / getAvailableSlots: zero-gap; pending by type; confirmed by table or type. */
function tableHasBookingConflictForWindow(
  table: Doc<"tables">,
  windowStartMs: number,
  windowEndMs: number,
  requestedTypeNormalized: string,
  activeBookings: Doc<"bookings">[],
  timezone: string,
  excludeBookingId?: Id<"bookings">,
): boolean {
  if (table.currentSessionId !== undefined) return true;
  for (const b of activeBookings) {
    if (excludeBookingId !== undefined && b._id === excludeBookingId) continue;
    const { startMs: existingStartMs, endMs: existingEndMs } = bookingWindowMs(
      b,
      timezone,
    );
    if (
      !overlaps(windowStartMs, windowEndMs, existingStartMs, existingEndMs)
    ) {
      continue;
    }
    if (
      b.status === "pending_approval" &&
      normalizeTableType(b.tableType) === requestedTypeNormalized
    ) {
      return true;
    }
    if (b.status === "confirmed" && bookingAppliesToTable(b, table)) {
      return true;
    }
  }
  return false;
}

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

async function roleContext(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<{ roleId?: Id<"staffRoles">; roleName?: string; allowedTableIds?: Id<"tables">[] }> {
  if (!roleId) return {};
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error("DATA_003: Staff role not found");
  }
  return {
    roleId,
    roleName: role.name,
    allowedTableIds: role.allowedTableIds,
  };
}

function ensureRoleCanAssignTable(
  allowedTableIds: Id<"tables">[] | undefined,
  tableId: Id<"tables">,
): void {
  if (!allowedTableIds) return;
  if (!allowedTableIds.includes(tableId)) {
    throw new Error("STAFF_002: Table outside allowed set");
  }
}

export const submitBooking = mutation({
  args: {
    clubId: v.id("clubs"),
    tableType: v.string(),
    requestedDate: v.string(),
    requestedStartTime: v.string(),
    requestedDurationMin: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const customer = requireCustomer(viewer);
    const user = await ctx.db.get(customer.userId);
    if (!user) throw new Error("AUTH_001: Not authenticated");

    // 1 — AUTH_002 / AUTH_006 / AUTH_004 (requireViewer already enforced 002/006 for viewer)
    if (user.phoneVerified !== true) {
      throw new Error("AUTH_004: Phone not verified");
    }

    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("DATA_003: Club not found");

    const now = Date.now();
    const requestedTypeNormalized = normalizeTableType(args.tableType);
    const requestedStartMs = zonedWallTimeToUtcMs(
      args.requestedDate,
      args.requestedStartTime,
      club.timezone,
    );
    const requestedEndMs =
      requestedStartMs + args.requestedDurationMin * 60_000;

    // 2 — BOOKING_004
    if (
      club.bookingSettings.enabled !== true ||
      club.subscriptionStatus === "frozen"
    ) {
      throw new Error("BOOKING_004: Club not accepting bookings");
    }

    // 3 — BOOKING_009
    const normalizedBookableTypes = club.bookingSettings.bookableTableTypes.map(
      (t) => normalizeTableType(t),
    );
    if (!normalizedBookableTypes.includes(requestedTypeNormalized)) {
      throw new Error("BOOKING_009: Table type not bookable");
    }

    // 4 — BOOKING_008 (date not past, within maxAdvanceDays in club TZ)
    const todayYmd = dateYmdInTimeZone(now, club.timezone);
    const lastAllowedYmd = addCalendarDaysYmd(
      todayYmd,
      club.bookingSettings.maxAdvanceDays,
      club.timezone,
    );
    if (args.requestedDate < todayYmd || args.requestedDate > lastAllowedYmd) {
      throw new Error("BOOKING_008: Outside bookable window");
    }

    // 5 — BOOKING_008 (bookable hours + DOW)
    const bookableHours = club.bookingSettings.bookableHours;
    if (!bookableHours) {
      throw new Error("BOOKING_008: Outside bookable hours");
    }
    const dayOfWeek = dayOfWeekInTimeZone(requestedStartMs, club.timezone);
    const startMin = parseHHMM(args.requestedStartTime);
    const openMin = parseHHMM(bookableHours.open);
    const closeMin = parseHHMM(bookableHours.close);
    const dayAllowed = bookableHours.daysOfWeek.includes(dayOfWeek);
    const withinHours = withinBookableWallClock(
      startMin,
      args.requestedDurationMin,
      openMin,
      closeMin,
    );
    if (!dayAllowed || !withinHours) {
      throw new Error("BOOKING_008: Outside bookable hours");
    }

    // 6 — BOOKING_010
    const minStartMs = now + club.bookingSettings.minAdvanceMinutes * 60_000;
    if (requestedStartMs < minStartMs) {
      throw new Error("BOOKING_010: Min advance time not met");
    }

    // 7 — BOOKING_008 (duration option)
    if (
      !club.bookingSettings.slotDurationOptions.includes(
        args.requestedDurationMin,
      )
    ) {
      throw new Error("BOOKING_008: Invalid slot duration");
    }

    const notesTrimmed = args.notes?.trim();
    if (notesTrimmed !== undefined && notesTrimmed.length > 200) {
      throw new Error("BOOKING_008: Notes too long");
    }

    // 8 — BOOKING_001
    const customerBookingsAtClub = await ctx.db
      .query("bookings")
      .withIndex("by_customer", (q) => q.eq("customerId", customer.userId))
      .filter((q) => q.eq(q.field("clubId"), args.clubId))
      .collect();
    const activeAtClubCount = customerBookingsAtClub.filter(
      (b) =>
        b.status === "pending_approval" || b.status === "confirmed",
    ).length;
    if (activeAtClubCount >= 2) {
      throw new Error("BOOKING_001: Max active bookings at club reached");
    }

    // 9 — BOOKING_002 (bookingLogs inside mutation)
    const activeBookingLogs = (
      await ctx.db
        .query("bookingLogs")
        .withIndex("by_customer_status", (q) =>
          q.eq("customerId", customer.userId).eq("status", "pending_approval"),
        )
        .collect()
    ).concat(
      await ctx.db
        .query("bookingLogs")
        .withIndex("by_customer_status", (q) =>
          q.eq("customerId", customer.userId).eq("status", "confirmed"),
        )
        .collect(),
    );
    const activeClubIds = new Set(activeBookingLogs.map((b) => b.clubId));
    const isNewClub = !activeClubIds.has(args.clubId);
    if (isNewClub && activeClubIds.size >= 2) {
      throw new Error("BOOKING_002: Max booking clubs reached");
    }

    // 10 — BOOKING_003 (revalidate availability; race-safe)
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club_type", (q) =>
        q.eq("clubId", args.clubId).eq("tableType", requestedTypeNormalized),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const sameDayBookings = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", args.clubId).eq("requestedDate", args.requestedDate),
      )
      .collect();
    const activeBookings = sameDayBookings.filter(
      (b) =>
        b.status === "pending_approval" || b.status === "confirmed",
    );

    let hasAvailableTable = false;
    for (const table of tables) {
      if (
        !tableHasBookingConflictForWindow(
          table,
          requestedStartMs,
          requestedEndMs,
          requestedTypeNormalized,
          activeBookings,
          club.timezone,
        )
      ) {
        hasAvailableTable = true;
        break;
      }
    }
    if (!hasAvailableTable) {
      throw new Error("BOOKING_003: Slot unavailable");
    }

    // 11 — estimated cost (server only)
    const ratePerMinute = resolveRatePerMinAtSessionStart(club, requestedStartMs);
    const estimatedCost =
      Math.max(args.requestedDurationMin, club.minBillMinutes) * ratePerMinute;
    const nowMs = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      clubId: args.clubId,
      customerId: customer.userId,
      tableType: requestedTypeNormalized,
      requestedDate: args.requestedDate,
      requestedStartTime: args.requestedStartTime,
      requestedDurationMin: args.requestedDurationMin,
      status: "pending_approval",
      rejectionReason: undefined,
      notes: notesTrimmed || undefined,
      estimatedCost,
      currency: club.currency,
      confirmedTableId: undefined,
      approvedAt: undefined,
      approvedByRoleId: undefined,
      approvedByRoleName: undefined,
      sessionId: undefined,
      reminderSentAt: undefined,
      approvalReminderSentAt: undefined,
      createdAt: nowMs,
      updatedAt: nowMs,
    });

    await ctx.db.insert("bookingLogs", {
      bookingId,
      customerId: customer.userId,
      clubId: args.clubId,
      clubName: club.name,
      clubAddress: club.address,
      thumbnailPhotoId: club.photos?.[0],
      tableType: requestedTypeNormalized,
      status: "pending_approval",
      rejectionReason: undefined,
      confirmedTableLabel: undefined,
      estimatedCost,
      currency: club.currency,
      notes: notesTrimmed || undefined,
      requestedDate: args.requestedDate,
      requestedStartTime: args.requestedStartTime,
      requestedDurationMin: args.requestedDurationMin,
      createdAt: nowMs,
      updatedAt: nowMs,
    });

    const stats = await ctx.db
      .query("customerBookingStats")
      .withIndex("by_customer_club", (q) =>
        q.eq("customerId", customer.userId).eq("clubId", args.clubId),
      )
      .unique();
    if (stats) {
      await ctx.db.patch(stats._id, {
        totalBookings: stats.totalBookings + 1,
      });
    } else {
      await ctx.db.insert("customerBookingStats", {
        customerId: customer.userId,
        clubId: args.clubId,
        noShowCount: 0,
        lateCancellationCount: 0,
        totalBookings: 1,
      });
    }

    await ctx.scheduler.runAfter(0, internal.notifications.notifyNewBookingRequest, {
      bookingId,
    });

    return { bookingId };
  },
});

export const getClubBookingFlowContext = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const viewer = await requireViewer(ctx);
    requireCustomer(viewer);
    const club = await getClubForViewer(ctx, viewer, clubId, "standard");
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    const activeTableCountByType: Record<string, number> = {};
    for (const t of tables) {
      if (!t.isActive) continue;
      const typ = normalizeTableType(t.tableType);
      if (!typ) continue;
      activeTableCountByType[typ] = (activeTableCountByType[typ] ?? 0) + 1;
    }
    return {
      name: club.name,
      timezone: club.timezone,
      currency: club.currency,
      minBillMinutes: club.minBillMinutes,
      baseRatePerMin: club.baseRatePerMin,
      specialRates: club.specialRates.map((r) => ({
        daysOfWeek: r.daysOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        ratePerMin: r.ratePerMin,
      })),
      bookingSettings: club.bookingSettings,
      activeTableCountByType,
    };
  },
});

export const getAvailableSlots = query({
  args: {
    clubId: v.id("clubs"),
    tableType: v.string(),
    requestedDate: v.string(),
    requestedDurationMin: v.number(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    void viewer;

    const club = await ctx.db.get(args.clubId);
    const bookableHours = club?.bookingSettings.bookableHours;
    if (!club || !bookableHours) return [];

    const noonMs = zonedWallTimeToUtcMs(args.requestedDate, "12:00", club.timezone);
    const dow = dayOfWeekInTimeZone(noonMs, club.timezone);
    if (!bookableHours.daysOfWeek.includes(dow)) return [];

    const requestedTypeNormalized = normalizeTableType(args.tableType);

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club_type", (q) =>
        q.eq("clubId", args.clubId).eq("tableType", requestedTypeNormalized),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", args.clubId).eq("requestedDate", args.requestedDate),
      )
      .collect();
    const activeBookings = bookings.filter(
      (b) => b.status === "pending_approval" || b.status === "confirmed",
    );

    const openMin = parseHHMM(bookableHours.open);
    const closeMin = parseHHMM(bookableHours.close);
    const slots: string[] = [];

    const slotStarts = enumerateSlotStartMinutes(
      openMin,
      closeMin,
      args.requestedDurationMin,
      30,
    );

    for (const slotStartMin of slotStarts) {
      const slotTime = formatHHMM(slotStartMin);
      const slotStartMs = zonedWallTimeToUtcMs(
        args.requestedDate,
        slotTime,
        club.timezone,
      );
      const slotEndMs = slotStartMs + args.requestedDurationMin * 60_000;

      let hasAvailableTable = false;
      for (const table of tables) {
        if (
          !tableHasBookingConflictForWindow(
            table,
            slotStartMs,
            slotEndMs,
            requestedTypeNormalized,
            activeBookings,
            club.timezone,
          )
        ) {
          hasAvailableTable = true;
          break;
        }
      }
      if (hasAvailableTable) slots.push(slotTime);
    }

    return slots;
  },
});

export const getCustomerBookings = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    if (viewer.userId !== customerId) {
      throw new Error("PERM_001: Cannot access another user's data");
    }
    const rows = await ctx.db
      .query("bookingLogs")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(
      rows.map(async (row) => {
        const club = await ctx.db.get(row.clubId);
        const windowMin = club?.bookingSettings.cancellationWindowMin ?? 30;
        const isLateCancellationNow =
          row.status === "confirmed" && club
            ? Date.now() >=
              computeBookingUnixTime(
                row.requestedDate,
                row.requestedStartTime,
                club.timezone,
              ) -
                windowMin * 60_000
            : false;
        return {
          ...row,
          thumbnailPhotoUrl: row.thumbnailPhotoId
            ? await ctx.storage.getUrl(row.thumbnailPhotoId as Id<"_storage">)
            : null,
          cancellationWindowMin: windowMin,
          isLateCancellationNow,
        };
      }),
    );
  },
});

export const getPendingBookingsCount = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    if (viewer.userId !== customerId) {
      throw new Error("PERM_001: Cannot access another user's data");
    }
    const rows = await ctx.db
      .query("bookingLogs")
      .withIndex("by_customer_status", (q) =>
        q.eq("customerId", customerId).eq("status", "pending_approval"),
      )
      .collect();
    return { count: rows.length };
  },
});

export const getNextConfirmedBooking = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    if (viewer.userId !== customerId) {
      throw new Error("PERM_001: Cannot access another user's data");
    }
    const confirmed = await ctx.db
      .query("bookingLogs")
      .withIndex("by_customer_status", (q) =>
        q.eq("customerId", customerId).eq("status", "confirmed"),
      )
      .collect();
    let next: Doc<"bookingLogs"> | null = null;
    let nextStartMs = Number.POSITIVE_INFINITY;
    for (const log of confirmed) {
      const club = await ctx.db.get(log.clubId);
      if (!club) continue;
      const startMs = computeBookingUnixTime(
        log.requestedDate,
        log.requestedStartTime,
        club.timezone,
      );
      if (startMs <= Date.now()) continue;
      if (startMs < nextStartMs) {
        nextStartMs = startMs;
        next = log;
      }
    }
    if (!next) return null;
    return { log: next, startMs: nextStartMs };
  },
});

export const getBookingDetail = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    const log = await ctx.db
      .query("bookingLogs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
      .unique();
    if (!log) return null;
    if (log.customerId !== viewer.userId) {
      return null;
    }
    const club = await ctx.db.get(log.clubId);
    return {
      ...log,
      thumbnailPhotoUrl: log.thumbnailPhotoId
        ? await ctx.storage.getUrl(log.thumbnailPhotoId as Id<"_storage">)
        : null,
      cancellationWindowMin: club?.bookingSettings.cancellationWindowMin ?? 30,
      isLateCancellationNow:
        log.status === "confirmed" && club
          ? Date.now() >=
            computeBookingUnixTime(
              log.requestedDate,
              log.requestedStartTime,
              club.timezone,
            ) -
              (club.bookingSettings.cancellationWindowMin ?? 30) * 60_000
          : false,
      clubProfile: club
        ? {
            _id: club._id,
            name: club.name,
            address: club.address,
            photos: club.photos ?? [],
          }
        : null,
    };
  },
});

export const approveBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    confirmedTableId: v.optional(v.id("tables")),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    const owner = requireOwner(await requireViewer(ctx));
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.clubId !== owner.clubId) {
      throw new Error("DATA_003: Booking not found");
    }
    assertBookingTransition(booking.status, ["pending_approval"]);

    const clubDoc = await ctx.db.get(booking.clubId);
    if (!clubDoc) {
      throw new Error("DATA_003: Club not found");
    }
    if (clubDoc.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    const role = await roleContext(ctx, booking.clubId, args.roleId);

    let confirmedTableLabel: string | undefined = undefined;
    if (args.confirmedTableId !== undefined) {
      const table = await ctx.db.get(args.confirmedTableId);
      if (!table || table.clubId !== owner.clubId || !table.isActive) {
        throw new Error("SESSION_005: Table inactive");
      }
      ensureRoleCanAssignTable(role.allowedTableIds, table._id);
      if (normalizeTableType(table.tableType) !== normalizeTableType(booking.tableType)) {
        throw new Error("BOOKING_003: Slot unavailable");
      }
      if (table.currentSessionId !== undefined) {
        throw new Error("SESSION_001: Table occupied");
      }
      const { startMs: approveStartMs, endMs: approveEndMs } = bookingWindowMs(
        booking,
        clubDoc.timezone,
      );
      const sameDay = await ctx.db
        .query("bookings")
        .withIndex("by_club_date", (q) =>
          q.eq("clubId", booking.clubId).eq("requestedDate", booking.requestedDate),
        )
        .collect();
      const activeSameDay = sameDay.filter(
        (b) =>
          b.status === "pending_approval" || b.status === "confirmed",
      );
      if (
        tableHasBookingConflictForWindow(
          table,
          approveStartMs,
          approveEndMs,
          normalizeTableType(booking.tableType),
          activeSameDay,
          clubDoc.timezone,
          args.bookingId,
        )
      ) {
        throw new Error(
          "BOOKING_003: This table already has a booking at that time. Please assign a different table.",
        );
      }
      confirmedTableLabel = table.label;
    }

    const now = Date.now();
    await ctx.db.patch(args.bookingId, {
      status: "confirmed",
      confirmedTableId: args.confirmedTableId,
      approvedAt: now,
      approvedByRoleId: role.roleId,
      approvedByRoleName: role.roleName,
      updatedAt: now,
    });
    await syncBookingLog(ctx, args.bookingId, {
      status: "confirmed",
      confirmedTableLabel,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyBookingApproved, {
      bookingId: booking._id,
      confirmedTableLabel,
    });
    return { success: true as const };
  },
});

export const rejectBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    rejectionReason: v.optional(v.string()),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { bookingId, rejectionReason, roleId }) => {
    const owner = requireOwner(await requireViewer(ctx));
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.clubId !== owner.clubId) {
      throw new Error("DATA_003: Booking not found");
    }
    const club = await ctx.db.get(booking.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }
    await roleContext(ctx, booking.clubId, roleId);
    assertBookingTransition(booking.status, ["pending_approval"]);
    const now = Date.now();
    const reason = rejectionReason?.trim() || undefined;
    if (reason && reason.length > 300) {
      throw new Error("DATA_002: Rejection reason too long");
    }
    await ctx.db.patch(bookingId, {
      status: "rejected",
      rejectionReason: reason,
      updatedAt: now,
    });
    await syncBookingLog(ctx, bookingId, {
      status: "rejected",
      rejectionReason: reason,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyBookingRejected, {
      bookingId,
      rejectionReason: reason,
    });
    return { success: true as const };
  },
});

export const cancelBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    clubId: v.id("clubs"),
  },
  handler: async (ctx, { bookingId, clubId }) => {
    const customer = requireCustomer(await requireViewer(ctx));
    const bookingLog = await ctx.db
      .query("bookingLogs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
      .unique();
    if (!bookingLog || bookingLog.customerId !== customer.userId) {
      // Silent reject per customer booking RLS requirements.
      return null;
    }
    if (
      bookingLog.status === "cancelled_by_customer" ||
      bookingLog.status === "cancelled_by_club"
    ) {
      throw new Error("BOOKING_007: This booking has already been cancelled.");
    }
    if (
      bookingLog.status === "expired" ||
      bookingLog.status === "rejected" ||
      bookingLog.status === "completed"
    ) {
      throw new Error("BOOKING_006: This booking cannot be cancelled.");
    }
    if (
      bookingLog.status !== "pending_approval" &&
      bookingLog.status !== "confirmed"
    ) {
      throw new Error("BOOKING_006: This booking cannot be cancelled.");
    }
    if (bookingLog.clubId !== clubId) {
      throw new Error("DATA_003: Booking not found");
    }

    const club = await ctx.db.get(clubId);
    const timezone = club?.timezone ?? "Asia/Kolkata";
    const cancellationWindowMin = club?.bookingSettings.cancellationWindowMin ?? 30;
    const todayYmd = dateYmdInTimeZone(Date.now(), timezone);
    const counter = await ctx.db
      .query("cancellationCounts")
      .withIndex("by_customer_club_date", (q) =>
        q
          .eq("customerId", customer.userId)
          .eq("clubId", clubId)
          .eq("date", todayYmd),
      )
      .unique();
    const currentCount = counter?.count ?? 0;
    if (currentCount >= 3) {
      throw new Error(
        "BOOKING_005: You have reached the maximum of 3 cancellations at this club today. Try again tomorrow.",
      );
    }

    const booking = await ctx.db.get(bookingId);
    const isLateCancellation =
      bookingLog.status === "confirmed" &&
      Date.now() >=
        computeBookingUnixTime(
          bookingLog.requestedDate,
          bookingLog.requestedStartTime,
          timezone,
        ) -
          cancellationWindowMin * 60_000;
    const now = Date.now();
    if (booking) {
      await ctx.db.patch(bookingId, {
        status: "cancelled_by_customer",
        updatedAt: now,
      });
    }
    if (counter) {
      await ctx.db.patch(counter._id, { count: currentCount + 1 });
    } else {
      await ctx.db.insert("cancellationCounts", {
        customerId: customer.userId,
        clubId,
        date: todayYmd,
        count: 1,
      });
    }
    await ctx.db.patch(bookingLog._id, {
      status: "cancelled_by_customer",
      updatedAt: now,
    });
    if (isLateCancellation) {
      const stats = await ctx.db
        .query("customerBookingStats")
        .withIndex("by_customer_club", (q) =>
          q.eq("customerId", customer.userId).eq("clubId", clubId),
        )
        .unique();
      if (stats) {
        await ctx.db.patch(stats._id, {
          lateCancellationCount: stats.lateCancellationCount + 1,
        });
      } else {
        await ctx.db.insert("customerBookingStats", {
          customerId: customer.userId,
          clubId,
          noShowCount: 0,
          lateCancellationCount: 1,
          totalBookings: 0,
        });
      }
    }
    if (club) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyOwnerCustomerCancelledBooking,
        { bookingId },
      );
    }
    return { cancelled: true as const, isLateCancellation };
  },
});

export const clubCancelBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    cancellationReason: v.optional(v.string()),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { bookingId, cancellationReason, roleId }) => {
    const owner = requireOwner(await requireViewer(ctx));
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.clubId !== owner.clubId) {
      throw new Error("DATA_003: Booking not found");
    }
    const club = await ctx.db.get(booking.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }
    await roleContext(ctx, booking.clubId, roleId);
    assertBookingTransition(booking.status, ["confirmed"]);
    const now = Date.now();
    const reason = cancellationReason?.trim() || undefined;
    if (reason && reason.length > 300) {
      throw new Error("DATA_002: Cancellation reason too long");
    }
    await ctx.db.patch(bookingId, {
      status: "cancelled_by_club",
      rejectionReason: reason,
      updatedAt: now,
    });
    await syncBookingLog(ctx, bookingId, {
      status: "cancelled_by_club",
      rejectionReason: reason,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyBookingCancelledByClub, {
      bookingId,
    });
    return { success: true as const };
  },
});

export const startSessionFromBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    tableId: v.optional(v.id("tables")),
    roleId: v.optional(v.id("staffRoles")),
    staffAcknowledgedComplaint: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookingId, tableId, roleId, staffAcknowledgedComplaint }) => {
    const owner = requireOwner(await requireViewer(ctx));
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.clubId !== owner.clubId) {
      throw new Error("DATA_003: Booking not found");
    }
    assertBookingTransition(booking.status, ["confirmed"]);

    const club = await ctx.db.get(booking.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    const startUnix = computeBookingUnixTime(
      booking.requestedDate,
      booking.requestedStartTime,
      club.timezone,
    );
    const now = Date.now();
    const earlyWindow = startUnix - 15 * 60_000;
    const lateWindow = startUnix + 30 * 60_000;
    if (now < earlyWindow || now > lateWindow) {
      throw new Error("BOOKING_011: Outside start window");
    }

    const customer = await ctx.db.get(booking.customerId);
    if (!customer) throw new Error("DATA_003: Customer not found");
    if (customer.isFrozen) throw new Error("SESSION_003: Customer frozen");
    if (customer.deletionRequestedAt !== undefined) {
      throw new Error("SESSION_004: Customer deleted");
    }

    const role = await roleContext(ctx, booking.clubId, roleId);
    const complaintCount = await countActiveComplaintsForUser(
      ctx,
      booking.customerId,
    );
    if (complaintCount > 0 && !staffAcknowledgedComplaint) {
      throw new Error(
        "COMPLAINT_001: This customer has active complaints. Acknowledge before starting the session.",
      );
    }
    const targetTableId = booking.confirmedTableId ?? tableId;
    if (!targetTableId) throw new Error("SESSION_006: No table assigned");

    const table = await ctx.db.get(targetTableId);
    if (!table || table.clubId !== booking.clubId || !table.isActive) {
      throw new Error("SESSION_005: Table inactive");
    }
    if (table.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Table occupied");
    }
    ensureRoleCanAssignTable(role.allowedTableIds, targetTableId);

    const ratePerMin = getApplicableRate(
      now,
      club.specialRates,
      club.baseRatePerMin,
      club.timezone,
    );

    const sessionId = await ctx.db.insert("sessions", {
      tableId: targetTableId,
      clubId: booking.clubId,
      customerId: booking.customerId,
      guestName: undefined,
      guestAge: undefined,
      isGuest: false,
      startTime: now,
      endTime: undefined,
      billableMinutes: undefined,
      ratePerMin,
      minBillMinutes: club.minBillMinutes,
      currency: club.currency,
      snackOrders: [],
      billTotal: undefined,
      discount: undefined,
      paymentMethod: undefined,
      paymentStatus: "pending",
      status: "active",
      cancellationReason: undefined,
      timerAlertMinutes: undefined,
      timerAlertFiredAt: undefined,
      creditResolvedAt: undefined,
      creditResolvedMethod: undefined,
      staffAcknowledgedComplaint: staffAcknowledgedComplaint ? true : undefined,
      acknowledgedByRoleId: staffAcknowledgedComplaint ? roleId : undefined,
      acknowledgedAt: staffAcknowledgedComplaint ? now : undefined,
      bookingId,
      discountAppliedByRoleId: undefined,
      discountAppliedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(targetTableId, { currentSessionId: sessionId });
    await ctx.db.patch(bookingId, {
      status: "completed",
      sessionId,
      updatedAt: now,
    });
    await syncBookingLog(ctx, bookingId, { status: "completed", updatedAt: now });

    await ctx.db.insert("sessionLogs", {
      sessionId,
      customerId: booking.customerId,
      clubId: booking.clubId,
      clubName: club.name,
      tableLabel: table.label,
      startTime: now,
      endTime: undefined,
      billTotal: undefined,
      currency: club.currency,
      paymentStatus: "pending",
      paymentMethod: undefined,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return { sessionId, hasComplaints: customer.complaints.length > 0 };
  },
});

export const listPendingBookings = query({
  args: {
    clubId: v.id("clubs"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clubId, cursor = 0, limit = 20 }) => {
    const owner = requireOwner(await requireViewer(ctx));
    if (owner.clubId !== clubId) throw new Error("PERM_001: Owner only");

    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) =>
        q.eq("clubId", clubId).eq("status", "pending_approval"),
      )
      .collect();
    const sorted = rows.sort((a, b) =>
      a.requestedDate === b.requestedDate
        ? a.requestedStartTime.localeCompare(b.requestedStartTime)
        : a.requestedDate.localeCompare(b.requestedDate),
    );
    const page = sorted.slice(cursor, cursor + limit);
    const items = await Promise.all(
      page.map(async (b) => {
        const user = await ctx.db.get(b.customerId);
        const stats = await ctx.db
          .query("customerBookingStats")
          .withIndex("by_customer_club", (q) =>
            q.eq("customerId", b.customerId).eq("clubId", b.clubId),
          )
          .unique();
        const logs = await ctx.db
          .query("bookingLogs")
          .withIndex("by_customer", (q) => q.eq("customerId", b.customerId))
          .collect();
        const platformTotal = logs.length;
        const platformNoShow = logs.filter((l) => l.status === "expired").length;
        const complaintDocs = await Promise.all(
          (user?.complaints ?? []).map((id) => ctx.db.get(id)),
        );
        const complaintTypes = complaintDocs
          .filter((c): c is NonNullable<typeof c> => c !== null && c.removedAt === undefined)
          .map((c) => c.type);
        return {
          booking: b,
          customer: {
            name: user?.name ?? "Unknown",
            phone: user?.phone ?? "",
          },
          complaints: complaintTypes,
          customerStats: {
            thisClub: {
              totalBookings: stats?.totalBookings ?? 0,
              noShowCount: stats?.noShowCount ?? 0,
              lateCancellationCount: stats?.lateCancellationCount ?? 0,
            },
            platformWide: {
              totalBookings: platformTotal,
              noShowCount: platformNoShow,
            },
          },
        };
      }),
    );
    const nextCursor = cursor + page.length < sorted.length ? cursor + page.length : null;
    return { items, nextCursor };
  },
});

export const listAssignableTablesForBooking = query({
  args: {
    bookingId: v.id("bookings"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { bookingId, roleId }) => {
    const owner = requireOwner(await requireViewer(ctx));
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.clubId !== owner.clubId) {
      throw new Error("DATA_003: Booking not found");
    }
    const club = await ctx.db.get(booking.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    const role = roleId
      ? await ctx.db.get(roleId)
      : null;
    if (roleId && (!role || role.clubId !== booking.clubId)) {
      throw new Error("DATA_003: Staff role not found");
    }
    const allowedSet = role?.allowedTableIds
      ? new Set(role.allowedTableIds)
      : null;
    const requestedType = normalizeTableType(booking.tableType);
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club_type", (q) =>
        q.eq("clubId", booking.clubId).eq("tableType", requestedType),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    const sameDayBookings = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", booking.clubId).eq("requestedDate", booking.requestedDate),
      )
      .collect();
    const active = sameDayBookings.filter(
      (b) => b.status === "pending_approval" || b.status === "confirmed",
    );
    const { startMs, endMs } = bookingWindowMs(booking, club.timezone);
    return tables
      .filter((table) => {
        if (allowedSet && !allowedSet.has(table._id)) return false;
        return !tableHasBookingConflictForWindow(
          table,
          startMs,
          endMs,
          requestedType,
          active,
          club.timezone,
          booking._id,
        );
      })
      .map((table) => ({ _id: table._id, label: table.label }));
  },
});

export const listUpcomingBookings = query({
  args: {
    clubId: v.id("clubs"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clubId, cursor = 0, limit = 20 }) => {
    const owner = requireOwner(await requireViewer(ctx));
    if (owner.clubId !== clubId) throw new Error("PERM_001: Owner only");
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    const today = dateYmdInTimeZone(Date.now(), club.timezone);
    const rows = (
      await ctx.db
        .query("bookings")
        .withIndex("by_status", (q) =>
          q.eq("clubId", clubId).eq("status", "confirmed"),
        )
        .collect()
    ).filter((b) => b.requestedDate >= today);
    const sorted = rows.sort((a, b) =>
      a.requestedDate === b.requestedDate
        ? a.requestedStartTime.localeCompare(b.requestedStartTime)
        : a.requestedDate.localeCompare(b.requestedDate),
    );
    const page = sorted.slice(cursor, cursor + limit);
    const items = await Promise.all(
      page.map(async (b) => {
        const user = await ctx.db.get(b.customerId);
        const table = b.confirmedTableId ? await ctx.db.get(b.confirmedTableId) : null;
        const complaintDocs = await Promise.all(
          (user?.complaints ?? []).map((id) => ctx.db.get(id)),
        );
        const complaints = complaintDocs
          .filter((c): c is NonNullable<typeof c> => c !== null && c.removedAt === undefined)
          .map((c) => c.type);
        return {
          booking: b,
          customer: { name: user?.name ?? "Unknown" },
          complaints,
          confirmedTableLabel: table?.label,
        };
      }),
    );
    const nextCursor = cursor + page.length < sorted.length ? cursor + page.length : null;
    return { items, nextCursor };
  },
});

export const listHistoryBookings = query({
  args: {
    clubId: v.id("clubs"),
    statusFilter: v.optional(v.string()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = requireOwner(await requireViewer(ctx));
    if (owner.clubId !== args.clubId) throw new Error("PERM_001: Owner only");
    const historyStatuses: Doc<"bookings">["status"][] = [
      "rejected",
      "cancelled_by_customer",
      "cancelled_by_club",
      "expired",
      "completed",
    ];
    const statuses =
      args.statusFilter && historyStatuses.includes(args.statusFilter as never)
        ? [args.statusFilter as Doc<"bookings">["status"]]
        : historyStatuses;
    const merged: (Doc<"bookings"> & { customerName: string })[] = [];
    for (const status of statuses) {
      const chunk = await ctx.db
        .query("bookings")
        .withIndex("by_status", (q) => q.eq("clubId", args.clubId).eq("status", status))
        .collect();
      for (const b of chunk) {
        if (args.dateFrom && b.requestedDate < args.dateFrom) continue;
        if (args.dateTo && b.requestedDate > args.dateTo) continue;
        const user = await ctx.db.get(b.customerId);
        const customerName = user?.name ?? "Unknown";
        if (
          args.searchQuery &&
          !customerName.toLowerCase().includes(args.searchQuery.trim().toLowerCase())
        ) {
          continue;
        }
        merged.push({ ...b, customerName });
      }
    }
    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    const cursor = args.cursor ?? 0;
    const limit = args.limit ?? 20;
    const items = merged.slice(cursor, cursor + limit);
    const nextCursor = cursor + items.length < merged.length ? cursor + items.length : null;
    return { items, nextCursor };
  },
});

export const checkApprovalDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("bookings")
      .withIndex("by_global_status", (q) => q.eq("status", "pending_approval"))
      .take(200);
    for (const booking of pending) {
      const club = await ctx.db.get(booking.clubId);
      if (!club) continue;
      const approvalMin = club.bookingSettings.approvalDeadlineMin ?? 60;
      const halfAt = booking.createdAt + (approvalMin * 60_000) / 2;
      const fullAt = booking.createdAt + approvalMin * 60_000;

      if (now >= halfAt && booking.approvalReminderSentAt === undefined) {
        const remaining = Math.max(0, Math.ceil((fullAt - now) / 60_000));
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.notifyOwnerApprovalDeadlineHalf,
          { bookingId: booking._id, remainingMinutes: remaining },
        );
        await ctx.db.patch(booking._id, { approvalReminderSentAt: now, updatedAt: now });
      }

      if (now >= fullAt) {
        const fresh = await ctx.db.get(booking._id);
        if (!fresh || fresh.status !== "pending_approval") continue;
        await ctx.db.patch(booking._id, { status: "expired", updatedAt: now });
        await syncBookingLog(ctx, booking._id, { status: "expired", updatedAt: now });
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.notifyBookingExpiredNoOwnerResponse,
          { bookingId: booking._id },
        );
      }
    }
    return { processed: pending.length };
  },
});

const ALLOWED_SLOT_DURATIONS = new Set([30, 60, 90, 120, 180]);

function isSimpleSameDayWindow(open: string, close: string): boolean {
  return hhmmToMinutes(close) >= hhmmToMinutes(open);
}

function assertBookableHoursShape(h: {
  open: string;
  close: string;
  daysOfWeek: number[];
}): void {
  if (!/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close)) {
    throw new Error("DATA_002: Bookable hours must use HH:MM");
  }
  if (h.daysOfWeek.length === 0) {
    throw new Error("DATA_002: Select at least one day for bookable hours");
  }
  for (const d of h.daysOfWeek) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error("DATA_002: Invalid day of week");
    }
  }
}

function assertBookableWithinOperating(
  club: Doc<"clubs">,
  bookableHours: { open: string; close: string; daysOfWeek: number[] },
): void {
  const oh = club.operatingHours;
  if (!oh) return;
  assertBookableHoursShape(bookableHours);
  if (
    isSimpleSameDayWindow(oh.open, oh.close) &&
    isSimpleSameDayWindow(bookableHours.open, bookableHours.close)
  ) {
    const oOpen = hhmmToMinutes(oh.open);
    const oClose = hhmmToMinutes(oh.close);
    const bOpen = hhmmToMinutes(bookableHours.open);
    const bClose = hhmmToMinutes(bookableHours.close);
    if (bOpen < oOpen || bClose > oClose) {
      throw new Error(
        "CLUB_004: Bookable hours must fall within operating hours.",
      );
    }
  }
}

export const getBookingEnablePrecheck = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const owner = requireOwner(await requireViewer(ctx));
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Cannot access another club's data");
    }
    const club = await ctx.db.get(clubId);
    if (!club) return null;
    const bs = club.bookingSettings;
    const c1 = (bs.bookableTableTypes?.length ?? 0) >= 1;
    const c2 = bs.bookableHours !== undefined;
    const c3 = club.operatingHours !== undefined;
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    const activeTypes = new Set<string>();
    for (const t of tables) {
      if (!t.isActive) continue;
      const tt = normalizeTableType(t.tableType);
      if (tt.length > 0) activeTypes.add(tt);
    }
    const c4 = (bs.bookableTableTypes ?? []).some((bt) =>
      activeTypes.has(normalizeTableType(bt)),
    );
    return {
      checks: [
        {
          id: "bookable_table_types",
          ok: c1,
          message: c1
            ? undefined
            : "Select at least one bookable table type before enabling online booking.",
        },
        {
          id: "bookable_hours",
          ok: c2,
          message: c2
            ? undefined
            : "Configure bookable hours before enabling online booking.",
        },
        {
          id: "operating_hours",
          ok: c3,
          message: c3
            ? undefined
            : "Please set your club operating hours before enabling online booking.",
        },
        {
          id: "active_tables_match",
          ok: c4,
          message: c4
            ? undefined
            : "No active tables match the selected bookable table types.",
        },
      ],
      allOk: c1 && c2 && c3 && c4,
    };
  },
});

export const updateBookingSettings = mutation({
  args: {
    clubId: v.id("clubs"),
    settings: v.object({
      maxAdvanceDays: v.optional(v.number()),
      minAdvanceMinutes: v.optional(v.number()),
      slotDurationOptions: v.optional(v.array(v.number())),
      cancellationWindowMin: v.optional(v.number()),
      approvalDeadlineMin: v.optional(v.number()),
      bookableTableTypes: v.optional(v.array(v.string())),
      bookableHours: v.optional(
        v.object({
          open: v.string(),
          close: v.string(),
          daysOfWeek: v.array(v.number()),
        }),
      ),
    }),
  },
  handler: async (ctx, { clubId, settings }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    requireOwner(viewer);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    const cur = club.bookingSettings;

    if (settings.maxAdvanceDays !== undefined) {
      if (!Number.isInteger(settings.maxAdvanceDays) || settings.maxAdvanceDays < 1) {
        throw new Error("DATA_002: maxAdvanceDays must be an integer ≥ 1");
      }
    }
    if (settings.minAdvanceMinutes !== undefined) {
      if (!Number.isInteger(settings.minAdvanceMinutes) || settings.minAdvanceMinutes < 0) {
        throw new Error("DATA_002: minAdvanceMinutes must be an integer ≥ 0");
      }
    }
    if (settings.cancellationWindowMin !== undefined) {
      if (
        !Number.isInteger(settings.cancellationWindowMin) ||
        settings.cancellationWindowMin < 0
      ) {
        throw new Error("DATA_002: cancellationWindowMin must be an integer ≥ 0");
      }
    }
    if (settings.approvalDeadlineMin !== undefined) {
      if (!Number.isInteger(settings.approvalDeadlineMin) || settings.approvalDeadlineMin < 1) {
        throw new Error("DATA_002: approvalDeadlineMin must be an integer ≥ 1");
      }
    }
    if (settings.slotDurationOptions !== undefined) {
      if (settings.slotDurationOptions.length === 0) {
        throw new Error("DATA_002: Select at least one slot duration");
      }
      for (const n of settings.slotDurationOptions) {
        if (!ALLOWED_SLOT_DURATIONS.has(n)) {
          throw new Error("DATA_002: Invalid slot duration option");
        }
      }
    }
    const next = { ...cur };
    if (settings.maxAdvanceDays !== undefined) {
      next.maxAdvanceDays = settings.maxAdvanceDays;
    }
    if (settings.minAdvanceMinutes !== undefined) {
      next.minAdvanceMinutes = settings.minAdvanceMinutes;
    }
    if (settings.slotDurationOptions !== undefined) {
      next.slotDurationOptions = settings.slotDurationOptions;
    }
    if (settings.cancellationWindowMin !== undefined) {
      next.cancellationWindowMin = settings.cancellationWindowMin;
    }
    if (settings.approvalDeadlineMin !== undefined) {
      next.approvalDeadlineMin = settings.approvalDeadlineMin;
    }
    if (settings.bookableTableTypes !== undefined) {
      next.bookableTableTypes = settings.bookableTableTypes.map((t) =>
        normalizeTableType(t),
      );
    }
    if (settings.bookableHours !== undefined) {
      assertBookableWithinOperating(club, settings.bookableHours);
      next.bookableHours = settings.bookableHours;
    }

    await ctx.db.patch(clubId, { bookingSettings: next });
    return { ok: true as const };
  },
});

export const toggleBookingEnabled = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    requireOwner(viewer);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    const cur = club.bookingSettings.enabled;
    if (!cur) {
      const bs = club.bookingSettings;
      if ((bs.bookableTableTypes?.length ?? 0) < 1) {
        throw new Error(
          "CLUB_002: Select at least one bookable table type before enabling online booking.",
        );
      }
      if (bs.bookableHours === undefined) {
        throw new Error(
          "CLUB_002: Configure bookable hours before enabling online booking.",
        );
      }
      if (club.operatingHours === undefined) {
        throw new Error(
          "CLUB_002: Please set your club operating hours before enabling online booking.",
        );
      }
      const tables = await ctx.db
        .query("tables")
        .withIndex("by_club", (q) => q.eq("clubId", clubId))
        .collect();
      const activeTypes = new Set<string>();
      for (const t of tables) {
        if (!t.isActive) continue;
        const tt = normalizeTableType(t.tableType);
        if (tt.length > 0) activeTypes.add(tt);
      }
      const okType = (bs.bookableTableTypes ?? []).some((bt) =>
        activeTypes.has(normalizeTableType(bt)),
      );
      if (!okType) {
        throw new Error(
          "CLUB_002: No active tables match the selected bookable table types.",
        );
      }
    }
    await ctx.db.patch(clubId, {
      bookingSettings: { ...club.bookingSettings, enabled: !cur },
    });
    return { enabled: !cur };
  },
});

export const detectNoShows = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const confirmed = await ctx.db
      .query("bookings")
      .withIndex("by_global_status", (q) => q.eq("status", "confirmed"))
      .take(200);
    for (const booking of confirmed) {
      const club = await ctx.db.get(booking.clubId);
      if (!club) continue;
      const customer = await ctx.db.get(booking.customerId);
      const startUnix = computeBookingUnixTime(
        booking.requestedDate,
        booking.requestedStartTime,
        club.timezone,
      );
      if (now <= startUnix + 30 * 60_000) continue;
      const fresh = await ctx.db.get(booking._id);
      if (!fresh || fresh.status !== "confirmed" || fresh.sessionId !== undefined) continue;

      await ctx.db.patch(booking._id, { status: "expired", updatedAt: now });
      await syncBookingLog(ctx, booking._id, { status: "expired", updatedAt: now });

      const stats = await ctx.db
        .query("customerBookingStats")
        .withIndex("by_customer_club", (q) =>
          q.eq("customerId", booking.customerId).eq("clubId", booking.clubId),
        )
        .unique();
      if (stats) {
        await ctx.db.patch(stats._id, { noShowCount: stats.noShowCount + 1 });
      } else {
        await ctx.db.insert("customerBookingStats", {
          customerId: booking.customerId,
          clubId: booking.clubId,
          noShowCount: 1,
          lateCancellationCount: 0,
          totalBookings: 0,
        });
      }

      if (club.subscriptionStatus === "frozen") {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.notifyNoShowCustomerFrozenClub,
          { bookingId: booking._id },
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.notifyNoShowCustomerNormal,
          { bookingId: booking._id },
        );
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.notifyOwnerCustomerNoShow,
          { bookingId: booking._id },
        );
      }
    }
    return { processed: confirmed.length };
  },
});

export const sendReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const confirmed = await ctx.db
      .query("bookings")
      .withIndex("by_global_status", (q) => q.eq("status", "confirmed"))
      .take(200);
    for (const booking of confirmed) {
      if (booking.reminderSentAt !== undefined || booking.sessionId !== undefined) continue;
      const club = await ctx.db.get(booking.clubId);
      if (!club) continue;
      const startUnix = computeBookingUnixTime(
        booking.requestedDate,
        booking.requestedStartTime,
        club.timezone,
      );
      const diff = startUnix - now;
      if (diff < 3_300_000 || diff > 3_900_000) continue;
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyBookingReminderCustomer,
        { bookingId: booking._id },
      );
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyBookingReminderOwner,
        { bookingId: booking._id },
      );
      await ctx.db.patch(booking._id, { reminderSentAt: now, updatedAt: now });
    }
    return { processed: confirmed.length };
  },
});

export const expireBooking = internalMutation({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) {
      throw new Error("DATA_003: Booking not found");
    }
    assertBookingTransition(booking.status, ["pending_approval", "confirmed"]);
    const now = Date.now();
    await ctx.db.patch(bookingId, {
      status: "expired",
      updatedAt: now,
    });
    await syncBookingLog(ctx, bookingId, {
      status: "expired",
      updatedAt: now,
    });
    return { success: true as const };
  },
});
