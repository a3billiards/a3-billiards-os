/**
 * Loyalty credit award + redemption helpers (PRD §7.11).
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const MS_PER_DAY = 86_400_000;

export async function getActiveLoyaltyProgramme(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
): Promise<Doc<"loyaltyProgrammes"> | null> {
  return (
    (await ctx.db
      .query("loyaltyProgrammes")
      .withIndex("by_clubId_status", (q) =>
        q.eq("clubId", clubId).eq("status", "active"),
      )
      .first()) ?? null
  );
}

export async function ensureLoyaltyLedger(
  ctx: MutationCtx,
  args: {
    clubId: Id<"clubs">;
    userId: Id<"users">;
    programmeId: Id<"loyaltyProgrammes">;
    now: number;
  },
): Promise<Doc<"loyaltyLedgers">> {
  const existing = await ctx.db
    .query("loyaltyLedgers")
    .withIndex("by_clubId_userId", (q) =>
      q.eq("clubId", args.clubId).eq("userId", args.userId),
    )
    .unique();

  if (existing) {
    if (existing.programmeId !== args.programmeId) {
      await ctx.db.patch(existing._id, {
        programmeId: args.programmeId,
        updatedAt: args.now,
      });
      return { ...existing, programmeId: args.programmeId, updatedAt: args.now };
    }
    return existing;
  }

  const id = await ctx.db.insert("loyaltyLedgers", {
    clubId: args.clubId,
    userId: args.userId,
    programmeId: args.programmeId,
    availableCredits: 0,
    lifetimeCreditsEarned: 0,
    lifetimeCreditsRedeemed: 0,
    createdAt: args.now,
    updatedAt: args.now,
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("DATA_003: Failed to create loyalty ledger");
  return row;
}

async function sumPlayMinutesInWindow(
  ctx: MutationCtx,
  args: {
    clubId: Id<"clubs">;
    userId: Id<"users">;
    windowStart: number;
    endTime: number;
    includeSessionId?: Id<"sessions">;
    includeMinutes?: number;
  },
): Promise<number> {
  const rows = await ctx.db
    .query("loyaltyPlayLog")
    .withIndex("by_clubId_userId_endTime", (q) =>
      q.eq("clubId", args.clubId).eq("userId", args.userId),
    )
    .filter((q) =>
      q.and(
        q.gte(q.field("endTime"), args.windowStart),
        q.lte(q.field("endTime"), args.endTime),
      ),
    )
    .collect();

  let total = rows.reduce((sum, r) => sum + r.billableMinutes, 0);
  if (
    args.includeSessionId &&
    args.includeMinutes != null &&
    !rows.some((r) => r.sessionId === args.includeSessionId)
  ) {
    total += args.includeMinutes;
  }
  return total;
}

async function tierAwardedInWindow(
  ctx: MutationCtx,
  args: {
    clubId: Id<"clubs">;
    userId: Id<"users">;
    tierId: Id<"loyaltyTiers">;
    windowStart: number;
  },
): Promise<boolean> {
  const row = await ctx.db
    .query("loyaltyCreditAwardLog")
    .withIndex("by_clubId_userId_tierId", (q) =>
      q
        .eq("clubId", args.clubId)
        .eq("userId", args.userId)
        .eq("tierId", args.tierId),
    )
    .filter((q) => q.gte(q.field("awardedAt"), args.windowStart))
    .first();
  return row !== null;
}

export type LoyaltyAwardResult = {
  creditsAwarded: number;
  newBalance: number;
};

/** Evaluate tier crossings and award credits. Idempotent per session via play log. */
export async function evaluateLoyaltyAfterCheckout(
  ctx: MutationCtx,
  session: Doc<"sessions">,
): Promise<LoyaltyAwardResult> {
  if (
    !session.customerId ||
    session.isGuest ||
    session.status !== "completed" ||
    session.billableMinutes == null ||
    session.endTime == null
  ) {
    return { creditsAwarded: 0, newBalance: 0 };
  }

  const programme = await getActiveLoyaltyProgramme(ctx, session.clubId);
  if (!programme) {
    return { creditsAwarded: 0, newBalance: 0 };
  }

  const now = session.endTime;
  const userId = session.customerId;

  const existingLog = await ctx.db
    .query("loyaltyPlayLog")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .first();

  if (!existingLog) {
    await ctx.db.insert("loyaltyPlayLog", {
      clubId: session.clubId,
      userId,
      sessionId: session._id,
      programmeId: programme._id,
      endTime: session.endTime,
      billableMinutes: session.billableMinutes,
    });
  }

  const ledger = await ensureLoyaltyLedger(ctx, {
    clubId: session.clubId,
    userId,
    programmeId: programme._id,
    now,
  });

  const tiers = (
    await ctx.db
      .query("loyaltyTiers")
      .withIndex("by_programmeId", (q) => q.eq("programmeId", programme._id))
      .collect()
  ).sort((a, b) => a.thresholdMinutes - b.thresholdMinutes || a.rank - b.rank);

  let creditsAwarded = 0;
  let highestTierReachedId = ledger.highestTierReachedId;

  for (const tier of tiers) {
    const windowStart = session.endTime - tier.windowDays * MS_PER_DAY;
    const cumulative = await sumPlayMinutesInWindow(ctx, {
      clubId: session.clubId,
      userId,
      windowStart,
      endTime: session.endTime,
      includeSessionId: session._id,
      includeMinutes: session.billableMinutes,
    });

    if (cumulative < tier.thresholdMinutes) continue;

    const alreadyAwarded = await tierAwardedInWindow(ctx, {
      clubId: session.clubId,
      userId,
      tierId: tier._id,
      windowStart,
    });
    if (alreadyAwarded) continue;

    for (let i = 0; i < tier.creditsAwarded; i++) {
      await ctx.db.insert("loyaltyCredits", {
        clubId: session.clubId,
        userId,
        programmeId: programme._id,
        tierId: tier._id,
        status: "available",
        awardedAt: now,
      });
    }

    await ctx.db.insert("loyaltyCreditAwardLog", {
      clubId: session.clubId,
      userId,
      programmeId: programme._id,
      tierId: tier._id,
      creditsAwarded: tier.creditsAwarded,
      cumulativeMinutesAtAward: cumulative,
      sessionId: session._id,
      source: "automatic",
      awardedAt: now,
    });

    creditsAwarded += tier.creditsAwarded;
    highestTierReachedId = tier._id;
  }

  if (creditsAwarded > 0) {
    const newBalance = ledger.availableCredits + creditsAwarded;
    await ctx.db.patch(ledger._id, {
      availableCredits: newBalance,
      lifetimeCreditsEarned: ledger.lifetimeCreditsEarned + creditsAwarded,
      highestTierReachedId,
      lastAwardedAt: now,
      updatedAt: now,
    });
    return { creditsAwarded, newBalance };
  }

  return { creditsAwarded: 0, newBalance: ledger.availableCredits };
}

