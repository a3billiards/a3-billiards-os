/**
 * Owner Financial tab: revenue by day, payment breakdown, outstanding credits,
 * billing history, home stats, and credit resolution.
 *
 * Revenue is attributed to `sessions.endTime` (or start fallback) in `clubs.timezone`
 * for completed sessions only; cancelled rows are excluded via `by_club_status`.
 *
 * // TODO: sessions older than ~2 years live in `sessions_archive`. Include that table
 * // when date ranges span archived data so long-range reports stay complete.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  assertMutationClubScope,
  requireOwner,
  requireViewer,
} from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { compareYmd, fillDateGaps, toClubDate } from "@a3/utils/timezone";
import { doRatesOverlap } from "@a3/utils/availability";

function throwPerm(message: string): never {
  throw new Error(message);
}

/** Authenticated owner scoped to `clubId`. */
async function assertOwnerClubMatch(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
): Promise<void> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "owner") {
    throw new Error("AUTH_001: Not authorized for financial data.");
  }
  if (viewer.clubId !== clubId) {
    throw new Error("AUTH_001: Not authorized for financial data.");
  }
}

/** Caller must be the club owner; optional staff role must include `financials`. */
async function assertOwnerFinancialAccess(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  await assertOwnerClubMatch(ctx, clubId);
  if (!roleId) return;
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error("AUTH_001: Not authorized for financial data.");
  }
  if (!role.allowedTabs.includes("financials")) {
    throw new Error("AUTH_001: Not authorized for financial data.");
  }
}

function assertCanResolveCredit(
  roleId: Id<"staffRoles"> | undefined,
  role: Doc<"staffRoles"> | null,
  clubId: Id<"clubs">,
): void {
  if (!roleId) return;
  if (
    !role ||
    role.clubId !== clubId ||
    !role.allowedTabs.includes("financials")
  ) {
    throw new Error(
      "Your current role does not have permission to resolve credits.",
    );
  }
}

async function loadCompletedSessionsForClub(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
): Promise<Doc<"sessions">[]> {
  return ctx.db
    .query("sessions")
    .withIndex("by_club_status", (q) =>
      q.eq("clubId", clubId).eq("status", "completed"),
    )
    .collect();
}

async function loadActiveSessionsForClub(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
): Promise<Doc<"sessions">[]> {
  return ctx.db
    .query("sessions")
    .withIndex("by_club_status", (q) =>
      q.eq("clubId", clubId).eq("status", "active"),
    )
    .collect();
}

async function customerDisplayName(
  ctx: QueryCtx,
  s: Doc<"sessions">,
): Promise<string> {
  if (s.isGuest) {
    return s.guestName?.trim() || "Guest";
  }
  if (s.customerId) {
    const u = await ctx.db.get(s.customerId);
    return u?.name ?? "[Deleted Customer]";
  }
  return "Unknown";
}

/** Gate for Financial tab UI (no throw — safe for useQuery). */
export const getFinancialTabAccess = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    try {
      const viewer = await requireViewer(ctx);
      if (viewer.role !== "owner") {
        return { canViewFinancials: false, canResolveCredits: false };
      }
      if (viewer.clubId !== clubId) {
        return { canViewFinancials: false, canResolveCredits: false };
      }
      if (!roleId) {
        return { canViewFinancials: true, canResolveCredits: true };
      }
      const role = await ctx.db.get(roleId);
      if (!role || role.clubId !== clubId) {
        return { canViewFinancials: false, canResolveCredits: false };
      }
      const has = role.allowedTabs.includes("financials");
      return { canViewFinancials: has, canResolveCredits: has };
    } catch {
      return { canViewFinancials: false, canResolveCredits: false };
    }
  },
});

