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
  Alert,
} from "react-native";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import {
  TableGrid,
  ComplaintBanner,
  type ComplaintBannerRow,
  PhoneInput,
} from "@a3/ui/components";
import { OwnerSnackPicker } from "../../components/OwnerSnackPicker";
import { CheckoutBillBreakdown } from "../../components/CheckoutBillBreakdown";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { formatCurrency, formatElapsed } from "@a3/utils/billing";
import { DEFAULT_PHONE_E164, isValidE164, normalizeE164 } from "@a3/utils/phone";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStaffRole, staffRoleQueryId, useStaffTabQueriesEnabled } from "../../lib/StaffRoleContext";
import { TabAccessDenied } from "../../components/TabAccessDenied";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";
import { useTranslation, getCurrentLanguage } from "@a3/i18n";
import { formatBookingSlotTag, formatSlotDurationLabel, slotDurationI18nKey } from "@a3/utils/bookingDisplay";
import {
  WalkInGroupSetup,
  type GroupPlayer,
  type PlayerSide,
} from "../../components/WalkInGroupSetup";
import { CustomerQrScannerModal } from "../../components/CustomerQrScannerModal";

const PRIVACY_URL = "https://a3billiards.com/privacy";
const TOS_URL = "https://a3billiards.com/terms";
const EXTEND_OPTIONS_MIN = [15, 30, 60] as const;
// Warn the desk that a table's assigned play time is nearly over.
const ENDING_SOON_MS = 10 * 60_000;

