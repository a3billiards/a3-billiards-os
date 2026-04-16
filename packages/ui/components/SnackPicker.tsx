import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors } from "../theme/colors";
import { layout, radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { formatCurrency } from "@a3/utils/billing";
import { parseConvexError } from "../errors";

type SessionStatus = "active" | "completed" | "cancelled";
type PaymentStatus = "pending" | "paid" | "credit";

export interface SnackPickerProps {
  visible: boolean;
  clubId: Id<"clubs">;
  sessionId: Id<"sessions">;
  sessionStatus: SessionStatus;
  paymentStatus: PaymentStatus;
  onClose: () => void;
  onAdded?: () => void;
  roleId?: Id<"staffRoles">;
  currency?: string;
}

export function SnackPicker(props: SnackPickerProps): React.JSX.Element {
  const {
    visible,
    clubId,
    sessionId,
    sessionStatus,
    paymentStatus,
    onClose,
    onAdded,
    roleId,
    currency = "INR",
  } = props;
  const snacks = useQuery(
    api.snacks.listAvailableSnacks,
    visible ? { clubId } : "skip",
  );
  const addSnacksToSession = useMutation(api.snacks.addSnacksToSession);
  const [qtyBySnackId, setQtyBySnackId] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQtyBySnackId({});
      setSaving(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const blocked =
      sessionStatus === "cancelled" ||
      (sessionStatus === "completed" && paymentStatus === "paid");
    if (blocked) {
      Alert.alert("Unable to add snacks", "This session can no longer be edited.");
      onClose();
    }
  }, [visible, sessionStatus, paymentStatus, onClose]);

  const selectedItems = useMemo(() => {
    if (!snacks) return [];
    return snacks
      .map((snack) => {
        const qty = qtyBySnackId[snack._id] ?? 0;
        return { snack, qty };
      })
      .filter((entry) => entry.qty > 0);
  }, [snacks, qtyBySnackId]);

  const subtotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + item.qty * item.snack.price,
        0,
      ),
    [selectedItems],
  );

  const updateQty = (snackId: string, delta: number) => {
    setQtyBySnackId((prev) => {
      const current = prev[snackId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [snackId]: next };
    });
  };

  const submit = async () => {
    if (selectedItems.length === 0 || saving) return;
    setSaving(true);
    try {
      await addSnacksToSession({
        sessionId,
        items: selectedItems.map((item) => ({
          snackId: item.snack._id,
          qty: item.qty,
        })),
        roleId,
      });
      onAdded?.();
      onClose();
    } catch (error) {
      Alert.alert(
        "Failed to add snacks",
        parseConvexError(error as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add Snacks</Text>
          <Text style={styles.subtitle}>Select items to append to this session bill.</Text>

          {snacks === undefined ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent.green} />
              <Text style={styles.hint}>Loading snacks...</Text>
            </View>
          ) : snacks.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.hint}>
                No snack items available. Add items from the Snacks tab.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {snacks.map((snack) => {
                const qty = qtyBySnackId[snack._id] ?? 0;
                return (
                  <View key={snack._id} style={styles.row}>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemName}>{snack.name}</Text>
                      <Text style={styles.itemPrice}>
                        {formatCurrency(snack.price, currency)} each
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => updateQty(snack._id, -1)}
                        style={styles.stepBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease ${snack.name}`}
                      >
                        <Text style={styles.stepBtnText}>-</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable
                        onPress={() => updateQty(snack._id, 1)}
                        style={styles.stepBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase ${snack.name}`}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatCurrency(subtotal, currency)}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.actionBtn, styles.cancelBtn]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={selectedItems.length === 0 || saving}
              onPress={submit}
              style={[
                styles.actionBtn,
                styles.confirmBtn,
                (selectedItems.length === 0 || saving) && styles.confirmBtnDisabled,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>
                {saving ? "Adding..." : "Add to Bill"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    minHeight: 360,
    maxHeight: "88%",
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
    marginBottom: spacing[3],
  },
  center: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  hint: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[2],
    textAlign: "center",
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: spacing[2],
  },
  row: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemMeta: {
    flex: 1,
    paddingRight: spacing[3],
  },
  itemName: {
    ...typography.label,
    color: colors.text.primary,
  },
  itemPrice: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  stepBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  stepBtnText: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  qtyText: {
    ...typography.label,
    color: colors.text.primary,
    minWidth: 24,
    textAlign: "center",
  },
  footer: {
    marginTop: spacing[3],
    marginBottom: spacing[2],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtotalLabel: {
    ...typography.label,
    color: colors.text.secondary,
  },
  subtotalValue: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[2],
  },
  actionBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  confirmBtn: {
    backgroundColor: colors.accent.green,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  cancelText: {
    ...typography.button,
    color: colors.text.primary,
  },
  confirmText: {
    ...typography.button,
    color: colors.bg.primary,
  },
});

export default SnackPicker;
