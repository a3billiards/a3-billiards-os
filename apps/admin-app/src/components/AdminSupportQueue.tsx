import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, spacing, typography, radius, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useTranslation, getCurrentLanguage } from "@a3/i18n";
import { MaterialIcons } from "@expo/vector-icons";

type Filter = "active" | "open" | "in_progress" | "resolved";

type SupportRow = {
  _id: Id<"supportRequests">;
  userId: Id<"users">;
  audience: "customer" | "owner";
  category: string;
  subject: string;
  message: string;
  status: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  adminNotes?: string;
  createdAt: number;
};

function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function AdminSupportQueue({
  bottomInset,
}: {
  bottomInset: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("active");
  const [target, setTarget] = useState<SupportRow | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useQuery(api.supportRequests.listSupportRequestsForAdmin, {
    statusFilter: filter,
  });
  const update = useMutation(api.supportRequests.adminUpdateSupportRequest);

  const openDetail = (row: SupportRow) => {
    setTarget(row);
    setNotes(row.adminNotes ?? "");
  };

  const applyStatus = async (status: "in_progress" | "resolved" | "closed") => {
    if (!target) return;
    setBusy(true);
    try {
      await update({
        requestId: target._id,
        status,
        adminNotes: notes.trim() || undefined,
      });
      setTarget(null);
      Alert.alert(t("adminApp.support.updated"));
    } catch (e) {
      Alert.alert(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "active", label: t("adminApp.support.filterActive") },
    { id: "open", label: t("adminApp.support.filterOpen") },
    { id: "in_progress", label: t("adminApp.support.filterInProgress") },
    { id: "resolved", label: t("adminApp.support.filterResolved") },
  ];

  if (rows === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.status.info} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="inbox" size={48} color={colors.text.tertiary} />
          <Text style={styles.empty}>{t("adminApp.support.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={rows as SupportRow[]}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: bottomInset, gap: spacing[3] }}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openDetail(item)}>
              <View style={styles.cardTop}>
                <Text style={styles.subject} numberOfLines={2}>
                  {item.subject}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {t(`adminApp.support.statuses.${item.status as "open"}`)}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.userName} ·{" "}
                {item.audience === "customer"
                  ? t("adminApp.support.fromCustomer")
                  : t("adminApp.support.fromOwner")}{" "}
                · {formatWhen(item.createdAt)}
              </Text>
              <Text style={styles.preview} numberOfLines={2}>
                {item.message}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={target !== null} transparent animationType="slide">
        <Pressable style={styles.modalScrim} onPress={() => !busy && setTarget(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {target ? (
              <>
                <Text style={styles.modalTitle}>{target.subject}</Text>
                <Text style={styles.modalMeta}>
                  {target.userName}
                  {target.userPhone ? ` · ${target.userPhone}` : ""}
                  {target.userEmail ? ` · ${target.userEmail}` : ""}
                </Text>
                <Text style={styles.modalBody}>{target.message}</Text>
                <Text style={styles.fieldLabel}>{t("adminApp.support.adminNotesLabel")}</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("adminApp.support.adminNotesPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  maxLength={2000}
                />
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => {
                    setTarget(null);
                    router.push(`/user/${target.userId}` as never);
                  }}
                >
                  <Text style={styles.linkBtnText}>{t("adminApp.support.viewUser")}</Text>
                </Pressable>
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.actionBtn}
                    disabled={busy}
                    onPress={() => void applyStatus("in_progress")}
                  >
                    <Text style={styles.actionBtnText}>{t("adminApp.support.markInProgress")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionPrimary]}
                    disabled={busy}
                    onPress={() => void applyStatus("resolved")}
                  >
                    <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>
                      {t("adminApp.support.markResolved")}
                    </Text>
                  </Pressable>
                </View>
                <Pressable disabled={busy} onPress={() => void applyStatus("closed")}>
                  <Text style={styles.closeText}>{t("adminApp.support.markClosed")}</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: spacing[3] },
  empty: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
  },
  filterChipActive: { borderColor: colors.status.info, backgroundColor: "rgba(74, 158, 255, 0.12)" },
  filterText: { ...typography.caption, color: colors.text.secondary },
  filterTextActive: { color: colors.status.info, fontWeight: "600" },
  card: {
    marginHorizontal: spacing[4],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
    gap: spacing[2],
  },
  cardTop: { flexDirection: "row", gap: spacing[2], alignItems: "flex-start" },
  subject: { ...typography.body, color: colors.text.primary, fontWeight: "600", flex: 1 },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: glass.inputBg,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.text.secondary },
  meta: { ...typography.caption, color: colors.text.tertiary },
  preview: { ...typography.bodySmall, color: colors.text.secondary },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing[5],
    gap: spacing[3],
    maxHeight: "85%",
  },
  modalTitle: { ...typography.heading3, color: colors.text.primary },
  modalMeta: { ...typography.caption, color: colors.text.secondary },
  modalBody: { ...typography.body, color: colors.text.primary },
  fieldLabel: { ...typography.caption, color: colors.text.secondary, textTransform: "uppercase" },
  notesInput: {
    borderWidth: 1,
    borderColor: glass.inputBorder,
    borderRadius: radius.md,
    padding: spacing[3],
    minHeight: 80,
    ...typography.body,
    color: colors.text.primary,
    textAlignVertical: "top",
  },
  linkBtn: { alignSelf: "flex-start" },
  linkBtnText: { ...typography.label, color: colors.status.info },
  actionRow: { flexDirection: "row", gap: spacing[2] },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPrimary: { backgroundColor: colors.accent.green, borderColor: colors.accent.green },
  actionBtnText: { ...typography.button, color: colors.text.primary },
  actionPrimaryText: { color: "#000", fontWeight: "700" },
  closeText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[2],
  },
});
