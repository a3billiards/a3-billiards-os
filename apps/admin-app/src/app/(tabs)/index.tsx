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
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { adminShell, adminTabBarTotalInset } from "../../theme/adminShell";

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
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function formatUpdated(ts: number): string {
  return new Intl.DateTimeFormat("en-IN", {
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
        {
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function DecorativeRevenueChart(): React.JSX.Element {
  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={112} viewBox="0 0 320 112" preserveAspectRatio="none">
        <Path
          d="M 8 88 C 60 92, 100 72, 140 56 S 220 28, 312 18"
          stroke={adminShell.chartLine}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={312} cy={18} r={4} fill={adminShell.chartLine} />
      </Svg>
      <Text style={styles.chartHint}>Activity curve (illustrative)</Text>
    </View>
  );
}

class DashboardErrorBoundary extends Component<
  { children: React.ReactNode; onRetry: () => void },
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
          <Text style={styles.errorText}>
            Failed to load dashboard data. Pull to refresh.
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              this.setState({ message: null });
              this.props.onRetry();
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function DashboardScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();
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
    await signOut();
    router.replace("/login");
  }, [router, signOut]);

  const dash = data ?? undefined;
  const bottomPad = adminTabBarTotalInset(insets.bottom);

  return (
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
            tintColor={adminShell.chartLine}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitles}>
              <Text style={styles.heroTitle}>Admin Dashboard</Text>
              <Text style={styles.heroSubtitle}>Platform Overview &amp; Analytics</Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                onPress={onLogout}
                hitSlop={12}
                style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.75 }]}
                accessibilityLabel="Log out"
              >
                <MaterialIcons name="logout" size={22} color={adminShell.chartLine} />
              </Pressable>
              <View style={styles.heroIconBtn} pointerEvents="none">
                <MaterialIcons name="settings" size={22} color={adminShell.textMuted} />
              </View>
            </View>
          </View>
          {dash ? (
            <Text style={styles.updated}>Updated {formatUpdated(dash.fetchedAt)}</Text>
          ) : null}
        </View>

        <DashboardErrorBoundary
          key={boundaryNonce}
          onRetry={() => setBoundaryNonce((n) => n + 1)}
        >
          {!canQuery || dash === undefined ? (
            <SkeletonGrid />
          ) : (
            <>
              <View style={styles.grid}>
                <GlassStatCard
                  icon="people"
                  value={formatInt(dash.totalUsers)}
                  label="Total Users"
                  onPress={() => router.push("/(tabs)/users")}
                />
                <GlassStatCard
                  icon="business"
                  value={formatInt(dash.activeClubs)}
                  label="Active Clubs"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/users",
                      params: { role: "owner" },
                    } as never)
                  }
                />
                <GlassStatCard
                  icon="play-circle-filled"
                  value={formatInt(dash.activeSessions)}
                  label="Active Sessions"
                  valueColor={
                    dash.activeSessions > 0 ? adminShell.trendPositive : colors.text.primary
                  }
                  trailing={dash.activeSessions > 0 ? <LiveDot /> : null}
                />
                <GlassStatCard
                  icon="report-problem"
                  value={formatInt(dash.openComplaints)}
                  label="Open Complaints"
                  valueColor={
                    dash.openComplaints > 0 ? colors.status.error : colors.text.primary
                  }
                  onPress={() => router.push("/(tabs)/complaints")}
                />
                <GlassStatCard
                  icon="pending-actions"
                  value={formatInt(dash.pendingBookings)}
                  label="Pending Bookings"
                  valueColor={
                    dash.pendingBookings > 0 ? colors.accent.amberLight : colors.text.primary
                  }
                />
              </View>

              <View style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>Platform revenue (live)</Text>
                <Text style={styles.revenueValue}>₹{formatInt(dash.revenue.allTime)}</Text>
                <View style={styles.revenueRow}>
                  <MaterialIcons name="trending-up" size={16} color={adminShell.trendPositive} />
                  <Text style={styles.revenueTrend}>
                    Today ₹{formatInt(dash.revenue.today)} · Multi-currency totals not converted
                  </Text>
                </View>
                <DecorativeRevenueChart />
              </View>
            </>
          )}
        </DashboardErrorBoundary>
      </ScrollView>
    </SafeAreaView>
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
    valueColor = colors.text.primary,
    trailing,
    onPress,
  } = props;
  const Body = (
    <View style={styles.statCard}>
      <View style={styles.statIconTile}>
        <MaterialIcons name={icon} size={20} color={colors.text.secondary} />
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
        {trailing}
      </View>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
  /** Cell wrapper width must be on the outer node — % width inside a shrink-wrapped Pressable collapses on RN. */
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.statCellWrap,
          pressed && { opacity: 0.92 },
        ]}
      >
        {Body}
      </Pressable>
    );
  }
  return <View style={styles.statCellWrap}>{Body}</View>;
}

const GAP = 12;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: adminShell.bgScreen },
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
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: adminShell.cardBorder,
    backgroundColor: adminShell.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    borderRadius: adminShell.radiusHero,
    borderWidth: 1,
    borderColor: adminShell.cardBorder,
    backgroundColor: adminShell.cardBg,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[5],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 15,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    marginTop: spacing[2],
    fontSize: 14,
    lineHeight: 20,
    color: adminShell.textMuted,
  },
  updated: {
    marginTop: spacing[4],
    ...typography.caption,
    color: adminShell.textLabel,
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
    borderRadius: adminShell.radiusHero,
    borderWidth: 1,
    borderColor: adminShell.cardBorder,
    backgroundColor: adminShell.cardBg,
    padding: spacing[4],
    minHeight: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  statIconTile: {
    width: 40,
    height: 40,
    borderRadius: adminShell.radiusIcon,
    backgroundColor: adminShell.iconTileBg,
    borderWidth: 1,
    borderColor: adminShell.iconTileBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  valueRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[4] },
  statValue: { fontSize: 24, fontWeight: "600", letterSpacing: -0.5 },
  statLabel: {
    marginTop: spacing[2],
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.45,
    color: adminShell.textLabel,
  },
  skeletonCard: {
    width: "100%",
    minHeight: 140,
    borderRadius: adminShell.radiusHero,
    backgroundColor: adminShell.cardBg,
    borderWidth: 1,
    borderColor: adminShell.cardBorder,
  },
  revenueCard: {
    borderRadius: adminShell.radiusHero,
    borderWidth: 1,
    borderColor: adminShell.cardBorder,
    backgroundColor: adminShell.cardBg,
    padding: spacing[5],
    marginBottom: spacing[4],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 15,
    elevation: 8,
  },
  revenueLabel: {
    fontSize: 12,
    letterSpacing: 0.6,
    color: adminShell.textLabel,
    textTransform: "uppercase",
  },
  revenueValue: {
    marginTop: spacing[2],
    fontSize: 30,
    fontWeight: "600",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  revenueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
  },
  revenueTrend: {
    flex: 1,
    fontSize: 13,
    color: adminShell.textMuted,
    lineHeight: 18,
  },
  chartWrap: { marginTop: spacing[4] },
  chartHint: {
    marginTop: spacing[2],
    fontSize: 11,
    color: adminShell.textLabel,
    fontStyle: "italic",
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: adminShell.trendPositive,
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
