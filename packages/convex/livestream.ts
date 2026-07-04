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

function viewerCountFromStream(stream: {
  currentViewerCount?: number;
  peakViewerCount?: number;
}): number {
  return stream.currentViewerCount ?? stream.peakViewerCount ?? 0;
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
    tableId: v.optional(v.id("tables")),
  },
  handler: async (ctx, args) => {
    const user = await assertOwnerClub(ctx, args.clubId);
    await assertStaffTabAllowed(ctx, args.clubId, "livestream", args.roleId);

    if (args.tableId) {
      const table = await ctx.db.get(args.tableId);
      if (!table || table.clubId !== args.clubId || !table.isActive) {
        throw new Error("DATA_003: Table not found");
      }
      const existingOnTable = await ctx.db
        .query("liveStreams")
        .withIndex("by_tableId_status", (q) =>
          q.eq("tableId", args.tableId).eq("status", "live"),
        )
        .first();
      if (existingOnTable) {
        throw new Error("LIVESTREAM_001: This table is already streaming");
      }
    }

    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("DATA_003: Club not found");

    return {
      userId: user._id,
      title: normalizeTitle(args.title),
      tableLabel: normalizeTableLabel(args.tableLabel),
      tableId: args.tableId,
    };
  },
});

export const insertLiveStream = internalMutation({
  args: {
    clubId: v.id("clubs"),
    startedBy: v.id("users"),
    title: v.optional(v.string()),
    tableLabel: v.optional(v.string()),
    tableId: v.optional(v.id("tables")),
    ivsChannelArn: v.string(),
    ivsIngestEndpoint: v.string(),
    ivsStreamKeyArn: v.string(),
    ivsPlaybackUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.tableId) {
      const existingOnTable = await ctx.db
        .query("liveStreams")
        .withIndex("by_tableId_status", (q) =>
          q.eq("tableId", args.tableId).eq("status", "live"),
        )
        .first();
      if (existingOnTable) {
        throw new Error("LIVESTREAM_001: This table is already streaming");
      }
    }

    const liveStreamId = await ctx.db.insert("liveStreams", {
      clubId: args.clubId,
      tableId: args.tableId,
      title: args.title,
      tableLabel: args.tableLabel,
      status: "live",
      startedBy: args.startedBy,
      startedAt: Date.now(),
      ivsChannelArn: args.ivsChannelArn,
      ivsIngestEndpoint: args.ivsIngestEndpoint,
      ivsStreamKeyArn: args.ivsStreamKeyArn,
      ivsPlaybackUrl: args.ivsPlaybackUrl,
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
    let channelArn = stream.ivsChannelArn;
    let playbackUrl = stream.ivsPlaybackUrl;
    if (!channelArn || !playbackUrl) {
      const club = await ctx.db.get(stream.clubId);
      channelArn = club?.ivsChannelArn;
      playbackUrl = club?.ivsPlaybackUrl;
    }
    if (!channelArn || !playbackUrl) {
      return null;
    }
    return {
      channelArn,
      playbackUrl,
    };
  },
});

export const updatePeakViewerCount = internalMutation({
  args: {
    liveStreamId: v.id("liveStreams"),
    viewerCount: v.number(),
  },
  handler: async (ctx, { liveStreamId, viewerCount }) => {
    const live = await ctx.db.get(liveStreamId);
    if (!live || live.status !== "live") return;

    const peak = live.peakViewerCount ?? 0;
    const patch: { currentViewerCount: number; peakViewerCount?: number } = {
      currentViewerCount: viewerCount,
    };
    if (viewerCount > peak) {
      patch.peakViewerCount = viewerCount;
    }
    await ctx.db.patch(live._id, patch);
  },
});

const STALE_STREAM_MS = 8 * 60 * 60 * 1000;

async function closeLiveStreamByChannel(
  ctx: MutationCtx,
  channelArn: string,
  endedReason: "connection_lost" | "stale_auto_closed",
  endedAt: number,
): Promise<boolean> {
  const live = await ctx.db
    .query("liveStreams")
    .withIndex("by_ivsChannelArn", (q) => q.eq("ivsChannelArn", channelArn))
    .first();
  if (live && live.status === "live") {
    await ctx.db.patch(live._id, {
      status: "ended",
      endedAt,
      endedReason,
    });
    return true;
  }

  const club = await ctx.db
    .query("clubs")
    .withIndex("by_ivsChannelArn", (q) => q.eq("ivsChannelArn", channelArn))
    .unique();
  if (!club) return false;

  const legacyLive = await ctx.db
    .query("liveStreams")
    .withIndex("by_clubId_status", (q) =>
      q.eq("clubId", club._id).eq("status", "live"),
    )
    .first();
  if (!legacyLive) return false;

  await ctx.db.patch(legacyLive._id, {
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

    const closed = await closeLiveStreamByChannel(
      ctx,
      channelArn,
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
        channelArn: stream.ivsChannelArn ?? "",
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
    liveStreamId: v.id("liveStreams"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args): Promise<{ viewerCount: number }> => {
    await ctx.runQuery(internal.livestream.assertLivestreamBroadcastAccess, args);
    const stream = await ctx.runQuery(internal.livestream.getStreamChannelArn, {
      liveStreamId: args.liveStreamId,
    });
    if (!stream?.channelArn) return { viewerCount: 0 };
    const result = await ctx.runAction(internal.livestreamActions.getViewerCount, {
      channelArn: stream.channelArn,
      liveStreamId: args.liveStreamId,
    });
    return { viewerCount: result.viewerCount };
  },
});

// ── Public API ───────────────────────────────────────────────────────────────

export const getStreamChannelArn = internalQuery({
  args: { liveStreamId: v.id("liveStreams") },
  handler: async (ctx, { liveStreamId }) => {
    const stream = await ctx.db.get(liveStreamId);
    if (!stream || stream.status !== "live") return null;
    if (stream.ivsChannelArn) {
      return { channelArn: stream.ivsChannelArn };
    }
    const club = await ctx.db.get(stream.clubId);
    if (!club?.ivsChannelArn) return null;
    return { channelArn: club.ivsChannelArn };
  },
});

/** Orchestrates IVS provisioning + stream row (Convex: action required for AWS calls). */
export const startStream = action({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
    title: v.optional(v.string()),
    tableLabel: v.optional(v.string()),
    tableId: v.optional(v.id("tables")),
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

    const preflight = await ctx.runQuery(internal.livestream.preflightStartStream, args);

    const ivs = await ctx.runAction(internal.livestreamActions.createIvsChannelForStream, {
      clubId: args.clubId,
      tableId: args.tableId,
    });

    const { value: streamKeyValue } = await ctx.runAction(
      internal.livestreamActions.getStreamKeyValue,
      { ivsStreamKeyArn: ivs.ivsStreamKeyArn },
    );

    const { liveStreamId } = await ctx.runMutation(internal.livestream.insertLiveStream, {
      clubId: args.clubId,
      startedBy: preflight.userId,
      title: preflight.title,
      tableLabel: preflight.tableLabel,
      tableId: preflight.tableId,
      ivsChannelArn: ivs.ivsChannelArn,
      ivsIngestEndpoint: ivs.ivsIngestEndpoint,
      ivsStreamKeyArn: ivs.ivsStreamKeyArn,
      ivsPlaybackUrl: ivs.ivsPlaybackUrl,
    });

    return {
      liveStreamId,
      ingestEndpoint: ivs.ivsIngestEndpoint,
      streamKeyValue,
    };
  },
});

export const endStream = mutation({
  args: {
    clubId: v.id("clubs"),
    liveStreamId: v.id("liveStreams"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    await assertLivestreamTab(ctx, args.clubId, args.roleId);

    const live = await ctx.db.get(args.liveStreamId);
    if (!live || live.clubId !== args.clubId || live.status !== "live") {
      throw new Error("LIVESTREAM_003: Stream is not live");
    }

    const now = Date.now();
    await ctx.db.patch(live._id, {
      status: "ended",
      endedAt: now,
      endedReason: "owner_ended",
    });

    const channelArn =
      live.ivsChannelArn ??
      (await ctx.db.get(args.clubId))?.ivsChannelArn ??
      "";
    if (channelArn) {
      await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, {
        channelArn,
      });
    }

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
          viewerCount: viewerCountFromStream(stream),
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
          viewerCount: viewerCountFromStream(stream),
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

    const channelArn =
      stream.ivsChannelArn ??
      (await ctx.db.get(stream.clubId))?.ivsChannelArn ??
      "";
    if (channelArn) {
      await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, {
        channelArn,
      });
    }

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
    isBroadcasting: boolean;
    viewerCount: number;
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

    const [{ token }, broadcast] = await Promise.all([
      ctx.runAction(internal.livestreamActions.signPlaybackToken, {
        channelArn: streamInfo.channelArn,
      }),
      ctx.runAction(internal.livestreamActions.getPlaybackBroadcastState, {
        channelArn: streamInfo.channelArn,
      }),
    ]);

    if (broadcast.isBroadcasting) {
      await ctx.runMutation(internal.livestream.updatePeakViewerCount, {
        liveStreamId: args.liveStreamId,
        viewerCount: broadcast.viewerCount,
      });
    }

    return {
      playbackUrl: streamInfo.playbackUrl,
      token,
      expiresInSeconds: 3600,
      isBroadcasting: broadcast.isBroadcasting,
      viewerCount: broadcast.viewerCount,
    };
  },
});

/** Owner broadcast screen: all live streams for this club. */
export const getActiveStreamsForClub = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    await assertLivestreamTab(ctx, clubId, roleId);

    const liveRows = await ctx.db
      .query("liveStreams")
      .withIndex("by_clubId_status", (q) => q.eq("clubId", clubId).eq("status", "live"))
      .collect();

    return liveRows.map((live) => ({
      liveStreamId: live._id,
      tableId: live.tableId ?? null,
      title: live.title ?? null,
      tableLabel: live.tableLabel ?? null,
      startedAt: live.startedAt,
      viewerCount: viewerCountFromStream(live),
    }));
  },
});

