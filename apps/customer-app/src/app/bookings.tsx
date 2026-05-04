import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@a3/convex/_generated/api";
import { BookingCard } from "@a3/ui/components";
import { colors, spacing, typography, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

type Segment = "upcoming" | "history";
type CustomerBookingLog = {
  bookingId: any;
  clubId: any;
  clubName: string;
  tableType: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedDurationMin: number;
  status: string;
  estimatedCost?: number;
  currency: string;
  confirmedTableLabel?: string;
  rejectionReason?: string;
  thumbnailPhotoUrl?: string | null;
  cancellationWindowMin?: number;
  isLateCancellationNow?: boolean;
};

const UPCOMING = new Set(["pending_approval", "confirmed"]);
const HISTORY = new Set([
  "rejected",
  "cancelled_by_customer",
  "cancelled_by_club",
  "expired",
  "completed",
]);

function bookingMs(dateYmd: string, hhmm: string): number {
  return new Date(`${dateYmd}T${hhmm}:00`).getTime();
}

export default function MyBookingsScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("upcoming");
  const user = useQuery(api.users.getCurrentUser);
  const logs = useQuery(
    api.bookings.getCustomerBookings,
    user?._id ? { customerId: user._id } : "skip",
  );
  const cancelBooking = useMutation(api.bookings.cancelBooking);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!logs) return { upcoming: [], history: [] } as const;
    const logsData = logs as CustomerBookingLog[];
    const upcoming = logsData
      .filter((x) => UPCOMING.has(x.status))
      .sort(
        (a, b) =>
          bookingMs(a.requestedDate, a.requestedStartTime) -
          bookingMs(b.requestedDate, b.requestedStartTime),
      );
    const history = logsData
      .filter((x) => HISTORY.has(x.status))
      .sort(
        (a, b) =>
          bookingMs(b.requestedDate, b.requestedStartTime) -
          bookingMs(a.requestedDate, a.requestedStartTime),
      );
    return { upcoming, history } as const;
  }, [logs]);

  const handleCancel = async (log: CustomerBookingLog) => {
    const title = "Cancel Booking?";
    const body =
      log.status === "pending_approval"
        ? `Your booking request at ${log.clubName} will be withdrawn.`
        : log.isLateCancellationNow
          ? `This is a late cancellation. Cancelling within ${log.cancellationWindowMin ?? 30} minutes of your booking time may affect your booking record.`
          : `Your confirmed booking at ${log.clubName} on ${log.requestedDate} at ${log.requestedStartTime} will be cancelled.`;
    Alert.alert(title, body, [
      { text: "Keep Booking", style: "cancel" },
      {
        text: "Cancel Booking",
        style: "destructive",
        onPress: async () => {
          try {
            setBusyId(log.bookingId);
            await cancelBooking({ bookingId: log.bookingId, clubId: log.clubId });
            Alert.alert("Booking cancelled");
          } catch (e) {
            Alert.alert(parseConvexError(e as Error).message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const list = segment === "upcoming" ? sorted.upcoming : sorted.history;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segBtn, segment === "upcoming" && styles.segBtnActive]}
          onPress={() => setSegment("upcoming")}
        >
          <Text style={[styles.segText, segment === "upcoming" && styles.segTextActive]}>
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, segment === "history" && styles.segBtnActive]}
          onPress={() => setSegment("history")}
        >
          <Text style={[styles.segText, segment === "history" && styles.segTextActive]}>
            History
          </Text>
        </Pressable>
      </View>

      {logs === undefined ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent.green} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {segment === "upcoming"
              ? "No upcoming bookings. Discover clubs to book a table."
              : "No past bookings yet."}
          </Text>
          {segment === "upcoming" ? (
            <Pressable
              style={styles.discoverBtn}
              onPress={() => router.push("/(tabs)/discover")}
            >
              <Text style={styles.discoverBtnText}>Discover Clubs</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {list.map((log: CustomerBookingLog) => (
            <BookingCard
              key={log.bookingId}
              mode="customer"
              booking={{
                _id: log.bookingId,
                tableType: log.tableType,
                requestedDate: log.requestedDate,
                requestedStartTime: log.requestedStartTime,
                requestedDurationMin: log.requestedDurationMin,
                status: log.status,
              }}
              log={{
                bookingId: log.bookingId,
                clubName: log.clubName,
                tableType: log.tableType,
                requestedDate: log.requestedDate,
                requestedStartTime: log.requestedStartTime,
                requestedDurationMin: log.requestedDurationMin,
                status: log.status,
                estimatedCost: log.estimatedCost,
                currency: log.currency,
                confirmedTableLabel: log.confirmedTableLabel,
                rejectionReason: log.rejectionReason,
                thumbnailPhotoUrl: log.thumbnailPhotoUrl,
              }}
              onPress={() => router.push(`/booking/${log.bookingId}`)}
              onCancel={
                busyId === log.bookingId
                  ? undefined
                  : () => {
                      void handleCancel(log);
                    }
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing[6], paddingTop: spacing[6], paddingBottom: spacing[3] },
  title: { fontSize: 24, lineHeight: 32, fontWeight: "300", color: colors.text.primary },
  segmented: {
    marginHorizontal: spacing[6],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.bg.secondary,
    padding: spacing[1],
    flexDirection: "row",
    gap: spacing[1],
  },
  segBtn: { flex: 1, minHeight: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  segBtnActive: { backgroundColor: colors.bg.tertiary },
  segText: { ...typography.labelSmall, color: colors.text.secondary },
  segTextActive: { color: colors.text.primary },
  list: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: spacing[3] },
  emptyText: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  discoverBtn: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  discoverBtnText: { ...typography.button, color: colors.bg.primary },
});
