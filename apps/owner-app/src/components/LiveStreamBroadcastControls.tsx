import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import {
  hasBroadcastPermissions,
  promptOpenSettings,
  requestBroadcastPermissions,
} from "../lib/broadcastPermissions";
import { toRtmpsIngestUrl } from "../lib/ivsIngest";
import {
  STREAM_QUALITY_OPTIONS,
  streamQualityConfig,
  type StreamQualityId,
} from "../lib/streamQuality";

type BroadcastPhase = "idle" | "starting" | "live" | "reconnecting";

type BroadcastCredentials = {
  ingestEndpoint: string;
  streamKeyValue: string;
  liveStreamId: Id<"liveStreams">;
};

type IvsCameraRef = {
  start: (options?: { rtmpsUrl?: string; streamKey?: string }) => void;
  stop: () => void;
};

type IvsModule = {
  IVSBroadcastCameraView: ComponentType<Record<string, unknown>>;
};

function loadIvsModule(): IvsModule | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("amazon-ivs-react-native-broadcast") as IvsModule;
  } catch {
    return null;
  }
}

const ivsModule = loadIvsModule();

export type LiveStreamBroadcastControlsProps = {
  clubId: Id<"clubs">;
  roleId: Id<"staffRoles"> | undefined;
  tables?: { _id: Id<"tables">; label: string }[];
  activeStream: {
    liveStreamId: Id<"liveStreams">;
    title: string | null;
    tableLabel: string | null;
    viewerCount: number;
  } | null;
  clubLiveStreams?: {
    liveStreamId: Id<"liveStreams">;
    tableId: Id<"tables"> | null;
    tableLabel: string | null;
    title: string | null;
  }[];
  onStartStream: (args: {
    title?: string;
    tableLabel?: string;
    tableId?: Id<"tables">;
  }) => Promise<BroadcastCredentials>;
  onEndStream: (liveStreamId: Id<"liveStreams">) => Promise<void>;
  onRefreshViewerCount: (liveStreamId: Id<"liveStreams">) => Promise<number>;
};