export const getRevenueByDay = query({
  args: {
    clubId: v.id("clubs"),
    dateFrom: v.string(),
    dateTo: v.string(),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, dateFrom, dateTo, roleId }) => {
    await assertOwnerFinancialAccess(ctx, clubId, roleId);
    const club = await ctx.db.get(clubId);
    if (!club) throwPerm("DATA_003: Club not found");

    if (compareYmd(dateFrom, dateTo) > 0) {
      return {
        days: [] as { date: string; revenue: number; sessionCount: number }[],
        totalRevenue: 0,
        totalSessions: 0,
        currency: club.currency,
      };
    }

    // TODO: multi-currency — sessions lock `currency` at start; if club.currency changed,
    // historical rows may differ. v1 sums numeric billTotal without FX conversion.

    const sessions = await loadCompletedSessionsForClub(ctx, clubId);
    const sparse: { date: string; revenue: number; sessionCount: number }[] = [];
    const byDay = new Map<string, { revenue: number; sessionCount: number }>();

    for (const s of sessions) {
      if (s.paymentStatus !== "paid") continue;
      const endMs = s.endTime ?? s.startTime;
      const sessionDate = toClubDate(endMs, club.timezone);
      if (compareYmd(sessionDate, dateFrom) < 0 || compareYmd(sessionDate, dateTo) > 0) {
        continue;
      }
      const bill = s.billTotal ?? 0;
      const cur = byDay.get(sessionDate) ?? { revenue: 0, sessionCount: 0 };
      cur.revenue += bill;
      cur.sessionCount += 1;
      byDay.set(sessionDate, cur);
    }
    for (const [date, row] of byDay) {
      sparse.push({ date, revenue: row.revenue, sessionCount: row.sessionCount });
    }

    const days = fillDateGaps(sparse, dateFrom, dateTo, club.timezone);

    let totalRevenue = 0;
    let totalSessions = 0;
    for (const d of days) {
      totalRevenue += d.revenue;
      totalSessions += d.sessionCount;
    }

    return {
      days,
      totalRevenue,
      totalSessions,
      currency: club.currency,
    };
  },
});

export const getPaymentMethodBreakdown = query({
  args: {
    clubId: v.id("clubs"),
    dateFrom: v.string(),
    dateTo: v.string(),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, dateFrom, dateTo, roleId }) => {
    await assertOwnerFinancialAccess(ctx, clubId, roleId);
    const club = await ctx.db.get(clubId);
    if (!club) throwPerm("DATA_003: Club not found");

    const empty = () => ({
      cash: { totalAmount: 0, sessionCount: 0 },
      upi: { totalAmount: 0, sessionCount: 0 },
      card: { totalAmount: 0, sessionCount: 0 },
      credit: { totalAmount: 0, sessionCount: 0 },
    });

    if (compareYmd(dateFrom, dateTo) > 0) {
      const z = empty();
      return {
        breakdown: [
          { method: "cash" as const, ...z.cash },
          { method: "upi" as const, ...z.upi },
          { method: "card" as const, ...z.card },
          { method: "credit" as const, ...z.credit },
        ],
        totalPaidRevenue: 0,
      };
    }

    const buckets = empty();
    const sessions = await loadCompletedSessionsForClub(ctx, clubId);

    for (const s of sessions) {
      const endMs = s.endTime ?? s.startTime;
      const sessionDate = toClubDate(endMs, club.timezone);
      if (compareYmd(sessionDate, dateFrom) < 0 || compareYmd(sessionDate, dateTo) > 0) {
        continue;
      }

      if (s.paymentStatus === "credit" && s.creditResolvedAt == null) {
        continue;
      }

      const bill = s.billTotal ?? 0;

      const resolvedMethod = s.creditResolvedMethod;
      if (
        s.creditResolvedAt != null &&
        (resolvedMethod === "cash" ||
          resolvedMethod === "upi" ||
          resolvedMethod === "card")
      ) {
        buckets[resolvedMethod].totalAmount += bill;
        buckets[resolvedMethod].sessionCount += 1;
        buckets.credit.sessionCount += 1;
        continue;
      }

      if (s.paymentStatus !== "paid") {
        continue;
      }

      const pm = s.paymentMethod;
      if (pm === "cash" || pm === "upi" || pm === "card") {
        buckets[pm].totalAmount += bill;
        buckets[pm].sessionCount += 1;
      }
    }

    const totalPaidRevenue =
      buckets.cash.totalAmount + buckets.upi.totalAmount + buckets.card.totalAmount;

    return {
      breakdown: [
        { method: "cash" as const, ...buckets.cash },
        { method: "upi" as const, ...buckets.upi },
        { method: "card" as const, ...buckets.card },
        { method: "credit" as const, ...buckets.credit },
      ],
      totalPaidRevenue,
    };
  },
});

const sortByV = v.union(v.literal("amount"), v.literal("date"));

