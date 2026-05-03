import { useMemo, useState, useEffect } from "react";
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
} from "react-native";
import { ComplaintBanner } from "@a3/ui/components";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@a3/convex/_generated/dataModel";
import { api } from "@a3/convex/_generated/api";
import { BookingCard } from "@a3/ui/components";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { computeBookingUnixTime, timeZoneAbbreviation } from "@a3/utils/timezone";
import { useLocalSearchParams } from "expo-router";
import { getActiveRoleId } from "../../lib/activeRoleStorage";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";

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
  { key: "all", label: "All" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled_by_customer", label: "Cancelled" },
  { key: "cancelled_by_club", label: "Cancelled" },
  { key: "expired", label: "Expired" },
  { key: "completed", label: "Completed" },
] as const;

function elapsedLabel(createdAt?: number): string {
  if (!createdAt) return "";
  const min = Math.max(1, Math.floor((Date.now() - createdAt) / 60_000));
  return `Submitted ${min} min ago`;
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

export default function BookingsTab() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const pending = useQuery(
    api.bookings.listPendingBookings,
    clubId ? { clubId, limit: 50 } : "skip",
  );
  const upcoming = useQuery(
    api.bookings.listUpcomingBookings,
    clubId ? { clubId, limit: 50 } : "skip",
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
  const [roleId, setRoleId] = useState<Id<"staffRoles"> | undefined>(undefined);
  const [complaintGateBooking, setComplaintGateBooking] = useState<{
    bookingId: Id<"bookings">;
    customerId: Id<"users">;
    customerName: string;
    confirmedTableId: Id<"tables"> | undefined;
  } | null>(null);

  useEffect(() => {
    void getActiveRoleId().then((v) => {
      if (v) setRoleId(v as Id<"staffRoles">);
    });
  }, []);

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
    clubId
      ? {
          clubId,
          statusFilter: historyFilter === "all" ? undefined : historyFilter,
          searchQuery: searchQuery.trim() || undefined,
          cursor: historyCursor,
          limit: 20,
        }
      : "skip",
  );

  const approveBooking = useMutation(api.bookings.approveBooking);
  const rejectBooking = useMutation(api.bookings.rejectBooking);
  const cancelByClub = useMutation(api.bookings.clubCancelBooking);
  const startSession = useMutation(api.bookings.startSessionFromBooking);

  const timezone = dashboard ? timeZoneAbbreviation("Asia/Kolkata") : "";
  const noBookings =
    (pending?.items.length ?? 0) +
      (upcoming?.items.length ?? 0) +
      historyItems.length +
      (historyPage?.items.length ?? 0) ===
    0;

  const ensureHistoryData = useMemo(() => historyPage?.items ?? [], [historyPage]);

  if (dashboard === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (
    (clubId && pending === undefined) ||
    (clubId && upcoming === undefined)
  ) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  const openApprove = (bookingId: Id<"bookings">) => {
    setSelectedBookingId(bookingId);
    setSelectedTableId(null);
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
      Alert.alert("Approve failed", parseConvexError(e as Error).message);
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
      Alert.alert("Reject failed", parseConvexError(e as Error).message);
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
      Alert.alert("Cancel failed", parseConvexError(e as Error).message);
    } finally {
      setInFlight(null);
    }
  };

  const renderSegment = () => {
    if (!dashboard?.bookingSettingsEnabled && noBookings) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>
            Enable online booking in Settings to start receiving requests.
          </Text>
        </View>
      );
    }

    if (segment === "pending") {
      if (!pending || pending.items.length === 0) {
        return <Text style={styles.emptyText}>No pending booking requests</Text>;
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
          }}
          complaints={item.complaints}
          customerStats={item.customerStats}
          isLoading={inFlight === item.booking._id}
          footerText={elapsedLabel(item.booking.createdAt)}
          onApprove={() => openApprove(item.booking._id)}
          onReject={() => openReject(item.booking._id)}
        />
      ));
    }

    if (segment === "upcoming") {
      if (!upcoming || upcoming.items.length === 0) {
        return <Text style={styles.emptyText}>No upcoming bookings</Text>;
      }
      return upcoming.items.map((item: any) => {
        const startEnabled = canStartNow(item.booking, "Asia/Kolkata");
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
              confirmedTableLabel: item.confirmedTableLabel ?? "Table to be assigned",
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
                          roleId,
                        });
                        Alert.alert("Success", "Session started successfully.");
                      } catch (e) {
                        Alert.alert("Start failed", parseConvexError(e as Error).message);
                      } finally {
                        setInFlight(null);
                      }
                    })();
                  }
                : undefined
            }
            footerText={`Times shown in ${timezone}`}
          />
        );
      });
    }

    const all = [...historyItems, ...ensureHistoryData];
    if (all.length === 0) {
      return <Text style={styles.emptyText}>No booking history yet</Text>;
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
            <Text style={styles.loadMoreText}>Load more</Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.hint}>Times shown in {timezone}</Text>
      </View>

      <View style={styles.segmented}>
        {(["pending", "upcoming", "history"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.segBtn, segment === s && styles.segBtnActive]}
            onPress={() => setSegment(s)}
          >
            <Text style={[styles.segText, segment === s && styles.segTextActive]}>
              {s[0].toUpperCase() + s.slice(1)}
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
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search customer"
            placeholderTextColor={colors.text.tertiary}
            style={styles.search}
          />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>{renderSegment()}</ScrollView>

      <Modal visible={showApproveModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign a Table (Optional)</Text>
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
              <Text style={styles.primaryBtnText}>Confirm Approval</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setShowApproveModal(false)}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showRejectModal || showCancelModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {showRejectModal ? "Reject Booking" : "Cancel Booking"}
            </Text>
            <TextInput
              value={reasonText}
              onChangeText={(v) => setReasonText(v.slice(0, 300))}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.text.tertiary}
              multiline
              style={styles.reasonInput}
            />
            <Text style={styles.counter}>{reasonText.length}/300</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={showRejectModal ? doReject : doCancel}
            >
              <Text style={styles.primaryBtnText}>Confirm</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setShowRejectModal(false);
                setShowCancelModal(false);
              }}
            >
              <Text style={styles.secondaryBtnText}>Close</Text>
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
                        roleId,
                      });
                      setComplaintGateBooking(null);
                      Alert.alert("Success", "Session started successfully.");
                    } catch (e) {
                      Alert.alert("Start failed", parseConvexError(e as Error).message);
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
  );
}

/** Bookings shell — Figma `31:1514` horizontal inset & title scale (node 33-8218). */
const SCREEN_PAD = spacing[6];
const CARD_LIST_GAP = spacing[3];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  centered: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
    backgroundColor: colors.bg.secondary,
    borderRadius: FIGMA_BOOKINGS.segmentRadius,
    borderWidth: 1,
    borderColor: FIGMA_BOOKINGS.segmentBorder,
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
  segBtnActive: { backgroundColor: colors.bg.tertiary },
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
    borderColor: FIGMA_BOOKINGS.chipActiveBorder,
    backgroundColor: FIGMA_BOOKINGS.chipActiveFill,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  chipTextActive: { color: "#000000" },
  search: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: colors.text.primary,
    ...typography.body,
    paddingHorizontal: spacing[3],
    minHeight: layout.touchTarget,
  },
  list: { paddingHorizontal: SCREEN_PAD, paddingBottom: spacing[8], gap: CARD_LIST_GAP },
  emptyWrap: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
  },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[2] },
  emptyText: { ...typography.body, color: colors.text.secondary },
  loadMore: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
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
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
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
  counter: { ...typography.caption, color: colors.text.secondary, textAlign: "right" },
});

