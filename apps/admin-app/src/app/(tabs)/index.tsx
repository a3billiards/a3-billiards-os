import React, { Component, useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius, glass } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { GlassPageBackground, LiquidGlassCard, GlassIconTile } from "@a3/ui/components";
import { LanguagePicker, getCurrentLanguage, useTranslation } from "@a3/i18n";
import { adminShell, adminTabBarTotalInset } from "../../theme/adminShell";
import { useAdminAuth } from "../../lib/adminAuth";

type DashboardData = {
  totalUsers: number;
  activeClubs: number;
  activeSessions: number;
  revenue: { allTime: number; today: number };
  openComplaints: number;
  pendingBookings: number;
  fetchedAt: number;
};

function formatInt(n: number): string {
  return new Intl.NumberFormat(getCurrentLanguage(), { maximumFractionDigits: 0 }).format(n);
}

function formatUpdated(ts: number): string {
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
}

function ShimmerBox({ style }: { style: object }): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.65,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]} />;
}

function SkeletonGrid(): React.JSX.Element {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.statCellWrap}>
          <ShimmerBox style={styles.skeletonCard} />
        </View>
      ))}
    </View>
  );
}

function LiveDot(): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <Animated.View
      style={[
        styles.liveDot,
        { transform: [{ scale }] },
      ]}
    />
  );
}

function DecorativeRevenueChart(): React.JSX.Element {
  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={140} viewBox="0 0 320 140" preserveAspectRatio="none">
        <Path
          d="M 8 110 C 60 114, 100 96, 140 78 S 220 36, 312 22"
          stroke={glass.chartLine}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        {/* Data points */}
        <Circle cx={8} cy={110} r={3} fill={glass.chartLine} />
        <Circle cx={70} cy={108} r={3} fill={glass.chartLine} />
        <Circle cx={140} cy={78} r={3} fill={glass.chartLine} />
        <Circle cx={210} cy={56} r={3} fill={glass.chartLine} />
        <Circle cx={270} cy={40} r={3} fill={glass.chartLine} />
        <Circle cx={312} cy={22} r={5} fill={glass.chartLine} />
      </Svg>
      <View style={styles.chartLabelsRow}>
        {["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m) => (
          <Text key={m} style={styles.chartXLabel}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

class DashboardErrorBoundary extends Component<
  {
    children: React.ReactNode;
    onRetry: () => void;
    loadError: string;
    retryLabel: string;
  },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: parseConvexError(error).message };
  }

  componentDidCatch(error: Error) {
    console.error("Admin dashboard error:", error);
  }

  render() {
    if (this.state.message) {
      return (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={20} color={colors.status.error} />
          <Text style={styles.errorText}>{this.props.loadError}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              this.setState({ message: null });
              this.props.onRetry();
            }}
          >
            <Text style={styles.retryBtnText}>{this.props.retryLabel}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function DashboardScreenContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOutAdmin } = useAdminAuth();
  const user = useQuery(api.users.getCurrentUser, {});
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [boundaryNonce, setBoundaryNonce] = useState(0);

  const canQuery =
    user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;

  const data = useQuery(
    api.admin.getAdminDashboard,
    canQuery ? { refreshKey } : "skip",
  ) as DashboardData | undefined;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const onLogout = useCallback(async () => {
    await signOutAdmin();
  }, [signOutAdmin]);

  const dash = data ?? undefined;
  const bottomPad = adminTabBarTotalInset(insets.bottom);

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: spacing[2], paddingBottom: bottomPad },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={glass.chartLine}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <LiquidGlassCard style={styles.heroCard} padding={24}>
              <View style={styles.heroTopRow}>
              <View style={styles.heroTitles}>
                <Text style={styles.heroTitle}>{t("adminApp.dashboard.title")}</Text>
                <Text style={styles.heroSubtitle}>{t("adminApp.dashboard.subtitle")}</Text>
              </View>
              <View style={styles.heroActions}>
                <LanguagePicker variant="icon" />
                <Pressable
                onPress={onLogout}
                hitSlop={12}
                style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.75 }]}
                accessibilityLabel={t("adminApp.dashboard.logOutAccessibility")}
              >
                <MaterialIcons name="logout" size={20} color={glass.accentBlue} />
              </Pressable>
              </View>
            </View>
            {dash ? (
              <View style={styles.updatedRow}>
                <View style={styles.statusDot} />
                <Text style={styles.updated}>
                  {t("adminApp.dashboard.liveUpdated", {
                    time: formatUpdated(dash.fetchedAt),
                  })}
                </Text>
              </View>
            ) : null}
          </LiquidGlassCard>

          <DashboardErrorBoundary
            key={boundaryNonce}
            onRetry={() => setBoundaryNonce((n) => n + 1)}
            loadError={t("adminApp.dashboard.loadError")}
            retryLabel={t("adminApp.dashboard.retry")}
          >
            {!canQuery || dash === undefined ? (
              <SkeletonGrid />
            ) : (
              <>
                <View style={styles.grid}>
                  <GlassStatCard
                    icon="people"
                    value={formatInt(dash.totalUsers)}
                    label={t("adminApp.dashboard.totalUsers")}
                    onPress={() => router.push("/(tabs)/users")}
                  />
                  <GlassStatCard
                    icon="business"
                    value={formatInt(dash.activeClubs)}
                    label={t("adminApp.dashboard.activeClubs")}
                    onPress={() => router.push("/(tabs)/clubs")}
                  />
                  <GlassStatCard
                    icon="play-circle-filled"
                    value={formatInt(dash.activeSessions)}
                    label={t("adminApp.dashboard.activeSessions")}
                    valueColor={
                      dash.activeSessions > 0 ? glass.trendPositive : glass.textPrimary
                    }
                    trailing={dash.activeSessions > 0 ? <LiveDot /> : null}
                    onPress={() => router.push("/sessions")}
                  />
                  <GlassStatCard
                    icon="report-problem"
                    value={formatInt(dash.openComplaints)}
                    label={t("adminApp.dashboard.openComplaints")}
                    valueColor={
                      dash.openComplaints > 0 ? colors.status.error : glass.textPrimary
                    }
                    onPress={() => router.push("/(tabs)/complaints")}
                  />
                  <GlassStatCard
                    icon="pending-actions"
                    value={formatInt(dash.pendingBookings)}
                    label={t("adminApp.dashboard.pendingBookings")}
                    valueColor={
                      dash.pendingBookings > 0 ? colors.accent.amberLight : glass.textPrimary
                    }
                    onPress={() => router.push("/bookings")}
                  />
                </View>

                <LiquidGlassCard style={styles.revenueCard} padding={24}>
                  <Text style={styles.revenueLabel}>{t("adminApp.dashboard.platformRevenue")}</Text>
                  <Text style={styles.revenueValue}>₹{formatInt(dash.revenue.allTime)}</Text>
                  <View style={styles.revenueRow}>
                    <MaterialIcons
                      name="trending-up"
                      size={16}
                      color={glass.trendPositive}
                    />
                    <Text style={styles.revenueTrend}>
                      {t("adminApp.dashboard.todayRevenue", {
                        amount: formatInt(dash.revenue.today),
                      })}
                    </Text>
                  </View>
                  <DecorativeRevenueChart />
                </LiquidGlassCard>
              </>
            )}
          </DashboardErrorBoundary>
        </ScrollView>
      </SafeAreaView>
    </GlassPageBackground>
  );
}

