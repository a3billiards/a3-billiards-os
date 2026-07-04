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
  I18nManager,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, spacing, radius, typography, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { useTranslation } from "@a3/i18n";

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function durationLabel(
  min: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (min === 60) return t("customerApp.bookingDetail.durationOneHour");
  if (min % 60 === 0) return t("customerApp.bookingDetail.durationHours", { count: min / 60 });
  if (min % 30 === 0) {
    return t("customerApp.bookingDetail.durationHoursDecimal", { hours: (min / 60).toFixed(1) });
  }
  return t("customerApp.bookingDetail.durationMin", { count: min });
}

function currencySymbol(code: string): string {
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return `${code} `;
}

function statusLabel(
  status: string,
  t: (key: string) => string,
): string {
  const key = `customerApp.bookingDetail.status.${status}` as const;
  const translated = t(key);
  if (translated !== key) return translated;
  return t("customerApp.bookingDetail.status.completed");
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
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
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
      address: club?.address ?? detail.clubAddress ?? t("customerApp.bookingDetail.addressUnavailable"),
      tombstone: club === null,
    };
  }, [detail, t]);

  if (!bookingId) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>{t("customerApp.bookingDetail.notFound")}</Text>
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (detail === undefined) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={glass.ctaBg} />
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (detail === null) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>{t("customerApp.bookingDetail.notFound")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace("/bookings")}>
            <Text style={styles.primaryBtnText}>{t("customerApp.bookingDetail.goToMyBookings")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  const onCancel = () => {
    if (!canCancel) return;
    Alert.alert(
      t("customerApp.myBookings.cancelTitle"),
      detail.status === "pending_approval"
        ? t("customerApp.myBookings.cancelPendingBody", { clubName: detail.clubName })
        : detail.isLateCancellationNow
          ? t("customerApp.myBookings.cancelLateBody", {
              minutes: detail.cancellationWindowMin ?? 30,
            })
          : t("customerApp.myBookings.cancelConfirmedBody", {
              clubName: detail.clubName,
              date: detail.requestedDate,
              time: detail.requestedStartTime,
            }),
      [
        { text: t("customerApp.myBookings.keepBooking"), style: "cancel" },
        {
          text: t("customerApp.bookingDetail.cancelBooking"),
          style: "destructive",
          onPress: async () => {
            try {
              setLoadingCancel(true);
              await cancelBooking({ bookingId: detail.bookingId, clubId: detail.clubId });
              Alert.alert(t("customerApp.myBookings.cancelledSuccess"));
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
    <GlassPageBackground>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.navBtnText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.navTitle}>{t("customerApp.bookingDetail.title")}</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 140 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {detail.thumbnailPhotoUrl ? (
          <Image source={{ uri: detail.thumbnailPhotoUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroFallback} />
        )}
        {venue?.tombstone ? (
          <View style={styles.tombstone}>
            <Text style={styles.tombstoneText}>{t("customerApp.bookingDetail.tombstone")}</Text>
          </View>
        ) : null}

        <View style={[styles.statusPill, { backgroundColor: statusChip!.bg }]}>
          <Text style={[styles.statusPillText, { color: statusChip!.fg }]}>
            {statusLabel(detail.status, t)}
          </Text>
        </View>
        <Text style={styles.clubName}>{venue?.name}</Text>
        <Text style={styles.address}>{venue?.address}</Text>

        {!venue?.tombstone ? (
          <Pressable onPress={() => router.push(`/club/${detail.clubId}` as any)}>
            <Text style={styles.viewClub}>{t("customerApp.bookingDetail.viewClubProfile")}</Text>
          </Pressable>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t("customerApp.bookingDetail.bookingInfo")}</Text>
          <Row label={t("customerApp.bookingDetail.tableType")} value={detail.tableType} />
          <Row label={t("customerApp.bookingDetail.date")} value={detail.requestedDate} />
          <Row label={t("customerApp.bookingDetail.time")} value={to12h(detail.requestedStartTime)} />
          <Row label={t("customerApp.bookingDetail.duration")} value={durationLabel(detail.requestedDurationMin, t)} />
          {detail.status === "confirmed" && detail.confirmedTableLabel ? (
            <Row
              label={t("customerApp.bookingDetail.assignedTable")}
              value={t("customerApp.bookingDetail.assignedTableValue", {
                label: detail.confirmedTableLabel,
              })}
            />
          ) : null}
          <Row
            label={t("customerApp.bookingDetail.estimatedCost")}
            value={t("customerApp.bookingDetail.estimatedCostValue", {
              symbol: currencySymbol(detail.currency),
              amount: detail.estimatedCost ?? 0,
            })}
          />
          <Text style={styles.note}>{t("customerApp.bookingDetail.billNote")}</Text>
          {detail.notes ? <Row label={t("customerApp.bookingDetail.yourNotes")} value={detail.notes} /> : null}
          {detail.status === "rejected" && detail.rejectionReason ? (
            <Row label={t("customerApp.bookingDetail.reason")} value={detail.rejectionReason} />
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!venue?.tombstone ? (
          <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/club/${detail.clubId}` as any)}>
            <Text style={styles.secondaryBtnText}>{t("customerApp.bookingDetail.viewClub")}</Text>
          </Pressable>
        ) : null}
        {canCancel ? (
          <Pressable
            style={[styles.cancelBtn, loadingCancel && { opacity: 0.7 }]}
            onPress={onCancel}
            disabled={loadingCancel}
          >
            <Text style={styles.cancelBtnText}>{t("customerApp.bookingDetail.cancelBooking")}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
    </GlassPageBackground>
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
  safe: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: spacing[3] },
  muted: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  nav: {
    margin: spacing[4],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
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
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
  },
  heroFallback: {
    width: "100%",
    height: 192,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
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
  viewClub: { ...typography.button, color: glass.accentBlue },
  infoCard: {
    borderRadius: glass.cardRadiusSmall,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
    padding: spacing[5],
    gap: spacing[2],
  },
  infoTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[2] },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },
  rowLabel: { ...typography.body, color: colors.text.secondary },
  rowValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: I18nManager.isRTL ? "left" : "right",
  },
  note: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[2] },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    backgroundColor: glass.tabPillBg,
    borderTopWidth: 1,
    borderTopColor: glass.tabPillBorder,
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
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.text.primary },
  primaryBtn: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    backgroundColor: glass.ctaBg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  primaryBtnText: { ...typography.button, color: glass.ctaText },
});