/** @deprecated Use getActiveStreamsForClub — returns first live stream for backward compat. */
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
      tableId: live.tableId ?? null,
      title: live.title ?? null,
      tableLabel: live.tableLabel ?? null,
      startedAt: live.startedAt,
      viewerCount: viewerCountFromStream(live),
    };
  },
});

export const listLiveStreamsForViewerRefresh = internalQuery({
  args: {},
  handler: async (ctx) => {
    const liveStreams = await ctx.db
      .query("liveStreams")
      .withIndex("by_status_startedAt", (q) => q.eq("status", "live"))
      .collect();

    const rows = await Promise.all(
      liveStreams.map(async (stream) => {
        let channelArn = stream.ivsChannelArn;
        if (!channelArn) {
          const club = await ctx.db.get(stream.clubId);
          channelArn = club?.ivsChannelArn;
        }
        return channelArn
          ? { liveStreamId: stream._id, channelArn }
          : null;
      }),
    );

    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/** Live viewer count for playback UI (updates via cron + token refresh). */
export const getLiveStreamPublicMeta = query({
  args: { liveStreamId: v.id("liveStreams") },
  handler: async (ctx, { liveStreamId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const stream = await ctx.db.get(liveStreamId);
    if (!stream || stream.status !== "live") return null;

    return {
      viewerCount: viewerCountFromStream(stream),
      title: stream.title ?? null,
      tableLabel: stream.tableLabel ?? null,
    };
  },
});
