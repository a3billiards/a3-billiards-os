/** AWS IVS ingest hostname → RTMPS URL expected by the Broadcast SDK. */
export function toRtmpsIngestUrl(ingestEndpoint: string): string {
  const trimmed = ingestEndpoint.trim();
  if (trimmed.startsWith("rtmps://") || trimmed.startsWith("rtmp://")) {
    return trimmed.endsWith("/app") ? trimmed : `${trimmed.replace(/\/+$/, "")}/app`;
  }
  const host = trimmed.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `rtmps://${host}:443/app`;
}
