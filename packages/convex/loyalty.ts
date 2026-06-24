/**
 * Membership Loyalty (PRD §7.11 / §8.9).
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner, requireViewer, requireCustomer } from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { assertStaffTabAllowed } from "./model/staffTabAccess";
import {
  evaluateLoyaltyAfterCheckout,
  getActiveLoyaltyProgramme,
  ensureLoyaltyLedger,
} from "./model/loyaltyCore";

function rewardFromTiers(
  tiers: { windowDays: number; thresholdMinutes: number; creditsAwarded: number }[],
) {
  const sorted = [...tiers].sort((a, b) => a.thresholdMinutes - b.thresholdMinutes);
  const t = sorted[0];
  if (!t) return null;
  return {
    windowDays: t.windowDays,
    thresholdMinutes: t.thresholdMinutes,
    creditsAwarded: t.creditsAwarded,
  };
}

async function assertOwnerClub(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
): Promise<void> {
  const viewer = await requireViewer(ctx);
  const owner = requireOwner(viewer);
  if (owner.clubId !== clubId) {
    throw new Error("PERM_001: Cannot access another club's data");
  }
}

function validateReward(
  reward: {
    windowDays: number;
    thresholdMinutes: number;
    creditsAwarded: number;
  },
  activate: boolean,
): void {
  if (reward.windowDays < 1 || reward.windowDays > 365) {
    throw new Error("LOYALTY_013: windowDays must be 1–365");
  }
  if (!activate) return;
  if (reward.thresholdMinutes <= 0) {
    throw new Error("LOYALTY_014: thresholdMinutes must be > 0");
  }
  if (reward.creditsAwarded < 1) {
    throw new Error("LOYALTY_015: creditsAwarded must be ≥ 1");
  }
}

export const getProgrammeSettings = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    await assertOwnerClub(ctx, clubId);
    const programmes = await ctx.db
      .query("loyaltyProgrammes")
      .withIndex("by_clubId_status", (q) => q.eq("clubId", clubId))
      .collect();

    const active = programmes.find((p) => p.status === "active") ?? null;
    const drafts = programmes.filter((p) => p.status === "draft");
    const archived = programmes.filter((p) => p.status === "archived");

    async function withReward(p: Doc<"loyaltyProgrammes"> | null) {
      if (!p) return null;
      const tiers = (
        await ctx.db
          .query("loyaltyTiers")
          .withIndex("by_programmeId", (q) => q.eq("programmeId", p._id))
          .collect()
      ).sort((a, b) => a.rank - b.rank);
      return { ...p, reward: rewardFromTiers(tiers) };
    }

    return {
      active: await withReward(active),
      drafts: await Promise.all(drafts.map(withReward)),
      archived: await Promise.all(archived.map(withReward)),
    };
  },
});

export const saveProgramme = mutation({
  args: {
    clubId: v.id("clubs"),
    programmeId: v.optional(v.id("loyaltyProgrammes")),
    name: v.string(),
    freeVisitMaxMinutes: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived"),
    ),
    windowDays: v.number(),
    thresholdMinutes: v.number(),
    creditsAwarded: v.number(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== args.clubId) {
      throw new Error("PERM_001: Cannot access another club's data");
    }
    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    const name = args.name.trim();
    if (!name) throw new Error("LOYALTY_005: Programme name is required");
    if (name.length > 60) throw new Error("LOYALTY_006: Programme name too long");
    if (args.freeVisitMaxMinutes < club.minBillMinutes) {
      throw new Error(
        "LOYALTY_007: freeVisitMaxMinutes must be ≥ club minBillMinutes",
      );
    }

    validateReward(
      {
        windowDays: args.windowDays,
        thresholdMinutes: args.thresholdMinutes,
        creditsAwarded: args.creditsAwarded,
      },
      args.status === "active",
    );

    if (args.status === "active") {
      const otherActive = await ctx.db
        .query("loyaltyProgrammes")
        .withIndex("by_clubId_status", (q) =>
          q.eq("clubId", args.clubId).eq("status", "active"),
        )
        .collect();
      const conflict = otherActive.find((p) => p._id !== args.programmeId);
      if (conflict) {
        throw new Error(
          "LOYALTY_008: Archive the current active programme before activating another",
        );
      }
    }

    const now = Date.now();
    let programmeId = args.programmeId;

    if (programmeId) {
      const existing = await ctx.db.get(programmeId);
      if (!existing || existing.clubId !== args.clubId) {
        throw new Error("DATA_003: Programme not found");
      }
      await ctx.db.patch(programmeId, {
        name,
        freeVisitMaxMinutes: args.freeVisitMaxMinutes,
        status: args.status,
        updatedAt: now,
        ...(args.status === "archived"
          ? { archivedAt: existing.archivedAt ?? now }
          : {}),
      });
      const oldTiers = await ctx.db
        .query("loyaltyTiers")
        .withIndex("by_programmeId", (q) => q.eq("programmeId", programmeId!))
        .collect();
      for (const t of oldTiers) await ctx.db.delete(t._id);
    } else {
      programmeId = await ctx.db.insert("loyaltyProgrammes", {
        clubId: args.clubId,
        name,
        status: args.status,
        freeVisitMaxMinutes: args.freeVisitMaxMinutes,
        createdBy: owner.userId,
        createdAt: now,
        updatedAt: now,
        archivedAt: args.status === "archived" ? now : undefined,
      });
    }

    await ctx.db.insert("loyaltyTiers", {
      clubId: args.clubId,
      programmeId: programmeId!,
      name: "Reward",
      windowDays: args.windowDays,
      thresholdMinutes: args.thresholdMinutes,
      creditsAwarded: args.creditsAwarded,
      rank: 1,
      createdAt: now,
    });

    return { programmeId };
  },
});

export const archiveProgramme = mutation({
  args: { programmeId: v.id("loyaltyProgrammes") },
  handler: async (ctx, { programmeId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    const programme = await ctx.db.get(programmeId);
    if (!programme || programme.clubId !== owner.clubId) {
      throw new Error("DATA_003: Programme not found");
    }
    const now = Date.now();
    await ctx.db.patch(programmeId, {
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    });
    return { ok: true as const };
  },
});

export const getRedemptionOffer = query({
  args: {
    clubId: v.id("clubs"),
    customerId: v.id("users"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, customerId, roleId }) => {
    await assertOwnerClub(ctx, clubId);
    await assertStaffTabAllowed(ctx, clubId, "loyalty", roleId);

    const programme = await getActiveLoyaltyProgramme(ctx as MutationCtx, clubId);
    if (!programme) return { eligible: false as const };

    const ledger = await ctx.db
      .query("loyaltyLedgers")
      .withIndex("by_clubId_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", customerId),
      )
      .unique();

    const availableCredits = ledger?.availableCredits ?? 0;
    if (availableCredits <= 0) return { eligible: false as const };

    const credit = await ctx.db
      .query("loyaltyCredits")
      .withIndex("by_clubId_userId_status", (q) =>
        q.eq("clubId", clubId).eq("userId", customerId).eq("status", "available"),
      )
      .first();

    return {
      eligible: true as const,
      availableCredits,
      freeVisitMaxMinutes: programme.freeVisitMaxMinutes,
      creditId: credit?._id ?? null,
      programmeName: programme.name,
    };
  },
});

export const getDashboardOverview = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    await assertOwnerClub(ctx, clubId);
    await assertStaffTabAllowed(ctx, clubId, "loyalty", roleId);

    const programme = await getActiveLoyaltyProgramme(ctx as MutationCtx, clubId);
    const tiers = programme
      ? (
          await ctx.db
            .query("loyaltyTiers")
            .withIndex("by_programmeId", (q) =>
              q.eq("programmeId", programme._id),
            )
            .collect()
        ).sort((a, b) => a.rank - b.rank)
      : [];

    const ledgers = await ctx.db
      .query("loyaltyLedgers")
      .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
      .collect();

    const awardLogs = await ctx.db
      .query("loyaltyCreditAwardLog")
      .withIndex("by_clubId_userId", (q) => q.eq("clubId", clubId))
      .collect();

    const redemptionLogs = await ctx.db
      .query("loyaltyCreditRedemptionLog")
      .withIndex("by_clubId_userId", (q) => q.eq("clubId", clubId))
      .collect();

    const totalCreditsAwarded = awardLogs.reduce(
      (s, l) => s + l.creditsAwarded,
      0,
    );
    const totalCreditsRedeemed = redemptionLogs.length;

    return {
      programme,
      reward: rewardFromTiers(tiers),
      enrolledCount: ledgers.length,
      totalCreditsAwarded,
      totalCreditsRedeemed,
    };
  },
});

export const listLoyaltyCustomers = query({
  args: {
    clubId: v.id("clubs"),
    search: v.optional(v.string()),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, search, roleId }) => {
    await assertOwnerClub(ctx, clubId);
    await assertStaffTabAllowed(ctx, clubId, "loyalty", roleId);

    const ledgers = await ctx.db
      .query("loyaltyLedgers")
      .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
      .collect();

    const q = (search ?? "").trim().toLowerCase();
    const rows = [];
    for (const ledger of ledgers) {
      const user = await ctx.db.get(ledger.userId);
      if (!user) continue;
      const hay = `${user.name} ${user.phone ?? ""}`.toLowerCase();
      if (q && !hay.includes(q)) continue;

      rows.push({
        ledgerId: ledger._id,
        userId: ledger.userId,
        name: user.name,
        phone: user.phone ?? null,
        availableCredits: ledger.availableCredits,
        lifetimeCreditsEarned: ledger.lifetimeCreditsEarned,
        lifetimeCreditsRedeemed: ledger.lifetimeCreditsRedeemed,
      });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },
});

export const getCustomerLoyaltyDetail = query({
  args: {
    clubId: v.id("clubs"),
    userId: v.id("users"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, userId, roleId }) => {
    await assertOwnerClub(ctx, clubId);
    await assertStaffTabAllowed(ctx, clubId, "loyalty", roleId);

    const ledger = await ctx.db
      .query("loyaltyLedgers")
      .withIndex("by_clubId_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", userId),
      )
      .unique();
    if (!ledger) return null;

    const user = await ctx.db.get(userId);
    const awards = await ctx.db
      .query("loyaltyCreditAwardLog")
      .withIndex("by_clubId_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", userId),
      )
      .collect();
    const redemptions = await ctx.db
      .query("loyaltyCreditRedemptionLog")
      .withIndex("by_clubId_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", userId),
      )
      .collect();

    return {
      ledger,
      user: user ? { name: user.name, phone: user.phone ?? null } : null,
      awards: awards.sort((a, b) => b.awardedAt - a.awardedAt),
      redemptions: redemptions.sort((a, b) => b.redeemedAt - a.redeemedAt),
    };
  },
});

export const manualAdjustCredits = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { clubId, userId, delta, reason }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Owner only");
    }
    if (delta === 0) throw new Error("LOYALTY_009: No change requested");

    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > 200) {
      throw new Error("LOYALTY_017: Reason required (max 200 characters)");
    }

    const programme = await getActiveLoyaltyProgramme(ctx, clubId);
    if (!programme) {
      throw new Error("LOYALTY_018: No active programme");
    }

    const now = Date.now();
    const ledger = await ensureLoyaltyLedger(ctx, {
      clubId,
      userId,
      programmeId: programme._id,
      now,
    });

    const newBalance = ledger.availableCredits + delta;
    if (newBalance < 0) {
      throw new Error("LOYALTY_019: Cannot reduce below zero available credits");
    }

    const abs = Math.abs(delta);
    if (delta > 0) {
      for (let i = 0; i < abs; i++) {
        await ctx.db.insert("loyaltyCredits", {
          clubId,
          userId,
          programmeId: programme._id,
          status: "available",
          awardedAt: now,
        });
      }
    } else {
      const toRevoke = await ctx.db
        .query("loyaltyCredits")
        .withIndex("by_clubId_userId_status", (q) =>
          q.eq("clubId", clubId).eq("userId", userId).eq("status", "available"),
        )
        .take(abs);
      if (toRevoke.length < abs) {
        throw new Error("LOYALTY_020: Not enough available credits to deduct");
      }
      for (const c of toRevoke) await ctx.db.delete(c._id);
    }

    await ctx.db.insert("loyaltyCreditAwardLog", {
      clubId,
      userId,
      programmeId: programme._id,
      creditsAwarded: delta,
      cumulativeMinutesAtAward: 0,
      source: "manual",
      manualReason: trimmed,
      awardedBy: owner.userId,
      awardedAt: now,
    });

    await ctx.db.patch(ledger._id, {
      availableCredits: newBalance,
      lifetimeCreditsEarned:
        delta > 0
          ? ledger.lifetimeCreditsEarned + delta
          : ledger.lifetimeCreditsEarned,
      updatedAt: now,
    });

    return { availableCredits: newBalance };
  },
});

/** Customer wallet: one row per club where they have a loyalty ledger. */
export const listMyLoyaltyByClub = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const customer = requireCustomer(viewer);

    const ledgers = await ctx.db
      .query("loyaltyLedgers")
      .withIndex("by_userId", (q) => q.eq("userId", customer.userId))
      .collect();

    const rows = await Promise.all(
      ledgers.map(async (ledger) => {
        const club = await ctx.db.get(ledger.clubId);
        const programme = await ctx.db.get(ledger.programmeId);
        if (!club || !programme || programme.status !== "active") return null;
        return {
          clubId: ledger.clubId,
          clubName: club.name,
          programmeName: programme.name,
          availableCredits: ledger.availableCredits,
          lifetimeCreditsEarned: ledger.lifetimeCreditsEarned,
        };
      }),
    );

    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.clubName.localeCompare(b.clubName));
  },
});

