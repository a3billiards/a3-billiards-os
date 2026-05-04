import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, spacing, radius, typography, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function durationLabel(min: number): string {
  if (min === 60) return "1 hour";
  if (min % 60 === 0) return `${min / 60} hours`;
  if (min % 30 === 0) return `${(min / 60).toFixed(1)} hours`;
  return `${min} min`;
}

function currencySymbol(code: string): string {
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return `${code} `;
}

function statusLabel(status: string): string {
  if (status === "pending_approval") return "Pending";
  if (status === "confirmed") return "Confirmed";
  if (status === "rejected") return "Declined";
  if (status === "cancelled_by_customer") return "Cancelled";
  if (status === "cancelled_by_club") return "Cancelled by Club";
  if (status === "expired") return "Expired";
  return "Completed";
}

function statusPalette(status: string): { bg: string; fg: string } {
  switch (status) {
    case "pending_approval":
      return { bg: colors.accent.amber, fg: "#000000" };
    case "confirmed":
      return { bg: colors.accent.green, fg: "#000000" };
    case "rejected":
      return { bg: colors.status.error, fg: "#000000" };
    case "completed":
      return { bg: colors.status.info, fg: "#000000" };
    default:
      return { bg: colors.text.secondary, fg: "#000000" };
  }
}

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const detail = useQuery(
    api.bookings.getBookingDetail,
    bookingId ? { bookingId: bookingId as any } : "skip",
  );
  const cancelBooking = useMutation(api.bookings.cancelBooking);
  const [loadingCancel, setLoadingCancel] = useState(false);

  const canCancel =
    detail?.status === "pending_approval" || detail?.status === "confirmed";
  const statusChip = detail ? statusPalette(detail.status) : null;

  const venue = useMemo(() => {
    if (!detail) return null;
    const club = detail.clubProfile;
    return {
      name: club?.name ?? detail.clubName,
      address: club?.address ?? detail.clubAddress ?? "Address unavailable",
      tombstone: club === null,
    };
  }, [detail]);

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>Booking not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (detail === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (detail === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>Booking not found.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace("/bookings")}>
            <Text style={styles.primaryBtnText}>Go to My Bookings</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const onCancel = () => {
    if (!canCancel) return;
    Alert.alert(
      "Cancel Booking?",
      detail.status === "pending_approval"
        ? `Your booking request at ${detail.clubName} will be withdrawn.`
        : detail.isLateCancellationNow
          ? `This is a late cancellation. Cancelling within ${detail.cancellationWindowMin ?? 30} minutes of your booking time may affect your booking record.`
          : `Your confirmed booking at ${detail.clubName} on ${detail.requestedDate} at ${detail.requestedStartTime} will be cancelled.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            try {
              setLoadingCancel(true);
              await cancelBooking({ bookingId: detail.bookingId, clubId: detail.clubId });
              Alert.alert("Booking cancelled");
            } catch (e) {
              Alert.alert(parseConvexError(e as Error).message);
            } finally {
              setLoadingCancel(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.navBtnText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.navTitle}>Booking Details</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 140 + insets.bottom }]}
      >
        {detail.thumbnailPhotoUrl ? (
          <Image source={{ uri: detail.thumbnailPhotoUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroFallback} />
        )}
        {venue?.tombstone ? (
          <View style={styles.tombstone}>
            <Text style={styles.tombstoneText}>This club is no longer on A3 Billiards OS.</Text>
          </View>
        ) : null}

        <View style={[styles.statusPill, { backgroundColor: statusChip!.bg }]}>
          <Text style={[styles.statusPillText, { color: statusChip!.fg }]}>
            {statusLabel(detail.status)}
          </Text>
        </View>
        <Text style={styles.clubName}>{venue?.name}</Text>
        <Text style={styles.address}>{venue?.address}</Text>

        {!venue?.tombstone ? (
          <Pressable onPress={() => router.push(`/club/${detail.clubId}` as any)}>
            <Text style={styles.viewClub}>View Club Profile →</Text>
          </Pressable>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Booking Information</Text>
          <Row label="Table Type" value={detail.tableType} />
          <Row label="Date" value={detail.requestedDate} />
          <Row label="Time" value={to12h(detail.requestedStartTime)} />
          <Row label="Duration" value={durationLabel(detail.requestedDurationMin)} />
          {detail.status === "confirmed" && detail.confirmedTableLabel ? (
            <Row label="Assigned table" value={`Table: ${detail.confirmedTableLabel}`} />
          ) : null}
          <Row
            label="Estimated Cost"
            value={`Est. ${currencySymbol(detail.currency)}${detail.estimatedCost ?? 0}`}
          />
          <Text style={styles.note}>
            Actual bill may vary based on session duration, discounts, and snacks.
          </Text>
          {detail.notes ? <Row label="Your notes" value={detail.notes} /> : null}
          {detail.status === "rejected" && detail.rejectionReason ? (
            <Row label="Reason" value={detail.rejectionReason} />
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!venue?.tombstone ? (
          <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/club/${detail.clubId}` as any)}>
            <Text style={styles.secondaryBtnText}>View Club</Text>
          </Pressable>
        ) : null}
        {canCancel ? (
          <Pressable
            style={[styles.cancelBtn, loadingCancel && { opacity: 0.7 }]}
            onPress={onCancel}
            disabled={loadingCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel Booking</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: spacing[3] },
  muted: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  nav: {
    margin: spacing[4],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing[4],
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  navBtnText: { fontSize: 24, color: colors.text.primary },
  navTitle: { ...typography.heading4, color: colors.text.primary },
  body: { paddingHorizontal: spacing[6], paddingBottom: 140, gap: spacing[3] },
  heroImage: {
    width: "100%",
    height: 192,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: colors.bg.secondary,
  },
  heroFallback: {
    width: "100%",
    height: 192,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: colors.bg.secondary,
  },
  tombstone: {
    borderWidth: 1,
    borderColor: colors.accent.amber,
    backgroundColor: "rgba(245,127,23,0.15)",
    borderRadius: radius.md,
    padding: spacing[3],
  },
  tombstoneText: { ...typography.bodySmall, color: colors.accent.amberLight },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: "#4A9EFF",
  },
  statusPillText: { ...typography.button, color: "#000000" },
  clubName: { ...typography.heading3, color: colors.text.primary },
  address: { ...typography.body, color: colors.text.secondary },
  viewClub: { ...typography.button, color: colors.text.primary },
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.bg.secondary,
    padding: spacing[5],
    gap: spacing[2],
  },
  infoTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[2] },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },
  rowLabel: { ...typography.body, color: colors.text.secondary },
  rowValue: { ...typography.body, color: colors.text.primary, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  note: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[2] },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    backgroundColor: colors.bg.primary,
    gap: spacing[2],
  },
  cancelBtn: {
    minHeight: 49,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.status.error,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { ...typography.buttonLarge, color: colors.status.error },
  secondaryBtn: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.text.primary },
  primaryBtn: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  primaryBtnText: { ...typography.button, color: colors.bg.primary },
});
