import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, glass } from "@a3/ui/theme";
import { TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import {
  GlassPageBackground,
  LiquidGlassCard,
  GlassIconTile,
  NotificationBellButton,
} from "@a3/ui/components";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { getCurrentLanguage, useTranslation, LanguagePicker } from "@a3/i18n";
import { customerTabBarTotalInset } from "../../theme/customerShell";

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dt);
}

function formatComplaintDate(ms: number): string {
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function countdownLabel(
  startMs: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const diff = Math.max(0, startMs - Date.now());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    return t("customerApp.home.countdownInMinutes", { count: Math.max(1, minutes) });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("customerApp.home.countdownInHours", { count: hours });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(startMs);
  if (
    start.getFullYear() === tomorrow.getFullYear() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getDate() === tomorrow.getDate()
  ) {
    return t("customerApp.home.tomorrow");
  }
  return t("customerApp.home.countdownInDays", { count: Math.ceil(hours / 24) });
}

function HomeScreenContent() {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = customerTabBarTotalInset(insets.bottom);
  const user = useQuery(api.users.getCurrentUser);
  const myComplaints = useQuery(api.complaints.getMyActiveComplaints);
  const next = useQuery(
    api.bookings.getNextConfirmedBooking,
    user?._id ? { customerId: user._id } : "skip",
  );
  const pending = useQuery(
    api.bookings.getPendingBookingsCount,
    user?._id ? { customerId: user._id } : "skip",
  );
  const unreadInbox = useQuery(api.notifications.getUnreadInboxCount);

  const complaints = myComplaints?.complaints ?? [];
  const greetingTime = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("customerApp.home.goodMorning");
    if (h < 17) return t("customerApp.home.goodAfternoon");
    return t("customerApp.home.goodEvening");
  })();

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: spacing[2], paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.greetingSmall}>{greetingTime}</Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {user?.name ? user.name : t("customerApp.home.playerDefault")}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <LanguagePicker variant="icon" />
              <NotificationBellButton
                unreadCount={unreadInbox?.count}
                onPress={() => router.push("/inbox-notifications")}
                accessibilityLabel={t("common.inbox.bellAccessibility")}
              />
              <Pressable
                hitSlop={10}
                style={styles.profileBtn}
                onPress={() => router.push("/(tabs)/profile")}
                accessibilityLabel={t("customerApp.home.profileAccessibility")}
              >
                <MaterialIcons name="person" size={20} color={glass.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Complaint details — customer sees exact reason */}
          {complaints.length > 0 ? (
            <LiquidGlassCard style={styles.alertCard} padding={14}>
              <View style={styles.alertHeader}>
                <View style={styles.alertIconWrap}>
                  <MaterialIcons
                    name="warning"
                    size={18}
                    color={colors.accent.amber}
                  />
                </View>
                <Text style={styles.alertTitle}>{t("customerApp.home.flaggedTitle")}</Text>
              </View>
              <Text style={styles.alertIntro}>{t("customerApp.home.flaggedIntro")}</Text>
              {complaints.map((c) => (
                <View key={c._id} style={styles.complaintBox}>
                  <Text style={styles.complaintType}>{c.typeLabel}</Text>
                  <Text style={styles.complaintMeta}>
                    {t("customerApp.home.filedBy", {
                      clubName: c.clubName,
                      date: formatComplaintDate(c.createdAt),
                    })}
                  </Text>
                  {c.description.trim().length > 0 ? (
                    <Text style={styles.complaintDesc}>{c.description}</Text>
                  ) : null}
                </View>
              ))}
            </LiquidGlassCard>
          ) : null}

          {/* Next booking hero */}
          {next ? (
            <LiquidGlassCard
              style={styles.nextCard}
              padding={20}
              onPress={() => router.push(`/booking/${next.log.bookingId}`)}
            >
              <View style={styles.nextRow}>
                <Text style={styles.nextLabel}>{t("customerApp.home.nextBooking")}</Text>
                <View style={styles.nextChip}>
                  <View style={styles.nextChipDot} />
                  <Text style={styles.nextChipText}>
                    {countdownLabel(next.startMs, t)}
                  </Text>
                </View>
              </View>
              <Text style={styles.nextClub} numberOfLines={1}>
                {next.log.clubName}
              </Text>
              <View style={styles.nextMetaRow}>
                <MaterialIcons
                  name="event"
                  size={14}
                  color={glass.textMuted}
                />
                <Text style={styles.nextMeta}>
                  {formatShortDate(next.log.requestedDate)} ·{" "}
                  {to12h(next.log.requestedStartTime)}
                </Text>
              </View>
            </LiquidGlassCard>
          ) : (
            <LiquidGlassCard style={styles.nextCard} padding={20}>
              <Text style={styles.nextLabel}>{t("customerApp.home.nextBooking")}</Text>
              <Text style={[styles.nextClub, { color: glass.textMuted }]}>
                {t("customerApp.home.noUpcomingBookings")}
              </Text>
              <Text style={styles.nextMeta}>{t("customerApp.home.discoverPrompt")}</Text>
              <Pressable
                style={styles.findBtn}
                onPress={() => router.push("/(tabs)/discover")}
              >
                <Text style={styles.findBtnText}>{t("customerApp.home.findClub")}</Text>
                <MaterialIcons name="chevron-right" size={18} color="#000" />
              </Pressable>
            </LiquidGlassCard>
          )}

          {/* Quick stats — pending count */}
          <View style={styles.gridTwo}>
            <View style={styles.statCellWrap}>
              <LiquidGlassCard style={styles.statCard} padding={18}>
                <GlassIconTile>
                  <MaterialIcons
                    name="pending-actions"
                    size={20}
                    color="#fbbf24"
                  />
                </GlassIconTile>
                <Text style={[styles.statValue, { color: "#fbbf24" }]}>
                  {pending?.count ?? 0}
                </Text>
                <Text style={styles.statLabel}>{t("customerApp.home.pendingRequests")}</Text>
              </LiquidGlassCard>
            </View>
            <View style={styles.statCellWrap}>
              <LiquidGlassCard
                style={styles.statCard}
                padding={18}
                onPress={() => router.push("/(tabs)/history")}
              >
                <GlassIconTile>
                  <MaterialIcons name="history" size={20} color="#86efac" />
                </GlassIconTile>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>{t("customerApp.home.viewHistory")}</Text>
              </LiquidGlassCard>
            </View>
          </View>

          {/* Quick links */}
          <Text style={styles.sectionTitle}>{t("customerApp.home.quickAccess")}</Text>
          <View style={styles.quickRow}>
            <Pressable
              style={styles.quickTile}
              onPress={() => router.push("/(tabs)/discover")}
            >
              <View style={styles.quickIcon}>
                <MaterialIcons name="explore" size={22} color="#7dd3fc" />
              </View>
              <Text style={styles.quickLabel}>{t("customerApp.home.discover")}</Text>
            </Pressable>
            <Pressable
              style={styles.quickTile}
              onPress={() => router.push("/(tabs)/bookings")}
            >
              <View style={styles.quickIcon}>
                <MaterialIcons name="event" size={22} color="#86efac" />
              </View>
              <Text style={styles.quickLabel}>{t("customerApp.home.bookings")}</Text>
            </Pressable>
            <Pressable
              style={styles.quickTile}
              onPress={() => router.push("/(tabs)/history")}
            >
              <View style={styles.quickIcon}>
                <MaterialIcons name="history" size={22} color="#fbbf24" />
              </View>
              <Text style={styles.quickLabel}>{t("customerApp.home.history")}</Text>
            </Pressable>
            <Pressable
              style={styles.quickTile}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <View style={styles.quickIcon}>
                <MaterialIcons name="person" size={22} color="#fda4af" />
              </View>
              <Text style={styles.quickLabel}>{t("customerApp.home.profile")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: layout.screenPadding,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  greetingSmall: {
    fontSize: 13,
    color: glass.textMuted,
    fontWeight: "500",
  },
  greetingName: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "700",
    color: glass.textPrimary,
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCard: {
    marginBottom: spacing[4],
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  alertIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    ...typography.label,
    color: "#fde68a",
    fontWeight: "700",
    flex: 1,
  },
  alertIntro: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[3],
    lineHeight: 20,
  },
  complaintBox: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  complaintType: {
    ...typography.label,
    color: colors.accent.amber,
    fontWeight: "700",
  },
  complaintMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  complaintDesc: {
    ...typography.bodySmall,
    color: glass.textPrimary,
    marginTop: spacing[2],
    lineHeight: 20,
  },
  nextCard: {
    marginBottom: spacing[4],
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: glass.textLabel,
    letterSpacing: 0.7,
  },
  nextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.4)",
    backgroundColor: "rgba(134, 239, 172, 0.12)",
  },
  nextChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#86efac",
  },
  nextChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#86efac",
  },
  nextClub: {
    marginTop: spacing[3],
    fontSize: 22,
    fontWeight: "700",
    color: glass.textPrimary,
    letterSpacing: -0.3,
  },
  nextMetaRow: {
    marginTop: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextMeta: {
    fontSize: 13,
    color: glass.textMuted,
  },
  findBtn: {
    marginTop: spacing[4],
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#86efac",
  },
  findBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  gridTwo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  statCellWrap: { width: "48.5%" },
  statCard: { width: "100%", minHeight: 130 },
  statValue: {
    marginTop: spacing[3],
    fontSize: 24,
    fontWeight: "700",
    color: glass.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: spacing[1],
    fontSize: 12,
    color: glass.textMuted,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.7,
    color: glass.textLabel,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: spacing[3],
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  quickTile: {
    width: "23%",
    alignItems: "center",
    gap: 8,
  },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 12,
    color: glass.textMuted,
    fontWeight: "500",
  },
});

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.customer.home")}>
      <HomeScreenContent />
    </TabErrorBoundary>
  );
}
