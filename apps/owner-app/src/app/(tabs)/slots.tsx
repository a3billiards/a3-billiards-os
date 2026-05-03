import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import {
  SnackPicker,
  TableGrid,
  ComplaintBanner,
  type ComplaintBannerRow,
} from "@a3/ui/components";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { getActiveRoleId } from "../../lib/activeRoleStorage";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";

export default function SlotsScreen() {
  const router = useRouter();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const [walkInTableId, setWalkInTableId] = useState<Id<"tables"> | null>(
    null,
  );
  const [walkInLockToken, setWalkInLockToken] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingConflictMessage, setPendingConflictMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [acquiringLock, setAcquiringLock] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [snackPickerSessionId, setSnackPickerSessionId] =
    useState<Id<"sessions"> | null>(null);
  const [showWalkInStartModal, setShowWalkInStartModal] = useState(false);
  const [walkInStartStep, setWalkInStartStep] = useState<"choose" | "customer">("choose");
  const [guestNameInput, setGuestNameInput] = useState("Walk-in");
  const [customerPhoneInput, setCustomerPhoneInput] = useState("");
  const [debouncedCustomerPhone, setDebouncedCustomerPhone] = useState("");
  const [pendingCustomerId, setPendingCustomerId] = useState<Id<"users"> | null>(null);
  const [showComplaintGate, setShowComplaintGate] = useState(false);
  const [roleId, setRoleId] = useState<Id<"staffRoles"> | undefined>(undefined);
  const walkInModalOpenedForTableRef = useRef<string | null>(null);

  useEffect(() => {
    void getActiveRoleId().then((v) => {
      if (v) setRoleId(v as Id<"staffRoles">);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerPhone(customerPhoneInput.trim()), 300);
    return () => clearTimeout(t);
  }, [customerPhoneInput]);

  const phoneReady = /^\+91\d{10}$/.test(debouncedCustomerPhone);
  const customerPhoneSearch = useQuery(
    api.complaints.searchCustomerByPhone,
    phoneReady ? { phone: debouncedCustomerPhone } : "skip",
  );
  const customerComplaints = useQuery(
    api.complaints.getCustomerActiveComplaints,
    pendingCustomerId ? { userId: pendingCustomerId } : "skip",
  );

  const snackEligibility = useQuery(
    api.snacks.getSessionSnackEligibility,
    snackPickerSessionId ? { sessionId: snackPickerSessionId } : "skip",
  );

  const conflict = useQuery(
    api.slotManagement.getWalkInBookingConflict,
    walkInTableId ? { tableId: walkInTableId } : "skip",
  );

  const acquireTableLock = useAction(api.ownerSessionActions.acquireTableLock);
  const releaseTableLock = useMutation(api.ownerSessions.releaseTableLock);
  const startWalkIn = useMutation(api.ownerSessions.startWalkInSession);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const clearWalkInState = useCallback(() => {
    walkInModalOpenedForTableRef.current = null;
    setWalkInTableId(null);
    setWalkInLockToken(null);
    setShowWalkInStartModal(false);
    setWalkInStartStep("choose");
    setGuestNameInput("Walk-in");
    setCustomerPhoneInput("");
    setDebouncedCustomerPhone("");
    setPendingCustomerId(null);
    setShowComplaintGate(false);
  }, []);

  const runStartWalkIn = useCallback(
    async (
      tableId: Id<"tables">,
      lockToken: string,
      opts?: {
        forceOverride?: boolean;
        guestName?: string;
        customerId?: Id<"users">;
        staffAcknowledgedComplaint?: boolean;
      },
    ) => {
      setActionError(null);
      try {
        const result = await startWalkIn({
          tableId,
          lockToken,
          forceStartDespiteConflict: opts?.forceOverride || undefined,
          guestName: opts?.customerId ? undefined : opts?.guestName,
          customerId: opts?.customerId,
          roleId,
          staffAcknowledgedComplaint: opts?.staffAcknowledgedComplaint,
        });
        if ((result as { hasUpcomingBooking?: boolean }).hasUpcomingBooking) {
          const r = result as {
            customerName?: string;
            bookingTime?: string;
          };
          setPendingConflictMessage(
            `This table has a booking for ${r.customerName ?? "Customer"} at ${r.bookingTime ?? ""}. Proceeding will take priority over the booking.`,
          );
          setShowConflictModal(true);
          return;
        }
        setShowConflictModal(false);
        setShowWalkInStartModal(false);
        setShowComplaintGate(false);
        clearWalkInState();
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
        clearWalkInState();
      }
    },
    [startWalkIn, clearWalkInState, roleId],
  );

  useEffect(() => {
    if (!walkInTableId || !walkInLockToken || conflict === undefined) return;

    if (conflict.hasConflict) {
      setPendingConflictMessage(conflict.message);
      setShowConflictModal(true);
      return;
    }

    if (walkInModalOpenedForTableRef.current === walkInTableId) return;
    walkInModalOpenedForTableRef.current = walkInTableId;
    setShowWalkInStartModal(true);
  }, [walkInTableId, walkInLockToken, conflict]);

  const handleTablePress = useCallback(
    async (tableId: string) => {
      if (!dashboard) return;
      const t = dashboard.tables.find((x) => x._id === tableId);
      if (!t || !t.isActive) return;
      if (t.currentSessionId) {
        setActionError("This table is already in use.");
        return;
      }
      setActionError(null);
      setAcquiringLock(true);
      try {
        const { lockToken } = await acquireTableLock({
          tableId: tableId as Id<"tables">,
        });
        setWalkInLockToken(lockToken);
        setWalkInTableId(tableId as Id<"tables">);
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
      } finally {
        setAcquiringLock(false);
      }
    },
    [dashboard, acquireTableLock],
  );

  const pickDifferentTable = useCallback(async () => {
    setShowConflictModal(false);
    if (walkInTableId !== null && walkInLockToken !== null) {
      try {
        await releaseTableLock({
          tableId: walkInTableId,
          lockToken: walkInLockToken,
        });
      } catch {
        /* lock may have expired — still clear UI */
      }
    }
    clearWalkInState();
  }, [walkInTableId, walkInLockToken, releaseTableLock, clearWalkInState]);

  const proceedAnyway = useCallback(() => {
    if (!walkInTableId || !walkInLockToken) return;
    setShowConflictModal(false);
    void runStartWalkIn(walkInTableId, walkInLockToken, { forceOverride: true });
  }, [walkInTableId, walkInLockToken, runStartWalkIn]);

  const cancelWalkInStart = useCallback(async () => {
    setShowWalkInStartModal(false);
    if (walkInTableId !== null && walkInLockToken !== null) {
      try {
        await releaseTableLock({
          tableId: walkInTableId,
          lockToken: walkInLockToken,
        });
      } catch {
        /* ignore */
      }
    }
    clearWalkInState();
  }, [walkInTableId, walkInLockToken, releaseTableLock, clearWalkInState]);

  const bannerRows: ComplaintBannerRow[] = useMemo(() => {
    if (!customerComplaints?.complaints) return [];
    return customerComplaints.complaints.map((c) => ({
      type: c.type,
      typeLabel: c.typeLabel,
      clubName: c.clubName,
      createdAt: c.createdAt,
    }));
  }, [customerComplaints]);

  if (dashboard === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.loadingText}>Loading tables…</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  const summary = dashboard.bookingSummary;
  const showSummary = dashboard.bookingSettingsEnabled;
  const activeTables = dashboard.tables.filter(
    (table) => table.currentSessionId !== undefined,
  );

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
            <Pressable
              onPress={() => router.push("/(tabs)/bookings?segment=pending")}
              style={({ pressed }) => [
                styles.summaryCard,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.summaryValue}>{summary.pending}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/bookings?segment=upcoming")}
              style={({ pressed }) => [
                styles.summaryCard,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.summaryValue}>
                {summary.confirmedToday}
              </Text>
              <Text style={styles.summaryLabel}>Confirmed today</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/bookings?segment=history")}
              style={({ pressed }) => [
                styles.summaryCard,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.summaryValue}>
                {summary.completedToday}
              </Text>
              <Text style={styles.summaryLabel}>Completed today</Text>
            </Pressable>
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

        {activeTables.length > 0 ? (
          <View style={styles.activeSection}>
            <Text style={styles.activeSectionTitle}>Active Tables</Text>
            <Text style={styles.activeSectionHint}>
              Add snacks to running sessions.
            </Text>
            {activeTables.map((table) => (
              <View key={table._id} style={styles.activeCard}>
                <View>
                  <Text style={styles.activeCardTitle}>{table.label}</Text>
                  <Text style={styles.activeCardMeta}>Session in progress</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.addSnacksBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setSnackPickerSessionId(table.currentSessionId as Id<"sessions">)
                  }
                >
                  <Text style={styles.addSnacksBtnText}>Add Snacks</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {(acquiringLock || (walkInTableId !== null && conflict === undefined)) && (
        <View style={styles.lockOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.accent.green} />
          <Text style={styles.lockOverlayText}>Reserving table…</Text>
        </View>
      )}

      <Modal
        visible={showConflictModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          void pickDifferentTable();
        }}
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
                onPress={() => {
                  void pickDifferentTable();
                }}
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

      <Modal
        visible={showWalkInStartModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          void cancelWalkInStart();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {walkInStartStep === "choose" ? (
              <>
                <Text style={styles.modalTitle}>Start session</Text>
                <Text style={styles.modalBody}>
                  Walk-in guest starts immediately. For a registered customer, look up by phone.
                </Text>
                <Text style={styles.walkInLabel}>Guest display name</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={guestNameInput}
                  onChangeText={setGuestNameInput}
                  placeholder="Walk-in"
                  placeholderTextColor={colors.text.tertiary}
                />
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnPrimary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      if (!walkInTableId || !walkInLockToken) return;
                      const g = guestNameInput.trim() || "Walk-in";
                      void runStartWalkIn(walkInTableId, walkInLockToken, { guestName: g });
                    }}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Start as walk-in guest</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      setWalkInStartStep("customer");
                      setPendingCustomerId(null);
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>
                      Registered customer (phone)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      void cancelWalkInStart();
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Customer phone</Text>
                <Text style={styles.modalHint}>
                  E.164 format: +91 and 10 digits (e.g. +919876543210)
                </Text>
                <TextInput
                  style={styles.walkInInput}
                  value={customerPhoneInput}
                  onChangeText={setCustomerPhoneInput}
                  keyboardType="phone-pad"
                  placeholder="+91xxxxxxxxxx"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />
                {customerPhoneSearch === undefined && phoneReady ? (
                  <ActivityIndicator color={colors.accent.green} />
                ) : customerPhoneSearch && !customerPhoneSearch.ok ? (
                  <Text style={styles.walkInErr}>{customerPhoneSearch.message}</Text>
                ) : customerPhoneSearch?.ok ? (
                  <View style={styles.foundCard}>
                    <Text style={styles.foundName}>{customerPhoneSearch.user.name}</Text>
                    <Text style={styles.foundPhone}>{customerPhoneSearch.user.phone}</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalBtnSecondary,
                        pressed && styles.pressed,
                        { marginTop: spacing[3] },
                      ]}
                      onPress={() => setPendingCustomerId(customerPhoneSearch.user._id)}
                    >
                      <Text style={styles.modalBtnSecondaryText}>Use this customer</Text>
                    </Pressable>
                  </View>
                ) : null}
                {pendingCustomerId !== null && customerComplaints !== undefined ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnPrimary,
                      pressed && styles.pressed,
                      { marginTop: spacing[4] },
                    ]}
                    onPress={() => {
                      if (!walkInTableId || !walkInLockToken || !pendingCustomerId) return;
                      if (customerComplaints.hasComplaints) {
                        setShowComplaintGate(true);
                      } else {
                        void runStartWalkIn(walkInTableId, walkInLockToken, {
                          customerId: pendingCustomerId,
                        });
                      }
                    }}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Start session</Text>
                  </Pressable>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      setWalkInStartStep("choose");
                      setPendingCustomerId(null);
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      void cancelWalkInStart();
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showComplaintGate} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "90%" }]}>
            <ComplaintBanner
              complaints={bannerRows}
              onCancel={() => {
                setShowComplaintGate(false);
              }}
              onAcknowledge={() => {
                if (!walkInTableId || !walkInLockToken || !pendingCustomerId) return;
                setShowComplaintGate(false);
                void runStartWalkIn(walkInTableId, walkInLockToken, {
                  customerId: pendingCustomerId,
                  staffAcknowledgedComplaint: true,
                });
              }}
            />
          </View>
        </View>
      </Modal>

      {snackPickerSessionId !== null && snackEligibility !== undefined ? (
        <SnackPicker
          visible
          clubId={dashboard.clubId}
          sessionId={snackPickerSessionId}
          sessionStatus={snackEligibility.status}
          paymentStatus={snackEligibility.paymentStatus}
          currency={dashboard.currency}
          onClose={() => setSnackPickerSessionId(null)}
        />
      ) : null}
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
    paddingHorizontal: layout.screenPadding,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[4],
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,17,23,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlayText: {
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
  activeSection: {
    marginTop: spacing[6],
    gap: spacing[2],
  },
  activeSectionTitle: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  activeSectionHint: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  activeCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  activeCardTitle: {
    ...typography.label,
    color: colors.text.primary,
  },
  activeCardMeta: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  addSnacksBtn: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
    alignItems: "center",
    justifyContent: "center",
  },
  addSnacksBtnText: {
    ...typography.labelSmall,
    color: colors.text.primary,
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
  walkInLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  walkInInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  walkInErr: {
    ...typography.bodySmall,
    color: colors.status.error,
    marginBottom: spacing[2],
  },
  foundCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  foundName: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  foundPhone: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 4 },
});
