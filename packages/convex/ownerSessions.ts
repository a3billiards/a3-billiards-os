/**
 * Owner session start (walk-in). Rate + currency locked on session row.
 * Table lock: acquire via ownerSessionActions.acquireTableLock (UUID in action);
 * startWalkInSession requires matching lock token + non-expired tableLockExpiry.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwnerWithClub, requireViewer } from "./model/viewer";
import { bookingAppliesToTable, resolveRatePerMinAtSessionStart } from "./model/sessionRate";
import { computeBookingUnixTime, dateYmdInTimeZone } from "@a3/utils/timezone";
import { countActiveComplaintsForUser } from "./complaints";
import { computeBill, clampDiscountPercent } from "@a3/utils/billing";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { bookingWindowMs } from "./model/bookingDuration";
import { normalizeTableTypeId } from "@a3/utils/tableTypes";
import {
  assertGuestDisplayName,
  assertLockToken,
  assertPlayerDisplayName,
  assertPlayerKey,
} from "./model/inputValidation";

const sessionParticipantSideArg = v.union(
  v.literal("sideA"),
  v.literal("sideB"),
);

const sessionParticipantArg = v.object({
  key: v.string(),
  customerId: v.optional(v.id("users")),
  displayName: v.string(),
  isGuest: v.boolean(),
  side: v.optional(sessionParticipantSideArg),
});

const sessionPlayModeArg = v.union(v.literal("casual"), v.literal("versus"));

type ParticipantInput = {
  key: string;
  customerId?: Id<"users">;
  displayName: string;
  isGuest: boolean;
  side?: "sideA" | "sideB";
};

async function validateAndNormalizeParticipants(
  ctx: MutationCtx,
  args: {
    customerId?: Id<"users">;
    guestName?: string;
    participants?: ParticipantInput[];
    playMode?: "casual" | "versus";
    losersPay?: boolean;
    staffAcknowledgedComplaint?: boolean;
    roleId?: Id<"staffRoles">;
  },
): Promise<{
  participants: ParticipantInput[];
  playMode: "casual" | "versus";
  losersPay: boolean;
  complaintAck: {
    staffAcknowledgedComplaint?: boolean;
    acknowledgedByRoleId?: Id<"staffRoles">;
    acknowledgedAt?: number;
  };
}> {
  const playMode = args.playMode ?? "casual";
  const losersPay = args.losersPay === true;
  const now = Date.now();

  if (losersPay && playMode !== "versus") {
    throw new Error("SESSION_007: Losers pay is only available in versus mode");
  }

  let participants: ParticipantInput[] = args.participants ?? [];

  if (participants.length === 0 && args.customerId !== undefined) {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("DATA_003: Customer not found");
    }
    participants = [
      {
        key: String(args.customerId),
        customerId: args.customerId,
        displayName: customer.name,
        isGuest: false,
        side: playMode === "versus" ? "sideA" : undefined,
      },
    ];
  }

  if (participants.length > 0) {
    const seenKeys = new Set<string>();
    const seenCustomerIds = new Set<string>();
    for (const p of participants) {
      const key = assertPlayerKey(p.key);
      const name = assertPlayerDisplayName(p.displayName);
      if (!key || !name) {
        throw new Error("DATA_001: Each player needs a name");
      }
      if (seenKeys.has(key)) {
        throw new Error("DATA_001: Duplicate player on this table");
      }
      seenKeys.add(key);
      p.key = key;
      p.displayName = name;
      if (p.isGuest && p.customerId !== undefined) {
        throw new Error("DATA_001: Guest players cannot have a customer id");
      }
      if (!p.isGuest) {
        if (p.customerId === undefined) {
          throw new Error("DATA_001: Registered players must have a customer id");
        }
        const cid = String(p.customerId);
        if (seenCustomerIds.has(cid)) {
          throw new Error("DATA_001: Same customer cannot be added twice");
        }
        seenCustomerIds.add(cid);
        const customer = await ctx.db.get(p.customerId);
        if (!customer || customer.role !== "customer") {
          throw new Error("DATA_003: Customer not found");
        }
        if (customer.isFrozen) {
          throw new Error("SESSION_003: Customer frozen");
        }
        if (customer.deletionRequestedAt !== undefined) {
          throw new Error("SESSION_004: Customer deleted");
        }
        if (!customer.phoneVerified) {
          throw new Error(
            "AUTH_004: Each player must be phone-verified before play",
          );
        }
      }
    }

    if (args.customerId !== undefined) {
      const primaryInList = participants.some(
        (p) => p.customerId === args.customerId,
      );
      if (!primaryInList) {
        throw new Error("DATA_001: Primary customer must be in the player list");
      }
    }
  }

  if (playMode === "versus") {
    if (args.guestName !== undefined && args.customerId === undefined) {
      throw new Error(
        "SESSION_008: Versus mode requires registered, verified players",
      );
    }
    const registered = participants.filter(
      (p) => !p.isGuest && p.customerId !== undefined,
    );
    if (registered.length < 2) {
      throw new Error(
        "SESSION_008: Versus mode needs at least two verified players",
      );
    }
    if (!registered.every((p) => p.side === "sideA" || p.side === "sideB")) {
      throw new Error("SESSION_008: Assign each player to Side A or Side B");
    }
    const hasA = registered.some((p) => p.side === "sideA");
    const hasB = registered.some((p) => p.side === "sideB");
    if (!hasA || !hasB) {
      throw new Error("SESSION_008: Versus mode needs players on both sides");
    }
  } else if (participants.some((p) => p.side !== undefined)) {
    throw new Error("DATA_001: Side assignment is only for versus mode");
  }

  let complaintAck: {
    staffAcknowledgedComplaint?: boolean;
    acknowledgedByRoleId?: Id<"staffRoles">;
    acknowledgedAt?: number;
  } = {};

  const customerIdsToCheck = new Set<Id<"users">>();
  if (args.customerId !== undefined) {
    customerIdsToCheck.add(args.customerId);
  }
  for (const p of participants) {
    if (p.customerId !== undefined) {
      customerIdsToCheck.add(p.customerId);
    }
  }

  for (const userId of customerIdsToCheck) {
    const n = await countActiveComplaintsForUser(ctx, userId);
    if (n > 0) {
      if (!args.staffAcknowledgedComplaint) {
        throw new Error(
          "COMPLAINT_001: A player has active complaints. Acknowledge before starting the session.",
        );
      }
      complaintAck = {
        staffAcknowledgedComplaint: true,
        acknowledgedByRoleId: args.roleId,
        acknowledgedAt: now,
      };
      break;
    }
  }

  return { participants, playMode, losersPay, complaintAck };
}

async function assertSlotsTabPermission(
  ctx: MutationCtx | QueryCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  if (!roleId) return;
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error("PERM_001: Staff role not found");
  }
  if (!role.allowedTabs.includes("slots")) {
    throw new Error("PERM_001: Slots tab not allowed for active role");
  }
}

/**
 * Called only from acquireTableLock action (server-side UUID).
 */
