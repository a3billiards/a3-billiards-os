import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  I18nManager,
  RefreshControl,
} from "react-native";
import { BookingCard, ComplaintBanner, GlassPageBackground } from "@a3/ui/components";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@a3/convex/_generated/dataModel";
import { api } from "@a3/convex/_generated/api";
import { colors, layout, radius, spacing, typography, glass } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { useTranslation } from "@a3/i18n";
import { computeBookingUnixTime, timeZoneAbbreviation } from "@a3/utils/timezone";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStaffRole, staffRoleQueryId, useStaffTabQueriesEnabled } from "../../lib/StaffRoleContext";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { TabAccessDenied } from "../../components/TabAccessDenied";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";

type Segment = "pending" | "upcoming" | "history";

const FIGMA_BOOKINGS = {
  segmentRadius: 24,
  segmentBorder: "rgba(255,255,255,0.1)",
  chipGap: 8,
  chipPadH: 12,
  chipPadV: 4,
  chipMinH: 28,
  chipActiveBorder: "#4A9EFF",
  chipActiveFill: "#4A9EFF",
} as const;

const HISTORY_FILTERS = [
  { key: "all", labelKey: "ownerApp.bookings.filters.all" },
  { key: "rejected", labelKey: "ownerApp.bookings.filters.rejected" },
  { key: "cancelled_by_customer", labelKey: "ownerApp.bookings.filters.cancelled" },
  { key: "cancelled_by_club", labelKey: "ownerApp.bookings.filters.cancelled" },
  { key: "expired", labelKey: "ownerApp.bookings.filters.expired" },
  { key: "completed", labelKey: "ownerApp.bookings.filters.completed" },
] as const;

function elapsedLabel(createdAt: number | undefined, tr: (key: string, opts?: { min: number }) => string): string {
  if (!createdAt) return "";
  const min = Math.max(1, Math.floor((Date.now() - createdAt) / 60_000));
  return tr("ownerApp.bookings.submittedAgo", { min });
}

function canStartNow(booking: {
  requestedDate: string;
  requestedStartTime: string;
}, timezone: string): boolean {
  const start = computeBookingUnixTime(
    booking.requestedDate,
    booking.requestedStartTime,
    timezone,
  );
  const now = Date.now();
  return now >= start - 15 * 60_000 && now <= start + 30 * 60_000;
}

