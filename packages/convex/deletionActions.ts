"use node";

/**
 * Account deletion + GDPR export (crypto + HTTP-adjacent flows live here; DB writes in `deletion.ts`).
 */

import { createHash, randomBytes } from "crypto";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const sendDeletionConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    cancelToken: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { email, cancelToken, role }) => {
    const base =
      process.env.CANCEL_DELETION_URL ?? "https://a3billiards.com/cancel-deletion";
    const cancelLink = `${base.replace(/\/$/, "")}?token=${encodeURIComponent(cancelToken)}`;
    await ctx.runAction(internal.notificationsFcm.sendDeletionConfirmationEmail, {
      email,
      cancelLink,
      role,
    });
  },
});

export const requestOwnerDeletion = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const pre = await ctx.runQuery(internal.deletion.ownerDeletionPreflight, {
      userId,
    });
    if (!pre.ok) {
      throw new Error(pre.error);
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");

    await ctx.runMutation(internal.deletion.setOwnerDeletionRequested, {
      userId,
      tokenHash,
      clubId: pre.clubId,
    });

    const user = await ctx.runQuery(internal.deletion.getUserById, { userId });
    if (user?.email) {
      await ctx.runAction(internal.deletionActions.sendDeletionConfirmationEmail, {
        email: user.email,
        cancelToken: rawToken,
        role: "owner",
      });
    }

    return {
      requested: true as const,
      scheduledPurgeAt: Date.now() + THIRTY_DAYS_MS,
    };
  },
});

export const requestCustomerDeletion = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const profile = await ctx.runQuery(
      internal.deletion.getUserProfileForDeletionFlow,
      { userId },
    );
    if (!profile) {
      throw new Error("AUTH_001: Not authenticated");
    }
    if (profile.role !== "customer") {
      throw new Error("PERM_001: Customer only");
    }
    if (profile.isFrozen) {
      throw new Error("AUTH_002: Account is frozen");
    }
    if (profile.deletionRequestedAt != null) {
      throw new Error("DATA_002: A deletion request is already in progress.");
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");

    await ctx.runMutation(internal.deletion.setCustomerDeletionRequested, {
      userId,
      tokenHash,
    });

    if (profile.email) {
      await ctx.runAction(internal.deletionActions.sendDeletionConfirmationEmail, {
        email: profile.email,
        cancelToken: rawToken,
        role: "customer",
      });
    }

    return {
      requested: true as const,
      scheduledPurgeAt: Date.now() + THIRTY_DAYS_MS,
    };
  },
});

export const generateAndSendDataExport = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(internal.deletion.getUserById, { userId });
    if (!user) return;
    if (!user.email) return;
    // DPDP: do not email exports for accounts in deletion grace / purge pipeline.
    if (user.deletionRequestedAt !== undefined) return;

    const sessionLogs = await ctx.runQuery(
      internal.deletion.getSessionLogSummary,
      { userId },
    );
    const bookingLogs = await ctx.runQuery(
      internal.deletion.getBookingLogSummary,
      { userId },
    );
    const complaintCount = await ctx.runQuery(internal.deletion.getComplaintCount, {
      userId,
    });

    const clubBlock =
      user.role === "owner"
        ? await ctx.runQuery(internal.deletion.getOwnerClubExportSummary, {
            userId,
          })
        : null;

    const exportData = {
      exportedAt: new Date().toISOString(),
      role: user.role,
      name: user.name,
      phone: user.phone ?? null,
      email: user.email,
      age: user.age,
      consentGiven: user.consentGiven,
      consentGivenAt: user.consentGivenAt
        ? new Date(user.consentGivenAt).toISOString()
        : null,
      accountCreatedAt: new Date(user.createdAt).toISOString(),
      sessionHistory: {
        totalSessions: sessionLogs.total,
        lastSessionDate: sessionLogs.lastDate,
      },
      bookingHistory: {
        totalBookings: bookingLogs.total,
        byStatus: bookingLogs.byStatus,
      },
      complaintCount,
      ownerClub: clubBlock,
      note: "Raw billing records from other clubs are excluded per A3 Billiards OS data minimization policy.",
    };

    const json = JSON.stringify(exportData, null, 2);

    await ctx.runAction(internal.notificationsFcm.sendDataExportEmailWithJson, {
      email: user.email,
      json,
    });

    return { sent: true as const };
  },
});