export const applyTableLock = internalMutation({
  args: {
    ownerUserId: v.id("users"),
    tableId: v.id("tables"),
    lockToken: v.string(),
    tableLockExpiry: v.number(),
  },
  handler: async (ctx, { ownerUserId, tableId, lockToken, tableLockExpiry }) => {
    const user = await ctx.db.get(ownerUserId);
    if (!user || user.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    if (user.isFrozen) {
      throw new Error("AUTH_002: Account is frozen");
    }
    if (user.deletionRequestedAt !== undefined) {
      throw new Error("AUTH_006: Account pending deletion");
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerUserId))
      .unique();
    if (!club) {
      throw new Error("AUTH_008: No club found for owner account");
    }
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== club._id) {
      throw new Error("DATA_003: Table not found");
    }
    if (!table.isActive) {
      throw new Error("SESSION_003: Table is inactive");
    }
    if (table.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Table is already occupied");
    }

    const now = Date.now();
    if (table.tableLockExpiry !== undefined && table.tableLockExpiry > now) {
      throw new Error(
        "SESSION_002: Table lock held by another flow — please retry",
      );
    }

    await ctx.db.patch(tableId, {
      tableLock: lockToken,
      tableLockExpiry,
    });
  },
});

/** Same owner extends an existing walk-in lock for desk WhatsApp OTP (longer TTL, same token). */
export const extendTableLockForOtpFlow = internalMutation({
  args: {
    ownerUserId: v.id("users"),
    tableId: v.id("tables"),
    lockToken: v.string(),
  },
  handler: async (ctx, { ownerUserId, tableId, lockToken }) => {
    const OTP_FLOW_LOCK_MS = 180_000;
    const user = await ctx.db.get(ownerUserId);
    if (!user || user.role !== "owner") {
      throw new Error("PERM_001: Owner only");
    }
    if (user.isFrozen) {
      throw new Error("AUTH_002: Account is frozen");
    }
    if (user.deletionRequestedAt !== undefined) {
      throw new Error("AUTH_006: Account pending deletion");
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerUserId))
      .unique();
    if (!club) {
      throw new Error("AUTH_008: No club found for owner account");
    }
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== club._id) {
      throw new Error("DATA_003: Table not found");
    }
    if (!table.isActive) {
      throw new Error("SESSION_003: Table is inactive");
    }
    if (table.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Table is already occupied");
    }

    const now = Date.now();
    if (table.tableLock !== lockToken) {
      throw new Error(
        "SESSION_002: Table lock no longer matches — tap the table again to reserve it",
      );
    }
    if (table.tableLockExpiry === undefined || table.tableLockExpiry <= now) {
      throw new Error(
        "SESSION_002: Table lock expired — tap the table again to continue",
      );
    }

    await ctx.db.patch(tableId, {
      tableLockExpiry: now + OTP_FLOW_LOCK_MS,
    });
  },
});

