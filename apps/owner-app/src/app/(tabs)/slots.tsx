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
  Linking,
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
import { formatCurrency, formatElapsed } from "@a3/utils/billing";
import { getActiveRoleId } from "../../lib/activeRoleStorage";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";

const PRIVACY_URL = "https://a3billiards.com/privacy";
const TOS_URL = "https://a3billiards.com/terms";

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
  const [walkInStartStep, setWalkInStartStep] = useState<
    "choose" | "customer" | "deskRegister"
  >("choose");
  const [guestNameInput, setGuestNameInput] = useState("Walk-in");
  const [customerPhoneInput, setCustomerPhoneInput] = useState("");
  const [debouncedCustomerPhone, setDebouncedCustomerPhone] = useState("");
  const [pendingCustomerId, setPendingCustomerId] = useState<Id<"users"> | null>(null);
  const [showComplaintGate, setShowComplaintGate] = useState(false);
  const [roleId, setRoleId] = useState<Id<"staffRoles"> | undefined>(undefined);
  const walkInModalOpenedForTableRef = useRef<string | null>(null);
  const [checkoutTableId, setCheckoutTableId] = useState<Id<"tables"> | null>(
    null,
  );
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  /** Pool-side new customer: name, age, +91 phone, WhatsApp OTP, consent. */
  const [deskName, setDeskName] = useState("");
  const [deskAge, setDeskAge] = useState("");
  const [deskPhone, setDeskPhone] = useState("+91");
  const [deskOtp, setDeskOtp] = useState("");
  const [deskConsent, setDeskConsent] = useState(false);
  const [deskBusySend, setDeskBusySend] = useState(false);
  const [deskBusySubmit, setDeskBusySubmit] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);

  useEffect(() => {
    void getActiveRoleId().then((v) => {
      if (v) setRoleId(v as Id<"staffRoles">);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerPhone(customerPhoneInput.trim()), 300);
    return () => clearTimeout(t);
  }, [customerPhoneInput]);

  // Tick once a second so elapsed timers and live bill preview stay current.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
  const ownerSendDeskCustomerOtp = useAction(
    api.ownerDeskCustomerRegistration.ownerSendDeskCustomerRegistrationOtp,
  );
  const ownerCompleteDeskCustomerRegistration = useAction(
    api.ownerDeskCustomerRegistration.ownerCompleteDeskCustomerRegistration,
  );
  const releaseTableLock = useMutation(api.ownerSessions.releaseTableLock);
  const startWalkIn = useMutation(api.ownerSessions.startWalkInSession);
  const checkoutTableSession = useMutation(api.ownerSessions.checkoutTableSession);

  const parsedDiscount = useMemo(() => {
    const trimmed = discountInput.trim();
    if (trimmed === "") return 0;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(100, n);
  }, [discountInput]);

  const checkoutPreview = useQuery(
    api.ownerSessions.previewTableCheckout,
    checkoutTableId !== null
      ? { tableId: checkoutTableId, roleId, discountPercent: parsedDiscount }
      : "skip",
  );

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
    setDeskName("");
    setDeskAge("");
    setDeskPhone("+91");
    setDeskOtp("");
    setDeskConsent(false);
    setDeskError(null);
    setDeskBusySend(false);
    setDeskBusySubmit(false);
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

  const openCheckoutForTable = useCallback((tableId: Id<"tables">) => {
    setActionError(null);
    setDiscountInput("");
    setCheckoutTableId(tableId);
    setShowCheckoutModal(true);
  }, []);

  const closeCheckoutModal = useCallback(() => {
    if (checkoutBusy) return;
    setShowCheckoutModal(false);
    setCheckoutTableId(null);
    setDiscountInput("");
  }, [checkoutBusy]);

  const runCheckout = useCallback(
    async (paymentMethod: "cash" | "upi" | "card" | "credit") => {
      if (checkoutTableId === null) return;
      setCheckoutBusy(true);
      setActionError(null);
      try {
        await checkoutTableSession({
          tableId: checkoutTableId,
          paymentMethod,
          roleId,
          discountPercent: parsedDiscount > 0 ? parsedDiscount : undefined,
        });
        setShowCheckoutModal(false);
        setCheckoutTableId(null);
        setDiscountInput("");
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
      } finally {
        setCheckoutBusy(false);
      }
    },
    [checkoutTableId, checkoutTableSession, roleId, parsedDiscount],
  );

  const handleTablePress = useCallback(
    async (tableId: string) => {
      if (!dashboard) return;
      const t = dashboard.tables.find((x) => x._id === tableId);
      if (!t || !t.isActive) return;
      if (t.currentSessionId) {
        openCheckoutForTable(tableId as Id<"tables">);
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
    [dashboard, acquireTableLock, openCheckoutForTable],
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
  const activeSessionByTableId = dashboard.activeSessionByTableId ?? {};

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
          Tap a free table for a walk-in, or an occupied table to close out and free it.
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
              Close a table to run checkout and free it, or add snacks while play continues.
            </Text>
            {activeTables.map((table) => {
              const session = activeSessionByTableId[table._id];
              const elapsedLabel =
                session !== undefined
                  ? formatElapsed(Math.max(0, nowMs - session.startTime))
                  : null;
              return (
                <View key={table._id} style={styles.activeCard}>
                  <View style={styles.activeCardLeft}>
                    <Text style={styles.activeCardTitle}>{table.label}</Text>
                    <Text style={styles.activeCardCustomer} numberOfLines={1}>
                      {session?.customerName ?? "Session in progress"}
                      {session?.isGuest ? (
                        <Text style={styles.guestBadgeInline}> · Guest</Text>
                      ) : null}
                    </Text>
                    {elapsedLabel ? (
                      <View style={styles.elapsedRow}>
                        <View style={styles.elapsedDot} />
                        <Text style={styles.activeCardMeta}>
                          {elapsedLabel} elapsed
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.activeCardMeta}>
                        Session in progress
                      </Text>
                    )}
                  </View>
                  <View style={styles.activeCardActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.closeTableBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        openCheckoutForTable(table._id as Id<"tables">)
                      }
                    >
                      <Text style={styles.closeTableBtnText}>Close table</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.addSnacksBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setSnackPickerSessionId(
                          table.currentSessionId as Id<"sessions">,
                        )
                      }
                    >
                      <Text style={styles.addSnacksBtnText}>Add Snacks</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
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
                  New customers can verify on WhatsApp and register here before play.
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
                      void (async () => {
                        if (!walkInTableId) return;
                        setDeskError(null);
                        setActionError(null);
                        try {
                          const { lockToken } = await acquireTableLock({
                            tableId: walkInTableId,
                            otpFlow: true,
                          });
                          setWalkInLockToken(lockToken);
                          setDeskName("");
                          setDeskAge("");
                          setDeskPhone("+91");
                          setDeskOtp("");
                          setDeskConsent(false);
                          setWalkInStartStep("deskRegister");
                        } catch (e) {
                          setDeskError(parseConvexError(e as Error).message);
                        }
                      })();
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>
                      New customer — WhatsApp OTP
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
            ) : walkInStartStep === "deskRegister" ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>Register customer</Text>
                <Text style={styles.modalHint}>
                  Enter their legal name, age (18+), and +91 mobile. We send a 6-digit code
                  to WhatsApp; enter it here to create their verified profile, then start the
                  session.
                </Text>
                {deskError ? (
                  <Text style={styles.walkInErr}>{deskError}</Text>
                ) : null}
                <Text style={styles.walkInLabel}>Full name</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={deskName}
                  onChangeText={setDeskName}
                  placeholder="As on ID"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.walkInLabel}>Age</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={deskAge}
                  onChangeText={setDeskAge}
                  placeholder="18+"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.walkInLabel}>Mobile (WhatsApp)</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={deskPhone}
                  onChangeText={setDeskPhone}
                  keyboardType="phone-pad"
                  placeholder="+91xxxxxxxxxx"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtnSecondary,
                    pressed && styles.pressed,
                    deskBusySend && styles.pressed,
                  ]}
                  disabled={deskBusySend}
                  onPress={() => {
                    void (async () => {
                      const phone = deskPhone.replace(/\s/g, "");
                      if (!/^\+91\d{10}$/.test(phone)) {
                        setDeskError("Use +91 followed by 10 digits.");
                        return;
                      }
                      setDeskError(null);
                      setDeskBusySend(true);
                      try {
                        await ownerSendDeskCustomerOtp({ phone });
                      } catch (e) {
                        setDeskError(parseConvexError(e as Error).message);
                      } finally {
                        setDeskBusySend(false);
                      }
                    })();
                  }}
                >
                  <Text style={styles.modalBtnSecondaryText}>
                    {deskBusySend ? "Sending…" : "Send WhatsApp code"}
                  </Text>
                </Pressable>
                <Text style={styles.walkInLabel}>6-digit code</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={deskOtp}
                  onChangeText={setDeskOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.text.tertiary}
                />
                <View style={styles.consentRow}>
                  <Pressable
                    onPress={() => setDeskConsent((c) => !c)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: deskConsent }}
                    hitSlop={8}
                  >
                    <View
                      style={[
                        styles.consentBox,
                        deskConsent && styles.consentBoxOn,
                      ]}
                    />
                  </Pressable>
                  <Text style={styles.consentText}>
                    Customer confirms they are 18+ and agrees to the{" "}
                    <Text
                      style={styles.linkInline}
                      onPress={() => void Linking.openURL(TOS_URL)}
                    >
                      Terms
                    </Text>{" "}
                    and{" "}
                    <Text
                      style={styles.linkInline}
                      onPress={() => void Linking.openURL(PRIVACY_URL)}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtnPrimary,
                    pressed && styles.pressed,
                    deskBusySubmit && styles.pressed,
                  ]}
                  disabled={deskBusySubmit}
                  onPress={() => {
                    void (async () => {
                      const name = deskName.trim();
                      const ageN = Number(deskAge);
                      const phone = deskPhone.replace(/\s/g, "");
                      const code = deskOtp.replace(/\s/g, "");
                      if (name.length < 2) {
                        setDeskError("Please enter the customer's full name.");
                        return;
                      }
                      if (!Number.isInteger(ageN) || ageN < 18) {
                        setDeskError("Age must be a whole number, 18 or older.");
                        return;
                      }
                      if (!/^\+91\d{10}$/.test(phone)) {
                        setDeskError("Use +91 followed by 10 digits.");
                        return;
                      }
                      if (!/^\d{6}$/.test(code)) {
                        setDeskError("Enter the 6-digit WhatsApp code.");
                        return;
                      }
                      if (!deskConsent) {
                        setDeskError("Ask the customer to confirm the consent checkbox.");
                        return;
                      }
                      setDeskError(null);
                      setDeskBusySubmit(true);
                      try {
                        const { userId } = await ownerCompleteDeskCustomerRegistration({
                          phone,
                          code,
                          name,
                          age: ageN,
                          consentGiven: true,
                        });
                        setPendingCustomerId(userId);
                        setCustomerPhoneInput(phone);
                        setDebouncedCustomerPhone(phone);
                        setWalkInStartStep("customer");
                        setDeskOtp("");
                      } catch (e) {
                        setDeskError(parseConvexError(e as Error).message);
                      } finally {
                        setDeskBusySubmit(false);
                      }
                    })();
                  }}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {deskBusySubmit ? "Saving…" : "Verify & continue"}
                  </Text>
                </Pressable>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      setDeskError(null);
                      setWalkInStartStep("choose");
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
              </ScrollView>
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

      <Modal
        visible={showCheckoutModal}
        transparent
        animationType="fade"
        onRequestClose={closeCheckoutModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close table</Text>
            <Text style={styles.modalBody}>
              End the session, record the bill, and free this table for the next guest.
            </Text>
            {checkoutPreview === undefined ? (
              <ActivityIndicator color={colors.accent.green} style={{ marginVertical: spacing[4] }} />
            ) : checkoutPreview === null ? (
              <Text style={styles.walkInErr}>
                No active session on this table. It may have already been closed.
              </Text>
            ) : (
              <>
                <Text style={styles.checkoutTableName}>{checkoutPreview.tableLabel}</Text>
                <Text style={styles.checkoutMeta}>
                  {checkoutPreview.isGuest
                    ? `Guest: ${checkoutPreview.guestName ?? "Walk-in"}`
                    : "Registered customer"}
                </Text>
                <Text style={styles.checkoutBill}>
                  Total due:{" "}
                  <Text style={styles.checkoutBillStrong}>
                    {formatCurrency(checkoutPreview.finalBill, checkoutPreview.currency)}
                  </Text>
                </Text>
                <Text style={styles.checkoutDetail}>
                  {checkoutPreview.billableMinutes} min billable (
                  {checkoutPreview.actualMinutes} min played) · Table{" "}
                  {formatCurrency(
                    checkoutPreview.discountedTable,
                    checkoutPreview.currency,
                  )}
                  {checkoutPreview.discountAmount > 0
                    ? ` (−${checkoutPreview.discountPercent}% off ${formatCurrency(
                        checkoutPreview.tableSubtotal,
                        checkoutPreview.currency,
                      )})`
                    : ""}{" "}
                  · Snacks{" "}
                  {formatCurrency(
                    checkoutPreview.snackTotal,
                    checkoutPreview.currency,
                  )}
                </Text>
                {checkoutPreview.canApplyDiscount ? (
                  <View style={styles.discountRow}>
                    <Text style={styles.walkInLabel}>
                      Discount %{" "}
                      {checkoutPreview.maxDiscountPercent !== null
                        ? `(max ${checkoutPreview.maxDiscountPercent}%)`
                        : ""}
                    </Text>
                    <TextInput
                      style={styles.discountInput}
                      value={discountInput}
                      onChangeText={setDiscountInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.text.tertiary}
                      maxLength={5}
                    />
                    {checkoutPreview.maxDiscountPercent !== null &&
                    parsedDiscount > checkoutPreview.maxDiscountPercent ? (
                      <Text style={styles.discountHint}>
                        Capped at {checkoutPreview.maxDiscountPercent}% by your role.
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.discountHint}>
                    Your role cannot apply discounts.
                  </Text>
                )}
                <Text style={styles.walkInLabel}>Payment</Text>
                <View style={styles.payGrid}>
                  {(
                    [
                      ["cash", "Cash"],
                      ["upi", "UPI"],
                      ["card", "Card"],
                      ["credit", "On credit"],
                    ] as const
                  ).map(([method, label]) => (
                    <Pressable
                      key={method}
                      style={({ pressed }) => [
                        styles.payTile,
                        pressed && styles.pressed,
                        checkoutBusy && { opacity: 0.5 },
                      ]}
                      disabled={checkoutBusy}
                      onPress={() => void runCheckout(method)}
                    >
                      <Text style={styles.payTileText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <View style={[styles.modalActions, { marginTop: spacing[4] }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  pressed && styles.pressed,
                ]}
                onPress={closeCheckoutModal}
                disabled={checkoutBusy}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
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
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  activeCardLeft: { flex: 1, minWidth: 0 },
  activeCardActions: { gap: spacing[2] },
  closeTableBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
    alignItems: "center",
    justifyContent: "center",
  },
  closeTableBtnText: {
    ...typography.labelSmall,
    color: "#fff",
    fontWeight: "600",
  },
  activeCardTitle: {
    ...typography.label,
    color: colors.text.primary,
  },
  activeCardCustomer: {
    ...typography.bodySmall,
    color: colors.text.primary,
    marginTop: spacing[0.5],
  },
  guestBadgeInline: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  elapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
    marginTop: spacing[0.5],
  },
  elapsedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.green,
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
  checkoutTableName: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  checkoutMeta: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  },
  checkoutBill: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  checkoutBillStrong: {
    ...typography.heading4,
    color: colors.accent.green,
  },
  checkoutDetail: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing[4],
  },
  discountRow: {
    marginBottom: spacing[3],
  },
  discountInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  discountHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  payGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  payTile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[2],
  },
  payTileText: { ...typography.label, color: colors.text.primary },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    marginBottom: spacing[4],
    marginTop: spacing[2],
  },
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border.default,
    marginTop: 2,
  },
  consentBoxOn: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  consentText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  linkInline: {
    color: colors.status.info,
    textDecorationLine: "underline",
  },
});