export const getOutstandingCredits = query({
  args: {
    clubId: v.id("clubs"),
    sortBy: v.optional(sortByV),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, sortBy, roleId }) => {
    await assertOwnerFinancialAccess(ctx, clubId, roleId);
    const club = await ctx.db.get(clubId);
    if (!club) throwPerm("DATA_003: Club not found");

    const sessions = await loadCompletedSessionsForClub(ctx, clubId);
    const creditRows: {
      sessionId: Id<"sessions">;
      customerName: string;
      isGuest: boolean;
      tableLabel: string;
      endTime: number;
      billTotal: number;
      currency: string;
      snackOrders: {
        snackId: string;
        name: string;
        qty: number;
        priceAtOrder: number;
      }[];
      discount: number | null;
      billableMinutes: number | null;
      ratePerMin: number;
    }[] = [];

    let totalOutstanding = 0;

    for (const s of sessions) {
      if (s.paymentStatus !== "credit" || s.creditResolvedAt != null) continue;
      const endMs = s.endTime ?? s.startTime;

      let customerName: string;
      if (s.isGuest) {
        customerName = s.guestName?.trim() || "Guest";
      } else if (s.customerId) {
        const u = await ctx.db.get(s.customerId);
        customerName = u?.name ?? "[Deleted Customer]";
      } else {
        customerName = "Unknown";
      }

      const table = await ctx.db.get(s.tableId);
      const tableLabel = table?.label ?? "—";

      const billTotal = s.billTotal;
      if (billTotal != null && Number.isFinite(billTotal)) {
        totalOutstanding += billTotal;
      }

      creditRows.push({
        sessionId: s._id,
        customerName,
        isGuest: s.isGuest,
        tableLabel,
        endTime: endMs,
        billTotal: billTotal != null && Number.isFinite(billTotal) ? billTotal : 0,
        currency: s.currency,
        snackOrders: s.snackOrders.map((o) => ({
          snackId: String(o.snackId),
          name: o.name,
          qty: o.qty,
          priceAtOrder: o.priceAtOrder,
        })),
        discount: s.discount ?? null,
        billableMinutes: s.billableMinutes ?? null,
        ratePerMin: s.ratePerMin,
      });
    }

    const sort = sortBy ?? "date";
    if (sort === "amount") {
      creditRows.sort((a, b) => b.billTotal - a.billTotal);
    } else {
      creditRows.sort((a, b) => b.endTime - a.endTime);
    }

    return {
      credits: creditRows,
      totalOutstanding,
      count: creditRows.length,
    };
  },
});

export const getHomePageDailyStats = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    await assertOwnerFinancialAccess(ctx, clubId, roleId);
    const club = await ctx.db.get(clubId);
    if (!club) throwPerm("DATA_003: Club not found");

    const today = toClubDate(Date.now(), club.timezone);
    const completed = await loadCompletedSessionsForClub(ctx, clubId);
    const active = await loadActiveSessionsForClub(ctx, clubId);

    let todayRevenue = 0;
    let completedToday = 0;
    for (const s of completed) {
      const endMs = s.endTime ?? s.startTime;
      if (toClubDate(endMs, club.timezone) !== today) continue;
      if (s.paymentStatus === "paid") {
        todayRevenue += s.billTotal ?? 0;
      }
      completedToday += 1;
    }

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    const activeTables = tables.filter((t) => t.isActive).length;

    return {
      todayRevenue,
      activeSessions: active.length,
      completedToday,
      activeTables,
      currency: club.currency,
    };
  },
});

export const getBillingHistory = query({
  args: {
    clubId: v.id("clubs"),
    dateFrom: v.string(),
    dateTo: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    await assertOwnerFinancialAccess(ctx, args.clubId, args.roleId);
    const club = await ctx.db.get(args.clubId);
    if (!club) throwPerm("DATA_003: Club not found");

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const offsetRaw = args.cursor ? parseInt(args.cursor, 10) : 0;
    const offset =
      Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    if (compareYmd(args.dateFrom, args.dateTo) > 0) {
      return { sessions: [], nextCursor: null, totalCount: 0 };
    }

    const completed = await loadCompletedSessionsForClub(ctx, args.clubId);
    const inRange: Doc<"sessions">[] = [];
    for (const s of completed) {
      const endMs = s.endTime ?? s.startTime;
      const sessionDate = toClubDate(endMs, club.timezone);
      if (
        compareYmd(sessionDate, args.dateFrom) < 0 ||
        compareYmd(sessionDate, args.dateTo) > 0
      ) {
        continue;
      }
      if (s.paymentStatus !== "paid" && s.paymentStatus !== "credit") {
        continue;
      }
      inRange.push(s);
    }

    inRange.sort(
      (a, b) => (b.endTime ?? b.startTime) - (a.endTime ?? a.startTime),
    );
    const totalCount = inRange.length;
    const page = inRange.slice(offset, offset + limit);

    const sessions = await Promise.all(
      page.map(async (s) => {
        const endMs = s.endTime ?? s.startTime;
        const table = await ctx.db.get(s.tableId);
        const customerName = await customerDisplayName(ctx, s);
        return {
          sessionId: s._id,
          customerName,
          isGuest: s.isGuest,
          tableLabel: table?.label ?? "—",
          startTime: s.startTime,
          endTime: endMs,
          billTotal: s.billTotal ?? 0,
          currency: s.currency,
          paymentStatus: s.paymentStatus as "paid" | "credit",
          paymentMethod: s.paymentMethod ?? null,
          creditResolvedAt: s.creditResolvedAt ?? null,
          creditResolvedMethod: s.creditResolvedMethod ?? null,
          discount: s.discount ?? null,
          snackCount: s.snackOrders.length,
          sessionDate: toClubDate(endMs, club.timezone),
        };
      }),
    );

    const nextCursor =
      offset + limit < totalCount ? String(offset + limit) : null;

    return { sessions, nextCursor, totalCount };
  },
});