function SlotsScreenContent() {
  const { t } = useTranslation();
  const locale = getCurrentLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const { roleId, canAccessTab } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const slotsEnabled = useStaffTabQueriesEnabled("slots");
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
    "choose" | "customer" | "deskRegister" | "groupSetup" | "addTeammate"
  >("choose");
  const [guestNameInput, setGuestNameInput] = useState("Walk-in");
  const [walkInPlayDurationMin, setWalkInPlayDurationMin] = useState(60);
  const [walkInPlayOpenEnded, setWalkInPlayOpenEnded] = useState(false);
  const [customerPhoneInput, setCustomerPhoneInput] = useState(DEFAULT_PHONE_E164);
  const [debouncedCustomerPhone, setDebouncedCustomerPhone] = useState("");
  const [pendingCustomerId, setPendingCustomerId] = useState<Id<"users"> | null>(null);
  const [showComplaintGate, setShowComplaintGate] = useState(false);
  const walkInModalOpenedForTableRef = useRef<string | null>(null);
  const startingWalkInRef = useRef(false);
  const acquiringLockRef = useRef(false);
  const [checkoutTableId, setCheckoutTableId] = useState<Id<"tables"> | null>(
    null,
  );
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [debouncedDiscountInput, setDebouncedDiscountInput] = useState("");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [extendTableId, setExtendTableId] = useState<Id<"tables"> | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendConflict, setExtendConflict] = useState<{
    time: string;
    name: string;
    maxExtendMinutes: number;
  } | null>(null);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const extendingRef = useRef(false);
  const movingRef = useRef(false);

  /** Pool-side new customer: name, age, +91 phone, WhatsApp OTP, consent. */
  const [deskName, setDeskName] = useState("");
  const [deskAge, setDeskAge] = useState("");
  const [deskPhone, setDeskPhone] = useState(DEFAULT_PHONE_E164);
  const [deskOtp, setDeskOtp] = useState("");
  const [deskConsent, setDeskConsent] = useState(false);
  const [deskBusySend, setDeskBusySend] = useState(false);
  const [deskBusySubmit, setDeskBusySubmit] = useState(false);
  const [deskBusyExtendLock, setDeskBusyExtendLock] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [deskInfo, setDeskInfo] = useState<string | null>(null);
  const [deskRegisterFor, setDeskRegisterFor] = useState<"primary" | "teammate">(
    "primary",
  );
  const [groupPlayers, setGroupPlayers] = useState<GroupPlayer[]>([]);
  const [playMode, setPlayMode] = useState<"casual" | "versus">("casual");
  const [losersPay, setLosersPay] = useState(false);
  const [groupValidationError, setGroupValidationError] = useState<string | null>(
    null,
  );
  const [teammatePhoneInput, setTeammatePhoneInput] = useState(DEFAULT_PHONE_E164);
  const [debouncedTeammatePhone, setDebouncedTeammatePhone] = useState("");
  const [customerNameQuery, setCustomerNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [debouncedQrPayload, setDebouncedQrPayload] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrAutoContinue, setQrAutoContinue] = useState(false);
  const [qrScanForTeammate, setQrScanForTeammate] = useState(false);
  const [teammateNameQuery, setTeammateNameQuery] = useState("");
  const [debouncedTeammateNameQuery, setDebouncedTeammateNameQuery] = useState("");
  const [checkoutLoserSide, setCheckoutLoserSide] = useState<PlayerSide | null>(
    null,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerPhone(customerPhoneInput.trim()), 300);
    return () => clearTimeout(t);
  }, [customerPhoneInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTeammatePhone(teammatePhoneInput.trim()), 300);
    return () => clearTimeout(t);
  }, [teammatePhoneInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedNameQuery(customerNameQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [customerNameQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTeammateNameQuery(teammateNameQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [teammateNameQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQrPayload(qrPayload.trim()), 400);
    return () => clearTimeout(t);
  }, [qrPayload]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDiscountInput(discountInput.trim()), 500);
    return () => clearTimeout(t);
  }, [discountInput]);

  // Tick once a second so elapsed timers and live bill preview stay current.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const phoneReady = isValidE164(normalizeE164(debouncedCustomerPhone));
  const teammatePhoneReady = isValidE164(normalizeE164(debouncedTeammatePhone));
  const customerPhoneSearch = useQuery(
    api.complaints.searchCustomerByPhone,
    phoneReady ? { phone: debouncedCustomerPhone } : "skip",
  );
  const clubIdForLookup = dashboard?.clubId;
  const nameSearch = useQuery(
    api.ownerCustomerLookup.searchCustomersByName,
    clubIdForLookup && debouncedNameQuery.length >= 2
      ? { clubId: clubIdForLookup, nameQuery: debouncedNameQuery }
      : "skip",
  );
  const teammateNameSearch = useQuery(
    api.ownerCustomerLookup.searchCustomersByName,
    clubIdForLookup && debouncedTeammateNameQuery.length >= 2
      ? { clubId: clubIdForLookup, nameQuery: debouncedTeammateNameQuery }
      : "skip",
  );
  const qrResolve = useQuery(
    api.ownerCustomerLookup.resolveCustomerQrPayload,
    clubIdForLookup && debouncedQrPayload.length >= 8
      ? { clubId: clubIdForLookup, payload: debouncedQrPayload }
      : "skip",
  );

  const teammatePhoneSearch = useQuery(
    api.complaints.searchCustomerByPhone,
    teammatePhoneReady ? { phone: debouncedTeammatePhone } : "skip",
  );
  const customerComplaints = useQuery(
    api.complaints.getCustomerActiveComplaints,
    pendingCustomerId && clubIdForLookup
      ? { userId: pendingCustomerId, clubId: clubIdForLookup }
      : "skip",
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
  const extendTableLockForDeskOtp = useAction(
    api.ownerSessionActions.extendTableLockForDeskOtp,
  );
  const ownerSendDeskCustomerOtp = useAction(
    api.ownerDeskCustomerRegistration.ownerSendDeskCustomerRegistrationOtp,
  );
  const ownerCompleteDeskCustomerRegistration = useAction(
    api.ownerDeskCustomerRegistration.ownerCompleteDeskCustomerRegistration,
  );
  const releaseTableLock = useMutation(api.ownerSessions.releaseTableLock);
  const startWalkIn = useMutation(api.ownerSessions.startWalkInSession);
  const checkoutTableSession = useMutation(api.ownerSessions.checkoutTableSession);
  const extendSession = useMutation(api.ownerSessions.extendSession);
  const moveSession = useMutation(api.ownerSessions.moveSession);

  useEffect(() => {
    if (!showWalkInStartModal || !walkInTableId || !walkInLockToken) return;
    const extend = () => {
      void extendTableLockForDeskOtp({
        tableId: walkInTableId,
        lockToken: walkInLockToken,
      }).catch(() => {
        // Lock may already be cleared after session start; ignore.
      });
    };
    extend();
    const id = setInterval(extend, 60_000);
    return () => clearInterval(id);
  }, [showWalkInStartModal, walkInTableId, walkInLockToken, extendTableLockForDeskOtp]);

  const discountInputTooHigh = useMemo(() => {
    const trimmed = discountInput.trim();
    if (trimmed === "") return false;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 100;
  }, [discountInput]);

  const parsedDiscount = useMemo(() => {
    const trimmed = debouncedDiscountInput.trim();
    if (trimmed === "") return 0;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n >= 100) return 0;
    return n;
  }, [debouncedDiscountInput]);

  const checkoutPreview = useQuery(
    api.ownerSessions.previewTableCheckout,
    checkoutTableId !== null && slotsEnabled
      ? { tableId: checkoutTableId, roleId: queryRoleId, discountPercent: parsedDiscount }
      : "skip",
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const resetPlayerLookupState = useCallback(() => {
    setCustomerPhoneInput(DEFAULT_PHONE_E164);
    setDebouncedCustomerPhone("");
    setTeammatePhoneInput(DEFAULT_PHONE_E164);
    setDebouncedTeammatePhone("");
    setCustomerNameQuery("");
    setDebouncedNameQuery("");
    setTeammateNameQuery("");
    setDebouncedTeammateNameQuery("");
    setQrPayload("");
    setDebouncedQrPayload("");
    setQrAutoContinue(false);
    setQrScanForTeammate(false);
    setShowQrScanner(false);
    setPendingCustomerId(null);
  }, []);

  const clearWalkInState = useCallback(() => {
    walkInModalOpenedForTableRef.current = null;
    setWalkInTableId(null);
    setWalkInLockToken(null);
    setShowWalkInStartModal(false);
    setWalkInStartStep("choose");
    setGuestNameInput(t("ownerApp.slots.defaultWalkIn"));
    setShowComplaintGate(false);
    setDeskName("");
    setDeskAge("");
    setDeskPhone(DEFAULT_PHONE_E164);
    setDeskOtp("");
    setDeskConsent(false);
    setDeskError(null);
    setDeskInfo(null);
    setDeskBusySend(false);
    setDeskBusySubmit(false);
    setDeskBusyExtendLock(false);
    setDeskRegisterFor("primary");
    setGroupPlayers([]);
    setPlayMode("casual");
    setLosersPay(false);
    setGroupValidationError(null);
    setWalkInPlayDurationMin(60);
    setWalkInPlayOpenEnded(false);
    resetPlayerLookupState();
  }, [t, resetPlayerLookupState]);

  const buildParticipantsPayload = useCallback(
    (players: GroupPlayer[], mode: "casual" | "versus") =>
      players.map((p) => ({
        key: p.key,
        customerId: p.customerId,
        displayName: p.displayName,
        isGuest: false as const,
        side: mode === "versus" ? p.side : undefined,
      })),
    [],
  );

  const openGroupSetupForCustomer = useCallback(
    (userId: Id<"users">, name: string, phone: string) => {
      setPendingCustomerId(userId);
      setGroupPlayers([
        {
          key: String(userId),
          customerId: userId,
          displayName: name,
          phone,
          side: "sideA",
        },
      ]);
      setPlayMode("casual");
      setLosersPay(false);
      setGroupValidationError(null);
      setWalkInStartStep("groupSetup");
      if (walkInTableId && walkInLockToken) {
        void extendTableLockForDeskOtp({
          tableId: walkInTableId,
          lockToken: walkInLockToken,
        }).catch(() => {});
      }
    },
    [walkInTableId, walkInLockToken, extendTableLockForDeskOtp],
  );

  const onQrScanned = useCallback((payload: string) => {
    const trimmed = payload.trim();
    setQrPayload(trimmed);
    setDebouncedQrPayload(trimmed);
    setQrAutoContinue(true);
  }, []);

  const addTeammateToGroup = useCallback(
    (userId: Id<"users">, name: string, phone: string) => {
      if (groupPlayers.some((p) => p.customerId === userId)) {
        setDeskError(t("ownerApp.slots.teammateAlreadyAdded"));
        return;
      }
      const defaultSide: PlayerSide =
        groupPlayers.some((p) => p.side === "sideA") ? "sideB" : "sideA";
      setGroupPlayers((prev) => [
        ...prev,
        {
          key: String(userId),
          customerId: userId,
          displayName: name,
          phone,
          side: defaultSide,
        },
      ]);
      setDeskError(null);
      setTeammatePhoneInput("");
      setDebouncedTeammatePhone("");
      setWalkInStartStep("groupSetup");
    },
    [groupPlayers, t],
  );

  useEffect(() => {
    if (!qrAutoContinue || qrResolve === undefined) return;
    if (qrResolve.ok) {
      setQrAutoContinue(false);
      if (qrScanForTeammate) {
        setQrScanForTeammate(false);
        addTeammateToGroup(
          qrResolve.user._id,
          qrResolve.user.name,
          qrResolve.user.phone ?? "",
        );
      } else {
        openGroupSetupForCustomer(
          qrResolve.user._id,
          qrResolve.user.name,
          qrResolve.user.phone ?? "",
        );
      }
    } else {
      setQrAutoContinue(false);
      Alert.alert(t("ownerApp.slots.error"), qrResolve.message);
    }
  }, [qrAutoContinue, qrResolve, qrScanForTeammate, addTeammateToGroup, openGroupSetupForCustomer, t]);

  const validateGroupBeforeStart = useCallback((): string | null => {
    if (playMode === "versus") {
      if (groupPlayers.length < 2) {
        return t("ownerApp.slots.needTwoForVersus");
      }
      const hasA = groupPlayers.some((p) => p.side === "sideA");
      const hasB = groupPlayers.some((p) => p.side === "sideB");
      if (!hasA || !hasB) {
        return t("ownerApp.slots.assignBothSides");
      }
    }
    return null;
  }, [groupPlayers, playMode, t]);

  const runStartWalkIn = useCallback(
    async (
      tableId: Id<"tables">,
      lockToken: string,
      opts?: {
        forceOverride?: boolean;
        guestName?: string;
        customerId?: Id<"users">;
        staffAcknowledgedComplaint?: boolean;
        participants?: ReturnType<typeof buildParticipantsPayload>;
        playMode?: "casual" | "versus";
        losersPay?: boolean;
        assignedPlayDurationMin?: number;
        assignedPlayOpenEnded?: boolean;
      },
    ) => {
      if (startingWalkInRef.current) return;
      startingWalkInRef.current = true;
      setActionError(null);
      try {
        const result = await startWalkIn({
          tableId,
          lockToken,
          forceStartDespiteConflict: opts?.forceOverride || undefined,
          guestName: opts?.customerId ? undefined : opts?.guestName,
          customerId: opts?.customerId,
          roleId: queryRoleId,
          staffAcknowledgedComplaint: opts?.staffAcknowledgedComplaint,
          participants: opts?.participants,
          playMode: opts?.playMode,
          losersPay: opts?.losersPay,
          assignedPlayDurationMin: opts?.assignedPlayOpenEnded
            ? undefined
            : opts?.assignedPlayDurationMin,
          assignedPlayOpenEnded: opts?.assignedPlayOpenEnded || undefined,
        });
        if ((result as { hasUpcomingBooking?: boolean }).hasUpcomingBooking) {
          const r = result as {
            customerName?: string;
            bookingTime?: string;
          };
          setPendingConflictMessage(
            t("ownerApp.slots.bookingConflictBody", {
              customerName:
                r.customerName ?? t("sharedUi.bookingCard.customerFallback"),
              bookingTime: r.bookingTime ?? "",
            }),
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
      } finally {
        startingWalkInRef.current = false;
      }
    },
    [startWalkIn, clearWalkInState, queryRoleId, t],
  );

  const playDurationOptions = dashboard?.slotDurationOptions ?? [30, 60, 90, 120, 180];

  const walkInPlayParams = useMemo(
    () => ({
      assignedPlayDurationMin: walkInPlayOpenEnded ? undefined : walkInPlayDurationMin,
      assignedPlayOpenEnded: walkInPlayOpenEnded || undefined,
    }),
    [walkInPlayDurationMin, walkInPlayOpenEnded],
  );

  const startGroupSession = useCallback(
    (staffAcknowledgedComplaint?: boolean) => {
      if (!walkInTableId || !walkInLockToken || !pendingCustomerId) return;
      const err = validateGroupBeforeStart();
      if (err) {
        setGroupValidationError(err);
        return;
      }
      setGroupValidationError(null);
      void runStartWalkIn(walkInTableId, walkInLockToken, {
        customerId: pendingCustomerId,
        participants: buildParticipantsPayload(groupPlayers, playMode),
        playMode,
        losersPay: playMode === "versus" ? losersPay : false,
        staffAcknowledgedComplaint,
        ...walkInPlayParams,
      });
    },
    [
      walkInTableId,
      walkInLockToken,
      pendingCustomerId,
      validateGroupBeforeStart,
      runStartWalkIn,
      buildParticipantsPayload,
      groupPlayers,
      playMode,
      losersPay,
      walkInPlayParams,
    ],
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
    setDebouncedDiscountInput("");
    setCheckoutLoserSide(null);
    setCheckoutTableId(tableId);
    setShowCheckoutModal(true);
  }, []);

  const closeCheckoutModal = useCallback(() => {
    if (checkoutBusy) return;
    setShowCheckoutModal(false);
    setCheckoutTableId(null);
    setDiscountInput("");
    setDebouncedDiscountInput("");
    setCheckoutLoserSide(null);
  }, [checkoutBusy]);

  const runCheckout = useCallback(
    async (paymentMethod: "cash" | "upi" | "card" | "credit") => {
      if (checkoutTableId === null) return;
      if (discountInputTooHigh) {
        setActionError(t("ownerApp.slots.discountMustBeLessThan100"));
        return;
      }
      if (
        checkoutPreview?.requiresLoserSide &&
        checkoutLoserSide === null
      ) {
        setActionError(t("ownerApp.slots.selectLosingSide"));
        return;
      }
      setCheckoutBusy(true);
      setActionError(null);
      try {
        await checkoutTableSession({
          tableId: checkoutTableId,
          paymentMethod,
          roleId: queryRoleId,
          discountPercent: parsedDiscount > 0 ? parsedDiscount : undefined,
          loserSide: checkoutPreview?.requiresLoserSide
            ? checkoutLoserSide ?? undefined
            : undefined,
        });
        setShowCheckoutModal(false);
        setCheckoutTableId(null);
        setDiscountInput("");
        setCheckoutLoserSide(null);
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
      } finally {
        setCheckoutBusy(false);
      }
    },
    [
      checkoutTableId,
      checkoutTableSession,
      queryRoleId,
      parsedDiscount,
      discountInputTooHigh,
      checkoutPreview?.requiresLoserSide,
      checkoutLoserSide,
      t,
    ],
  );

  const closeExtendModal = useCallback(() => {
    if (extendBusy) return;
    setExtendTableId(null);
    setExtendConflict(null);
    setShowMovePicker(false);
  }, [extendBusy]);

  // Local clock label (respects club timezone + user locale) for showing the
  // resulting end time when extending a session.
  const formatClock = useCallback(
    (ms: number): string =>
      new Intl.DateTimeFormat(locale, {
        timeZone: dashboard?.timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(ms)),
    [locale, dashboard?.timezone],
  );

  const runExtend = useCallback(
    async (addMinutes: number) => {
      if (extendTableId === null || extendingRef.current) return;
      extendingRef.current = true;
      setExtendBusy(true);
      setActionError(null);
      try {
        const res = await extendSession({
          tableId: extendTableId,
          addMinutes,
          roleId: queryRoleId,
        });
        if (res.ok) {
          setExtendConflict(null);
          setExtendTableId(null);
          setShowMovePicker(false);
        } else {
          const time = new Intl.DateTimeFormat(locale, {
            timeZone: dashboard?.timezone,
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(res.conflictStartMs));
          setExtendConflict({
            time,
            name: res.conflictCustomerName,
            maxExtendMinutes: res.maxExtendMinutes,
          });
        }
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
        setExtendTableId(null);
      } finally {
        extendingRef.current = false;
        setExtendBusy(false);
      }
    },
    [extendTableId, extendSession, queryRoleId, locale, dashboard?.timezone],
  );

  const freeTablesForMove = useMemo(() => {
    if (!dashboard || extendTableId === null) return [];
    const source = dashboard.tables.find((tb) => tb._id === extendTableId);
    if (!source) return [];
    return dashboard.tables.filter(
      (tb) =>
        tb._id !== extendTableId &&
        tb.isActive &&
        tb.currentSessionId === undefined &&
        tb.tableType === source.tableType,
    );
  }, [dashboard, extendTableId]);

  const runMove = useCallback(
    async (toTableId: Id<"tables">) => {
      if (extendTableId === null || movingRef.current) return;
      movingRef.current = true;
      setMoveBusy(true);
      setActionError(null);
      try {
        const res = await moveSession({
          fromTableId: extendTableId,
          toTableId,
          roleId: queryRoleId,
        });
        if (res.ok) {
          setShowMovePicker(false);
          setExtendConflict(null);
          setExtendTableId(null);
        } else {
          const time = new Intl.DateTimeFormat(locale, {
            timeZone: dashboard?.timezone,
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(res.conflictStartMs));
          Alert.alert(
            t("ownerApp.slots.moveTable"),
            t("ownerApp.slots.extendConflictNoRoom", {
              time,
              name: ` (${res.conflictCustomerName})`,
            }),
          );
        }
      } catch (e) {
        setActionError(parseConvexError(e as Error).message);
      } finally {
        movingRef.current = false;
        setMoveBusy(false);
      }
    },
    [extendTableId, moveSession, queryRoleId, locale, dashboard?.timezone, t],
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
      resetPlayerLookupState();
      setGroupPlayers([]);
      setPlayMode("casual");
      setLosersPay(false);
      setGroupValidationError(null);
      if (acquiringLockRef.current) return;
      acquiringLockRef.current = true;
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
        acquiringLockRef.current = false;
        setAcquiringLock(false);
      }
    },
    [dashboard, acquireTableLock, openCheckoutForTable, resetPlayerLookupState],
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
    void runStartWalkIn(walkInTableId, walkInLockToken, {
      forceOverride: true,
      ...walkInPlayParams,
    });
  }, [walkInTableId, walkInLockToken, runStartWalkIn, walkInPlayParams]);

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

  const renderPlayDurationChips = () => (
    <View style={styles.playDurationBlock}>
      <Text style={styles.walkInLabel}>{t("ownerApp.slots.assignPlayDuration")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.playDurationRow}>
          {playDurationOptions.map((min) => {
            const key = slotDurationI18nKey(min);
            const label = key ? t(key) : `${min} min`;
            const active = !walkInPlayOpenEnded && walkInPlayDurationMin === min;
            return (
              <Pressable
                key={min}
                style={[styles.playDurationChip, active && styles.playDurationChipActive]}
                onPress={() => {
                  setWalkInPlayOpenEnded(false);
                  setWalkInPlayDurationMin(min);
                }}
              >
                <Text
                  style={[
                    styles.playDurationChipText,
                    active && styles.playDurationChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const bannerRows: ComplaintBannerRow[] = useMemo(() => {
    if (!customerComplaints?.complaints) return [];
    return customerComplaints.complaints.map((c) => ({
      type: c.type,
      typeLabel: c.typeLabel,
      clubName: c.clubName,
      createdAt: c.createdAt,
    }));
  }, [customerComplaints]);

  const localizedBookingTags = useMemo(() => {
    if (!dashboard) return {};
    const raw = dashboard.bookingTagByTableId ?? {};
    const tz = dashboard.timezone;
    const out: Record<string, { label: string }> = {};
    for (const [tableId, tag] of Object.entries(raw)) {
      out[tableId] = {
        label: formatBookingSlotTag(
          tag.startMs,
          tag.durationMin,
          tag.openEnded,
          tz,
          locale,
          t,
        ),
      };
    }
    return out;
  }, [dashboard, locale, t]);

  if (dashboard === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.loadingText}>{t("ownerApp.slots.loadingTables")}</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (roleId !== undefined && !canAccessTab("slots")) {
    return <TabAccessDenied tabLabel={t("common.tabs.owner.slots")} />;
  }

  const summary = dashboard.bookingSummary;
  const showSummary = dashboard.bookingSettingsEnabled;
  /** Do not cover the walk-in / conflict modals — overlay uses absoluteFill and can steal touches on some devices. */
  const showLockOverlay =
    acquiringLock ||
    (walkInTableId !== null &&
      walkInLockToken !== null &&
      !showWalkInStartModal &&
      !showConflictModal &&
      conflict === undefined);
  const activeTables = dashboard.tables.filter(
    (table) => table.currentSessionId !== undefined,
  );
  const activeSessionByTableId = dashboard.activeSessionByTableId ?? {};
  const extendSessionMeta =
    extendTableId !== null ? activeSessionByTableId[extendTableId] : undefined;
  // Extensions are added on top of the later of "now" or the current planned end
  // (mirrors ownerSessions.extendSession), so the desk sees the real finish time.
  const extendBaseMs =
    extendSessionMeta != null
      ? Math.max(extendSessionMeta.plannedEndTime ?? nowMs, nowMs)
      : nowMs;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.green}
          />
        }
      >
        <Text style={styles.screenTitle}>{dashboard.clubName}</Text>
        <Text style={styles.screenSubtitle}>{t("ownerApp.slots.subtitle")}</Text>

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
              <Text style={styles.summaryLabel}>{t("ownerApp.slots.pending")}</Text>
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
              <Text style={styles.summaryLabel}>{t("ownerApp.slots.confirmedToday")}</Text>
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
              <Text style={styles.summaryLabel}>{t("ownerApp.slots.completedToday")}</Text>
            </Pressable>
          </View>
        )}

        {actionError !== null && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorLabel}>{t("ownerApp.slots.error")}</Text>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        )}

        <TableGrid
          tables={dashboard.tables}
          bookingTagByTableId={localizedBookingTags}
          onTablePress={handleTablePress}
        />

        {activeTables.length > 0 ? (
          <View style={styles.activeSection}>
            <Text style={styles.activeSectionTitle}>{t("ownerApp.slots.activeTables")}</Text>
            <Text style={styles.activeSectionHint}>{t("ownerApp.slots.activeTablesHint")}</Text>
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
                      {session?.customerName ?? t("ownerApp.slots.sessionInProgress")}
                      {session?.isGuest ? (
                        <Text style={styles.guestBadgeInline}>{t("ownerApp.slots.guestBadge")}</Text>
                      ) : null}
                      {session?.playMode === "versus" ? (
                        <Text style={styles.versusBadgeInline}>
                          {" · "}
                          {t("ownerApp.slots.versusBadge")}
                          {session.losersPay
                            ? ` · ${t("ownerApp.slots.losersPayBadge")}`
                            : ""}
                        </Text>
                      ) : null}
                      {(session?.playerCount ?? 0) > 1 ? (
                        <Text style={styles.versusBadgeInline}>
                          {" · "}
                          {t("ownerApp.slots.playersCount", {
                            count: session?.playerCount ?? 0,
                          })}
                        </Text>
                      ) : null}
                    </Text>
                    {elapsedLabel ? (
                      <View style={styles.elapsedRow}>
                        <View style={styles.elapsedDot} />
                        <Text style={styles.activeCardMeta}>
                          {t("ownerApp.slots.elapsedSuffix", { time: elapsedLabel })}
                          {session
                            ? ` · ${formatSlotDurationLabel(
                                session.assignedPlayDurationMin ?? 60,
                                session.assignedPlayOpenEnded,
                                t,
                              )}`
                            : ""}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.activeCardMeta}>
                        {t("ownerApp.slots.sessionInProgress")}
                      </Text>
                    )}
                    {session?.plannedEndTime != null ? (
                      session.plannedEndTime > nowMs ? (
                        session.plannedEndTime - nowMs <= ENDING_SOON_MS ? (
                          <Text style={styles.endingSoonMeta}>
                            {t("ownerApp.slots.endingSoon", {
                              time: formatElapsed(session.plannedEndTime - nowMs),
                            })}
                          </Text>
                        ) : (
                          <Text style={styles.activeCardMeta}>
                            {t("ownerApp.slots.remaining", {
                              time: formatElapsed(session.plannedEndTime - nowMs),
                            })}
                          </Text>
                        )
                      ) : (
                        <View>
                          <Text style={styles.overtimeMeta}>
                            {t("ownerApp.slots.overtime", {
                              time: formatElapsed(nowMs - session.plannedEndTime),
                            })}
                          </Text>
                          <Text style={styles.timeUpMeta}>
                            {t("ownerApp.slots.timeUp")}
                          </Text>
                        </View>
                      )
                    ) : null}
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
                      <Text style={styles.closeTableBtnText}>{t("ownerApp.slots.closeTable")}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.addSnacksBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        setActionError(null);
                        setExtendConflict(null);
                        setShowMovePicker(false);
                        setExtendTableId(table._id as Id<"tables">);
                      }}
                    >
                      <Text style={styles.addSnacksBtnText}>{t("ownerApp.slots.addTime")}</Text>
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
                      <Text style={styles.addSnacksBtnText}>{t("ownerApp.slots.addItems")}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {showLockOverlay && (
        <View style={styles.lockOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.accent.green} />
          <Text style={styles.lockOverlayText}>{t("ownerApp.slots.reservingTable")}</Text>
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
            <Text style={styles.modalTitle}>{t("ownerApp.slots.bookingConflict")}</Text>
            <Text style={styles.modalBody}>{pendingConflictMessage}</Text>
            <Text style={styles.modalHint}>{t("ownerApp.slots.bookingConflictHint")}</Text>
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
                accessibilityLabel={t("ownerApp.slots.pickDifferentTable")}
              >
                <Text style={styles.modalBtnSecondaryText}>
                  {t("ownerApp.slots.pickDifferentTable")}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  pressed && styles.pressed,
                ]}
                onPress={proceedAnyway}
                accessibilityRole="button"
                accessibilityLabel={t("ownerApp.slots.proceedAnyway")}
              >
                <Text style={styles.modalBtnPrimaryText}>{t("ownerApp.slots.proceedAnyway")}</Text>
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
          <View style={[styles.modalCard, { maxHeight: "90%" }]}>
            {walkInStartStep === "choose" ? (
              <ScrollView
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.modalTitle}>{t("ownerApp.slots.startSession")}</Text>
                <Text style={styles.modalBody}>{t("ownerApp.slots.walkInModalBody")}</Text>
                {renderPlayDurationChips()}
                <Text style={styles.walkInLabel}>{t("ownerApp.slots.guestDisplayName")}</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={guestNameInput}
                  onChangeText={setGuestNameInput}
                  placeholder={t("ownerApp.slots.defaultWalkIn")}
                  placeholderTextColor={colors.text.tertiary}
                />
                {deskError ? (
                  <Text style={styles.walkInErr}>{deskError}</Text>
                ) : null}
                {deskInfo ? (
                  <Text style={styles.walkInOk}>{deskInfo}</Text>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnPrimary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      if (!walkInTableId || !walkInLockToken) return;
                      setDeskError(null);
                      const g = guestNameInput.trim() || t("ownerApp.slots.defaultWalkIn");
                      void runStartWalkIn(walkInTableId, walkInLockToken, {
                        guestName: g,
                        ...walkInPlayParams,
                      });
                    }}
                  >
                    <Text style={styles.modalBtnPrimaryText}>{t("ownerApp.slots.walkInGuest")}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      setDeskError(null);
                      setWalkInStartStep("customer");
                      setPendingCustomerId(null);
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>
                      {t("ownerApp.slots.registeredCustomer")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      (pressed || deskBusyExtendLock) && styles.pressed,
                      deskBusyExtendLock && styles.modalBtnDisabled,
                    ]}
                    disabled={deskBusyExtendLock}
                    hitSlop={8}
                    onPress={() => {
                      void (async () => {
                        if (
                          !walkInTableId ||
                          walkInLockToken === null ||
                          deskBusyExtendLock
                        ) {
                          return;
                        }
                        setDeskError(null);
                        setActionError(null);
                        setDeskBusyExtendLock(true);
                        try {
                          await extendTableLockForDeskOtp({
                            tableId: walkInTableId,
                            lockToken: walkInLockToken,
                          });
                          setDeskName("");
                          setDeskAge("");
                          setDeskPhone(DEFAULT_PHONE_E164);
                          setDeskOtp("");
                          setDeskConsent(false);
                          setDeskRegisterFor("primary");
                          setWalkInStartStep("deskRegister");
                        } catch (e) {
                          setDeskError(parseConvexError(e as Error).message);
                        } finally {
                          setDeskBusyExtendLock(false);
                        }
                      })();
                    }}
                  >
                    {deskBusyExtendLock ? (
                      <ActivityIndicator color={colors.text.primary} />
                    ) : (
                      <Text style={styles.modalBtnSecondaryText}>
                        {t("ownerApp.slots.newCustomerWhatsApp")}
                      </Text>
                    )}
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
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.cancel")}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : walkInStartStep === "deskRegister" ? (
              <ScrollView
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>{t("ownerApp.slots.registerCustomer")}</Text>
                <Text style={styles.modalHint}>{t("ownerApp.slots.registerCustomerHint")}</Text>
                {deskError ? (
                  <Text style={styles.walkInErr}>{deskError}</Text>
                ) : null}
                {deskInfo ? (
                  <Text style={styles.walkInOk}>{deskInfo}</Text>
                ) : null}
                <Text style={styles.walkInLabel}>{t("ownerApp.slots.fullName")}</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={deskName}
                  onChangeText={setDeskName}
                  placeholder={t("ownerApp.slots.asOnId")}
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.walkInLabel}>{t("auth.owner.register.age")}</Text>
                <TextInput
                  style={styles.walkInInput}
                  value={deskAge}
                  onChangeText={setDeskAge}
                  placeholder={t("ownerApp.slots.age18Plus")}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.walkInLabel}>{t("ownerApp.slots.mobileWhatsApp")}</Text>
                <PhoneInput
                  value={deskPhone}
                  onChangeValue={setDeskPhone}
                  countryCodeLabel={t("auth.phone.countryCode")}
                  selectCountryLabel={t("auth.phone.selectCountry")}
                  accessibilityLabel={t("auth.phone.number")}
                  inputStyle={styles.walkInInput}
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
                      const phone = normalizeE164(deskPhone);
                      if (!isValidE164(phone)) {
                        setDeskError(t("ownerApp.slots.usePhoneFormat"));
                        setDeskInfo(null);
                        return;
                      }
                      setDeskError(null);
                      setDeskInfo(null);
                      setDeskBusySend(true);
                      try {
                        await ownerSendDeskCustomerOtp({ phone });
                        setDeskInfo(t("ownerApp.slots.otpSentWhatsApp"));
                        Alert.alert(
                          t("ownerApp.slots.codeSentTitle"),
                          t("ownerApp.slots.codeSentBody"),
                        );
                      } catch (e) {
                        setDeskInfo(null);
                        setDeskError(parseConvexError(e as Error).message);
                      } finally {
                        setDeskBusySend(false);
                      }
                    })();
                  }}
                >
                  <Text style={styles.modalBtnSecondaryText}>
                    {deskBusySend ? t("ownerApp.slots.sending") : t("ownerApp.slots.sendWhatsAppCode")}
                  </Text>
                </Pressable>
                <Text style={styles.walkInLabel}>{t("ownerApp.slots.sixDigitCode")}</Text>
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
                    {t("ownerApp.slots.consentDeskPrefix")}{" "}
                    <Text
                      style={styles.linkInline}
                      onPress={() => void Linking.openURL(TOS_URL).catch(() => {})}
                    >
                      {t("ownerApp.slots.terms")}
                    </Text>{" "}
                    {t("ownerApp.slots.and")}{" "}
                    <Text
                      style={styles.linkInline}
                      onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})}
                    >
                      {t("ownerApp.slots.privacyPolicy")}
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
                      const phone = normalizeE164(deskPhone);
                      const code = deskOtp.replace(/\s/g, "");
                      if (name.length < 2) {
                        setDeskError(t("ownerApp.slots.enterFullName"));
                        setDeskInfo(null);
                        return;
                      }
                      if (!Number.isInteger(ageN) || ageN < 18) {
                        setDeskError(t("ownerApp.slots.ageMustBe18"));
                        setDeskInfo(null);
                        return;
                      }
                      if (!isValidE164(phone)) {
                        setDeskError(t("ownerApp.slots.usePhoneFormat"));
                        setDeskInfo(null);
                        return;
                      }
                      if (!/^\d{6}$/.test(code)) {
                        setDeskError(t("ownerApp.slots.enterWhatsAppCode"));
                        setDeskInfo(null);
                        return;
                      }
                      if (!deskConsent) {
                        setDeskError(t("ownerApp.slots.confirmConsentCheckbox"));
                        setDeskInfo(null);
                        return;
                      }
                      setDeskError(null);
                      setDeskInfo(null);
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
                        if (deskRegisterFor === "teammate") {
                          addTeammateToGroup(userId, name, phone);
                          setDeskRegisterFor("primary");
                        } else {
                          openGroupSetupForCustomer(userId, name, phone);
                        }
                        setWalkInStartStep(
                          deskRegisterFor === "teammate" ? "groupSetup" : "groupSetup",
                        );
                        setDeskOtp("");
                      } catch (e) {
                        setDeskInfo(null);
                        setDeskError(parseConvexError(e as Error).message);
                      } finally {
                        setDeskBusySubmit(false);
                      }
                    })();
                  }}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {deskBusySubmit ? t("ownerApp.slots.saving") : t("ownerApp.slots.verifyContinue")}
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
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.back")}</Text>
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
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.cancel")}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : walkInStartStep === "groupSetup" ? (
              <WalkInGroupSetup
                players={groupPlayers}
                primaryCustomerId={pendingCustomerId}
                playMode={playMode}
                losersPay={losersPay}
                onPlayModeChange={(next) => {
                  setPlayMode(next);
                  if (next === "casual") setLosersPay(false);
                  setGroupValidationError(null);
                }}
                onLosersPayChange={setLosersPay}
                onSideChange={(customerId, side) => {
                  setGroupPlayers((prev) =>
                    prev.map((p) =>
                      p.customerId === customerId ? { ...p, side } : p,
                    ),
                  );
                }}
                onRemove={(customerId) => {
                  setGroupPlayers((prev) =>
                    prev.filter((p) => p.customerId !== customerId),
                  );
                }}
                onAddTeammate={() => {
                  setDeskError(null);
                  setTeammatePhoneInput("");
                  setDebouncedTeammatePhone("");
                  setWalkInStartStep("addTeammate");
                }}
                onRegisterTeammate={() => {
                  setDeskRegisterFor("teammate");
                  setDeskName("");
                  setDeskAge("");
                  setDeskPhone(DEFAULT_PHONE_E164);
                  setDeskOtp("");
                  setDeskConsent(false);
                  setDeskError(null);
                  if (walkInTableId && walkInLockToken) {
                    void extendTableLockForDeskOtp({
                      tableId: walkInTableId,
                      lockToken: walkInLockToken,
                    }).catch(() => {});
                  }
                  setWalkInStartStep("deskRegister");
                }}
                onStart={() => {
                  if (!walkInTableId || !walkInLockToken || !pendingCustomerId) return;
                  if (customerComplaints?.hasComplaints) {
                    setShowComplaintGate(true);
                    return;
                  }
                  startGroupSession();
                }}
                onBack={() => {
                  setGroupValidationError(null);
                  resetPlayerLookupState();
                  setGroupPlayers([]);
                  setWalkInStartStep("customer");
                }}
                validationError={groupValidationError}
                t={t}
              />
            ) : walkInStartStep === "addTeammate" ? (
              <ScrollView
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>{t("ownerApp.slots.addTeammate")}</Text>
                <Text style={styles.modalHint}>{t("ownerApp.slots.addTeammatePhone")}</Text>

                <Text style={[styles.modalHint, { marginTop: spacing[3] }]}>
                  {t("ownerApp.slots.scanQrCode")}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtnPrimary,
                    pressed && styles.pressed,
                    { marginBottom: spacing[2] },
                  ]}
                  onPress={() => {
                    setQrScanForTeammate(true);
                    setShowQrScanner(true);
                  }}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {t("ownerApp.slots.openQrScanner")}
                  </Text>
                </Pressable>
                <TextInput
                  style={styles.walkInInput}
                  value={qrPayload}
                  onChangeText={setQrPayload}
                  placeholder={t("ownerApp.slots.qrPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {qrResolve === undefined && debouncedQrPayload.length >= 8 ? (
                  <ActivityIndicator color={colors.accent.green} />
                ) : qrResolve && !qrResolve.ok && debouncedQrPayload.length >= 8 ? (
                  <Text style={styles.walkInErr}>{qrResolve.message}</Text>
                ) : qrResolve?.ok ? (
                  <View style={styles.foundCard}>
                    <Text style={styles.foundName}>{qrResolve.user.name}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.modalBtnPrimary, pressed && styles.pressed]}
                      onPress={() =>
                        addTeammateToGroup(
                          qrResolve.user._id,
                          qrResolve.user.name,
                          qrResolve.user.phone ?? "",
                        )
                      }
                    >
                      <Text style={styles.modalBtnPrimaryText}>
                        {t("ownerApp.slots.addTeammate")}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Text style={[styles.modalHint, { marginTop: spacing[3] }]}>
                  {t("ownerApp.slots.customerNameSearch")}
                </Text>
                <TextInput
                  style={styles.walkInInput}
                  value={teammateNameQuery}
                  onChangeText={setTeammateNameQuery}
                  placeholder={t("ownerApp.slots.customerNamePlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                />
                {teammateNameSearch?.users.map((u) => (
                  <Pressable
                    key={u._id}
                    style={({ pressed }) => [styles.foundCard, pressed && styles.pressed]}
                    onPress={() =>
                      addTeammateToGroup(u._id, u.name, u.phone ?? "")
                    }
                  >
                    <Text style={styles.foundName}>{u.name}</Text>
                    {u.phone ? <Text style={styles.foundPhone}>{u.phone}</Text> : null}
                  </Pressable>
                ))}

                <PhoneInput
                  value={teammatePhoneInput}
                  onChangeValue={setTeammatePhoneInput}
                  countryCodeLabel={t("auth.phone.countryCode")}
                  selectCountryLabel={t("auth.phone.selectCountry")}
                  accessibilityLabel={t("auth.phone.number")}
                  inputStyle={styles.walkInInput}
                />
                {teammatePhoneSearch === undefined && teammatePhoneReady ? (
                  <ActivityIndicator color={colors.accent.green} />
                ) : teammatePhoneSearch && !teammatePhoneSearch.ok ? (
                  <Text style={styles.walkInErr}>{teammatePhoneSearch.message}</Text>
                ) : teammatePhoneSearch?.ok ? (
                  <View style={styles.foundCard}>
                    <Text style={styles.foundName}>{teammatePhoneSearch.user.name}</Text>
                    <Text style={styles.foundPhone}>{teammatePhoneSearch.user.phone}</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalBtnPrimary,
                        pressed && styles.pressed,
                        { marginTop: spacing[3] },
                      ]}
                      onPress={() =>
                        addTeammateToGroup(
                          teammatePhoneSearch.user._id,
                          teammatePhoneSearch.user.name,
                          teammatePhoneSearch.user.phone ?? debouncedTeammatePhone,
                        )
                      }
                    >
                      <Text style={styles.modalBtnPrimaryText}>
                        {t("ownerApp.slots.addTeammate")}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setWalkInStartStep("groupSetup")}
                  >
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.back")}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t("ownerApp.slots.customerPhone")}</Text>
                <Text style={styles.modalHint}>{t("ownerApp.slots.phoneFormatHint")}</Text>

                <Text style={[styles.modalHint, { marginTop: spacing[3] }]}>
                  {t("ownerApp.slots.scanQrCode")}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtnPrimary,
                    pressed && styles.pressed,
                    { marginBottom: spacing[2] },
                  ]}
                  onPress={() => setShowQrScanner(true)}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {t("ownerApp.slots.openQrScanner")}
                  </Text>
                </Pressable>
                <TextInput
                  style={styles.walkInInput}
                  value={qrPayload}
                  onChangeText={setQrPayload}
                  placeholder={t("ownerApp.slots.qrPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {qrResolve === undefined && debouncedQrPayload.length >= 8 ? (
                  <ActivityIndicator color={colors.accent.green} />
                ) : qrResolve && !qrResolve.ok ? (
                  <Text style={styles.walkInErr}>{qrResolve.message}</Text>
                ) : qrResolve?.ok ? (
                  <View style={styles.foundCard}>
                    <Text style={styles.foundName}>{qrResolve.user.name}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.modalBtnPrimary, pressed && styles.pressed]}
                      onPress={() =>
                        openGroupSetupForCustomer(
                          qrResolve.user._id,
                          qrResolve.user.name,
                          qrResolve.user.phone ?? "",
                        )
                      }
                    >
                      <Text style={styles.modalBtnPrimaryText}>
                        {t("ownerApp.slots.continueToGroup")}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Text style={[styles.modalHint, { marginTop: spacing[3] }]}>
                  {t("ownerApp.slots.customerNameSearch")}
                </Text>
                <TextInput
                  style={styles.walkInInput}
                  value={customerNameQuery}
                  onChangeText={setCustomerNameQuery}
                  placeholder={t("ownerApp.slots.customerNamePlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                />
                {nameSearch?.users.map((u) => (
                  <Pressable
                    key={u._id}
                    style={({ pressed }) => [styles.foundCard, pressed && styles.pressed]}
                    onPress={() =>
                      openGroupSetupForCustomer(u._id, u.name, u.phone ?? "")
                    }
                  >
                    <Text style={styles.foundName}>{u.name}</Text>
                    {u.phone ? <Text style={styles.foundPhone}>{u.phone}</Text> : null}
                  </Pressable>
                ))}

                <PhoneInput
                  value={customerPhoneInput}
                  onChangeValue={setCustomerPhoneInput}
                  countryCodeLabel={t("auth.phone.countryCode")}
                  selectCountryLabel={t("auth.phone.selectCountry")}
                  accessibilityLabel={t("auth.phone.number")}
                  inputStyle={styles.walkInInput}
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
                      <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.useThisCustomer")}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalBtnPrimary,
                        pressed && styles.pressed,
                        { marginTop: spacing[2] },
                      ]}
                      onPress={() =>
                        openGroupSetupForCustomer(
                          customerPhoneSearch.user._id,
                          customerPhoneSearch.user.name,
                          customerPhoneSearch.user.phone ?? debouncedCustomerPhone,
                        )
                      }
                    >
                      <Text style={styles.modalBtnPrimaryText}>
                        {t("ownerApp.slots.continueToGroup")}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {pendingCustomerId !== null && customerComplaints !== undefined ? (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalBtnPrimary,
                        pressed && styles.pressed,
                        { marginTop: spacing[4] },
                      ]}
                      onPress={() => {
                        if (!pendingCustomerId) return;
                        const primary = groupPlayers.find(
                          (p) => p.customerId === pendingCustomerId,
                        );
                        if (!primary) {
                          openGroupSetupForCustomer(
                            pendingCustomerId,
                            customerPhoneSearch?.ok
                              ? customerPhoneSearch.user.name
                              : t("sharedUi.bookingCard.customerFallback"),
                            debouncedCustomerPhone,
                          );
                          return;
                        }
                        setWalkInStartStep("groupSetup");
                      }}
                    >
                      <Text style={styles.modalBtnPrimaryText}>
                        {t("ownerApp.slots.continueToGroup")}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      resetPlayerLookupState();
                      setGroupPlayers([]);
                      setWalkInStartStep("choose");
                    }}
                  >
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.back")}</Text>
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
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.cancel")}</Text>
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
                if (walkInStartStep === "groupSetup" || groupPlayers.length > 1) {
                  startGroupSession(true);
                  return;
                }
                void runStartWalkIn(walkInTableId, walkInLockToken, {
                  customerId: pendingCustomerId,
                  staffAcknowledgedComplaint: true,
                  ...walkInPlayParams,
                });
              }}
            />
          </View>
        </View>
      </Modal>

      {snackPickerSessionId !== null && dashboard ? (
        <>
          {snackEligibility === undefined ? (
            <Modal transparent visible animationType="fade">
              <View style={styles.lockOverlay}>
                <ActivityIndicator size="large" color={colors.accent.green} />
                <Text style={styles.lockOverlayText}>{t("common.loading")}</Text>
              </View>
            </Modal>
          ) : (
            <OwnerSnackPicker
              visible
              clubId={dashboard.clubId}
              sessionId={snackPickerSessionId}
              sessionStatus={snackEligibility.status}
              paymentStatus={snackEligibility.paymentStatus}
              currency={dashboard.currency}
              roleId={queryRoleId}
              onClose={() => setSnackPickerSessionId(null)}
            />
          )}
        </>
      ) : null}

      <Modal
        visible={showCheckoutModal}
        transparent
        animationType="fade"
        onRequestClose={closeCheckoutModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.checkoutModalCard]}>
            <Text style={styles.modalTitle}>{t("ownerApp.slots.closeTable")}</Text>
            <Text style={styles.modalBody}>{t("ownerApp.slots.closeTableBody")}</Text>
            {checkoutPreview === undefined ? (
              <ActivityIndicator color={colors.accent.green} style={{ marginVertical: spacing[4] }} />
            ) : checkoutPreview === null ? (
              <Text style={styles.walkInErr}>{t("ownerApp.slots.noActiveSession")}</Text>
            ) : (
              <ScrollView
                style={styles.checkoutScroll}
                contentContainerStyle={styles.checkoutScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.checkoutTableName}>{checkoutPreview.tableLabel}</Text>
                <Text style={styles.checkoutMeta}>
                  {checkoutPreview.isGuest
                    ? t("ownerApp.slots.guestLabel", {
                        name: checkoutPreview.guestName ?? t("ownerApp.slots.defaultWalkIn"),
                      })
                    : t("ownerApp.slots.registeredCustomerCheckout")}
                </Text>
                <CheckoutBillBreakdown preview={checkoutPreview} t={t} />
                {checkoutPreview.canApplyDiscount ? (
                  <View style={styles.discountRow}>
                    <Text style={styles.walkInLabel}>
                      {t("ownerApp.slots.discountPercent")}{" "}
                      {checkoutPreview.maxDiscountPercent !== null
                        ? t("ownerApp.slots.discountMax", {
                            percent: checkoutPreview.maxDiscountPercent,
                          })
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
                        {t("ownerApp.slots.discountCapped", {
                          percent: checkoutPreview.maxDiscountPercent,
                        })}
                      </Text>
                    ) : discountInputTooHigh ? (
                      <Text style={styles.walkInErr}>
                        {t("ownerApp.slots.discountMustBeLessThan100")}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.discountHint}>{t("ownerApp.slots.cannotApplyDiscount")}</Text>
                )}
                {checkoutPreview.requiresLoserSide ? (
                  <>
                    <Text style={styles.walkInLabel}>
                      {t("ownerApp.slots.selectLosingSide")}
                    </Text>
                    <View style={styles.payGrid}>
                      {(["sideA", "sideB"] as const).map((side) => (
                        <Pressable
                          key={side}
                          style={({ pressed }) => [
                            styles.payTile,
                            checkoutLoserSide === side && styles.payTileSelected,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => setCheckoutLoserSide(side)}
                        >
                          <Text style={styles.payTileText}>
                            {side === "sideA"
                              ? t("ownerApp.slots.sideA")
                              : t("ownerApp.slots.sideB")}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {checkoutLoserSide !== null ? (
                      <Text style={styles.modalBody}>
                        {t("ownerApp.slots.losersPayCheckoutNote")}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                <Text style={styles.walkInLabel}>{t("ownerApp.slots.payment")}</Text>
                <View style={styles.payGrid}>
                  {(
                    [
                      ["cash", t("ownerApp.slots.paymentCash")],
                      ["upi", t("ownerApp.slots.paymentUpi")],
                      ["card", t("ownerApp.slots.paymentCard")],
                      ["credit", t("ownerApp.slots.paymentCredit")],
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
              </ScrollView>
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
                <Text style={styles.modalBtnSecondaryText}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={extendTableId !== null}
        transparent
        animationType="fade"
        onRequestClose={closeExtendModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {showMovePicker ? (
              <>
                <Text style={styles.modalTitle}>{t("ownerApp.slots.moveTitle")}</Text>
                <ScrollView
                  style={{ maxHeight: 320 }}
                  showsVerticalScrollIndicator={false}
                >
                  {freeTablesForMove.length === 0 ? (
                    <Text style={styles.walkInErr}>
                      {t("ownerApp.slots.noFreeTables")}
                    </Text>
                  ) : (
                    freeTablesForMove.map((tb) => (
                      <Pressable
                        key={tb._id}
                        style={({ pressed }) => [
                          styles.foundCard,
                          pressed && styles.pressed,
                          moveBusy && { opacity: 0.5 },
                          { marginBottom: spacing[2] },
                        ]}
                        disabled={moveBusy}
                        onPress={() => void runMove(tb._id as Id<"tables">)}
                      >
                        <Text style={styles.foundName}>{tb.label}</Text>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    disabled={moveBusy}
                    onPress={() => setShowMovePicker(false)}
                  >
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.back")}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t("ownerApp.slots.extendTitle")}</Text>
                {extendConflict ? (
                  <Text style={styles.modalBody}>
                    {extendConflict.maxExtendMinutes > 0
                      ? t("ownerApp.slots.extendConflict", {
                          time: extendConflict.time,
                          name: ` (${extendConflict.name})`,
                          max: extendConflict.maxExtendMinutes,
                        })
                      : t("ownerApp.slots.extendConflictNoRoom", {
                          time: extendConflict.time,
                          name: ` (${extendConflict.name})`,
                        })}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.modalBody}>{t("ownerApp.slots.extendBody")}</Text>
                    {extendSessionMeta?.plannedEndTime != null ? (
                      <Text style={styles.modalHint}>
                        {t("ownerApp.slots.extendCurrentEnd", {
                          time: formatClock(extendSessionMeta.plannedEndTime),
                        })}
                      </Text>
                    ) : null}
                  </>
                )}
                <View style={[styles.playDurationRow, { flexWrap: "wrap" }]}>
                  {EXTEND_OPTIONS_MIN.filter(
                    (min) =>
                      !extendConflict ||
                      extendConflict.maxExtendMinutes >= min,
                  ).map((min) => (
                    <Pressable
                      key={min}
                      style={({ pressed }) => [
                        styles.playDurationChip,
                        pressed && styles.pressed,
                        extendBusy && { opacity: 0.5 },
                      ]}
                      disabled={extendBusy}
                      onPress={() => void runExtend(min)}
                    >
                      <Text style={styles.playDurationChipText}>
                        {t("ownerApp.slots.extendMinutes", { count: min })}
                      </Text>
                      <Text style={styles.extendUntilText}>
                        {t("ownerApp.slots.extendUntil", {
                          time: formatClock(extendBaseMs + min * 60_000),
                        })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={[styles.modalActions, { marginTop: spacing[4] }]}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnPrimary,
                      pressed && styles.pressed,
                      (moveBusy || freeTablesForMove.length === 0) && { opacity: 0.5 },
                    ]}
                    disabled={moveBusy || freeTablesForMove.length === 0}
                    onPress={() => setShowMovePicker(true)}
                  >
                    <Text style={styles.modalBtnPrimaryText}>
                      {t("ownerApp.slots.moveTable")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                    disabled={extendBusy}
                    onPress={closeExtendModal}
                  >
                    <Text style={styles.modalBtnSecondaryText}>{t("ownerApp.slots.cancel")}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <CustomerQrScannerModal
        visible={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScan={onQrScanned}
      />
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
  versusBadgeInline: {
    ...typography.caption,
    color: colors.accent.amber,
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
  overtimeMeta: {
    ...typography.bodySmall,
    color: colors.accent.amber,
    marginTop: spacing[0.5],
  },
  endingSoonMeta: {
    ...typography.bodySmall,
    color: colors.accent.amber,
    fontWeight: "600",
    marginTop: spacing[0.5],
  },
  timeUpMeta: {
    ...typography.caption,
    color: colors.accent.amber,
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
  checkoutModalCard: {
    maxHeight: "92%",
  },
  checkoutScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  checkoutScrollContent: {
    paddingBottom: spacing[2],
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
  modalBtnDisabled: { opacity: 0.55 },
  playDurationBlock: { marginBottom: spacing[3] },
  playDurationRow: { flexDirection: "row", gap: spacing[2], paddingVertical: spacing[1] },
  playDurationChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
  },
  playDurationChipActive: {
    borderColor: colors.accent.green,
    backgroundColor: "rgba(67,160,71,0.15)",
  },
  playDurationChipText: { ...typography.caption, color: colors.text.secondary },
  playDurationChipTextActive: { color: colors.accent.green, fontWeight: "600" },
  extendUntilText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 11,
    marginTop: spacing[0.5],
    textAlign: "center",
  },
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
  walkInOk: {
    ...typography.bodySmall,
    color: colors.accent.green,
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
  payTileSelected: {
    borderColor: colors.accent.green,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
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

export default function SlotsScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.slots")}>
      <SlotsScreenContent />
    </TabErrorBoundary>
  );
}
