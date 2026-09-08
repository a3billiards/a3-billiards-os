import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { useTranslation } from "@a3/i18n";
import { formatCurrency } from "@a3/utils/billing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";
import { useStaffRole, useStaffTabQueryArgs } from "../../lib/StaffRoleContext";
import { TabAccessDenied } from "../../components/TabAccessDenied";

type FormState = {
  name: string;
  price: string;
  fulfillmentType: "counter" | "kitchen";
};

function SnacksScreenContent() {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const { roleId, canAccessTab } = useStaffRole();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const snacksArgs = useStaffTabQueryArgs(dashboard?.clubId, "snacks");
  const snacks = useQuery(api.snacks.listSnacks, snacksArgs);
  const createSnack = useMutation(api.snacks.createSnack);
  const updateSnack = useMutation(api.snacks.updateSnack);
  const toggleSnackAvailability = useMutation(api.snacks.toggleSnackAvailability);
  const deleteSnack = useMutation(api.snacks.deleteSnack);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingSnackId, setEditingSnackId] = useState<Id<"snacks"> | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    price: "",
    fulfillmentType: "counter",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingSnack = useMemo(
    () => snacks?.find((snack) => snack._id === editingSnackId) ?? null,
    [snacks, editingSnackId],
  );

  if (dashboard === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.centerText}>{t("ownerApp.snacks.loading")}</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (roleId !== undefined && !canAccessTab("snacks")) {
    return <TabAccessDenied tabLabel={t("common.tabs.owner.snacks")} />;
  }

  if (snacks === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.centerText}>{t("ownerApp.snacks.loading")}</Text>
      </View>
    );
  }

  const openCreate = () => {
    setEditingSnackId(null);
    setForm({ name: "", price: "", fulfillmentType: "counter" });
    setError(null);
    setEditorVisible(true);
  };

  const openEdit = (snackId: Id<"snacks">) => {
    const snack = snacks.find((s) => s._id === snackId);
    if (!snack) return;
    setEditingSnackId(snackId);
    setForm({
      name: snack.name,
      price: String(snack.price),
      fulfillmentType: snack.fulfillmentType ?? "counter",
    });
    setError(null);
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorVisible(false);
  };

  const saveSnack = async () => {
    if (saving) return;
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) {
      setError(t("ownerApp.snacks.nameRequired"));
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError(t("ownerApp.snacks.pricePositive"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingSnackId) {
        await updateSnack({
          snackId: editingSnackId,
          name,
          price,
          fulfillmentType: form.fulfillmentType,
        });
      } else {
        await createSnack({
          clubId: dashboard.clubId,
          name,
          price,
          fulfillmentType: form.fulfillmentType,
        });
      }
      setEditorVisible(false);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (snackId: Id<"snacks">) => {
    try {
      await toggleSnackAvailability({ snackId });
    } catch (e) {
      Alert.alert(t("ownerApp.snacks.unableToUpdate"), parseConvexError(e as Error).message);
    }
  };

  const onDelete = (snackId: Id<"snacks">) => {
    Alert.alert(
      t("ownerApp.snacks.removeTitle"),
      t("ownerApp.snacks.removeBody"),
      [
        { text: t("ownerApp.snacks.cancel"), style: "cancel" },
        {
          text: t("ownerApp.snacks.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSnack({ snackId });
            } catch (e) {
              Alert.alert(t("ownerApp.snacks.deleteFailed"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("ownerApp.snacks.menuTitle")}</Text>
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("ownerApp.snacks.addItem")}
        >
          <Text style={styles.addBtnText}>{t("ownerApp.snacks.addSnack")}</Text>
        </Pressable>
      </View>

      {snacks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t("ownerApp.snacks.empty")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {snacks.map((snack) => (
            <View key={snack._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.snackName}>{snack.name}</Text>
                  <Text style={styles.snackPrice}>
                    {formatCurrency(snack.price, dashboard.currency)}
                  </Text>
                  <Text style={styles.snackType}>
                    {(snack.fulfillmentType ?? "counter") === "kitchen"
                      ? t("ownerApp.snacks.kitchenItem")
                      : t("ownerApp.snacks.counterSnack")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    snack.isAvailable ? styles.badgeAvailable : styles.badgeUnavailable,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {snack.isAvailable
                      ? t("ownerApp.snacks.available")
                      : t("ownerApp.snacks.unavailable")}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  onPress={() => openEdit(snack._id)}
                >
                  <Text style={styles.actionText}>{t("common.edit")}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  onPress={() => void onToggle(snack._id)}
                >
                  <Text style={styles.actionText}>
                    {snack.isAvailable
                      ? t("ownerApp.snacks.markUnavailable")
                      : t("ownerApp.snacks.markAvailable")}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.deleteBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onDelete(snack._id)}
                >
                  <Text style={styles.deleteText}>{t("ownerApp.snacks.delete")}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {editingSnack ? t("ownerApp.snacks.editItem") : t("ownerApp.snacks.addSnackItem")}
            </Text>

            <Text style={styles.label}>{t("ownerApp.snacks.name")}</Text>
            <TextInput
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              placeholder={t("ownerApp.snacks.namePlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              style={styles.input}
            />

            <Text style={styles.label}>{t("ownerApp.snacks.price")}</Text>
            <TextInput
              value={form.price}
              onChangeText={(price) => setForm((prev) => ({ ...prev, price }))}
              placeholder="0"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.label}>{t("common.typeLabel")}</Text>
            <View style={styles.typeRow}>
              <Pressable
                onPress={() =>
                  setForm((prev) => ({ ...prev, fulfillmentType: "counter" }))
                }
                style={[
                  styles.typeChip,
                  form.fulfillmentType === "counter" && styles.typeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    form.fulfillmentType === "counter" && styles.typeChipTextActive,
                  ]}
                >
                  {t("ownerApp.snacks.counterSnack")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setForm((prev) => ({ ...prev, fulfillmentType: "kitchen" }))
                }
                style={[
                  styles.typeChip,
                  form.fulfillmentType === "kitchen" && styles.typeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    form.fulfillmentType === "kitchen" && styles.typeChipTextActive,
                  ]}
                >
                  {t("ownerApp.snacks.kitchenItem")}
                </Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.formError}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeEditor}
                style={[styles.modalBtn, styles.modalCancel]}
              >
                <Text style={styles.modalCancelText}>{t("ownerApp.snacks.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveSnack()}
                disabled={saving}
                style={[styles.modalBtn, styles.modalConfirm, saving && styles.disabled]}
              >
                <Text style={styles.modalConfirmText}>
                  {saving ? t("ownerApp.snacks.saving") : t("ownerApp.snacks.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
  },
  centerText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[6],
    paddingBottom: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  addBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[4],
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    ...typography.button,
    color: colors.bg.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  snackName: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  snackPrice: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  snackType: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    marginTop: spacing[1],
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  badgeAvailable: {
    backgroundColor: colors.accent.green,
  },
  badgeUnavailable: {
    backgroundColor: colors.accent.amber,
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.bg.primary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  actionBtn: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    ...typography.labelSmall,
    color: colors.text.primary,
  },
  deleteBtn: {
    borderColor: colors.status.error,
  },
  deleteText: {
    ...typography.labelSmall,
    color: colors.status.error,
  },
  pressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay.scrim,
  },
  modalSheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[2],
  },
  modalTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  label: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[1],
  },
  typeChip: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[2],
  },
  typeChipActive: {
    borderColor: colors.accent.green,
    backgroundColor: colors.accent.green,
  },
  typeChipText: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    textAlign: "center",
  },
  typeChipTextActive: {
    color: colors.bg.primary,
  },
  input: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing[3],
    color: colors.text.primary,
    ...typography.body,
  },
  formError: {
    ...typography.bodySmall,
    color: colors.status.error,
    marginTop: spacing[1],
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[3],
  },
  modalBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancel: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalConfirm: {
    backgroundColor: colors.accent.green,
  },
  modalCancelText: {
    ...typography.button,
    color: colors.text.primary,
  },
  modalConfirmText: {
    ...typography.button,
    color: colors.bg.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default function SnacksScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.snacks")}>
      <SnacksScreenContent />
    </TabErrorBoundary>
  );
}