function BookingsTabContent() {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const params = useLocalSearchParams<{ segment?: string }>();
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const { roleId, canAccessTab } = useStaffRole();
  const bookingsEnabled = useStaffTabQueriesEnabled("bookings");
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const pending = useQuery(
    api.bookings.listPendingBookings,
    clubId && bookingsEnabled
      ? { clubId, limit: 50, roleId: queryRoleId }
      : "skip",
  );
  const upcoming = useQuery(
    api.bookings.listUpcomingBookings,
    clubId && bookingsEnabled
      ? { clubId, limit: 50, roleId: queryRoleId }
      : "skip",
  );

  const initialSeg =
    params.segment === "upcoming" || params.segment === "history"
      ? (params.segment as Segment)
      : "pending";
  const [segment, setSegment] = useState<Segment>(initialSeg);
  const [historyCursor, setHistoryCursor] = useState<number>(0);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<Id<"tables"> | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [inFlight, setInFlight] = useState<string | null>(null);
  const [complaintGateBooking, setComplaintGateBooking] = useState<{
    bookingId: Id<"bookings">;
    customerId: Id<"users">;
    customerName: string;
    confirmedTableId: Id<"tables"> | undefined;
  } | null>(null);

  const complaintGateDetails = useQuery(
    api.complaints.getCustomerActiveComplaints,
    complaintGateBooking ? { userId: complaintGateBooking.customerId } : "skip",
  );

  const complaintBannerRows = useMemo(() => {
    if (!complaintGateDetails?.complaints) return [];
    return complaintGateDetails.complaints.map((c) => ({
      type: c.type,
      typeLabel: c.typeLabel,
      clubName: c.clubName,
      createdAt: c.createdAt,
    }));
  }, [complaintGateDetails]);

  const assignableTables = useQuery(
    api.bookings.listAssignableTablesForBooking,
    selectedBookingId ? { bookingId: selectedBookingId } : "skip",
  );

  const historyPage = useQuery(
    api.bookings.listHistoryBookings,
    clubId && bookingsEnabled
      ? {
          clubId,
          statusFilter: historyFilter === "all" ? undefined : historyFilter,
          searchQuery: searchQuery.trim() || undefined,
          cursor: historyCursor,
          limit: 20,
          roleId: queryRoleId,
        }
      : "skip",
  );

  const approveBooking = useMutation(api.bookings.approveBooking);
  const rejectBooking = useMutation(api.bookings.rejectBooking);
  const cancelByClub = useMutation(api.bookings.clubCancelBooking);
  const startSession = useMutation(api.bookings.startSessionFromBooking);

  const clubTimezone = dashboard?.timezone ?? "Asia/Kolkata";
  const timezone = dashboard ? timeZoneAbbreviation(clubTimezone) : "";
  const noBookings =
    (pending?.items.length ?? 0) +
      (upcoming?.items.length ?? 0) +
      historyItems.length +
      (historyPage?.items.length ?? 0) ===
    0;

  const ensureHistoryData = useMemo(() => historyPage?.items ?? [], [historyPage]);

  if (dashboard === undefined) {
    return (
      <GlassPageBackground>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={glass.ctaBg} />
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
      </View>
      </GlassPageBackground>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (roleId !== undefined && !canAccessTab("bookings")) {
    return <TabAccessDenied tabLabel={t("common.tabs.owner.bookings")} />;
  }

  if (
    (clubId && pending === undefined) ||
    (clubId && upcoming === undefined)
  ) {
    return (
      <GlassPageBackground>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={glass.ctaBg} />
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
      </View>
      </GlassPageBackground>
    );
  }

  const openApprove = (
    bookingId: Id<"bookings">,
    preselectedTableId?: Id<"tables">,
  ) => {
    setSelectedBookingId(bookingId);
    setSelectedTableId(preselectedTableId ?? null);
    setShowApproveModal(true);
  };
  const openReject = (bookingId: Id<"bookings">) => {
    setSelectedBookingId(bookingId);
    setReasonText("");
    setShowRejectModal(true);
  };
  const openCancel = (bookingId: Id<"bookings">) => {
    setSelectedBookingId(bookingId);
    setReasonText("");
    setShowCancelModal(true);
  };

  const doApprove = async () => {
    if (!selectedBookingId) return;
    setInFlight(selectedBookingId);
    try {
      await approveBooking({
        bookingId: selectedBookingId,
        confirmedTableId: selectedTableId ?? undefined,
      });
      setShowApproveModal(false);
    } catch (e) {
      Alert.alert(t("ownerApp.bookings.approveFailed"), parseConvexError(e as Error).message);
    } finally {
      setInFlight(null);
    }
  };

  const doReject = async () => {
    if (!selectedBookingId) return;
    setInFlight(selectedBookingId);
    try {
      await rejectBooking({
        bookingId: selectedBookingId,
        rejectionReason: reasonText.trim() || undefined,
      });
      setShowRejectModal(false);
    } catch (e) {
      Alert.alert(t("ownerApp.bookings.rejectFailed"), parseConvexError(e as Error).message);
    } finally {
      setInFlight(null);
    }
  };

  const doCancel = async () => {
    if (!selectedBookingId) return;
    setInFlight(selectedBookingId);
    try {
      await cancelByClub({
        bookingId: selectedBookingId,
        cancellationReason: reasonText.trim() || undefined,
      });
      setShowCancelModal(false);
    } catch (e) {
      Alert.alert(t("ownerApp.bookings.cancelFailed"), parseConvexError(e as Error).message);
    } finally {
      setInFlight(null);
    }
  };

  const renderSegment = () => {
    if (!dashboard?.bookingSettingsEnabled && noBookings) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t("ownerApp.bookings.noBookingsYet")}</Text>
          <Text style={styles.emptyText}>{t("ownerApp.bookings.enableOnlineBooking")}</Text>
        </View>
      );
    }

    if (segment === "pending") {
      if (!pending || pending.items.length === 0) {
        return <Text style={styles.emptyText}>{t("ownerApp.bookings.noPending")}</Text>;
      }
      return pending.items.map((item: any) => (
        <BookingCard
          key={item.booking._id}
          mode="owner-pending"
          booking={{
            _id: item.booking._id,
            customerName: item.customer.name,
            customerPhone: item.customer.phone,
            tableType: item.booking.tableType,
            requestedDate: item.booking.requestedDate,
            requestedStartTime: item.booking.requestedStartTime,
            requestedDurationMin: item.booking.requestedDurationMin,
            estimatedCost: item.booking.estimatedCost,
            currency: item.booking.currency,
            notes: item.booking.notes,
            status: item.booking.status,
            createdAt: item.booking.createdAt,
            confirmedTableLabel: item.requestedTableLabel,
          }}
          complaints={item.complaints}
          customerStats={item.customerStats}
          isLoading={inFlight === item.booking._id}
          footerText={elapsedLabel(item.booking.createdAt, t)}
          onApprove={() =>
            openApprove(item.booking._id, item.booking.confirmedTableId)
          }
          onReject={() => openReject(item.booking._id)}
        />
      ));
    }

    if (segment === "upcoming") {
      if (!upcoming || upcoming.items.length === 0) {
        return <Text style={styles.emptyText}>{t("ownerApp.bookings.noUpcoming")}</Text>;
      }
      return upcoming.items.map((item: any) => {
        const startEnabled = canStartNow(item.booking, clubTimezone);
        return (
          <BookingCard
            key={item.booking._id}
            mode="owner-upcoming"
            booking={{
              _id: item.booking._id,
              customerName: item.customer.name,
              tableType: item.booking.tableType,
              requestedDate: item.booking.requestedDate,
              requestedStartTime: item.booking.requestedStartTime,
              requestedDurationMin: item.booking.requestedDurationMin,
              confirmedTableLabel: item.confirmedTableLabel ?? t("ownerApp.bookings.tableToAssign"),
              status: item.booking.status,
            }}
            complaints={item.complaints}
            isLoading={inFlight === item.booking._id}
            onCancel={() => openCancel(item.booking._id)}
            onStartSession={
              startEnabled
                ? () => {
                    const hasComplaints = (item.complaints?.length ?? 0) > 0;
                    if (hasComplaints) {
                      setComplaintGateBooking({
                        bookingId: item.booking._id,
                        customerId: item.booking.customerId,
                        customerName: item.customer.name,
                        confirmedTableId: item.booking.confirmedTableId,
                      });
                      return;
                    }
                    void (async () => {
                      try {
                        setInFlight(item.booking._id);
                        await startSession({
                          bookingId: item.booking._id,
                          tableId: item.booking.confirmedTableId,
                          roleId: queryRoleId,
                        });
                        Alert.alert(t("ownerApp.bookings.success"), t("ownerApp.bookings.startSuccess"));
                      } catch (e) {
                        Alert.alert(t("ownerApp.bookings.startFailed"), parseConvexError(e as Error).message);
                      } finally {
                        setInFlight(null);
                      }
                    })();
                  }
                : undefined
            }
            footerText={t("ownerApp.bookings.timesInTimezone", { timezone })}
          />
        );
      });
    }

    const all = [...historyItems, ...ensureHistoryData];
    if (all.length === 0) {
      return <Text style={styles.emptyText}>{t("ownerApp.bookings.noHistory")}</Text>;
    }
    return (
      <>
        {all.map((item: any) => (
          <BookingCard
            key={item._id}
            mode="owner-history"
            booking={{
              _id: item._id,
              customerName: item.customerName,
              tableType: item.tableType,
              requestedDate: item.requestedDate,
              requestedStartTime: item.requestedStartTime,
              requestedDurationMin: item.requestedDurationMin,
              status: item.status,
              rejectionReason: item.rejectionReason,
            }}
          />
        ))}
        {historyPage?.nextCursor !== null && historyPage?.nextCursor !== undefined ? (
          <Pressable
            style={styles.loadMore}
            onPress={() => {
              setHistoryItems((prev) => [...prev, ...ensureHistoryData]);
              setHistoryCursor(historyPage.nextCursor!);
            }}
          >
            <Text style={styles.loadMoreText}>{t("common.loadMore")}</Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  return (
    <GlassPageBackground>
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("ownerApp.bookings.title")}</Text>
        <Text style={styles.hint}>{t("ownerApp.bookings.timesInTimezone", { timezone })}</Text>
      </View>

      <View style={styles.segmented}>
        {(["pending", "upcoming", "history"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.segBtn, segment === s && styles.segBtnActive]}
            onPress={() => setSegment(s)}
          >
            <Text style={[styles.segText, segment === s && styles.segTextActive]}>
              {t(`ownerApp.bookings.${s}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {segment === "history" ? (
        <View style={styles.historyFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipsRow}>
              {HISTORY_FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[
                    styles.chip,
                    historyFilter === f.key && styles.chipActive,
                  ]}
                  onPress={() => {
                    setHistoryItems([]);
                    setHistoryCursor(0);
                    setHistoryFilter(f.key);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      historyFilter === f.key && styles.chipTextActive,
                    ]}
                  >
                    {t(f.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("ownerApp.bookings.searchPlaceholder")}
            placeholderTextColor={colors.text.tertiary}
            style={styles.search}
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderSegment()}
      </ScrollView>

      <Modal visible={showApproveModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedTableId
                ? t("ownerApp.bookings.confirmTable")
                : t("ownerApp.bookings.assignTable")}
            </Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {(assignableTables ?? []).map((t: any) => (
                <Pressable
                  key={t._id}
                  onPress={() => setSelectedTableId(t._id)}
                  style={[
                    styles.tableRow,
                    selectedTableId === t._id && styles.tableRowActive,
                  ]}
                >
                  <Text style={styles.tableRowText}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.primaryBtn} onPress={doApprove}>
              <Text style={styles.primaryBtnText}>{t("ownerApp.bookings.approve")}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setShowApproveModal(false)}>
              <Text style={styles.secondaryBtnText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showRejectModal || showCancelModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {showRejectModal ? t("ownerApp.bookings.rejectBooking") : t("ownerApp.bookings.cancelBooking")}
            </Text>
            <TextInput
              value={reasonText}
              onChangeText={(v) => setReasonText(v.slice(0, 300))}
              placeholder={t("ownerApp.bookings.reasonOptional")}
              placeholderTextColor={colors.text.tertiary}
              multiline
              style={styles.reasonInput}
            />
            <Text style={styles.counter}>{reasonText.length}/300</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={showRejectModal ? doReject : doCancel}
            >
              <Text style={styles.primaryBtnText}>
                {showRejectModal ? t("ownerApp.bookings.reject") : t("ownerApp.bookings.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setShowRejectModal(false);
                setShowCancelModal(false);
              }}
            >
              <Text style={styles.secondaryBtnText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={complaintGateBooking !== null} transparent animationType="fade">
        <View style={[styles.modalBackdrop, styles.complaintGateBackdrop]}>
          <View style={[styles.modalCard, styles.complaintGateCard]}>
            {complaintGateDetails === undefined ? (
              <ActivityIndicator color={colors.accent.green} />
            ) : (
              <ComplaintBanner
                complaints={complaintBannerRows}
                onCancel={() => setComplaintGateBooking(null)}
                onAcknowledge={() => {
                  void (async () => {
                    if (!complaintGateBooking) return;
                    try {
                      setInFlight(complaintGateBooking.bookingId);
                      await startSession({
                        bookingId: complaintGateBooking.bookingId,
                        tableId: complaintGateBooking.confirmedTableId,
                        staffAcknowledgedComplaint: true,
                        roleId: queryRoleId,
                      });
                      setComplaintGateBooking(null);
                      Alert.alert(t("ownerApp.bookings.success"), t("ownerApp.bookings.startSuccess"));
                    } catch (e) {
                      Alert.alert(t("ownerApp.bookings.startFailed"), parseConvexError(e as Error).message);
                    } finally {
                      setInFlight(null);
                    }
                  })();
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
    </GlassPageBackground>
  );
}

/** Bookings shell — Figma `31:1514` horizontal inset & title scale (node 33-8218). */
const SCREEN_PAD = spacing[6];
const CARD_LIST_GAP = spacing[3];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  centered: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { ...typography.body, color: colors.text.secondary, marginTop: spacing[3] },
  header: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SCREEN_PAD,
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "300",
    color: colors.text.primary,
  },
  hint: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: "300",
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  segmented: {
    marginHorizontal: SCREEN_PAD,
    marginBottom: spacing[3],
    backgroundColor: glass.inputBg,
    borderRadius: FIGMA_BOOKINGS.segmentRadius,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    padding: spacing[1],
    flexDirection: "row",
    gap: spacing[1],
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnActive: {
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
  },
  segText: {
    fontSize: typography.labelSmall.fontSize,
    lineHeight: typography.labelSmall.lineHeight,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  segTextActive: { color: colors.text.primary },
  historyFilters: { paddingHorizontal: SCREEN_PAD, marginBottom: spacing[3], gap: spacing[2] },
  chipsRow: { flexDirection: "row", gap: FIGMA_BOOKINGS.chipGap },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.full,
    paddingHorizontal: FIGMA_BOOKINGS.chipPadH,
    paddingVertical: FIGMA_BOOKINGS.chipPadV,
    minHeight: FIGMA_BOOKINGS.chipMinH,
    justifyContent: "center",
  },
  chipActive: {
    borderColor: glass.inputBorderFocus,
    backgroundColor: "rgba(56, 189, 248, 0.22)",
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  chipTextActive: { color: glass.textPrimary },
  search: {
    backgroundColor: glass.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    color: colors.text.primary,
    ...typography.body,
    paddingHorizontal: spacing[3],
    minHeight: layout.touchTarget,
  },
  list: { paddingHorizontal: SCREEN_PAD, paddingBottom: spacing[8], gap: CARD_LIST_GAP },
  emptyWrap: {
    backgroundColor: glass.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    padding: spacing[4],
  },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[2] },
  emptyText: { ...typography.body, color: colors.text.secondary },
  loadMore: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: { ...typography.button, color: colors.text.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
    padding: spacing[4],
  },
  complaintGateBackdrop: { justifyContent: "center" },
  complaintGateCard: { maxHeight: "88%" },
  modalCard: {
    backgroundColor: glass.tabPillBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: glass.tabPillBorder,
    padding: spacing[4],
    gap: spacing[2],
  },
  modalTitle: { ...typography.heading4, color: colors.text.primary },
  tableRow: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
  },
  tableRowActive: { borderColor: colors.accent.green, backgroundColor: "rgba(67,160,71,0.15)" },
  tableRowText: { ...typography.body, color: colors.text.primary },
  primaryBtn: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...typography.button, color: colors.bg.primary },
  secondaryBtn: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.text.primary },
  reasonInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    color: colors.text.primary,
    ...typography.body,
  },
  counter: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: I18nManager.isRTL ? "left" : "right",
  },
});

export default function BookingsTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.bookings")}>
      <BookingsTabContent />
    </TabErrorBoundary>
  );
}