export const resolveCredit = mutation({
  args: {
    sessionId: v.id("sessions"),
    resolvedMethod: v.union(
      v.literal("cash"),
      v.literal("upi"),
      v.literal("card"),
    ),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { sessionId, resolvedMethod, roleId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throwPerm("DATA_003: Session not found");
    }
    await assertOwnerClubMatch(ctx, session.clubId);

    if (session.status !== "completed") {
      throwPerm("DATA_002: Only completed sessions can be resolved");
    }
    if (session.paymentStatus !== "credit") {
      throwPerm("DATA_002: Session is not on credit");
    }
    if (session.creditResolvedAt != null) {
      throw new Error("This credit has already been marked as paid.");
    }

    const roleDoc = roleId ? await ctx.db.get(roleId) : null;
    assertCanResolveCredit(roleId, roleDoc, session.clubId);

    const now = Date.now();
    await ctx.db.patch(sessionId, {
      paymentStatus: "paid",
      creditResolvedAt: now,
      creditResolvedMethod: resolvedMethod,
      updatedAt: now,
    });

    const log = await ctx.db
      .query("sessionLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    if (log !== null) {
      await ctx.db.patch(log._id, {
        paymentStatus: "paid",
        creditResolvedAt: now,
        creditResolvedMethod: resolvedMethod,
        updatedAt: now,
      });
    }

    return { resolved: true as const };
  },
});

// ── Owner settings: rate configuration ───────────────────────────────────────

async function requireOwnerClubWritableFinancial(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
) {
  const viewer = await requireViewer(ctx);
  requireOwner(viewer);
  assertMutationClubScope(viewer, clubId);
  const club = await ctx.db.get(clubId);
  if (!club) throw new Error("DATA_003: Club not found");
  assertClubSubscriptionWritable(club);
  return club;
}

function assertIso4217(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) {
    throw new Error("DATA_002: Currency must be a 3-letter ISO 4217 code");
  }
  return c;
}

function assertIanaTimezone(tz: string): string {
  const t = tz.trim();
  try {
    const list = Intl.supportedValuesOf("timeZone");
    if (!list.includes(t)) {
      throw new Error("DATA_002: Invalid IANA timezone");
    }
  } catch {
    throw new Error("DATA_002: Invalid IANA timezone");
  }
  return t;
}

function assertHHMMRate(label: string, s: string): void {
  if (!/^\d{2}:\d{2}$/.test(s)) {
    throw new Error(`DATA_002: ${label} must be HH:MM`);
  }
  const [h, m] = s.split(":").map((x) => Number(x));
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`DATA_002: ${label} is out of range`);
  }
}

type ClubSpecialRate = Doc<"clubs">["specialRates"][number];

function assertSpecialRateFields(
  r: Pick<
    ClubSpecialRate,
    "label" | "ratePerMin" | "startTime" | "endTime" | "daysOfWeek"
  >,
): void {
  if (r.label.trim().length === 0) {
    throw new Error("DATA_002: Label is required");
  }
  if (r.ratePerMin <= 0) {
    throw new Error("DATA_002: ratePerMin must be greater than 0");
  }
  assertHHMMRate("Start time", r.startTime);
  assertHHMMRate("End time", r.endTime);
  if (r.daysOfWeek.length === 0) {
    throw new Error("DATA_002: Select at least one day of week");
  }
  for (const d of r.daysOfWeek) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error("DATA_002: Invalid day of week");
    }
  }
}

function assertNoSpecialRateOverlap(
  rates: ClubSpecialRate[],
  candidate: Pick<
    ClubSpecialRate,
    "label" | "ratePerMin" | "startTime" | "endTime" | "daysOfWeek"
  > & { id?: string },
  excludeId?: string,
): void {
  const tempId = candidate.id ?? "__new__";
  const next: ClubSpecialRate = {
    id: tempId,
    label: candidate.label,
    ratePerMin: candidate.ratePerMin,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    daysOfWeek: candidate.daysOfWeek,
  };
  for (const ex of rates) {
    if (excludeId !== undefined && ex.id === excludeId) continue;
    if (doRatesOverlap(next, ex)) {
      throw new Error(
        "CLUB_001: This time window overlaps with an existing special rate. Please adjust the times or days.",
      );
    }
  }
}

