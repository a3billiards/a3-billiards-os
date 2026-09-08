/**
 * GST Report (estimate-only) — read-only aggregation from completed sessions.
 * Full income-tax / P&L report deferred until CA consultation.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner, requireViewer } from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { compareYmd, toClubDate, addCalendarDaysYmd } from "@a3/utils/timezone";
import { computeBillBreakdown } from "@a3/utils/billing";
import { computeGstReport } from "@a3/utils/gstReport";

const supplyType = v.union(v.literal("intrastate"), v.literal("interstate"));

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

async function loadCompletedSessionsForClub(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
): Promise<Doc<"sessions">[]> {
  return ctx.db
    .query("sessions")
    .withIndex("by_club_status", (q) =>
      q.eq("clubId", clubId).eq("status", "completed"),
    )
    .collect();
}

function isRealisedSession(s: Doc<"sessions">): boolean {
  return (
    s.paymentStatus === "paid" ||
    (s.paymentStatus === "credit" && s.creditResolvedAt != null)
  );
}

function countDaysInclusive(
  dateFrom: string,
  dateTo: string,
  timeZone: string,
): number {
  if (compareYmd(dateFrom, dateTo) > 0) return 0;
  let n = 0;
  let cur = dateFrom;
  while (compareYmd(cur, dateTo) <= 0 && n < 400) {
    n += 1;
    cur = addCalendarDaysYmd(cur, 1, timeZone);
  }
  return n;
}

export const getGstSettings = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    await assertOwnerClubMatch(ctx, clubId);
    const row = await ctx.db
      .query("gstSettings")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .unique();
    if (!row) {
      return {
        configured: false as const,
        gstRegistered: false,
        gstin: null as string | null,
        supplyType: "intrastate" as const,
        tableTimeGstPercent: 18,
        snacksGstPercent: 5,
        monthlyInputTaxCredit: null as number | null,
      };
    }
    return {
      configured: true as const,
      gstRegistered: row.gstRegistered,
      gstin: row.gstin ?? null,
      supplyType: row.supplyType,
      tableTimeGstPercent: row.tableTimeGstPercent,
      snacksGstPercent: row.snacksGstPercent,
      monthlyInputTaxCredit: row.monthlyInputTaxCredit ?? null,
    };
  },
});

export const updateGstSettings = mutation({
  args: {
    clubId: v.id("clubs"),
    gstRegistered: v.boolean(),
    gstin: v.optional(v.string()),
    supplyType,
    tableTimeGstPercent: v.number(),
    snacksGstPercent: v.number(),
    monthlyInputTaxCredit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = requireOwner(await requireViewer(ctx));
    if (owner.clubId !== args.clubId) {
      throw new Error("AUTH_001: Not authorized.");
    }
    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    if (args.tableTimeGstPercent < 0 || args.tableTimeGstPercent > 100) {
      throw new Error("DATA_002: tableTimeGstPercent must be 0–100");
    }
    if (args.snacksGstPercent < 0 || args.snacksGstPercent > 100) {
      throw new Error("DATA_002: snacksGstPercent must be 0–100");
    }
    if (
      args.monthlyInputTaxCredit != null &&
      args.monthlyInputTaxCredit < 0
    ) {
      throw new Error("DATA_002: monthlyInputTaxCredit cannot be negative");
    }

    const gstin = args.gstin?.trim().toUpperCase() || undefined;
    if (gstin && gstin.length !== 15) {
      throw new Error("DATA_002: GSTIN must be 15 characters when provided");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("gstSettings")
      .withIndex("by_club", (q) => q.eq("clubId", args.clubId))
      .unique();

    const patch = {
      gstRegistered: args.gstRegistered,
      gstin,
      supplyType: args.supplyType,
      tableTimeGstPercent: args.tableTimeGstPercent,
      snacksGstPercent: args.snacksGstPercent,
      monthlyInputTaxCredit: args.monthlyInputTaxCredit,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return ctx.db.insert("gstSettings", { clubId: args.clubId, ...patch });
  },
});

export const getGstReport = query({
  args: {
    clubId: v.id("clubs"),
    dateFrom: v.string(),
    dateTo: v.string(),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, dateFrom, dateTo, roleId }) => {
    await assertOwnerFinancialAccess(ctx, clubId, roleId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");

    if (compareYmd(dateFrom, dateTo) > 0) {
      return {
        invalidRange: true as const,
        currency: club.currency,
      };
    }

    const settingsRow = await ctx.db
      .query("gstSettings")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .unique();

    const settings = {
      gstRegistered: settingsRow?.gstRegistered ?? false,
      supplyType: settingsRow?.supplyType ?? ("intrastate" as const),
      tableTimeGstPercent: settingsRow?.tableTimeGstPercent ?? 18,
      snacksGstPercent: settingsRow?.snacksGstPercent ?? 5,
      monthlyInputTaxCredit: settingsRow?.monthlyInputTaxCredit,
    };

    let taxableTableRevenue = 0;
    let taxableSnackRevenue = 0;
    let sessionCount = 0;

    const completed = await loadCompletedSessionsForClub(ctx, clubId);
    for (const s of completed) {
      if (!isRealisedSession(s)) continue;
      const endMs = s.endTime ?? s.startTime;
      const sessionDate = toClubDate(endMs, club.timezone);
      if (
        compareYmd(sessionDate, dateFrom) < 0 ||
        compareYmd(sessionDate, dateTo) > 0
      ) {
        continue;
      }

      const breakdown = computeBillBreakdown({
        startTime: s.startTime,
        endTime: s.endTime ?? null,
        billableMinutes: s.billableMinutes,
        ratePerMin: s.ratePerMin,
        minBillMinutes: s.minBillMinutes,
        discount: s.discount,
        snackOrders: s.snackOrders,
      });

      taxableTableRevenue += breakdown.discountedTable;
      taxableSnackRevenue += breakdown.snackTotal;
      sessionCount += 1;
    }

    taxableTableRevenue = Math.round(taxableTableRevenue * 100) / 100;
    taxableSnackRevenue = Math.round(taxableSnackRevenue * 100) / 100;

    const periodDays = countDaysInclusive(dateFrom, dateTo, club.timezone);
    const breakdown = computeGstReport(
      { taxableTableRevenue, taxableSnackRevenue, sessionCount },
      settings,
      periodDays,
    );

    return {
      invalidRange: false as const,
      dateFrom,
      dateTo,
      periodDays,
      currency: club.currency,
      gstin: settingsRow?.gstin ?? null,
      settingsConfigured: settingsRow != null,
      ...breakdown,
    };
  },
});
