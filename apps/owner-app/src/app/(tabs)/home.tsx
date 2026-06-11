import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { layout, spacing, typography, glass } from "@a3/ui/theme";
import {
  GlassPageBackground,
  LiquidGlassCard,
  GlassIconTile,
} from "@a3/ui/components";
import { formatCurrency } from "@a3/utils/billing";
import { getActiveRoleId } from "../../lib/activeRoleStorage";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";

type QuickTile = {
  href:
    | "/(tabs)/slots"
    | "/(tabs)/snacks"
    | "/(tabs)/financials"
    | "/(tabs)/complaints"
    | "/(tabs)/bookings"
    | "/(tabs)/settings";
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  tint: string;
};

const QUICK_TILES: QuickTile[] = [
  { href: "/(tabs)/slots", label: "Slots", icon: "view-module", tint: "#86efac" },
  { href: "/(tabs)/bookings", label: "Bookings", icon: "event", tint: "#7dd3fc" },
  { href: "/(tabs)/snacks", label: "Snacks", icon: "fastfood", tint: "#fbbf24" },
  { href: "/(tabs)/financials", label: "Financials", icon: "bar-chart", tint: "#fde047" },
  { href: "/(tabs)/complaints", label: "Complaints", icon: "report-problem", tint: "#fda4af" },
  { href: "/(tabs)/settings", label: "Settings", icon: "settings", tint: glass.textMuted },
];

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const [roleId, setRoleId] = useState<Id<"staffRoles"> | undefined>(undefined);

  useEffect(() => {
    void getActiveRoleId().then((v) => {
      if (v) setRoleId(v as Id<"staffRoles">);
    });
  }, []);

  const stats = useQuery(
    api.financials.getHomePageDailyStats,
    dashboard ? { clubId: dashboard.clubId, roleId } : "skip",
  );

  if (dashboard === undefined) {
    return (
      <GlassPageBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={glass.accentBlue} />
          <Text style={styles.centerText}>Loading dashboard…</Text>
        </View>
      </GlassPageBackground>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  const summary = dashboard.bookingSummary;
  const showSummary = dashboard.bookingSettingsEnabled;

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: spacing[2], paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header row — Home title + notifications + Owner pill */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Home</Text>
            <View style={styles.headerActions}>
              <Pressable
                hitSlop={10}
                style={styles.bellBtn}
                onPress={() => router.push("/(tabs)/complaints")}
                accessibilityLabel="Notifications"
              >
                <MaterialIcons
                  name="notifications-none"
                  size={20}
                  color={glass.textMuted}
                />
                <View style={styles.bellDot} />
              </Pressable>
              <View style={styles.ownerPill}>
                <MaterialIcons name="security" size={14} color="#7dd3fc" />
                <Text style={styles.ownerPillText}>Owner</Text>
              </View>
            </View>
          </View>

          {/* Today's Total Revenue hero */}
          <LiquidGlassCard style={styles.revenueHero} padding={24}>
            <View style={styles.revenueLabelRow}>
              <MaterialIcons name="trending-up" size={14} color="#7dd3fc" />
              <Text style={styles.revenueLabel}>TODAY'S TOTAL REVENUE</Text>
            </View>
            <View style={styles.revenueValueRow}>
              <Text style={styles.currency}>₹</Text>
              <Text style={styles.revenueValue}>
                {stats === undefined
                  ? "—"
                  : formatCurrency(stats.todayRevenue, stats.currency).replace(
                      /^[^\d]+/,
                      "",
                    )}
              </Text>
            </View>
            <View style={styles.revenueSubRow}>
              <Text style={styles.revenueSubMuted}>
                {stats === undefined
                  ? "Loading…"
                  : `${stats.completedToday} session${stats.completedToday === 1 ? "" : "s"} today`}
              </Text>
              <View style={styles.revenueSubDot} />
              <Text style={styles.revenueSubAccent}>Cash basis</Text>
            </View>
          </LiquidGlassCard>

          {/* Active Tables / Sessions Today */}
          <View style={styles.gridTwo}>
            <View style={styles.statCellWrap}>
              <LiquidGlassCard style={styles.statCard} padding={20}>
                <GlassIconTile>
                  <MaterialIcons name="view-module" size={20} color="#7dd3fc" />
                </GlassIconTile>
                <Text style={styles.statValue}>
                  {stats === undefined ? "—" : stats.activeTables}
                </Text>
                <Text style={styles.statLabel}>Active Tables</Text>
              </LiquidGlassCard>
            </View>
            <View style={styles.statCellWrap}>
              <LiquidGlassCard style={styles.statCard} padding={20}>
                <GlassIconTile>
                  <MaterialIcons
                    name="play-circle-outline"
                    size={20}
                    color="#86efac"
                  />
                </GlassIconTile>
                <Text style={[styles.statValue, { color: "#86efac" }]}>
                  {stats === undefined ? "—" : stats.activeSessions}
                </Text>
                <Text style={styles.statLabel}>Sessions Today</Text>
              </LiquidGlassCard>
            </View>
          </View>

          {/* Quick Access */}
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickRow}>
            {QUICK_TILES.slice(0, 4).map((t) => (
              <Pressable
                key={t.href}
                onPress={() => router.push(t.href)}
                style={({ pressed }) => [
                  styles.quickTile,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${t.label}`}
              >
                <View style={styles.quickIcon}>
                  <MaterialIcons name={t.icon} size={20} color={t.tint} />
                </View>
                <Text style={styles.quickLabel}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Bookings summary (if enabled) */}
          {showSummary ? (
            <>
              <Text style={styles.sectionTitle}>Bookings Today</Text>
              <View style={styles.gridThree}>
                <View style={styles.statCellWrapThird}>
                  <LiquidGlassCard
                    style={styles.summaryCard}
                    padding={14}
                    onPress={() =>
                      router.push("/(tabs)/bookings?segment=pending")
                    }
                  >
                    <Text style={[styles.summaryValue, { color: "#fbbf24" }]}>
                      {summary.pending}
                    </Text>
                    <Text style={styles.summaryLabel}>Pending</Text>
                  </LiquidGlassCard>
                </View>
                <View style={styles.statCellWrapThird}>
                  <LiquidGlassCard
                    style={styles.summaryCard}
                    padding={14}
                    onPress={() =>
                      router.push("/(tabs)/bookings?segment=upcoming")
                    }
                  >
                    <Text style={[styles.summaryValue, { color: "#86efac" }]}>
                      {summary.confirmedToday}
                    </Text>
                    <Text style={styles.summaryLabel}>Confirmed</Text>
                  </LiquidGlassCard>
                </View>
                <View style={styles.statCellWrapThird}>
                  <LiquidGlassCard
                    style={styles.summaryCard}
                    padding={14}
                    onPress={() =>
                      router.push("/(tabs)/bookings?segment=history")
                    }
                  >
                    <Text style={[styles.summaryValue, { color: "#7dd3fc" }]}>
                      {summary.completedToday}
                    </Text>
                    <Text style={styles.summaryLabel}>Completed</Text>
                  </LiquidGlassCard>
                </View>
              </View>
            </>
          ) : (
            <LiquidGlassCard style={styles.bookingsDisabled} padding={16}>
              <MaterialIcons
                name="event-busy"
                size={20}
                color={glass.textMuted}
              />
              <Text style={styles.bookingsDisabledText}>
                Online booking is disabled. Enable it in Settings to track
                booking activity here.
              </Text>
            </LiquidGlassCard>
          )}

          {/* Active Sessions */}
          {stats?.activeSessions && stats.activeSessions > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Active Sessions</Text>
              <LiquidGlassCard
                style={styles.activeSessionCard}
                padding={18}
                onPress={() => router.push("/(tabs)/slots")}
              >
                <View style={styles.activeRow}>
                  <View style={styles.activeLeft}>
                    <View style={styles.liveDot} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.activeTitle}>
                        {stats.activeSessions} active session
                        {stats.activeSessions === 1 ? "" : "s"}
                      </Text>
                      <Text style={styles.activeSub}>Tap to view tables</Text>
                    </View>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={glass.textMuted}
                  />
                </View>
              </LiquidGlassCard>
            </>
          ) : null}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
  },
  centerText: {
    ...typography.body,
    color: glass.textMuted,
    marginTop: spacing[3],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: glass.textPrimary,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: glass.trendPositive,
    borderWidth: 1,
    borderColor: glass.pageBgBottom,
  },
  ownerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.4)",
    backgroundColor: "rgba(125, 211, 252, 0.1)",
  },
  ownerPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7dd3fc",
    letterSpacing: 0.2,
  },
  revenueHero: {
    marginBottom: spacing[4],
  },
  revenueLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  revenueLabel: {
    fontSize: 11,
    color: glass.textLabel,
    letterSpacing: 0.7,
    fontWeight: "600",
  },
  revenueValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: spacing[2],
  },
  currency: {
    fontSize: 24,
    color: glass.textMuted,
    fontWeight: "500",
    marginRight: 4,
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 38,
    color: glass.textPrimary,
    fontWeight: "700",
    letterSpacing: -1,
  },
  revenueSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
  },
  revenueSubMuted: { fontSize: 12, color: glass.textMuted },
  revenueSubDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: glass.textLabel,
  },
  revenueSubAccent: {
    fontSize: 12,
    color: "#7dd3fc",
    fontWeight: "600",
  },
  gridTwo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  gridThree: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  statCellWrap: { width: "48.5%" },
  statCellWrapThird: { width: "31.5%" },
  statCard: {
    width: "100%",
    minHeight: 150,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "700",
    color: glass.textPrimary,
    letterSpacing: -0.5,
    marginTop: spacing[4],
  },
  statLabel: {
    marginTop: spacing[2],
    fontSize: 13,
    color: glass.textMuted,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.7,
    color: glass.textLabel,
    textTransform: "uppercase",
    fontWeight: "600",
    marginTop: spacing[3],
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
  summaryCard: {
    width: "100%",
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: glass.textPrimary,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: glass.textLabel,
    textAlign: "center",
    marginTop: 4,
    textTransform: "uppercase",
  },
  bookingsDisabled: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  bookingsDisabledText: {
    ...typography.bodySmall,
    color: glass.textMuted,
    flex: 1,
  },
  activeSessionCard: {
    marginBottom: spacing[3],
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: glass.trendPositive,
  },
  activeTitle: {
    fontSize: 15,
    color: glass.textPrimary,
    fontWeight: "600",
  },
  activeSub: {
    marginTop: 2,
    fontSize: 12,
    color: glass.textMuted,
  },
});
