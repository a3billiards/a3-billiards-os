/**
 * Live Streaming (PRD v31 §7.13 / TDD v1.9 §4.10–§4.12).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { assertStaffTabAllowed } from "./model/staffTabAccess";
import { requireAdminWithMfa, requireOwner, requireViewer } from "./model/viewer";

const TITLE_MAX_LEN = 80;

async function assertOwnerClub(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
): Promise<Doc<"users">> {
  const viewer = await requireViewer(ctx);
  const owner = requireOwner(viewer);
  if (owner.clubId !== clubId) {
    throw new Error("PERM_001: Cannot access another club's data");
  }
  const club = await ctx.db.get(clubId);
  if (!club) throw new Error("DATA_003: Club not found");
  assertClubSubscriptionWritable(club);
  const user = await ctx.db.get(owner.userId);
  if (!user) throw new Error("DATA_003: User not found");
  return user;
}

async function assertLivestreamTab(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  await assertOwnerClub(ctx, clubId);
  await assertStaffTabAllowed(ctx, clubId, "livestream", roleId);
}

function normalizeTitle(title: string | undefined): string | undefined {
  if (title === undefined) return undefined;
  const trimmed = title.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > TITLE_MAX_LEN) {
    throw new Error(`DATA_002: Title must be at most ${TITLE_MAX_LEN} characters`);
  }
  return trimmed;
}

function normalizeTableLabel(tableLabel: string | undefined): string | undefined {
  if (tableLabel === undefined) return undefined;
  const trimmed = tableLabel.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveClubBannerUrl(
  ctx: QueryCtx,
  club: Doc<"clubs">,
): Promise<string | null> {
  const firstPhotoId = club.photos?.[0];
  if (!firstPhotoId) return null;
  return (await ctx.storage.getUrl(firstPhotoId as Id<"_storage">)) ?? null;
}

// ── Internal helpers (actions + cron + webhook) ───────────────────────────────

export const getClubIvsFields = internalQuery({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const club = await ctx.db.get(clubId);
    if (!club) return null;
    return {
      ivsChannelArn: club.ivsChannelArn ?? null,
      ivsIngestEndpoint: club.ivsIngestEndpoint ?? null,
      ivsStreamKeyArn: club.ivsStreamKeyArn ?? null,
      ivsPlaybackUrl: club.ivsPlaybackUrl ?? null,
    };
  },
});

export const persistIvsChannel = internalMutation({
  args: {
    clubId: v.id("clubs"),
    ivsChannelArn: v.string(),
    ivsIngestEndpoint: v.string(),
    ivsStreamKeyArn: v.string(),
    ivsPlaybackUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    await ctx.db.patch(args.clubId, {
      ivsChannelArn: args.ivsChannelArn,
      ivsIngestEndpoint: args.ivsIngestEndpoint,
      ivsStreamKeyArn: args.ivsStreamKeyArn,
      ivsPlaybackUrl: args.ivsPlaybackUrl,
    });
  },
});

export const preflightStartStream = internalQuery({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
    title: v.optional(v.string()),
    tableLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await assertOwnerClub(ctx, args.clubId);
    await assertStaffTabAllowed(ctx, args.clubId, "livestream", args.roleId);

    const existingLive = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) =>
        q.eq("clubId", args.clubId).eq("status", "live"),
      )
      .first();
    if (existingLive) {
      throw new Error("LIVESTREAM_001: A stream is already live for this club");
    }

    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("DATA_003: Club not found");

    return {
      userId: user._id,
      title: normalizeTitle(args.title),
      tableLabel: normalizeTableLabel(args.tableLabel),
      club: {
        ivsChannelArn: club.ivsChannelArn ?? null,
        ivsIngestEndpoint: club.ivsIngestEndpoint ?? null,
        ivsStreamKeyArn: club.ivsStreamKeyArn ?? null,
        ivsPlaybackUrl: club.ivsPlaybackUrl ?? null,
      },
    };
  },
});

export const insertLiveStream = internalMutation({
  args: {
    clubId: v.id("clubs"),
    startedBy: v.id("users"),
    title: v.optional(v.string()),
    tableLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingLive = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) =>
        q.eq("clubId", args.clubId).eq("status", "live"),
      )
      .first();
    if (existingLive) {
      throw new Error("LIVESTREAM_001: A stream is already live for this club");
    }

    const liveStreamId = await ctx.db.insert("liveStreams", {
      clubId: args.clubId,
      title: args.title,
      tableLabel: args.tableLabel,
      status: "live",
      startedBy: args.startedBy,
      startedAt: Date.now(),
    });

    return { liveStreamId };
  },
});

export const getStreamForPlayback = internalQuery({
  args: { liveStreamId: v.id("liveStreams") },
  handler: async (ctx, { liveStreamId }) => {
    const stream = await ctx.db.get(liveStreamId);
    if (!stream || stream.status !== "live") {
      return null;
    }
    const club = await ctx.db.get(stream.clubId);
    if (!club?.ivsChannelArn || !club.ivsPlaybackUrl) {
      return null;
    }
    return {
      channelArn: club.ivsChannelArn,
      playbackUrl: club.ivsPlaybackUrl,
    };
  },
});

export const updatePeakViewerCount = internalMutation({
  args: {
    clubId: v.id("clubs"),
    viewerCount: v.number(),
  },
  handler: async (ctx, { clubId, viewerCount }) => {
    const live = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) =>
        q.eq("clubId", clubId).eq("status", "live"),
      )
      .first();
    if (!live) return;

    const peak = live.peakViewerCount ?? 0;
    if (viewerCount > peak) {
      await ctx.db.patch(live._id, { peakViewerCount: viewerCount });
    }
  },
});

const STALE_STREAM_MS = 8 * 60 * 60 * 1000;

async function closeLiveStreamForClub(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  endedReason: "connection_lost" | "stale_auto_closed",
  endedAt: number,
): Promise<boolean> {
  const live = await ctx.db
    .query("liveStreams")
    .withIndex("by_clubId_status", (q) =>
      q.eq("clubId", clubId).eq("status", "live"),
    )
    .first();
  if (!live) return false;

  await ctx.db.patch(live._id, {
    status: "ended",
    endedAt,
    endedReason,
  });
  return true;
}

/** EventBridge IVS Stream End → reconcile liveStreams row (TDD §5 / §6.12). */
export const processIvsEventBridgeEvent = internalMutation({
  args: { event: v.any() },
  handler: async (ctx, { event }) => {
    if (!event || typeof event !== "object") return { handled: false as const };

    const envelope = event as {
      source?: string;
      "detail-type"?: string;
      resources?: unknown[];
      detail?: { event_name?: string };
    };

    if (envelope.source !== "aws.ivs") return { handled: false as const };
    if (envelope["detail-type"] !== "IVS Stream State Change") {
      return { handled: false as const };
    }
    if (envelope.detail?.event_name !== "Stream End") {
      return { handled: false as const };
    }

    const channelArn = envelope.resources?.[0];
    if (typeof channelArn !== "string" || !channelArn.trim()) {
      return { handled: false as const };
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_ivsChannelArn", (q) => q.eq("ivsChannelArn", channelArn))
      .unique();
    if (!club) return { handled: false as const };

    const closed = await closeLiveStreamForClub(
      ctx,
      club._id,
      "connection_lost",
      Date.now(),
    );
    return { handled: closed };
  },
});

/** Safety net: close live rows older than 8 hours (TDD v1.9 §7). */
export const closeStaleLiveStreams = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_STREAM_MS;
    const stale = await ctx.db
      .query("liveStreams")
      .withIndex("by_status_startedAt", (q) => q.eq("status", "live"))
      .filter((q) => q.lt(q.field("startedAt"), cutoff))
      .collect();

    const now = Date.now();
    let closed = 0;
    for (const stream of stale) {
      await ctx.db.patch(stream._id, {
        status: "ended",
        endedAt: now,
        endedReason: "stale_auto_closed",
      });
      await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, {
        clubId: stream.clubId,
      });
      closed += 1;
    }
    return { closed };
  },
});