export function LiveStreamBroadcastControls({
  activeStream,
  tables,
  clubLiveStreams,
  onStartStream,
  onEndStream,
  onRefreshViewerCount,
}: LiveStreamBroadcastControlsProps): React.JSX.Element {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const cameraRef = useRef<IvsCameraRef | null>(null);
  const credentialsRef = useRef<BroadcastCredentials | null>(null);
  const intentionalEndRef = useRef(false);

  const [phase, setPhase] = useState<BroadcastPhase>("idle");
  const [previewAllowed, setPreviewAllowed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [title, setTitle] = useState(activeStream?.title ?? "");
  const [tableLabel, setTableLabel] = useState(activeStream?.tableLabel ?? "");
  const [viewerCount, setViewerCount] = useState(activeStream?.viewerCount ?? 0);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<"front" | "back">("back");
  const [selectedTableId, setSelectedTableId] = useState<Id<"tables"> | null>(null);
  const [streamQuality, setStreamQuality] = useState<StreamQualityId>("720p");

  useEffect(() => {
    if (activeStream) {
      setViewerCount(activeStream.viewerCount);
      if (credentialsRef.current && (phase === "idle" || phase === "reconnecting")) {
        setPhase("live");
      }
    } else if (!intentionalEndRef.current && phase !== "starting") {
      setPhase("idle");
      credentialsRef.current = null;
    }
  }, [activeStream, phase]);

  const isLive = phase === "live" || phase === "reconnecting";
  const wantsCamera = isFocused || isLive;
  const mountCamera = wantsCamera && previewAllowed && cameraReady;

  useEffect(() => {
    if (!wantsCamera) {
      setPreviewAllowed(false);
      setCameraReady(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const granted = await hasBroadcastPermissions();
      if (cancelled) return;
      if (granted) {
        setPreviewAllowed(true);
        return;
      }
      const result = await requestBroadcastPermissions();
      if (cancelled) return;
      setPreviewAllowed(result.granted);
      if (!result.granted) {
        setStatusNote(result.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wantsCamera]);

  useEffect(() => {
    if (!previewAllowed || !wantsCamera) {
      setCameraReady(false);
      return;
    }
    const timer = setTimeout(() => setCameraReady(true), 400);
    return () => {
      clearTimeout(timer);
      setCameraReady(false);
    };
  }, [previewAllowed, wantsCamera]);

  const remoteLiveOnly = Boolean(activeStream && !credentialsRef.current);

  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") return;
    const streamId =
      credentialsRef.current?.liveStreamId ?? activeStream?.liveStreamId;
    if (!streamId) return;
    const id = setInterval(() => {
      void onRefreshViewerCount(streamId)
        .then((count) => setViewerCount(count))
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [phase, onRefreshViewerCount, activeStream?.liveStreamId]);

  const handleBroadcastState = useCallback(
    (stateStatus: string) => {
      if (stateStatus === "CONNECTED") {
        setPhase("live");
        setStatusNote(null);
        const streamId =
          credentialsRef.current?.liveStreamId ?? activeStream?.liveStreamId;
        if (streamId) {
          void onRefreshViewerCount(streamId)
            .then((count) => setViewerCount(count))
            .catch(() => undefined);
        }
        return;
      }
      if (stateStatus === "CONNECTING") {
        setPhase("starting");
        setStatusNote(t("ownerApp.livestream.connectingIvs"));
        return;
      }
      if (stateStatus === "DISCONNECTED") {
        if (intentionalEndRef.current) {
          setPhase("idle");
          setStatusNote(null);
          return;
        }
        setPhase("reconnecting");
        setStatusNote(t("ownerApp.livestream.connectionInterrupted"));
      }
    },
    [onRefreshViewerCount, activeStream, t],
  );

  const goLive = useCallback(async () => {
    if (!ivsModule) {
      Alert.alert(
        t("ownerApp.livestream.devBuildRequiredTitle"),
        t("ownerApp.livestream.devBuildRequiredBody"),
      );
      return;
    }

    const permission = await requestBroadcastPermissions();
    if (!permission.granted) {
      promptOpenSettings(permission.message, {
        title: t("ownerApp.livestream.permissionRequired"),
        notNow: t("ownerApp.livestream.notNow"),
        openSettings: t("ownerApp.livestream.openSettings"),
      });
      return;
    }

    setBusy(true);
    intentionalEndRef.current = false;
    setPhase("starting");
    setStatusNote(t("ownerApp.livestream.startingStream"));
    try {
      const pickedTable = tables?.find((t) => t._id === selectedTableId);
      const creds = await onStartStream({
        title: title.trim() || undefined,
        tableLabel: tableLabel.trim() || pickedTable?.label || undefined,
        tableId: selectedTableId ?? undefined,
      });
      credentialsRef.current = creds;
      setStatusNote(t("ownerApp.livestream.connectingCamera"));
      cameraRef.current?.start({
        rtmpsUrl: toRtmpsIngestUrl(creds.ingestEndpoint),
        streamKey: creds.streamKeyValue,
      });
    } catch (e) {
      setPhase("idle");
      setStatusNote(null);
      credentialsRef.current = null;
      const parsed = parseConvexError(e as Error);
      Alert.alert(
        parsed.code === "LIVESTREAM_002"
          ? t("ownerApp.livestream.couldNotGoLive")
          : t("ownerApp.livestream.goLiveFailed"),
        parsed.message,
      );
    } finally {
      setBusy(false);
    }
  }, [onStartStream, tableLabel, title, t]);

  const endLive = useCallback(async () => {
    const streamId =
      credentialsRef.current?.liveStreamId ?? activeStream?.liveStreamId;
    if (!streamId) return;
    setBusy(true);
    intentionalEndRef.current = true;
    try {
      if (credentialsRef.current) {
        cameraRef.current?.stop();
      }
      await onEndStream(streamId);
      credentialsRef.current = null;
      setPhase("idle");
      setStatusNote(null);
    } catch (e) {
      intentionalEndRef.current = false;
      Alert.alert(t("common.error"), parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [onEndStream, t]);

  if (!ivsModule) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t("ownerApp.livestream.unavailableTitle")}</Text>
        <Text style={styles.meta}>{t("ownerApp.livestream.unavailableBody")}</Text>
      </View>
    );
  }

  const { IVSBroadcastCameraView } = ivsModule;
  const quality = streamQualityConfig(streamQuality);
  const cameraViewProps = quality.configurationPreset
    ? { configurationPreset: quality.configurationPreset }
    : { videoConfig: quality.videoConfig };

  if (remoteLiveOnly && !isLive) {
    return (
      <View style={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("ownerApp.livestream.streamLiveTitle")}</Text>
          <Text style={styles.meta}>{t("ownerApp.livestream.streamLiveBody")}</Text>
          <Text style={styles.viewers}>
            {t("ownerApp.livestream.viewers", { count: viewerCount })}
          </Text>
          <Pressable
            style={[styles.dangerBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => {
              Alert.alert(
                t("ownerApp.livestream.endStreamTitle"),
                t("ownerApp.livestream.endStreamBodyAll"),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("ownerApp.livestream.endStream"),
                    style: "destructive",
                    onPress: () => void endLive(),
                  },
                ],
              );
            }}
          >
            <Text style={styles.dangerBtnText}>
              {busy ? t("ownerApp.livestream.ending") : t("ownerApp.livestream.endStream")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.previewBox}>
        {mountCamera ? (
          <IVSBroadcastCameraView
            key={streamQuality}
            ref={cameraRef}
            style={styles.preview}
            cameraPosition={cameraPosition}
            isMuted={micMuted}
            cameraPreviewAspectMode="fit"
            {...cameraViewProps}
            onBroadcastStateChanged={(stateStatus: string) =>
              handleBroadcastState(stateStatus)
            }
            onBroadcastError={(error: { isFatal?: boolean; detail?: string }) => {
              if (error.isFatal) {
                setStatusNote(error.detail ?? t("ownerApp.livestream.broadcastError"));
              }
            }}
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>
              {!previewAllowed
                ? t("ownerApp.livestream.allowCameraMic")
                : wantsCamera
                  ? t("ownerApp.livestream.startingCamera")
                  : t("ownerApp.livestream.cameraPaused")}
            </Text>
          </View>
        )}
        {isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>
              {phase === "reconnecting"
                ? t("ownerApp.livestream.reconnectingBadge")
                : t("ownerApp.livestream.liveBadge")}
            </Text>
          </View>
        ) : null}
      </View>

      {statusNote ? <Text style={styles.statusNote}>{statusNote}</Text> : null}

      {isLive ? (
        <View style={styles.liveControlsRow}>
          <Text style={styles.viewers}>
            {t("ownerApp.livestream.viewers", { count: viewerCount })}
          </Text>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setMicMuted((m) => !m)}
            accessibilityLabel={
              micMuted ? t("ownerApp.livestream.micUnmute") : t("ownerApp.livestream.micMute")
            }
          >
            <Text style={styles.iconBtnText}>{micMuted ? "🔇" : "🎤"}</Text>
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() =>
              setCameraPosition((p) => (p === "back" ? "front" : "back"))
            }
            accessibilityLabel={t("ownerApp.livestream.flipCamera")}
          >
            <Text style={styles.iconBtnText}>🔄</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLive ? (
        <>
          {tables && tables.length > 0 ? (
            <>
              <Text style={styles.label}>{t("ownerApp.livestream.selectTable")}</Text>
              <View style={styles.tableChipRow}>
                {tables.map((tbl) => {
                  const on = selectedTableId === tbl._id;
                  const taken = clubLiveStreams?.some(
                    (s) => s.tableId === tbl._id || (s.tableId == null && s.tableLabel === tbl.label),
                  );
                  return (
                    <Pressable
                      key={tbl._id}
                      disabled={taken}
                      onPress={() =>
                        setSelectedTableId((prev) =>
                          prev === tbl._id ? null : tbl._id,
                        )
                      }
                      style={[styles.tableChip, on && styles.tableChipOn, taken && styles.tableChipDisabled]}
                    >
                      <Text style={[styles.tableChipText, on && styles.tableChipTextOn]}>
                        {tbl.label}
                        {taken ? " · LIVE" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={styles.label}>{t("ownerApp.livestream.streamQuality")}</Text>
          <View style={styles.tableChipRow}>
            {STREAM_QUALITY_OPTIONS.map((opt) => {
              const on = streamQuality === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  disabled={isLive}
                  onPress={() => setStreamQuality(opt.id)}
                  style={[styles.tableChip, on && styles.tableChipOn, isLive && styles.tableChipDisabled]}
                >
                  <Text style={[styles.tableChipText, on && styles.tableChipTextOn]}>
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {isLive ? (
            <Text style={styles.statusNote}>{t("ownerApp.livestream.qualityChangeHint")}</Text>
          ) : null}
          <Text style={styles.label}>{t("ownerApp.livestream.titleOptional")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("ownerApp.livestream.placeholderTitle")}
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            editable={!busy}
          />
          <Text style={styles.label}>{t("ownerApp.livestream.tableLabelOptional")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("ownerApp.livestream.placeholderTable")}
            placeholderTextColor={colors.text.tertiary}
            value={tableLabel}
            onChangeText={setTableLabel}
            editable={!busy}
          />
          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void goLive()}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg.primary} />
            ) : (
              <Text style={styles.primaryBtnText}>{t("ownerApp.livestream.goLive")}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.dangerBtn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => {
            Alert.alert(
              t("ownerApp.livestream.endStreamTitle"),
              t("ownerApp.livestream.endStreamBodyCustomer"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("ownerApp.livestream.endStream"),
                  style: "destructive",
                  onPress: () => void endLive(),
                },
              ],
            );
          }}
        >
          <Text style={styles.dangerBtnText}>
            {busy ? t("ownerApp.livestream.ending") : t("ownerApp.livestream.endStream")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing[2],
  },
  title: { ...typography.heading4, color: colors.text.primary },
  meta: { ...typography.bodySmall, color: colors.text.secondary },
  previewBox: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 420,
    backgroundColor: "#000",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  preview: { flex: 1 },
  previewPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  previewPlaceholderText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  liveBadge: {
    position: "absolute",
    top: spacing[2],
    left: spacing[2],
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  liveBadgeText: {
    ...typography.labelSmall,
    color: "#fff",
    fontWeight: "700",
  },
  statusNote: { ...typography.bodySmall, color: colors.accent.amber },
  viewers: { ...typography.body, color: colors.text.primary },
  label: { ...typography.labelSmall, color: colors.text.secondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    backgroundColor: colors.bg.tertiary,
  },
  primaryBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...typography.button, color: colors.bg.primary },
  dangerBtn: {
    backgroundColor: colors.status.error,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: { ...typography.button, color: "#fff" },
  btnDisabled: { opacity: 0.55 },
  liveControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  iconBtnText: { fontSize: 18 },
  tableChipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  tableChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: layout.touchTarget,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
  },
  tableChipOn: {
    borderColor: colors.accent.green,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  tableChipDisabled: { opacity: 0.45 },
  tableChipText: { ...typography.bodySmall, color: colors.text.secondary },
  tableChipTextOn: { color: colors.accent.green, fontWeight: "600" },
});
