import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { MaterialIcons } from "@expo/vector-icons";

export type AdminLiveStreamRow = {
  liveStreamId: Id<"liveStreams">;
  clubId: Id<"clubs">;
  clubName: string;
  clubBannerImageUrl: string | null;
  title: string | null;
  tableLabel: string | null;
  startedAt: number;
  viewerCount: number;
  startedByUserId: Id<"users">;
  startedByName: string;
};

type Props = {
  streams: AdminLiveStreamRow[] | undefined;
  onForceEnd: (args: { liveStreamId: Id<"liveStreams">; reason: string }) => Promise<void>;
  bottomInset: number;
};

function formatStartedAt(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function LiveStreamModerationList({
  streams,
  onForceEnd,
  bottomInset,
}: Props): React.JSX.Element {
  const [target, setTarget] = useState<AdminLiveStreamRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submitForceEnd = async () => {
    if (!target) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert("Reason required", "Enter a short reason before force-ending.");
      return;
    }
    setBusy(true);
    try {
      await onForceEnd({ liveStreamId: target.liveStreamId, reason: trimmed });
      setTarget(null);
      setReason("");
    } catch (e) {
      Alert.alert("Force-end failed", parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (streams === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.status.info} />
      </View>
    );
  }

  if (streams.length === 0) {
    return (
      <View style={[styles.empty, { paddingBottom: bottomInset }]}>
        <MaterialIcons name="videocam-off" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyTitle}>No active streams</Text>
        <Text style={styles.emptyMeta}>All clubs are offline right now.</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={streams}
        keyExtractor={(item) => item.liveStreamId}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
        renderItem={({ item }) => {
          const meta = [item.title, item.tableLabel].filter(Boolean).join(" · ");
          return (
            <View style={styles.row}>
              {item.clubBannerImageUrl ? (
                <Image source={{ uri: item.clubBannerImageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbLetter}>{item.clubName.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.clubName} numberOfLines={1}>
                    {item.clubName}
                  </Text>
                  <View style={styles.livePill}>
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                </View>
                {meta ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {meta}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  Started by {item.startedByName} · {formatStartedAt(item.startedAt)}
                </Text>
                <Text style={styles.meta}>
                  Viewers (best effort): {item.viewerCount}
                </Text>
                <Pressable
                  style={styles.forceBtn}
                  onPress={() => {
                    setTarget(item);
                    setReason("");
                  }}
                >
                  <MaterialIcons name="block" size={16} color="#fff" />
                  <Text style={styles.forceBtnText}>Force end</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={target !== null} transparent animationType="fade">
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Force-end stream?</Text>
            <Text style={styles.modalMeta}>
              This immediately stops the broadcast at AWS IVS and notifies the club owner.
            </Text>
            <Text style={styles.label}>Reason (required)</Text>
            <TextInput
              style={styles.input}
              placeholder="Policy violation, inappropriate content…"
              placeholderTextColor={colors.text.tertiary}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
              editable={!busy}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                disabled={busy}
                onPress={() => {
                  setTarget(null);
                  setReason("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={() => void submitForceEnd()}
              >
                <Text style={styles.confirmBtnText}>{busy ? "Ending…" : "Force end"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  emptyTitle: { ...typography.heading4, color: colors.text.primary },
  emptyMeta: { ...typography.bodySmall, color: colors.text.secondary, textAlign: "center" },
  list: { padding: spacing[4], gap: spacing[3] },
  row: {
    flexDirection: "row",
    gap: spacing[3],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
  },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  thumbPlaceholder: {
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbLetter: { ...typography.heading4, color: colors.text.tertiary },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  clubName: { flex: 1, ...typography.heading4, color: colors.text.primary },
  livePill: {
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  livePillText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  meta: { ...typography.bodySmall, color: colors.text.secondary },
  forceBtn: {
    marginTop: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    alignSelf: "flex-start",
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    minHeight: layout.touchTarget - 8,
  },
  forceBtnText: { ...typography.button, color: "#fff", fontSize: 13 },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalTitle: { ...typography.heading3, color: colors.text.primary },
  modalMeta: { ...typography.bodySmall, color: colors.text.secondary },
  label: { ...typography.labelSmall, color: colors.text.secondary, marginTop: spacing[2] },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing[3],
    minHeight: 88,
    color: colors.text.primary,
    backgroundColor: colors.bg.tertiary,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[3] },
  cancelBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelBtnText: { ...typography.button, color: colors.text.secondary },
  confirmBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.status.error,
  },
  confirmBtnText: { ...typography.button, color: "#fff" },
  btnDisabled: { opacity: 0.55 },
});
