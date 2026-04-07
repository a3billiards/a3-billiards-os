import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { TableGrid } from "@a3/ui/components";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

export default function SlotsScreen() {
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const [walkInTableId, setWalkInTableId] = useState<Id<"tables"> | null>(
    null,
  );
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingConflictMessage, setPendingConflictMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Prevents double startWalkIn in React Strict Mode / re-renders for same table. */
  const autoStartForTableRef = useRef<string | null>(null);

  const conflict = useQuery(
    api.slotManagement.getWalkInBookingConflict,
    walkInTableId ? { tableId: walkInTableId } : "skip",
  );

  const startWalkIn = useMutation(api.ownerSessions.startWalkInSession);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const runStartWalkIn = useCallback(
    async (tableId: Id<"tables">) => {
      setActionError(null);
      try {
        await startWalkIn({ tableId });
        setWalkInTableId(null);
        setShowConflictModal(false);
        autoStartForTableRef.current = null;
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
        autoStartForTableRef.current = null;
        setWalkInTableId(null);
      }
    },
    [startWalkIn],
  );

  useEffect(() => {
    if (walkInTableId === null) {
      autoStartForTableRef.current = null;
    }
  }, [walkInTableId]);

  useEffect(() => {
    if (!walkInTableId || conflict === undefined) return;

    if (conflict.hasConflict) {
      setPendingConflictMessage(conflict.message);
      setShowConflictModal(true);
      return;
    }

    if (autoStartForTableRef.current === walkInTableId) return;
    autoStartForTableRef.current = walkInTableId;
    void runStartWalkIn(walkInTableId);
  }, [walkInTableId, conflict, runStartWalkIn]);

  const handleTablePress = useCallback(
    (tableId: string) => {
      if (!dashboard) return;
      const t = dashboard.tables.find((x) => x._id === tableId);
      if (!t || !t.isActive) return;
      if (t.currentSessionId) {
        setActionError("This table is already in use.");
        return;
      }
      setActionError(null);
      autoStartForTableRef.current = null;
      setWalkInTableId(tableId as Id<"tables">);
    },
    [dashboard],
  );

  const pickDifferentTable = useCallback(() => {
    setShowConflictModal(false);
    setWalkInTableId(null);
    autoStartForTableRef.current = null;
  }, []);

  const proceedAnyway = useCallback(() => {
    if (!walkInTableId) return;
    setShowConflictModal(false);
    void runStartWalkIn(walkInTableId);
  }, [walkInTableId, runStartWalkIn]);

  if (dashboard === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.loadingText}>Loading tables…</Text>
      </View>
    );
  }

  const summary = dashboard.bookingSummary;
  const showSummary = dashboard.bookingSettingsEnabled;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.green}
          />
        }
      >
        <Text style={styles.screenTitle}>Slots</Text>
        <Text style={styles.screenSubtitle}>
          Tap a free table to start a walk-in session
        </Text>

        {showSummary && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.pending}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {summary.confirmedToday}
              </Text>
              <Text style={styles.summaryLabel}>Confirmed today</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {summary.completedToday}
              </Text>
              <Text style={styles.summaryLabel}>Completed today</Text>
            </View>
          </View>
        )}

        {actionError !== null && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorLabel}>Error</Text>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        )}

        <TableGrid
          tables={dashboard.tables}
          bookingTagByTableId={dashboard.bookingTagByTableId}
          onTablePress={handleTablePress}
        />
      </ScrollView>

      <Modal
        visible={showConflictModal}
        transparent
        animationType="fade"
        onRequestClose={pickDifferentTable}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Booking conflict</Text>
            <Text style={styles.modalBody}>{pendingConflictMessage}</Text>
            <Text style={styles.modalHint}>
              Physical walk-ins take priority if you choose to proceed.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  pressed && styles.pressed,
                ]}
                onPress={pickDifferentTable}
                accessibilityRole="button"
                accessibilityLabel="Pick different table"
              >
                <Text style={styles.modalBtnSecondaryText}>
                  Pick Different Table
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  pressed && styles.pressed,
                ]}
                onPress={proceedAnyway}
                accessibilityRole="button"
                accessibilityLabel="Proceed anyway"
              >
                <Text style={styles.modalBtnPrimaryText}>Proceed Anyway</Text>
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
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[6],
    paddingBottom: spacing[10],
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[4],
  },
  screenTitle: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  screenSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[6],
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: "center",
    minHeight: layout.touchTarget,
  },
  summaryValue: {
    ...typography.heading4,
    color: colors.accent.green,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[1],
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  errorLabel: {
    ...typography.labelSmall,
    color: colors.status.error,
    marginRight: spacing[2],
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.error,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "center",
    padding: layout.screenPadding,
  },
  modalCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.xl,
    padding: spacing[6],
    maxWidth: layout.modalMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  modalTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  modalBody: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  },
  modalHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing[6],
  },
  modalActions: {
    gap: spacing[3],
  },
  modalBtnPrimary: {
    backgroundColor: colors.accent.amber,
    borderRadius: radius.lg,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimaryText: {
    ...typography.buttonLarge,
    color: colors.bg.primary,
  },
  modalBtnSecondary: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnSecondaryText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
  pressed: { opacity: 0.88 },
});