export const assertLivestreamBroadcastAccess = internalQuery({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    await assertLivestreamTab(ctx, args.clubId, args.roleId);
    return { ok: true as const };
  },
});

export const refreshViewerCount = action({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args): Promise<{ viewerCount: number }> => {
    await ctx.runQuery(internal.livestream.assertLivestreamBroadcastAccess, args);
    return await ctx.runAction(internal.livestreamActions.getViewerCount, {
      clubId: args.clubId,
    });
  },
});

// ── Public API ───────────────────────────────────────────────────────────────

/** Orchestrates IVS provisioning + stream row (Convex: action required for AWS calls). */
export const startStream = action({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
    title: v.optional(v.string()),
    tableLabel: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    liveStreamId: Id<"liveStreams">;
    ingestEndpoint: string;
    streamKeyValue: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const preflight: {
      userId: Id<"users">;
      title?: string;
      tableLabel?: string;
      club: {
        ivsChannelArn: string | null;
        ivsIngestEndpoint: string | null;
        ivsStreamKeyArn: string | null;
        ivsPlaybackUrl: string | null;
      };
    } = await ctx.runQuery(internal.livestream.preflightStartStream, args);

    let club = preflight.club;
    if (!club.ivsChannelArn) {
      await ctx.runAction(internal.livestreamActions.createIvsChannel, {
        clubId: args.clubId,
      });
      club = await ctx.runQuery(internal.livestream.getClubIvsFields, {
        clubId: args.clubId,
      });
      if (!club?.ivsChannelArn || !club.ivsIngestEndpoint || !club.ivsStreamKeyArn) {
        throw new Error("LIVESTREAM_002: AWS IVS API call failed");
      }
    }

    const { value: streamKeyValue } = await ctx.runAction(
      internal.livestreamActions.getStreamKeyValue,
      { ivsStreamKeyArn: club.ivsStreamKeyArn! },
    );

    const { liveStreamId } = await ctx.runMutation(internal.livestream.insertLiveStream, {
      clubId: args.clubId,
      startedBy: preflight.userId,
      title: preflight.title,
      tableLabel: preflight.tableLabel,
    });

    return {
      liveStreamId,
      ingestEndpoint: club.ivsIngestEndpoint!,
      streamKeyValue,
    };
  },
});