export const getCustomerLoyaltyStatus = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const viewer = await requireViewer(ctx);
    const customer = requireCustomer(viewer);

    const programme = await getActiveLoyaltyProgramme(ctx as MutationCtx, clubId);
    if (!programme) return null;

    const ledger = await ctx.db
      .query("loyaltyLedgers")
      .withIndex("by_clubId_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", customer.userId),
      )
      .unique();
    if (!ledger) return null;

    const tiers = (
      await ctx.db
        .query("loyaltyTiers")
        .withIndex("by_programmeId", (q) => q.eq("programmeId", programme._id))
        .collect()
    ).sort((a, b) => a.rank - b.rank);

    const reward = rewardFromTiers(tiers);
    if (!reward) return null;

    const windowStart = Date.now() - reward.windowDays * 86_400_000;
    const logs = await ctx.db
      .query("loyaltyPlayLog")
      .withIndex("by_clubId_userId_endTime", (q) =>
        q.eq("clubId", clubId).eq("userId", customer.userId),
      )
      .filter((q) => q.gte(q.field("endTime"), windowStart))
      .collect();

    const progressMinutes = logs.reduce((s, l) => s + l.billableMinutes, 0);
    const progressPercent =
      reward.thresholdMinutes > 0
        ? Math.min(100, Math.round((progressMinutes / reward.thresholdMinutes) * 100))
        : 0;

    const rewardTier = tiers[0];
    const rewardEarnedThisPeriod = rewardTier
      ? (await ctx.db
          .query("loyaltyCreditAwardLog")
          .withIndex("by_clubId_userId_tierId", (q) =>
            q
              .eq("clubId", clubId)
              .eq("userId", customer.userId)
              .eq("tierId", rewardTier._id),
          )
          .filter((q) => q.gte(q.field("awardedAt"), windowStart))
          .first()) !== null
      : false;

    return {
      programmeName: programme.name,
      availableCredits: ledger.availableCredits,
      progressMinutes,
      progressPercent,
      thresholdMinutes: reward.thresholdMinutes,
      windowDays: reward.windowDays,
      rewardEarnedThisPeriod,
      lifetimeCreditsEarned: ledger.lifetimeCreditsEarned,
      lifetimeCreditsRedeemed: ledger.lifetimeCreditsRedeemed,
      sessionCountInWindow: logs.length,
    };
  },
});

export const evaluateCheckoutLoyalty = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return { creditsAwarded: 0 };

    const result = await evaluateLoyaltyAfterCheckout(ctx, session);
    if (result.creditsAwarded > 0 && session.customerId) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.notifyLoyaltyCreditAwarded,
        {
          clubId: session.clubId,
          userId: session.customerId,
          creditsAwarded: result.creditsAwarded,
          newBalance: result.newBalance,
        },
      );
    }
    return result;
  },
});