export async function finalizeFreeVisitRedemption(
  ctx: MutationCtx,
  args: {
    session: Doc<"sessions">;
    billableMinutes: number;
    overageMinutes: number;
    overageBilled: number;
    redeemedBy: Id<"users">;
    now: number;
  },
): Promise<void> {
  const { session } = args;
  if (!session.isFreeVisit || !session.freeVisitCreditId || !session.customerId) {
    return;
  }

  const credit = await ctx.db.get(session.freeVisitCreditId);
  if (!credit || credit.status !== "reserved") {
    throw new Error("LOYALTY_001: Free-visit credit is not reserved for this session");
  }
  if (credit.clubId !== session.clubId || credit.userId !== session.customerId) {
    throw new Error("LOYALTY_002: Credit does not belong to this customer at this club");
  }

  await ctx.db.patch(credit._id, {
    status: "redeemed",
    redeemedAt: args.now,
    sessionId: session._id,
    reservedForSessionId: undefined,
  });

  const ledger = await ctx.db
    .query("loyaltyLedgers")
    .withIndex("by_clubId_userId", (q) =>
      q.eq("clubId", session.clubId).eq("userId", session.customerId!),
    )
    .unique();

  if (ledger) {
    await ctx.db.patch(ledger._id, {
      availableCredits: Math.max(0, ledger.availableCredits - 1),
      lifetimeCreditsRedeemed: ledger.lifetimeCreditsRedeemed + 1,
      updatedAt: args.now,
    });
  }

  await ctx.db.insert("loyaltyCreditRedemptionLog", {
    clubId: session.clubId,
    userId: session.customerId,
    creditId: credit._id,
    sessionId: session._id,
    freeVisitMaxMinutesApplied: session.freeVisitMaxMinutes ?? 0,
    billableMinutes: args.billableMinutes,
    overageMinutes: args.overageMinutes,
    overageBilled: args.overageBilled,
    redeemedBy: args.redeemedBy,
    redeemedAt: args.now,
  });
}

export async function revertReservedFreeVisitCredit(
  ctx: MutationCtx,
  session: Doc<"sessions">,
): Promise<void> {
  if (!session.freeVisitCreditId) return;
  const credit = await ctx.db.get(session.freeVisitCreditId);
  if (!credit || credit.status !== "reserved") return;

  await ctx.db.patch(credit._id, {
    status: "available",
    reservedAt: undefined,
    reservedForSessionId: undefined,
  });
}

export async function reserveFreeVisitCredit(
  ctx: MutationCtx,
  args: {
    creditId: Id<"loyaltyCredits">;
    clubId: Id<"clubs">;
    userId: Id<"users">;
    sessionId: Id<"sessions">;
    now: number;
  },
): Promise<void> {
  const credit = await ctx.db.get(args.creditId);
  if (!credit || credit.clubId !== args.clubId || credit.userId !== args.userId) {
    throw new Error("LOYALTY_003: Credit not found");
  }
  if (credit.status !== "available") {
    throw new Error("LOYALTY_004: Credit is not available");
  }

  await ctx.db.patch(args.creditId, {
    status: "reserved",
    reservedAt: args.now,
    reservedForSessionId: args.sessionId,
  });
}
