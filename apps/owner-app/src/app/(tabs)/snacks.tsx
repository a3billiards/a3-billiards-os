import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
import { parseConvexError } from "@a3/ui/errors";
import { formatCurrency } from "@a3/utils/billing";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";

type FormState = {
  name: string;
  price: string;
};

export default function SnacksScreen() {
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const snacks = useQuery(
    api.snacks.listSnacks,
    dashboard ? { clubId: dashboard.clubId } : "skip",
  );
  const createSnack = useMutation(api.snacks.createSnack);
  const updateSnack = useMutation(api.snacks.updateSnack);
  const toggleSnackAvailability = useMutation(api.snacks.toggleSnackAvailability);
  const deleteSnack = useMutation(api.snacks.deleteSnack);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingSnackId, setEditingSnackId] = useState<Id<"snacks"> | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", price: "" });
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
        <Text style={styles.centerText}>Loading snack menu...</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (snacks === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.centerText}>Loading snack menu...</Text>
      </View>
    );
  }

  const openCreate = () => {
    setEditingSnackId(null);
    setForm({ name: "", price: "" });
    setError(null);
    setEditorVisible(true);
  };

  const openEdit = (snackId: Id<"snacks">) => {
    const snack = snacks.find((s) => s._id === snackId);
    if (!snack) return;
    setEditingSnackId(snackId);
    setForm({ name: snack.name, price: String(snack.price) });
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
      setError("Name is required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Price must be a positive number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingSnackId) {
        await updateSnack({ snackId: editingSnackId, name, price });
      } else {
        await createSnack({ clubId: dashboard.clubId, name, price });
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
      Alert.alert("Unable to update", parseConvexError(e as Error).message);
    }
  };

  const onDelete = (snackId: Id<"snacks">) => {
    Alert.alert(
      "Remove this item?",
      "It will no longer appear on the menu. Historical orders are preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSnack({ snackId });
            } catch (e) {
              Alert.alert("Delete failed", parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Snacks</Text>
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add snack item"
        >
          <Text style={styles.addBtnText}>+ Add Item</Text>
        </Pressable>
      </View>

      {snacks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No snack items yet. Tap '+ Add Item' to create your menu.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {snacks.map((snack) => (
            <View key={snack._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.snackName}>{snack.name}</Text>
                  <Text style={styles.snackPrice}>
                    {formatCurrency(snack.price, dashboard.currency)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    snack.isAvailable ? styles.badgeAvailable : styles.badgeUnavailable,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {snack.isAvailable ? "Available" : "Unavailable"}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  onPress={() => openEdit(snack._id)}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  onPress={() => void onToggle(snack._id)}
                >
                  <Text style={styles.actionText}>
                    {snack.isAvailable ? "Mark Unavailable" : "Mark Available"}
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
                  <Text style={styles.deleteText}>Delete</Text>
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
              {editingSnack ? "Edit Snack Item" : "Add Snack Item"}
            </Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              placeholder="e.g. Nachos"
              placeholderTextColor={colors.text.tertiary}
              style={styles.input}
            />

            <Text style={styles.label}>Price</Text>
            <TextInput
              value={form.price}
              onChangeText={(price) => setForm((prev) => ({ ...prev, price }))}
              placeholder="0"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            {error ? <Text style={styles.formError}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeEditor}
                style={[styles.modalBtn, styles.modalCancel]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveSnack()}
                disabled={saving}
                style={[styles.modalBtn, styles.modalConfirm, saving && styles.disabled]}
              >
                <Text style={styles.modalConfirmText}>
                  {saving ? "Saving..." : "Save"}
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
