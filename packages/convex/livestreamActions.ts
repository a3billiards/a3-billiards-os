"use node";

/**
 * AWS IVS integration (TDD v1.9 §6.11–§6.13).
 * All AWS credentials and the playback private key are read only in this file (via model/livestreamIvs.ts).
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  fetchChannelViewerCount,
  fetchStreamKeyValue,
  provisionClubIvsChannel,
  provisionStreamIvsChannel,
  isChannelBroadcasting,
  signIvsPlaybackToken,
  stopChannelStream,
} from "./model/livestreamIvs";
import { randomUUID } from "crypto";

export const createIvsChannelForStream = internalAction({
  args: {
    clubId: v.id("clubs"),
    tableId: v.optional(v.id("tables")),
  },
  handler: async (_ctx, { clubId, tableId }) => {
    const label = `${clubId}-${tableId ?? randomUUID()}`;
    return await provisionStreamIvsChannel(label);
  },
});

export const createIvsChannel = internalAction({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const provisioned = await provisionClubIvsChannel(clubId);
    await ctx.runMutation(internal.livestream.persistIvsChannel, {
      clubId,
      ...provisioned,
    });
  },
});

export const getStreamKeyValue = internalAction({
  args: { ivsStreamKeyArn: v.string() },
  handler: async (_ctx, { ivsStreamKeyArn }) => {
    const value = await fetchStreamKeyValue(ivsStreamKeyArn);
    return { value };
  },
});

export const stopIvsStream = internalAction({
  args: { channelArn: v.string() },
  handler: async (_ctx, { channelArn }) => {
    if (!channelArn.trim()) return { stopped: false as const };
    const stopped = await stopChannelStream(channelArn);
    return { stopped };
  },
});

export const getViewerCount = internalAction({
  args: { channelArn: v.string(), liveStreamId: v.optional(v.id("liveStreams")) },
  handler: async (ctx, { channelArn, liveStreamId }) => {
    if (!channelArn.trim()) return { viewerCount: 0, isBroadcasting: false };
    const viewerCount = await fetchChannelViewerCount(channelArn);
    const isBroadcasting = await isChannelBroadcasting(channelArn);
    if (liveStreamId) {
      await ctx.runMutation(internal.livestream.updatePeakViewerCount, {
        liveStreamId,
        viewerCount,
      });
    }
    return { viewerCount, isBroadcasting };
  },
});

export const getPlaybackBroadcastState = internalAction({
  args: { channelArn: v.string() },
  handler: async (_ctx, { channelArn }) => {
    if (!channelArn.trim()) {
      return { isBroadcasting: false as const, viewerCount: 0 };
    }
    const isBroadcasting = await isChannelBroadcasting(channelArn);
    const viewerCount = isBroadcasting
      ? await fetchChannelViewerCount(channelArn)
      : 0;
    return { isBroadcasting, viewerCount };
  },
});

export const signPlaybackToken = internalAction({
  args: { channelArn: v.string() },
  handler: async (_ctx, { channelArn }) => {
    const token = signIvsPlaybackToken(channelArn);
    return { token };
  },
});

/** Poll AWS IVS viewer counts for all live streams (cron + manual refresh). */
export const refreshAllLiveViewerCounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const streams = await ctx.runQuery(
      internal.livestream.listLiveStreamsForViewerRefresh,
      {},
    );
    for (const stream of streams) {
      await ctx.runAction(internal.livestreamActions.getViewerCount, {
        channelArn: stream.channelArn,
        liveStreamId: stream.liveStreamId,
      });
    }
  },
});
