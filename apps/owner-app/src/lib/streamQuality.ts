export type StreamQualityId = "480p" | "720p" | "1080p";

export type StreamQualityOption = {
  id: StreamQualityId;
  labelKey:
    | "ownerApp.livestream.quality480"
    | "ownerApp.livestream.quality720"
    | "ownerApp.livestream.quality1080";
  configurationPreset?: "basicPortrait" | "standardPortrait";
  videoConfig?: {
    width: number;
    height: number;
    bitrate: number;
    targetFrameRate: number;
    keyframeInterval: number;
    isAutoBitrate: boolean;
    maxBitrate: number;
    minBitrate: number;
  };
};

export const STREAM_QUALITY_OPTIONS: StreamQualityOption[] = [
  {
    id: "480p",
    labelKey: "ownerApp.livestream.quality480",
    configurationPreset: "basicPortrait",
  },
  {
    id: "720p",
    labelKey: "ownerApp.livestream.quality720",
    videoConfig: {
      width: 720,
      height: 1280,
      bitrate: 2_500_000,
      targetFrameRate: 30,
      keyframeInterval: 2,
      isAutoBitrate: true,
      maxBitrate: 4_500_000,
      minBitrate: 800_000,
    },
  },
  {
    id: "1080p",
    labelKey: "ownerApp.livestream.quality1080",
    configurationPreset: "standardPortrait",
  },
];

export function streamQualityConfig(id: StreamQualityId): StreamQualityOption {
  return STREAM_QUALITY_OPTIONS.find((o) => o.id === id) ?? STREAM_QUALITY_OPTIONS[1]!;
}