export const releaseTableLock = mutation({
  args: {
    tableId: v.id("tables"),
    lockToken: v.string(),
  },
  handler: async (ctx, { tableId, lockToken }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (table.tableLock === lockToken) {
      await ctx.db.patch(tableId, {
        tableLock: undefined,
        tableLockExpiry: undefined,
      });
    }
    return { success: true as const };
  },
});

export const startWalkInSession = mutation({
  args: {
    tableId: v.id("tables"),
    lockToken: v.string(),
    guestName: v.optional(v.string()),
    forceStartDespiteConflict: v.optional(v.boolean()),
    customerId: v.optional(v.id("users")),
    roleId: v.optional(v.id("staffRoles")),
    staffAcknowledgedComplaint: v.optional(v.boolean()),
    participants: v.optional(v.array(sessionParticipantArg)),
    playMode: v.optional(sessionPlayModeArg),
    losersPay: v.optional(v.boolean()),
    assignedPlayDurationMin: v.optional(v.number()),
    assignedPlayOpenEnded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const {
      tableId,
      lockToken: rawLockToken,
      guestName,
      forceStartDespiteConflict,
      customerId,
      roleId,
      staffAcknowledgedComplaint,
      participants: participantsArg,
      playMode: playModeArg,
      losersPay: losersPayArg,
      assignedPlayDurationMin,
      assignedPlayOpenEnded,
    } = args;
    const lockToken = assertLockToken(rawLockToken);
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }
    if (club.subscriptionStatus === "frozen") {
      throw new Error("SUBSCRIPTION_003: Club account is frozen");
    }

    await assertSlotsTabPermission(ctx, owner.clubId, roleId);

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (!table.isActive) {
      throw new Error("SESSION_003: Table is inactive");
    }
    if (table.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Table is already occupied");
    }

    const now = Date.now();
    const todayYmd = dateYmdInTimeZone(now, club.timezone);
    const confirmedToday = (
      await ctx.db
        .query("bookings")
        .withIndex("by_club_date", (q) =>
          q.eq("clubId", owner.clubId).eq("requestedDate", todayYmd),
        )
        .collect()
    ).filter((b) => b.status === "confirmed");
    if (!forceStartDespiteConflict) {
      for (const booking of confirmedToday) {
        if (!bookingAppliesToTable(booking, table)) continue;
        const startMs = computeBookingUnixTime(
          booking.requestedDate,
          booking.requestedStartTime,
          club.timezone,
        );
        if (startMs > now && startMs <= now + 60 * 60_000) {
          const customer = await ctx.db.get(booking.customerId);
          return {
            hasUpcomingBooking: true as const,
            bookingTime: booking.requestedStartTime,
            customerName: customer?.name ?? "Customer",
          };
        }
      }
    }

    if (
      table.tableLock !== lockToken ||
      table.tableLockExpiry === undefined ||
      table.tableLockExpiry <= now
    ) {
      throw new Error(
        "SESSION_002: Table lock invalid or expired — please retry",
      );
    }

    if (customerId !== undefined && guestName !== undefined) {
      throw new Error(
        "DATA_001: Provide either a registered customer or a guest name, not both",
      );
    }

    const ratePerMin = resolveRatePerMinAtSessionStart(
      club,
      now,
      table.tableType,
    );
    const minBillMinutes = club.minBillMinutes;
    const currency = club.currency;

    const playOpenEnded = assignedPlayOpenEnded === true;
    let playDurationMin: number | undefined;
    if (!playOpenEnded) {
      const dur = assignedPlayDurationMin ?? club.bookingSettings.slotDurationOptions[0] ?? 60;
      if (!club.bookingSettings.slotDurationOptions.includes(dur)) {
        throw new Error("BOOKING_008: Invalid play duration");
      }
      playDurationMin = dur;
    }

    const {
      participants: normalizedParticipants,
      playMode,
      losersPay,
      complaintAck,
    } = await validateAndNormalizeParticipants(ctx, {
      customerId,
      guestName,
      participants: participantsArg,
      playMode: playModeArg,
      losersPay: losersPayArg,
      staffAcknowledgedComplaint,
      roleId,
    });

    let sessionCustomerId: typeof customerId = undefined;
    let sessionGuestName: string | undefined;
    let sessionGuestAge: number | undefined;
    let sessionIsGuest = true;

    if (customerId !== undefined) {
      const customer = await ctx.db.get(customerId);
      if (!customer || customer.role !== "customer") {
        throw new Error("DATA_003: Customer not found");
      }
      if (customer.isFrozen) {
        throw new Error("SESSION_003: Customer frozen");
      }
      if (customer.deletionRequestedAt !== undefined) {
        throw new Error("SESSION_004: Customer deleted");
      }
      if (!customer.phoneVerified) {
        throw new Error(
          "AUTH_004: Customer phone must be verified before play",
        );
      }
      sessionCustomerId = customerId;
      sessionGuestName = undefined;
      sessionGuestAge = customer.age;
      sessionIsGuest = false;
    } else {
      sessionGuestName = assertGuestDisplayName(guestName);
    }

    const sessionId = await ctx.db.insert("sessions", {
      tableId,
      clubId: owner.clubId,
      customerId: sessionCustomerId,
      guestName: sessionGuestName,
      guestAge: sessionGuestAge,
      isGuest: sessionIsGuest,
      startTime: now,
      endTime: undefined,
      billableMinutes: undefined,
      ratePerMin,
      minBillMinutes,
      currency,
      snackOrders: [],
      billTotal: undefined,
      discount: undefined,
      paymentMethod: undefined,
      paymentStatus: "pending",
      status: "active",
      cancellationReason: undefined,
      assignedPlayDurationMin: playOpenEnded ? undefined : playDurationMin,
      assignedPlayOpenEnded: playOpenEnded ? true : undefined,
      // Scheduling hold so future online slots free up once the assigned time passes.
      // Open-ended sessions keep the table held until checkout (undefined here).
      plannedEndTime:
        playOpenEnded || playDurationMin === undefined
          ? undefined
          : now + playDurationMin * 60_000,
      timerAlertMinutes: playOpenEnded ? undefined : playDurationMin,
      timerAlertFiredAt: undefined,
      creditResolvedAt: undefined,
      creditResolvedMethod: undefined,
      staffAcknowledgedComplaint: complaintAck.staffAcknowledgedComplaint,
      acknowledgedByRoleId: complaintAck.acknowledgedByRoleId,
      acknowledgedAt: complaintAck.acknowledgedAt,
      bookingId: undefined,
      discountAppliedByRoleId: undefined,
      discountAppliedAt: undefined,
      playMode: normalizedParticipants.length > 0 ? playMode : undefined,
      losersPay: losersPay || undefined,
      participants:
        normalizedParticipants.length > 0 ? normalizedParticipants : undefined,
      loserSide: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(tableId, {
      currentSessionId: sessionId,
      tableLock: undefined,
      tableLockExpiry: undefined,
    });

    if (sessionCustomerId !== undefined) {
      await ctx.db.insert("sessionLogs", {
        sessionId,
        customerId: sessionCustomerId,
        clubId: owner.clubId,
        clubName: club.name,
        tableLabel: table.label,
        startTime: now,
        endTime: undefined,
        billTotal: undefined,
        currency,
        paymentStatus: "pending",
        paymentMethod: undefined,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    return { sessionId, hasUpcomingBooking: false as const };
  },
});

const paymentMethodArg = v.union(
  v.literal("cash"),
  v.literal("upi"),
  v.literal("card"),
  v.literal("credit"),
);

type SnackFulfillmentType = "counter" | "kitchen";

function resolveSnackFulfillmentType(
  snack: { fulfillmentType?: SnackFulfillmentType } | null,
): SnackFulfillmentType {
  return snack?.fulfillmentType ?? "counter";
}

async function enrichSnackLineItems(
  ctx: QueryCtx,
  snackOrders: {
    snackId: Id<"snacks">;
    name: string;
    qty: number;
    priceAtOrder: number;
  }[],
) {
  const uniqueIds = [...new Set(snackOrders.map((o) => o.snackId))];
  const snacksById = new Map<
    Id<"snacks">,
    { fulfillmentType?: SnackFulfillmentType } | null
  >();
  for (const id of uniqueIds) {
    snacksById.set(id, await ctx.db.get(id));
  }
  return snackOrders.map((o) => {
    const fulfillmentType = resolveSnackFulfillmentType(
      snacksById.get(o.snackId) ?? null,
    );
    return {
      snackId: o.snackId,
      name: o.name,
      qty: o.qty,
      priceAtOrder: o.priceAtOrder,
      lineTotal: o.priceAtOrder * o.qty,
      fulfillmentType,
    };
  });
}

function computeCheckoutBill(session: {
  startTime: number;
  ratePerMin: number;
  minBillMinutes: number;
  snackOrders: { snackId: Id<"snacks">; name: string; qty: number; priceAtOrder: number }[];
  discount?: number;
}) {
  const now = Date.now();
  const endTime = now <= session.startTime ? session.startTime + 1 : now;
  const snackOrders = session.snackOrders.map((o) => ({
    snackId: String(o.snackId),
    name: o.name,
    qty: o.qty,
    priceAtOrder: o.priceAtOrder,
  }));

  return {
    endTime,
    bill: computeBill({
      startTime: session.startTime,
      endTime,
      ratePerMin: session.ratePerMin,
      minBillMinutes: session.minBillMinutes,
      snackOrders,
      discount: session.discount ?? 0,
    }),
  };
}

/**
 * Resolve discount permissions for the active role.
 * Owner unrestricted (no role) → can apply, no cap.
 * Staff role → uses `canApplyDiscount` and optional `maxDiscountPercent`.
 */
async function resolveDiscountPermissions(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<{ canApplyDiscount: boolean; maxDiscountPercent: number | null }> {
  if (!roleId) {
    return { canApplyDiscount: true, maxDiscountPercent: null };
  }
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    return { canApplyDiscount: false, maxDiscountPercent: 0 };
  }
  return {
    canApplyDiscount: role.canApplyDiscount,
    maxDiscountPercent: role.maxDiscountPercent ?? null,
  };
}

/** Bill preview for an occupied table (owner Slots checkout modal). */
export const previewTableCheckout = query({
  args: {
    tableId: v.id("tables"),
    roleId: v.optional(v.id("staffRoles")),
    discountPercent: v.optional(v.number()),
  },
  handler: async (ctx, { tableId, roleId, discountPercent }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }
    await assertSlotsTabPermission(ctx, owner.clubId, roleId);

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      return null;
    }
    if (table.currentSessionId === undefined) {
      return null;
    }

    const session = await ctx.db.get(table.currentSessionId);
    if (!session || session.clubId !== owner.clubId || session.status !== "active") {
      return null;
    }

    const perms = await resolveDiscountPermissions(ctx, owner.clubId, roleId);
    const requested =
      typeof discountPercent === "number" && Number.isFinite(discountPercent)
        ? discountPercent
        : 0;
    const appliedDiscountPct =
      requested <= 0
        ? 0
        : clampDiscountPercent(
            requested,
            perms.canApplyDiscount,
            perms.maxDiscountPercent,
          );

    const { bill } = computeCheckoutBill({
      ...session,
      discount: appliedDiscountPct,
    });
    const snackLineItems = await enrichSnackLineItems(ctx, session.snackOrders);
    const counterSnackTotal = snackLineItems
      .filter((line) => line.fulfillmentType === "counter")
      .reduce((sum, line) => sum + line.lineTotal, 0);
    const kitchenSnackTotal = snackLineItems
      .filter((line) => line.fulfillmentType === "kitchen")
      .reduce((sum, line) => sum + line.lineTotal, 0);
    const participants = session.participants ?? [];
    return {
      sessionId: session._id,
      tableLabel: table.label,
      currency: session.currency,
      isGuest: session.isGuest,
      guestName: session.guestName ?? null,
      startTime: session.startTime,
      ratePerMin: session.ratePerMin,
      finalBill: bill.finalBill,
      billableMinutes: bill.billableMinutes,
      actualMinutes: bill.actualMinutes,
      snackTotal: bill.snackTotal,
      snackLineItems,
      counterSnackTotal,
      kitchenSnackTotal,
      tableSubtotal: bill.tableSubtotal,
      discountedTable: bill.discountedTable,
      discountAmount: bill.discountAmount,
      discountPercent: appliedDiscountPct,
      canApplyDiscount: perms.canApplyDiscount,
      maxDiscountPercent: perms.maxDiscountPercent,
      playMode: session.playMode ?? "casual",
      losersPay: session.losersPay === true,
      participants,
      requiresLoserSide:
        session.playMode === "versus" && session.losersPay === true,
    };
  },
});

/** Complete billing for the active session on a table and free the table. */
export const checkoutTableSession = mutation({
  args: {
    tableId: v.id("tables"),
    paymentMethod: paymentMethodArg,
    roleId: v.optional(v.id("staffRoles")),
    discountPercent: v.optional(v.number()),
    loserSide: v.optional(sessionParticipantSideArg),
  },
  handler: async (ctx, { tableId, paymentMethod, roleId, discountPercent, loserSide }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) {
      throw new Error("DATA_003: Club not found");
    }
    assertClubSubscriptionWritable(club);
    await assertSlotsTabPermission(ctx, owner.clubId, roleId);

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (table.currentSessionId === undefined) {
      throw new Error("SESSION_004: No active session on this table");
    }

    const session = await ctx.db.get(table.currentSessionId);
    if (!session || session.clubId !== owner.clubId) {
      throw new Error("DATA_003: Session not found");
    }
    if (session.status !== "active") {
      throw new Error("SESSION_004: Session is not active");
    }

    if (session.playMode === "versus" && session.losersPay === true) {
      if (loserSide !== "sideA" && loserSide !== "sideB") {
        throw new Error("SESSION_009: Select the losing side for losers pay");
      }
      const registered = (session.participants ?? []).filter(
        (p) => !p.isGuest && p.customerId !== undefined,
      );
      const losers = registered.filter((p) => p.side === loserSide);
      if (losers.length === 0) {
        throw new Error("SESSION_009: No players on the selected losing side");
      }
    } else if (loserSide !== undefined) {
      throw new Error("SESSION_009: Loser side only applies when losers pay is on");
    }

    const perms = await resolveDiscountPermissions(ctx, owner.clubId, roleId);
    const requested =
      typeof discountPercent === "number" && Number.isFinite(discountPercent)
        ? discountPercent
        : 0;
    const appliedDiscountPct = clampDiscountPercent(
      requested,
      perms.canApplyDiscount,
      perms.maxDiscountPercent,
    );

    const { endTime, bill } = computeCheckoutBill({
      ...session,
      discount: appliedDiscountPct,
    });
    const now = Date.now();
    const paymentStatus = paymentMethod === "credit" ? "credit" : "paid";

    await ctx.db.patch(session._id, {
      endTime,
      billableMinutes: bill.billableMinutes,
      billTotal: bill.finalBill,
      paymentMethod,
      paymentStatus,
      status: "completed",
      discount: appliedDiscountPct > 0 ? appliedDiscountPct : undefined,
      discountAppliedByRoleId: appliedDiscountPct > 0 ? roleId : undefined,
      discountAppliedAt: appliedDiscountPct > 0 ? now : undefined,
      loserSide:
        session.playMode === "versus" && session.losersPay === true
          ? loserSide
          : undefined,
      updatedAt: now,
    });

    await ctx.db.patch(tableId, {
      currentSessionId: undefined,
      tableLock: undefined,
      tableLockExpiry: undefined,
    });

    const log = await ctx.db
      .query("sessionLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .first();

    if (log !== null) {
      await ctx.db.patch(log._id, {
        endTime,
        billTotal: bill.finalBill,
        paymentStatus,
        paymentMethod,
        status: "completed",
        updatedAt: now,
      });
    } else if (session.customerId !== undefined && session.isGuest !== true) {
      await ctx.db.insert("sessionLogs", {
        sessionId: session._id,
        customerId: session.customerId,
        clubId: session.clubId,
        clubName: club.name,
        tableLabel: table.label,
        startTime: session.startTime,
        endTime,
        billTotal: bill.finalBill,
        currency: session.currency,
        paymentStatus,
        paymentMethod,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      sessionId: session._id,
      finalBill: bill.finalBill,
      currency: session.currency,
      paymentStatus,
    };
  },
});

/**
 * Earliest confirmed/pending online booking on `table` that overlaps [windowStartMs, windowEndMs).
 * Checks each calendar day the window touches (handles windows crossing midnight).
 */
async function findEarliestBookingConflictOnTable(
  ctx: MutationCtx,
  club: Doc<"clubs">,
  table: Doc<"tables">,
  windowStartMs: number,
  windowEndMs: number,
): Promise<{ startMs: number; customerName: string } | null> {
  const tz = club.timezone;
  const dates = new Set<string>([
    dateYmdInTimeZone(windowStartMs, tz),
    dateYmdInTimeZone(windowEndMs, tz),
  ]);
  let earliest: { startMs: number; customerName: string } | null = null;
  for (const ymd of dates) {
    const dayBookings = await ctx.db
      .query("bookings")
      .withIndex("by_club_date", (q) =>
        q.eq("clubId", club._id).eq("requestedDate", ymd),
      )
      .collect();
    for (const b of dayBookings) {
      if (b.status !== "confirmed" && b.status !== "pending_approval") continue;
      if (!bookingAppliesToTable(b, table)) continue;
      const { startMs, endMs } = bookingWindowMs(b, tz, club.minBillMinutes);
      const overlaps = windowStartMs < endMs && startMs < windowEndMs;
      if (!overlaps) continue;
      if (earliest === null || startMs < earliest.startMs) {
        const customer = await ctx.db.get(b.customerId);
        earliest = { startMs, customerName: customer?.name ?? "Customer" };
      }
    }
  }
  return earliest;
}

/**
 * Add play time to the active session on a table.
 * Rejects (without changing anything) if the added time collides with an online booking,
 * returning how much time is free so the desk can add less or move the group.
 */
export const extendSession = mutation({
  args: {
    tableId: v.id("tables"),
    addMinutes: v.number(),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { tableId, addMinutes, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await assertSlotsTabPermission(ctx, owner.clubId, roleId);

    if (!Number.isFinite(addMinutes) || addMinutes <= 0 || addMinutes > 600) {
      throw new Error("DATA_002: Choose between 1 and 600 minutes to add");
    }

    const table = await ctx.db.get(tableId);
    if (!table || table.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (table.currentSessionId === undefined) {
      throw new Error("SESSION_004: No active session on this table");
    }
    const session = await ctx.db.get(table.currentSessionId);
    if (!session || session.clubId !== owner.clubId || session.status !== "active") {
      throw new Error("SESSION_004: Session is not active");
    }

    const now = Date.now();
    // Anchor the extension at the later of "now" and the current planned end so an
    // overstaying guest's added time starts from now, not from a past planned end.
    const base = Math.max(session.plannedEndTime ?? now, now);
    const newEnd = base + addMinutes * 60_000;

    const conflict = await findEarliestBookingConflictOnTable(
      ctx,
      club,
      table,
      base,
      newEnd,
    );
    if (conflict) {
      const maxMs = conflict.startMs - base;
      return {
        ok: false as const,
        reason: "RESERVED" as const,
        conflictStartMs: conflict.startMs,
        conflictCustomerName: conflict.customerName,
        maxExtendMinutes: Math.max(0, Math.floor(maxMs / 60_000)),
      };
    }

    const newDurationMin = Math.max(
      1,
      Math.ceil((newEnd - session.startTime) / 60_000),
    );
    await ctx.db.patch(session._id, {
      plannedEndTime: newEnd,
      assignedPlayDurationMin: newDurationMin,
      assignedPlayOpenEnded: undefined,
      timerAlertMinutes: newDurationMin,
      timerAlertFiredAt: undefined,
      updatedAt: now,
    });

    return { ok: true as const, newPlannedEndTime: newEnd };
  },
});

/**
 * Move the active session from one table to a free table of the same type.
 * Validates the target is free (no live session) and has no online booking clashing
 * with the remaining planned window. Billing/rate are locked on the session and unchanged.
 */
export const moveSession = mutation({
  args: {
    fromTableId: v.id("tables"),
    toTableId: v.id("tables"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { fromTableId, toTableId, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwnerWithClub(viewer);
    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    await assertSlotsTabPermission(ctx, owner.clubId, roleId);

    if (fromTableId === toTableId) {
      throw new Error("DATA_001: Pick a different table to move to");
    }

    const fromTable = await ctx.db.get(fromTableId);
    if (!fromTable || fromTable.clubId !== owner.clubId) {
      throw new Error("DATA_003: Table not found");
    }
    if (fromTable.currentSessionId === undefined) {
      throw new Error("SESSION_004: No active session on this table");
    }
    const session = await ctx.db.get(fromTable.currentSessionId);
    if (!session || session.clubId !== owner.clubId || session.status !== "active") {
      throw new Error("SESSION_004: Session is not active");
    }

    const toTable = await ctx.db.get(toTableId);
    if (!toTable || toTable.clubId !== owner.clubId) {
      throw new Error("DATA_003: Target table not found");
    }
    if (!toTable.isActive) {
      throw new Error("SESSION_003: Target table is inactive");
    }
    if (toTable.currentSessionId !== undefined) {
      throw new Error("SESSION_001: Target table is already occupied");
    }
    if (
      normalizeTableTypeId(toTable.tableType ?? "") !==
      normalizeTableTypeId(fromTable.tableType ?? "")
    ) {
      throw new Error("SESSION_007: Move to a table of the same type");
    }

    const now = Date.now();
    const windowEnd = Math.max(
      session.plannedEndTime ?? now + club.minBillMinutes * 60_000,
      now + 1,
    );
    const conflict = await findEarliestBookingConflictOnTable(
      ctx,
      club,
      toTable,
      now,
      windowEnd,
    );
    if (conflict) {
      return {
        ok: false as const,
        reason: "RESERVED" as const,
        conflictStartMs: conflict.startMs,
        conflictCustomerName: conflict.customerName,
      };
    }

    await ctx.db.patch(session._id, { tableId: toTableId, updatedAt: now });
    await ctx.db.patch(fromTableId, {
      currentSessionId: undefined,
      tableLock: undefined,
      tableLockExpiry: undefined,
    });
    await ctx.db.patch(toTableId, { currentSessionId: session._id });

    const log = await ctx.db
      .query("sessionLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .first();
    if (log !== null) {
      await ctx.db.patch(log._id, { tableLabel: toTable.label, updatedAt: now });
    }

    return { ok: true as const, toTableLabel: toTable.label };
  },
});
