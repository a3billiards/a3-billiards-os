"use node";

/**
 * AWS IVS client helpers — server-only (internalActions). Credentials never leave this module.
 */

import {
  CreateChannelCommand,
  GetStreamCommand,
  GetStreamKeyCommand,
  IvsClient,
  type IvsClientConfig,
  StopStreamCommand,
} from "@aws-sdk/client-ivs";
import jwt from "jsonwebtoken";

const TOKEN_TTL_SECONDS = 3600;

function wrapIvsError(err: unknown): never {
  const detail = err instanceof Error ? err.message : String(err);
  throw new Error(`LIVESTREAM_002: AWS IVS API call failed (${detail})`);
}

function normalizePem(pem: string): string {
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

export function getIvsClient(): IvsClient {
  const region = process.env.AWS_IVS_REGION?.trim();
  const accessKeyId = process.env.AWS_IVS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_IVS_SECRET_ACCESS_KEY?.trim();
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("LIVESTREAM_002: AWS IVS credentials are not configured");
  }
  const config: IvsClientConfig = {
    region,
    credentials: { accessKeyId, secretAccessKey },
  };
  return new IvsClient(config);
}

export async function provisionStreamIvsChannel(uniqueLabel: string): Promise<{
  ivsChannelArn: string;
  ivsIngestEndpoint: string;
  ivsStreamKeyArn: string;
  ivsPlaybackUrl: string;
}> {
  const client = getIvsClient();
  try {
    const channelRes = await client.send(
      new CreateChannelCommand({
        name: `a3-stream-${uniqueLabel}`.slice(0, 128),
        authorized: true,
        latencyMode: "LOW",
        type: "STANDARD",
      }),
    );
    const channel = channelRes.channel;
    const streamKey = channelRes.streamKey;
    if (!channel?.arn || !channel.ingestEndpoint || !channel.playbackUrl) {
      throw new Error("CreateChannel returned incomplete channel data");
    }
    if (!streamKey?.arn) {
      throw new Error("CreateChannel returned no stream key");
    }
    return {
      ivsChannelArn: channel.arn,
      ivsIngestEndpoint: channel.ingestEndpoint,
      ivsStreamKeyArn: streamKey.arn,
      ivsPlaybackUrl: channel.playbackUrl,
    };
  } catch (err) {
    wrapIvsError(err);
  }
}

export async function provisionClubIvsChannel(clubId: string): Promise<{
  ivsChannelArn: string;
  ivsIngestEndpoint: string;
  ivsStreamKeyArn: string;
  ivsPlaybackUrl: string;
}> {
  const client = getIvsClient();
  try {
    // CreateChannelCommand returns the channel AND its auto-created stream key
    // in one response. Never call CreateStreamKey separately — IVS only allows
    // one key per channel (quota = 1) and listing requires a separate IAM
    // permission. Using the key from the CreateChannel response avoids both.
    const channelRes = await client.send(
      new CreateChannelCommand({
        name: `a3-club-${clubId}`.slice(0, 128),
        authorized: true,
        latencyMode: "LOW",
        type: "STANDARD",
      }),
    );
    const channel = channelRes.channel;
    const streamKey = channelRes.streamKey;
    if (!channel?.arn || !channel.ingestEndpoint || !channel.playbackUrl) {
      throw new Error("CreateChannel returned incomplete channel data");
    }
    if (!streamKey?.arn) {
      throw new Error("CreateChannel returned no stream key");
    }
    return {
      ivsChannelArn: channel.arn,
      ivsIngestEndpoint: channel.ingestEndpoint,
      ivsStreamKeyArn: streamKey.arn,
      ivsPlaybackUrl: channel.playbackUrl,
    };
  } catch (err) {
    wrapIvsError(err);
  }
}

export async function fetchStreamKeyValue(ivsStreamKeyArn: string): Promise<string> {
  if (!ivsStreamKeyArn.trim()) {
    throw new Error("missing stream key ARN");
  }
  const client = getIvsClient();
  try {
    const res = await client.send(new GetStreamKeyCommand({ arn: ivsStreamKeyArn }));
    const value = res.streamKey?.value;
    if (!value) {
      throw new Error("GetStreamKey returned no value");
    }
    return value;
  } catch (err) {
    wrapIvsError(err);
  }
}

export async function stopChannelStream(channelArn: string): Promise<boolean> {
  if (!channelArn.trim()) return false;
  const client = getIvsClient();
  try {
    await client.send(new StopStreamCommand({ channelArn }));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Stream may already be offline after owner disconnect — not a hard failure.
    if (
      message.includes("ChannelNotBroadcasting") ||
      message.includes("ResourceNotFound") ||
      message.includes("not currently online") ||
      message.includes("StreamUnavailable") ||
      message.includes("NotFoundException")
    ) {
      return false;
    }
    wrapIvsError(err);
  }
}

export async function isChannelBroadcasting(channelArn: string): Promise<boolean> {
  if (!channelArn.trim()) return false;
  const client = getIvsClient();
  try {
    const res = await client.send(new GetStreamCommand({ channelArn }));
    return Boolean(res.stream);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ChannelNotBroadcasting") ||
      message.includes("ResourceNotFound") ||
      message.includes("not currently online") ||
      message.includes("StreamUnavailable")
    ) {
      return false;
    }
    wrapIvsError(err);
  }
}

export async function fetchChannelViewerCount(channelArn: string): Promise<number> {
  if (!channelArn.trim()) return 0;
  const client = getIvsClient();
  try {
    const res = await client.send(new GetStreamCommand({ channelArn }));
    return res.stream?.viewerCount ?? 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ChannelNotBroadcasting") ||
      message.includes("ResourceNotFound") ||
      message.includes("not currently online") ||
      message.includes("StreamUnavailable")
    ) {
      return 0;
    }
    wrapIvsError(err);
  }
}

export function signIvsPlaybackToken(channelArn: string): string {
  const keyPairId = process.env.AWS_IVS_PLAYBACK_AUTH_KEY_PAIR_ID?.trim();
  const privateKeyRaw = process.env.AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY?.trim();
  if (!keyPairId || !privateKeyRaw) {
    throw new Error("LIVESTREAM_002: Playback authorization keys are not configured");
  }
  if (!channelArn.trim()) {
    throw new Error("missing channel ARN");
  }

  const privateKey = normalizePem(privateKeyRaw);
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  try {
    return jwt.sign(
      {
        "aws:channel-arn": channelArn,
        "aws:access-control-allow-origin": "*",
        exp,
      },
      privateKey,
      {
        algorithm: "ES384",
        keyid: keyPairId,
      },
    );
  } catch (err) {
    wrapIvsError(err);
  }
}

export { TOKEN_TTL_SECONDS };