export const endStream = mutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    await assertLivestreamTab(ctx, args.clubId, args.roleId);

    const live = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) =>
        q.eq("clubId", args.clubId).eq("status", "live"),
      )
      .first();
    if (!live) {
      throw new Error("LIVESTREAM_003: No stream is currently live for this club");
    }

    const now = Date.now();
    await ctx.db.patch(live._id, {
      status: "ended",
      endedAt: now,
      endedReason: "owner_ended",
    });

    await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, {
      clubId: args.clubId,
    });

    return { liveStreamId: live._id, endedAt: now };
  },
});

/** Cross-club discovery — minimal public field set only (TDD §4.11). */
export const getActiveStreamsPlatformWide = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getAuthUserId(ctx);
    if (!viewer) return [];

    const liveStreams = await ctx.db
      .query("liveStreams")
      .withIndex("by_status_startedAt", (q) => q.eq("status", "live"))
      .order("desc")
      .collect();

    const rows = await Promise.all(
      liveStreams.map(async (stream) => {
        const club = await ctx.db.get(stream.clubId);
        if (!club) return null;
        return {
          liveStreamId: stream._id,
          clubId: stream.clubId,
          clubName: club.name,
          clubBannerImageUrl: await resolveClubBannerUrl(ctx, club),
          title: stream.title ?? null,
          tableLabel: stream.tableLabel ?? null,
          startedAt: stream.startedAt,
          viewerCount: stream.peakViewerCount ?? 0,
        };
      }),
    );

    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/** Admin moderation — platform-wide live list with broadcaster attribution. */
export const getActiveStreamsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminWithMfa(ctx);

    const liveStreams = await ctx.db
      .query("liveStreams")
      .withIndex("by_status_startedAt", (q) => q.eq("status", "live"))
      .order("desc")
      .collect();

    const rows = await Promise.all(
      liveStreams.map(async (stream) => {
        const club = await ctx.db.get(stream.clubId);
        if (!club) return null;
        const startedByUser = await ctx.db.get(stream.startedBy);
        return {
          liveStreamId: stream._id,
          clubId: stream.clubId,
          clubName: club.name,
          clubBannerImageUrl: await resolveClubBannerUrl(ctx, club),
          title: stream.title ?? null,
          tableLabel: stream.tableLabel ?? null,
          startedAt: stream.startedAt,
          viewerCount: stream.peakViewerCount ?? 0,
          startedByUserId: stream.startedBy,
          startedByName: startedByUser?.name ?? "Unknown",
        };
      }),
    );

    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const adminForceEndStream = mutation({
  args: {
    liveStreamId: v.id("liveStreams"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminWithMfa(ctx);
    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("DATA_002: A reason is required to force-end a stream");
    }

    const stream = await ctx.db.get(args.liveStreamId);
    if (!stream || stream.status !== "live") {
      throw new Error("LIVESTREAM_004: This stream is not currently active");
    }

    const now = Date.now();
    await ctx.db.patch(stream._id, {
      status: "ended",
      endedAt: now,
      endedReason: "admin_force_ended",
    });

    await ctx.db.insert("liveStreamModerationLog", {
      clubId: stream.clubId,
      liveStreamId: stream._id,
      adminId: admin.userId,
      reason,
      endedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, {
      clubId: stream.clubId,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyOwnerStreamForceEnded, {
      clubId: stream.clubId,
      reason,
    });

    return { liveStreamId: stream._id, endedAt: now };
  },
});

/** Playback token — action (signing runs in internalAction). No entitlement checks. */
export const getPlaybackToken = action({
  args: { liveStreamId: v.id("liveStreams") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    playbackUrl: string;
    token: string;
    expiresInSeconds: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const streamInfo: {
      channelArn: string;
      playbackUrl: string;
    } | null = await ctx.runQuery(internal.livestream.getStreamForPlayback, {
      liveStreamId: args.liveStreamId,
    });
    if (!streamInfo) {
      throw new Error("LIVESTREAM_004: This stream is not currently active");
    }

    const { token } = await ctx.runAction(internal.livestreamActions.signPlaybackToken, {
      channelArn: streamInfo.channelArn,
    });

    return {
      playbackUrl: streamInfo.playbackUrl,
      token,
      expiresInSeconds: 3600,
    };
  },
});

/** Owner broadcast screen: current club live state. */
export const getActiveStreamForClub = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    await assertLivestreamTab(ctx, clubId, roleId);

    const live = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) => q.eq("clubId", clubId).eq("status", "live"))
      .first();

    if (!live) return null;

    return {
      liveStreamId: live._id,
      title: live.title ?? null,
      tableLabel: live.tableLabel ?? null,
      startedAt: live.startedAt,
      viewerCount: live.peakViewerCount ?? 0,
    };
  },
});
