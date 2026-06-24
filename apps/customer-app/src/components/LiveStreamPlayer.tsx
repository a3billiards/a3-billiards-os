import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { MaterialIcons } from "@expo/vector-icons";

const TOKEN_REFRESH_MS = 45 * 60 * 1000;

type IvsPlayerRef = {
  play: () => void;
  pause: () => void;
};

type IvsPlayerModule = {
  default: ComponentType<Record<string, unknown>>;
};

function loadIvsPlayer(): IvsPlayerModule | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { default: require("amazon-ivs-react-native-player").default };
  } catch {
    return null;
  }
}

const ivsPlayerModule = loadIvsPlayer();

function authorizedPlaybackUrl(playbackUrl: string, token: string): string {
  const sep = playbackUrl.includes("?") ? "&" : "?";
  return `${playbackUrl}${sep}token=${encodeURIComponent(token)}`;
}

export type LiveStreamPlayerProps = {
  liveStreamId: Id<"liveStreams">;
  clubName?: string;
  onClose: () => void;
};

export function LiveStreamPlayer({
  liveStreamId,
  clubName,
  onClose,
}: LiveStreamPlayerProps): React.JSX.Element {
  const getPlaybackToken = useAction(api.livestream.getPlaybackToken);
  const playerRef = useRef<IvsPlayerRef | null>(null);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "playing" | "ended" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      const { playbackUrl, token } = await getPlaybackToken({ liveStreamId });
      setStreamUrl(authorizedPlaybackUrl(playbackUrl, token));
      setPhase("playing");
      setErrorMessage(null);
    } catch (e) {
      const parsed = parseConvexError(e as Error);
      if (parsed.code === "LIVESTREAM_004") {
        setPhase("ended");
        setErrorMessage(null);
      } else {
        setPhase("error");
        setErrorMessage(parsed.message);
      }
    }
  }, [getPlaybackToken, liveStreamId]);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      void fetchToken();
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [phase, fetchToken]);

  if (!ivsPlayerModule) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Playback unavailable</Text>
        <Text style={styles.meta}>
          Watch Live requires a custom dev build with the Amazon IVS Player SDK. Expo Go
          is not supported.
        </Text>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const IVSPlayer = ivsPlayerModule.default;

  return (
    <View style={styles.root}>
      {phase === "loading" ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
          <Text style={styles.meta}>Loading stream…</Text>
        </View>
      ) : null}

      {phase === "playing" && streamUrl ? (
        <IVSPlayer
          ref={playerRef}
          style={styles.player}
          streamUrl={streamUrl}
          autoplay
          loop={false}
          liveLowLatency
          resizeMode="aspectFit"
          onPlayerStateChange={(state: string) => {
            if (state === "Ended" || state === "Idle") {
              setPhase("ended");
            }
          }}
          onError={(error: string) => {
            if (error.toLowerCase().includes("ended")) {
              setPhase("ended");
              return;
            }
            setPhase("error");
            setErrorMessage(error);
          }}
        />
      ) : null}

      {(phase === "ended" || phase === "error") && (
        <View style={styles.overlay}>
          <MaterialIcons
            name={phase === "ended" ? "videocam-off" : "error-outline"}
            size={48}
            color={colors.text.secondary}
          />
          <Text style={styles.title}>
            {phase === "ended" ? "This stream has ended" : "Could not play stream"}
          </Text>
          {errorMessage ? <Text style={styles.meta}>{errorMessage}</Text> : null}
          {phase === "error" ? (
            <Pressable style={styles.retryBtn} onPress={() => void fetchToken()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={onClose} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        {clubName ? (
          <Text style={styles.topTitle} numberOfLines={1}>
            {clubName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  player: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
    gap: spacing[3],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[3],
  },
  topBar: {
    position: "absolute",
    top: spacing[12],
    left: spacing[4],
    right: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  backBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: layout.touchTarget / 2,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    ...typography.heading4,
    color: "#fff",
  },
  title: { ...typography.heading3, color: colors.text.primary, textAlign: "center" },
  meta: { ...typography.bodySmall, color: colors.text.secondary, textAlign: "center" },
  closeBtn: {
    marginTop: spacing[4],
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: 8,
  },
  closeBtnText: { ...typography.button, color: colors.bg.primary },
  retryBtn: {
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: 8,
  },
  retryBtnText: { ...typography.button, color: colors.bg.primary },
});
