import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
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
import { layout, spacing, typography, glass } from "@a3/ui/theme";
import { TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import {
  GlassPageBackground,
  LiquidGlassCard,
  GlassIconTile,
  NotificationBellButton,
} from "@a3/ui/components";
import { formatCurrency } from "@a3/utils/billing";
import { LanguagePicker, useTranslation } from "@a3/i18n";
import { useStaffRole, staffRoleQueryId } from "../../lib/StaffRoleContext";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { OwnerModePasscodeGate } from "../../components/OwnerModePasscodeGate";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";

type QuickTile = {
  href:
    | "/(tabs)/slots"
    | "/(tabs)/snacks"
    | "/(tabs)/financials"
    | "/(tabs)/complaints"
    | "/(tabs)/bookings"
    | "/(tabs)/settings";
  labelKey: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  tint: string;
};

const QUICK_TILES: QuickTile[] = [
  { href: "/(tabs)/slots", labelKey: "ownerApp.home.tileSlots", icon: "view-module", tint: "#86efac" },
  { href: "/(tabs)/bookings", labelKey: "ownerApp.home.tileBookings", icon: "event", tint: "#7dd3fc" },
  { href: "/(tabs)/snacks", labelKey: "ownerApp.home.tileSnacks", icon: "fastfood", tint: "#fbbf24" },
  { href: "/(tabs)/financials", labelKey: "ownerApp.home.tileFinancials", icon: "bar-chart", tint: "#fde047" },
  { href: "/(tabs)/complaints", labelKey: "ownerApp.home.tileComplaints", icon: "report-problem", tint: "#fda4af" },
  { href: "/(tabs)/settings", labelKey: "ownerApp.home.tileSettings", icon: "settings", tint: glass.textMuted },
];

const QUICK_TILE_TAB: Record<QuickTile["href"], string | null> = {
  "/(tabs)/slots": "slots",
  "/(tabs)/bookings": "bookings",
  "/(tabs)/snacks": "snacks",
  "/(tabs)/financials": "financials",
  "/(tabs)/complaints": "complaints",
  "/(tabs)/settings": null,
};

function HomeScreenContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const { roleId, canAccessTab } = useStaffRole();
  const [ownerPasscodeOpen, setOwnerPasscodeOpen] = useState(false);
  const { refreshing, onRefresh } = usePullToRefresh();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const unreadInbox = useQuery(api.notifications.getUnreadInboxCount);
  const roles = useQuery(
    api.staffRoles.listStaffRoles,
    dashboard ? {} : "skip",
  );

  const activeRoleName = roles?.find((r) => r._id === roleId)?.name ?? null;

  const visibleQuickTiles = QUICK_TILES.filter((t) => {
    const tab = QUICK_TILE_TAB[t.href];
    if (tab === null) return true;
    if (roleId === undefined) return false;
    return canAccessTab(tab);
  });

  const onRolePillPress = useCallback(() => {
    if (roleId && activeRoleName) {
      Alert.alert(
        t("ownerApp.home.alertStaffRoleTitle", { roleName: activeRoleName }),
        t("ownerApp.home.alertStaffRoleMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("ownerApp.home.alertOwnerMode"),
            onPress: () => setOwnerPasscodeOpen(true),
          },
        ],
      );
      return;
    }
    router.push("/(tabs)/settings");
  }, [roleId, activeRoleName, router, t]);

  const canViewFinancials = roleId !== undefined && canAccessTab("financials");
  const canViewBookings = roleId !== undefined && canAccessTab("bookings");

  const stats = useQuery(
    api.financials.getHomePageDailyStats,
    dashboard && canViewFinancials
      ? { clubId: dashboard.clubId, roleId: staffRoleQueryId(roleId) }
      : "skip",
  );

  const activeTablesCount = canViewFinancials
    ? stats?.activeTables
    : dashboard?.tables.filter((t) => t.isActive).length;
  const activeSessionsCount = canViewFinancials
    ? stats?.activeSessions
    : dashboard
      ? Object.keys(dashboard.activeSessionByTableId ?? {}).length
      : undefined;

  if (dashboard === undefined) {
    return (
      <GlassPageBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={glass.accentBlue} />
          <Text style={styles.centerText}>{t("ownerApp.home.loadingDashboard")}</Text>
        </View>
      </GlassPageBackground>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  const summary = dashboard.bookingSummary;
  const showSummary = dashboard.bookingSettingsEnabled && canViewBookings;

  return (
    <>
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
          {/* Header row — club name + notifications + role pill */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {dashboard.clubName}
              </Text>
              <Text style={styles.headerSubtitle}>{t("ownerApp.home.subtitle")}</Text>
            </View>
            <View style={styles.headerActions}>
              <LanguagePicker variant="icon" />
              <NotificationBellButton
                unreadCount={unreadInbox?.count}
                onPress={() => router.push("/inbox-notifications")}
                accessibilityLabel={t("common.inbox.bellAccessibility")}
              />
              <Pressable
                style={styles.ownerPill}
                onPress={onRolePillPress}
                accessibilityRole="button"
                accessibilityLabel={
                  roleId && activeRoleName
                    ? t("ownerApp.home.staffRoleAccessibility", { name: activeRoleName })
                    : t("ownerApp.home.alertOwnerMode")
                }
              >
                <MaterialIcons
                  name={roleId ? "badge" : "security"}
                  size={14}
                  color="#7dd3fc"
                />
                <Text style={styles.ownerPillText} numberOfLines={1}>
                  {roleId
                    ? (activeRoleName ?? t("ownerApp.home.staffFallback"))
                    : t("ownerApp.home.ownerMode")}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Today's Total Revenue hero — owner / roles with financials only */}
          {canViewFinancials ? (
          <LiquidGlassCard style={styles.revenueHero} padding={24}>
            <View style={styles.revenueLabelRow}>
              <MaterialIcons name="trending-up" size={14} color="#7dd3fc" />
              <Text style={styles.revenueLabel}>{t("ownerApp.home.todayRevenue")}</Text>
            </View>
            <View style={styles.revenueValueRow}>
              <Text style={styles.currency}>₹</Text>
              <Text style={styles.revenueValue}>
                {stats === undefined
                  ? t("common.emDash")
                  : formatCurrency(stats.todayRevenue, stats.currency).replace(
                      /^[^\d]+/,
                      "",
                    )}
              </Text>
            </View>
            <View style={styles.revenueSubRow}>
              <Text style={styles.revenueSubMuted}>
                {stats === undefined
                  ? t("common.loading")
                  : t("ownerApp.home.sessionsToday", { count: stats.completedToday })}
              </Text>
              <View style={styles.revenueSubDot} />
              <Text style={styles.revenueSubAccent}>{t("ownerApp.home.cashBasis")}</Text>
            </View>
          </LiquidGlassCard>
          ) : null}

          {/* Active Tables / Sessions Today */}
          <View style={styles.gridTwo}>
            <View style={styles.statCellWrap}>
              <LiquidGlassCard style={styles.statCard} padding={20}>
                <GlassIconTile>
                  <MaterialIcons name="view-module" size={20} color="#7dd3fc" />
                </GlassIconTile>
                <Text style={styles.statValue}>
                  {activeTablesCount === undefined ? t("common.emDash") : activeTablesCount}
                </Text>
                <Text style={styles.statLabel}>{t("ownerApp.home.activeTables")}</Text>
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
                  {activeSessionsCount === undefined ? t("common.emDash") : activeSessionsCount}
                </Text>
                <Text style={styles.statLabel}>{t("ownerApp.home.sessionsTodayLabel")}</Text>
              </LiquidGlassCard>
            </View>
          </View>

          {/* Quick Access */}
          <Text style={styles.sectionTitle}>{t("ownerApp.home.quickAccess")}</Text>
          <View style={styles.quickRow}>
            {visibleQuickTiles.slice(0, 4).map((tile) => (
              <Pressable
                key={tile.href}
                onPress={() => router.push(tile.href)}
                style={({ pressed }) => [
                  styles.quickTile,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(tile.labelKey)}
              >
                <View style={styles.quickIcon}>
                  <MaterialIcons name={tile.icon} size={20} color={tile.tint} />
                </View>
                <Text style={styles.quickLabel}>{t(tile.labelKey)}</Text>
              </Pressable>
            ))}
          </View>

          {/* Bookings summary (if enabled) */}
          {showSummary ? (
            <>
              <Text style={styles.sectionTitle}>{t("ownerApp.home.bookingsToday")}</Text>
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
                    <Text style={styles.summaryLabel}>{t("ownerApp.home.pending")}</Text>
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
                    <Text style={styles.summaryLabel}>{t("ownerApp.home.confirmed")}</Text>
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
                    <Text style={styles.summaryLabel}>{t("ownerApp.home.completed")}</Text>
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
                {t("ownerApp.home.bookingsDisabled")}
              </Text>
            </LiquidGlassCard>
          )}

          {/* Active Sessions */}
          {stats?.activeSessions && stats.activeSessions > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t("ownerApp.home.activeSessions")}</Text>
              <LiquidGlassCard
                style={styles.activeSessionCard}
                padding={18}
                onPress={() => router.push("/(tabs)/slots")}
              >
                <View style={styles.activeRow}>
                  <View style={styles.activeLeft}>
                    <View style={styles.liveDot} />
                    <View style={styles.activeTitleBlock}>
                      <Text style={styles.activeTitle}>
                        {t("ownerApp.home.activeSessionsCount", {
                          count: stats.activeSessions,
                        })}
                      </Text>
                      <Text style={styles.activeSub}>{t("ownerApp.home.tapToViewTables")}</Text>
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
    <OwnerModePasscodeGate
      visible={ownerPasscodeOpen}
      clubId={dashboard.clubId}
      onCancel={() => setOwnerPasscodeOpen(false)}
      onSuccess={() => setOwnerPasscodeOpen(false)}
    />
    </>
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
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingEnd: spacing[3],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: glass.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    ...typography.caption,
    color: glass.textMuted,
    marginTop: 2,
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
    maxWidth: 140,
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
    marginEnd: 4,
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
  activeTitleBlock: {
    marginStart: 12,
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

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.home")}>
      <HomeScreenContent />
    </TabErrorBoundary>
  );
}