export const updateBaseRate = mutation({
  args: {
    clubId: v.id("clubs"),
    baseRatePerMin: v.number(),
  },
  handler: async (ctx, { clubId, baseRatePerMin }) => {
    await requireOwnerClubWritableFinancial(ctx, clubId);
    if (baseRatePerMin <= 0) {
      throw new Error("DATA_002: Base rate must be greater than 0");
    }
    await ctx.db.patch(clubId, { baseRatePerMin });
    return { ok: true as const };
  },
});

export const updateMinBillMinutes = mutation({
  args: {
    clubId: v.id("clubs"),
    minBillMinutes: v.number(),
  },
  handler: async (ctx, { clubId, minBillMinutes }) => {
    await requireOwnerClubWritableFinancial(ctx, clubId);
    if (!Number.isInteger(minBillMinutes) || minBillMinutes < 1) {
      throw new Error("DATA_002: Minimum billable minutes must be an integer ≥ 1");
    }
    await ctx.db.patch(clubId, { minBillMinutes });
    return { ok: true as const };
  },
});

export const updateCurrency = mutation({
  args: {
    clubId: v.id("clubs"),
    currency: v.string(),
  },
  handler: async (ctx, { clubId, currency }) => {
    await requireOwnerClubWritableFinancial(ctx, clubId);
    const c = assertIso4217(currency);
    await ctx.db.patch(clubId, { currency: c });
    return { ok: true as const };
  },
});

export const updateTimezone = mutation({
  args: {
    clubId: v.id("clubs"),
    timezone: v.string(),
  },
  handler: async (ctx, { clubId, timezone }) => {
    await requireOwnerClubWritableFinancial(ctx, clubId);
    const tz = assertIanaTimezone(timezone);
    await ctx.db.patch(clubId, { timezone: tz });
    return { ok: true as const };
  },
});

export const addSpecialRate = mutation({
  args: {
    clubId: v.id("clubs"),
    label: v.string(),
    ratePerMin: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    daysOfWeek: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const club = await requireOwnerClubWritableFinancial(ctx, args.clubId);
    const body = {
      label: args.label,
      ratePerMin: args.ratePerMin,
      startTime: args.startTime,
      endTime: args.endTime,
      daysOfWeek: args.daysOfWeek,
    };
    assertSpecialRateFields(body);
    const rates = club.specialRates ?? [];
    assertNoSpecialRateOverlap(rates, body);
    const id = crypto.randomUUID();
    const next = [...rates, { id, ...body }];
    await ctx.db.patch(args.clubId, { specialRates: next });
    return { rateId: id as string };
  },
});

export const updateSpecialRate = mutation({
  args: {
    clubId: v.id("clubs"),
    rateId: v.string(),
    label: v.optional(v.string()),
    ratePerMin: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const club = await requireOwnerClubWritableFinancial(ctx, args.clubId);
    const rates = club.specialRates ?? [];
    const idx = rates.findIndex((r) => r.id === args.rateId);
    if (idx === -1) throw new Error("DATA_003: Special rate not found");
    const prev = rates[idx]!;
    const merged = {
      label: args.label ?? prev.label,
      ratePerMin: args.ratePerMin ?? prev.ratePerMin,
      startTime: args.startTime ?? prev.startTime,
      endTime: args.endTime ?? prev.endTime,
      daysOfWeek: args.daysOfWeek ?? prev.daysOfWeek,
    };
    assertSpecialRateFields(merged);
    assertNoSpecialRateOverlap(
      rates,
      { ...merged, id: args.rateId },
      args.rateId,
    );
    const next = [...rates];
    next[idx] = { id: args.rateId, ...merged };
    await ctx.db.patch(args.clubId, { specialRates: next });
    return { ok: true as const };
  },
});

export const deleteSpecialRate = mutation({
  args: {
    clubId: v.id("clubs"),
    rateId: v.string(),
  },
  handler: async (ctx, { clubId, rateId }) => {
    await requireOwnerClubWritableFinancial(ctx, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    const rates = (club.specialRates ?? []).filter((r) => r.id !== rateId);
    if (rates.length === (club.specialRates ?? []).length) {
      throw new Error("DATA_003: Special rate not found");
    }
    await ctx.db.patch(clubId, { specialRates: rates });
    return { ok: true as const };
  },
});
