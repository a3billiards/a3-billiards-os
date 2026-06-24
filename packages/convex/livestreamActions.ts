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
  signIvsPlaybackToken,
  stopChannelStream,
} from "./model/livestreamIvs";

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
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const club = await ctx.runQuery(internal.livestream.getClubIvsFields, { clubId });
    if (!club?.ivsChannelArn) return { stopped: false as const };
    const stopped = await stopChannelStream(club.ivsChannelArn);
    return { stopped };
  },
});

export const getViewerCount = internalAction({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const club = await ctx.runQuery(internal.livestream.getClubIvsFields, { clubId });
    if (!club?.ivsChannelArn) return { viewerCount: 0 };

    const viewerCount = await fetchChannelViewerCount(club.ivsChannelArn);
    await ctx.runMutation(internal.livestream.updatePeakViewerCount, {
      clubId,
      viewerCount,
    });
    return { viewerCount };
  },
});

export const signPlaybackToken = internalAction({
  args: { channelArn: v.string() },
  handler: async (_ctx, { channelArn }) => {
    const token = signIvsPlaybackToken(channelArn);
    return { token };
  },
});
