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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function formatUpdated(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
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
        <ShimmerBox key={i} style={styles.skeletonCard} />
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>A3 Billiards OS</Text>
          <Text style={styles.subtitle}>Platform Overview</Text>
          {dash ? (
            <Text style={styles.updated}>Updated {formatUpdated(dash.fetchedAt)}</Text>
          ) : null}
        </View>
        <Pressable onPress={onLogout} hitSlop={12} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <DashboardErrorBoundary
        key={boundaryNonce}
        onRetry={() => setBoundaryNonce((n) => n + 1)}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.green}
            />
          }
        >
          {!canQuery || dash === undefined ? (
            <SkeletonGrid />
          ) : (
            <View style={styles.grid}>
              <MetricCard
                icon="people"
                value={formatInt(dash.totalUsers)}
                label="Registered Users"
                onPress={() => router.push("/(tabs)/users")}
              />
              <MetricCard
                icon="business"
                value={formatInt(dash.activeClubs)}
                label="Active Clubs"
                sublabel="Active + Grace period"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/users",
                    params: { role: "owner" },
                  } as never)
                }
              />
              <MetricCard
                icon="play-circle-filled"
                value={formatInt(dash.activeSessions)}
                label="Active Sessions"
                valueColor={
                  dash.activeSessions > 0 ? colors.accent.green : colors.text.primary
                }
                trailing={dash.activeSessions > 0 ? <LiveDot /> : null}
              />
              <MetricCard
                icon="pending-actions"
                value={formatInt(dash.pendingBookings)}
                label="Pending Bookings"
                valueColor={
                  dash.pendingBookings > 0 ? colors.accent.amber : colors.text.primary
                }
                sublabel="Awaiting owner approval"
              />
              <MetricCard
                icon="report-problem"
                value={formatInt(dash.openComplaints)}
                label="Open Complaints"
                valueColor={
                  dash.openComplaints > 0 ? colors.status.error : colors.text.primary
                }
                onPress={() => router.push("/(tabs)/complaints")}
              />
              <MetricCard
                icon="trending-up"
                value={formatInt(dash.revenue.today)}
                label="Today's Revenue"
                sublabel={`All-time: ${formatInt(dash.revenue.allTime)}`}
                footnote="Multi-currency totals not converted"
              />
            </View>
          )}
        </ScrollView>
      </DashboardErrorBoundary>
    </SafeAreaView>
  );
}

function MetricCard(props: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  label: string;
  sublabel?: string;
  footnote?: string;
  valueColor?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}): React.JSX.Element {
  const {
    icon,
    value,
    label,
    sublabel,
    footnote,
    valueColor = colors.text.primary,
    trailing,
    onPress,
  } = props;
  const Body = (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <MaterialIcons name={icon} size={22} color={colors.text.secondary} />
        </View>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
          {trailing}
        </View>
        <Text style={styles.cardLabel}>{label}</Text>
        {sublabel ? <Text style={styles.cardSublabel}>{sublabel}</Text> : null}
        {footnote ? <Text style={styles.cardFoot}>{footnote}</Text> : null}
      </View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => [pressed && styles.cardPressed]}
      >
        {Body}
      </Pressable>
    );
  }
  return Body;
}

const CARD_GAP = spacing[3];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  headerLeft: { flex: 1, paddingRight: spacing[3] },
  brand: { ...typography.heading3, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 2 },
  updated: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[2] },
  logoutBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[2] },
  logoutText: { ...typography.label, color: colors.accent.green },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[10],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  skeletonCard: {
    width: "48%",
    aspectRatio: 1.15,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    marginBottom: CARD_GAP,
  },
  card: {
    width: "48%",
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing[4],
    minHeight: 132,
    marginBottom: CARD_GAP,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: { gap: spacing[2] },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  valueRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  value: { ...typography.heading2, fontSize: 26, fontWeight: "700" },
  cardLabel: { ...typography.caption, color: colors.text.secondary, textTransform: "none" },
  cardSublabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: -spacing[1],
  },
  cardFoot: {
    ...typography.caption,
    fontStyle: "italic",
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.emerald,
  },
  errorBanner: {
    marginHorizontal: layout.screenPadding,
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
