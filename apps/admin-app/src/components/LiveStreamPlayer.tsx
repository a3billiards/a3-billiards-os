import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAction, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, spacing, typography, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import { MaterialIcons } from "@expo/vector-icons";

const TOKEN_REFRESH_MS = 45 * 60 * 1000;
const WAIT_FOR_BROADCAST_MS = 90_000;
const BROADCAST_POLL_MS = 3_000;
const PLAYBACK_RETRY_MS = 5_000;
const MAX_PLAYBACK_RETRIES = 8;

type PlayerPhase = "loading" | "waiting" | "playing" | "ended" | "error";

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

function isRecoverablePlaybackError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("offline") ||
    lower.includes("unavailable") ||
    lower.includes("404") ||
    lower.includes("could not") ||
    lower.includes("failed to load") ||
    lower.includes("network")
  );
}

export type LiveStreamPlayerProps = {
  liveStreamId: Id<"liveStreams">;
  clubName?: string;
  onClose: () => void;
  onSwitchStream?: (liveStreamId: Id<"liveStreams">, clubName: string) => void;
};

export function LiveStreamPlayer({
  liveStreamId,
  clubName,
  onClose,
  onSwitchStream,
}: LiveStreamPlayerProps): React.JSX.Element {
  const { t } = useTranslation();
  const getPlaybackToken = useAction(api.livestream.getPlaybackToken);
  const streamMeta = useQuery(api.livestream.getLiveStreamPublicMeta, { liveStreamId });
  const otherStreams = useQuery(api.livestream.getActiveStreamsPlatformWide);
  const playerRef = useRef<IvsPlayerRef | null>(null);
  const waitStartedAtRef = useRef<number | null>(null);
  const playbackRetryRef = useRef(0);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<PlayerPhase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const clearTimers = useCallback(() => {
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const fetchToken = useCallback(
    async (options?: { forRetry?: boolean; silent?: boolean }) => {
      if (!options?.silent) {
        clearTimers();
      }
      if (!options?.forRetry && !options?.silent) {
        waitStartedAtRef.current = Date.now();
        playbackRetryRef.current = 0;
        setPhase("loading");
        setStatusNote(null);
      }

      try {
        const { playbackUrl, token, isBroadcasting } = await getPlaybackToken({
          liveStreamId,
        });

        if (!isBroadcasting) {
          if (options?.silent) return;

          const startedAt = waitStartedAtRef.current ?? Date.now();
          if (Date.now() - startedAt >= WAIT_FOR_BROADCAST_MS) {
            setPhase("error");
            setStreamUrl(null);
            setErrorMessage(t("customerApp.streaming.broadcasterNotConnected"));
            return;
          }

          setPhase("waiting");
          setStreamUrl(null);
          setStatusNote(t("customerApp.streaming.waitingForClub"));
          waitTimerRef.current = setTimeout(() => {
            void fetchToken({ forRetry: true });
          }, BROADCAST_POLL_MS);
          return;
        }

        setStreamUrl(authorizedPlaybackUrl(playbackUrl, token));
        setPhase("playing");
        setStatusNote(null);
        setErrorMessage(null);
        playbackRetryRef.current = 0;
      } catch (e) {
        if (options?.silent) return;

        const parsed = parseConvexError(e as Error);
        if (parsed.code === "LIVESTREAM_004") {
          setPhase("ended");
          setStreamUrl(null);
          setErrorMessage(null);
        } else {
          setPhase("error");
          setStreamUrl(null);
          setErrorMessage(parsed.message);
        }
      }
    },
    [clearTimers, getPlaybackToken, liveStreamId, t],
  );

  const schedulePlaybackRetry = useCallback(
    (reason: string) => {
      if (playbackRetryRef.current >= MAX_PLAYBACK_RETRIES) {
        setPhase("error");
        setErrorMessage(reason);
        return;
      }

      playbackRetryRef.current += 1;
      setPhase("waiting");
      setStreamUrl(null);
      setStatusNote(t("customerApp.streaming.reconnecting"));
      retryTimerRef.current = setTimeout(() => {
        void fetchToken({ forRetry: true });
      }, PLAYBACK_RETRY_MS);
    },
    [fetchToken, t],
  );

  useEffect(() => {
    void fetchToken();
    return () => clearTimers();
  }, [clearTimers, fetchToken]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      void fetchToken({ silent: true });
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [phase, fetchToken]);

  if (!ivsPlayerModule) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{t("customerApp.streaming.playbackUnavailable")}</Text>
        <Text style={styles.meta}>{t("customerApp.streaming.devBuildRequired")}</Text>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>{t("customerApp.streaming.close")}</Text>
        </Pressable>
      </View>
    );
  }

  const IVSPlayer = ivsPlayerModule.default;

  return (
    <View style={styles.root}>
      {phase === "loading" || phase === "waiting" ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
          <Text style={styles.meta}>
            {statusNote ??
              (phase === "loading"
                ? t("customerApp.streaming.loadingStream")
                : t("customerApp.streaming.waitingBroadcast"))}
          </Text>
        </View>
      ) : null}

      {phase === "playing" && streamUrl ? (
        <IVSPlayer
          key={streamUrl}
          ref={playerRef}
          style={styles.player}
          streamUrl={streamUrl}
          autoplay
          loop={false}
          liveLowLatency
          resizeMode="aspectFit"
          muted={muted}
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
            if (isRecoverablePlaybackError(error)) {
              schedulePlaybackRetry(error);
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
            {phase === "ended"
              ? t("customerApp.streaming.streamEnded")
              : t("customerApp.streaming.couldNotPlay")}
          </Text>
          {errorMessage ? <Text style={styles.meta}>{errorMessage}</Text> : null}
          {phase === "error" ? (
            <Pressable style={styles.retryBtn} onPress={() => void fetchToken()}>
              <Text style={styles.retryBtnText}>{t("customerApp.streaming.retry")}</Text>
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
        {phase === "playing" && streamMeta ? (
          <Text style={styles.viewerBadge}>
            {t("customerApp.streaming.viewers", { count: streamMeta.viewerCount })}
          </Text>
        ) : null}
        {phase === "playing" ? (
          <Pressable
            style={styles.backBtn}
            onPress={() => setMuted((m) => !m)}
            hitSlop={12}
            accessibilityLabel={muted ? t("customerApp.streaming.unmute") : t("customerApp.streaming.mute")}
          >
            <MaterialIcons
              name={muted ? "volume-off" : "volume-up"}
              size={22}
              color="#fff"
            />
          </Pressable>
        ) : null}
      </View>

      {phase === "playing" && otherStreams && otherStreams.length > 1 ? (
        <View style={styles.otherStreamsWrap}>
          <Text style={styles.otherStreamsLabel}>{t("customerApp.streaming.otherLive")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {otherStreams
              .filter((s) => s.liveStreamId !== liveStreamId)
              .map((s) => (
                <Pressable
                  key={s.liveStreamId}
                  style={styles.otherStreamChip}
                  onPress={() =>
                    onSwitchStream?.(s.liveStreamId, s.clubName)
                  }
                >
                  <Text style={styles.otherStreamChipTitle} numberOfLines={1}>
                    {s.clubName}
                  </Text>
                  {s.tableLabel ? (
                    <Text style={styles.otherStreamChipMeta} numberOfLines={1}>
                      {s.tableLabel}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
          </ScrollView>
        </View>
      ) : null}
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
  viewerBadge: {
    ...typography.labelSmall,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: "hidden",
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
  otherStreamsWrap: {
    position: "absolute",
    bottom: spacing[6],
    left: 0,
    right: 0,
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  otherStreamsLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.85)",
  },
  otherStreamChip: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    maxWidth: 160,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  otherStreamChipTitle: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  otherStreamChipMeta: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginTop: 2,
  },
});