function GlassStatCard(props: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  label: string;
  valueColor?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}): React.JSX.Element {
  const {
    icon,
    value,
    label,
    valueColor = glass.textPrimary,
    trailing,
    onPress,
  } = props;

  return (
    <View style={styles.statCellWrap}>
      <LiquidGlassCard style={styles.statCard} onPress={onPress} padding={20}>
        <GlassIconTile>
          <MaterialIcons name={icon} size={20} color={glass.textMuted} />
        </GlassIconTile>
        <View style={styles.valueRow}>
          <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
          {trailing}
        </View>
        <Text style={styles.statLabel} numberOfLines={2}>
          {label.toUpperCase()}
        </Text>
      </LiquidGlassCard>
    </View>
  );
}

const GAP = 12;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: layout.screenPadding,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  heroTitles: { flex: 1, minWidth: 0 },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    marginBottom: spacing[5],
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: glass.textPrimary,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 20,
    color: glass.textMuted,
  },
  updatedRow: {
    marginTop: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: glass.trendPositive,
  },
  updated: {
    fontSize: 12,
    color: glass.textLabel,
    letterSpacing: 0.4,
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  statCellWrap: {
    width: "48%",
    marginBottom: GAP,
  },
  statCard: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 162,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[4],
  },
  statValue: { fontSize: 26, fontWeight: "600", letterSpacing: -0.5 },
  statLabel: {
    marginTop: spacing[2],
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.6,
    color: glass.textLabel,
  },
  skeletonCard: {
    width: "100%",
    minHeight: 162,
    borderRadius: glass.cardRadius,
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
  },
  revenueCard: {
    marginBottom: spacing[4],
  },
  revenueLabel: {
    fontSize: 13,
    letterSpacing: 0.7,
    color: glass.textLabel,
    textTransform: "uppercase",
  },
  revenueValue: {
    marginTop: spacing[2],
    fontSize: 32,
    fontWeight: "600",
    color: glass.textPrimary,
    letterSpacing: -0.5,
  },
  revenueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  revenueTrend: {
    flex: 1,
    fontSize: 13,
    color: glass.trendPositive,
    fontWeight: "600",
  },
  chartWrap: { marginTop: spacing[4] },
  chartLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 6,
  },
  chartXLabel: {
    fontSize: 10,
    color: glass.textLabel,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: glass.trendPositive,
  },
  errorBanner: {
    marginBottom: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: "rgba(244, 67, 54, 0.12)",
    borderWidth: 1,
    borderColor: colors.status.error,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing[2],
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.error,
    flex: 1,
    minWidth: 120,
  },
  retryBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: colors.bg.secondary,
  },
  retryBtnText: { ...typography.caption, color: colors.text.primary, fontWeight: "600" },
});

export default function DashboardScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.index")}>
      <DashboardScreenContent />
    </TabErrorBoundary>
  );
}
