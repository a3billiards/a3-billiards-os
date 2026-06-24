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
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

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
  activeStream: {
    liveStreamId: Id<"liveStreams">;
    title: string | null;
    tableLabel: string | null;
    viewerCount: number;
  } | null;
  onStartStream: (args: {
    title?: string;
    tableLabel?: string;
  }) => Promise<BroadcastCredentials>;
  onEndStream: () => Promise<void>;
  onRefreshViewerCount: () => Promise<number>;
};

export function LiveStreamBroadcastControls({
  activeStream,
  onStartStream,
  onEndStream,
  onRefreshViewerCount,
}: LiveStreamBroadcastControlsProps): React.JSX.Element {
  const cameraRef = useRef<IvsCameraRef | null>(null);
  const credentialsRef = useRef<BroadcastCredentials | null>(null);
  const intentionalEndRef = useRef(false);

  const [phase, setPhase] = useState<BroadcastPhase>("idle");
  const [title, setTitle] = useState(activeStream?.title ?? "");
  const [tableLabel, setTableLabel] = useState(activeStream?.tableLabel ?? "");
  const [viewerCount, setViewerCount] = useState(activeStream?.viewerCount ?? 0);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const remoteLiveOnly = Boolean(activeStream && !credentialsRef.current);

  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") return;
    const id = setInterval(() => {
      void onRefreshViewerCount()
        .then((count) => setViewerCount(count))
        .catch(() => undefined);
    }, 45_000);
    return () => clearInterval(id);
  }, [phase, onRefreshViewerCount]);

  const handleBroadcastState = useCallback(
    (stateStatus: string) => {
      if (stateStatus === "CONNECTED") {
        setPhase("live");
        setStatusNote(null);
        return;
      }
      if (stateStatus === "CONNECTING") {
        setPhase("starting");
        setStatusNote("Connecting to AWS IVS…");
        return;
      }
      if (stateStatus === "DISCONNECTED") {
        if (intentionalEndRef.current) {
          setPhase("idle");
          setStatusNote(null);
          return;
        }
        setPhase("reconnecting");
        setStatusNote(
          "Connection interrupted — reconnecting. Your stream stays live unless AWS ends it.",
        );
      }
    },
    [],
  );

  const goLive = useCallback(async () => {
    if (!ivsModule) {
      Alert.alert(
        "Dev build required",
        "Live broadcast needs a custom development build with the IVS native module. Expo Go is not supported.",
      );
      return;
    }
    setBusy(true);
    intentionalEndRef.current = false;
    setPhase("starting");
    setStatusNote("Starting stream…");
    try {
      const creds = await onStartStream({
        title: title.trim() || undefined,
        tableLabel: tableLabel.trim() || undefined,
      });
      credentialsRef.current = creds;
      cameraRef.current?.start({
        rtmpsUrl: creds.ingestEndpoint,
        streamKey: creds.streamKeyValue,
      });
      setPhase("live");
      setStatusNote(null);
      const count = await onRefreshViewerCount();
      setViewerCount(count);
    } catch (e) {
      setPhase("idle");
      setStatusNote(null);
      const parsed = parseConvexError(e as Error);
      Alert.alert(
        parsed.code === "LIVESTREAM_002" ? "Could not go live" : "Go live failed",
        parsed.message,
      );
    } finally {
      setBusy(false);
    }
  }, [onStartStream, onRefreshViewerCount, tableLabel, title]);

  const endLive = useCallback(async () => {
    setBusy(true);
    intentionalEndRef.current = true;
    try {
      if (credentialsRef.current) {
        cameraRef.current?.stop();
      }
      await onEndStream();
      credentialsRef.current = null;
      setPhase("idle");
      setStatusNote(null);
    } catch (e) {
      intentionalEndRef.current = false;
      Alert.alert("Could not end stream", parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [onEndStream]);

  if (!ivsModule) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Live broadcast unavailable</Text>
        <Text style={styles.meta}>
          Install a custom dev client build with the Amazon IVS Broadcast SDK. Expo Go
          cannot run this feature.
        </Text>
      </View>
    );
  }

  const { IVSBroadcastCameraView } = ivsModule;
  const isLive = phase === "live" || phase === "reconnecting";
  const creds = credentialsRef.current;

  if (remoteLiveOnly && !isLive) {
    return (
      <View style={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>Stream is live</Text>
          <Text style={styles.meta}>
            This club already has an active broadcast (another device or a previous
            session). End it here, or return to the device that started the stream.
          </Text>
          <Text style={styles.viewers}>Viewers (best effort): {viewerCount}</Text>
          <Pressable
            style={[styles.dangerBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => {
              Alert.alert(
                "End stream?",
                "This will stop the broadcast for all viewers.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "End stream", style: "destructive", onPress: () => void endLive() },
                ],
              );
            }}
          >
            <Text style={styles.dangerBtnText}>{busy ? "Ending…" : "End Stream"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.previewBox}>
        <IVSBroadcastCameraView
          ref={cameraRef}
          style={styles.preview}
          cameraPosition="back"
          configurationPreset="basicPortrait"
          rtmpsUrl={creds?.ingestEndpoint}
          streamKey={creds?.streamKeyValue}
          onBroadcastStateChanged={(stateStatus: string) =>
            handleBroadcastState(stateStatus)
          }
          onBroadcastError={(error: { isFatal?: boolean; detail?: string }) => {
            if (error.isFatal) {
              setStatusNote(error.detail ?? "Broadcast error");
            }
          }}
        />
        {isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>
              {phase === "reconnecting" ? "RECONNECTING" : "LIVE"}
            </Text>
          </View>
        ) : null}
      </View>

      {statusNote ? <Text style={styles.statusNote}>{statusNote}</Text> : null}

      {isLive ? (
        <Text style={styles.viewers}>
          Viewers (best effort): {viewerCount}
        </Text>
      ) : null}

      {!isLive ? (
        <>
          <Text style={styles.label}>Title (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Friday Night Final"
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            editable={!busy}
          />
          <Text style={styles.label}>Table label (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Table 4"
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
              <Text style={styles.primaryBtnText}>Go Live</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.dangerBtn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => {
            Alert.alert(
              "End stream?",
              "This will stop the broadcast and remove it from the customer Live tab.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "End stream", style: "destructive", onPress: () => void endLive() },
              ],
            );
          }}
        >
          <Text style={styles.dangerBtnText}>{busy ? "Ending…" : "End Stream"}</Text>
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
});
