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
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { formatCurrency } from "@a3/utils/billing";
import { getActiveRoleId } from "../../lib/activeRoleStorage";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { ownerShell, ownerTabBarTotalInset } from "../../theme/ownerShell";

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
  { href: "/(tabs)/slots", label: "Slots", icon: "view-module", tint: colors.accent.green },
  { href: "/(tabs)/bookings", label: "Bookings", icon: "event", tint: colors.status.info },
  { href: "/(tabs)/snacks", label: "Snacks", icon: "fastfood", tint: colors.accent.amber },
  { href: "/(tabs)/financials", label: "Financials", icon: "attach-money", tint: colors.accent.amberLight },
  { href: "/(tabs)/complaints", label: "Complaints", icon: "report-problem", tint: colors.status.error },
  { href: "/(tabs)/settings", label: "Settings", icon: "settings", tint: colors.text.secondary },
];

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  const summary = dashboard.bookingSummary;
  const showSummary = dashboard.bookingSettingsEnabled;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: spacing[2], paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Owner Dashboard</Text>
          <Text style={styles.heroSubtitle}>{todayLabel}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.statCellWrapFull}>
            <View style={styles.statCard}>
              <View style={styles.valueRow}>
                <Text style={styles.statHeroValue}>
                  {stats === undefined
                    ? "—"
                    : formatCurrency(stats.todayRevenue, stats.currency)}
                </Text>
              </View>
              <Text style={styles.statLabel}>TODAY'S REVENUE</Text>
              <Text style={styles.statSub}>
                {stats === undefined
                  ? "Loading…"
                  : `${stats.completedToday} session${stats.completedToday === 1 ? "" : "s"} completed`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.statCellWrap}>
            <View style={styles.statCard}>
              <View style={styles.statIconTile}>
                <MaterialIcons
                  name="play-circle-outline"
                  size={20}
                  color={ownerShell.trendPositive}
                />
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.statValue}>
                  {stats === undefined ? "—" : stats.activeSessions}
                </Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={2}>ACTIVE SESSIONS</Text>
            </View>
          </View>
          <View style={styles.statCellWrap}>
            <View style={styles.statCard}>
              <View style={styles.statIconTile}>
                <MaterialIcons
                  name="view-module"
                  size={20}
                  color={colors.status.info}
                />
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.statValue}>
                  {stats === undefined ? "—" : stats.activeTables}
                </Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={2}>ACTIVE TABLES</Text>
            </View>
          </View>
        </View>

        {showSummary ? (
          <>
            <Text style={styles.sectionTitle}>Bookings today</Text>
            <View style={styles.grid}>
              <View style={styles.statCellWrapThird}>
                <Pressable
                  onPress={() => router.push("/(tabs)/bookings?segment=pending")}
                  style={({ pressed }) => [
                    styles.summaryCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.summaryValue}>{summary.pending}</Text>
                  <Text style={styles.summaryLabel} numberOfLines={1}>PENDING</Text>
                </Pressable>
              </View>
              <View style={styles.statCellWrapThird}>
                <Pressable
                  onPress={() => router.push("/(tabs)/bookings?segment=upcoming")}
                  style={({ pressed }) => [
                    styles.summaryCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.summaryValue}>{summary.confirmedToday}</Text>
                  <Text style={styles.summaryLabel} numberOfLines={1}>CONFIRMED</Text>
                </Pressable>
              </View>
              <View style={styles.statCellWrapThird}>
                <Pressable
                  onPress={() => router.push("/(tabs)/bookings?segment=history")}
                  style={({ pressed }) => [
                    styles.summaryCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.summaryValue}>{summary.completedToday}</Text>
                  <Text style={styles.summaryLabel} numberOfLines={1}>COMPLETED</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.bookingsDisabled}>
            <MaterialIcons name="event-busy" size={20} color={colors.text.secondary} />
            <Text style={styles.bookingsDisabledText}>
              Online booking is disabled. Enable it in Settings to track booking
              activity here.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick access</Text>
        <View style={styles.grid}>
          {QUICK_TILES.map((t) => (
            <View key={t.href} style={styles.statCellWrap}>
              <Pressable
                onPress={() => router.push(t.href)}
                style={({ pressed }) => [
                  styles.tileCard,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${t.label}`}
              >
                <View style={styles.statIconTile}>
                  <MaterialIcons name={t.icon} size={20} color={t.tint} />
                </View>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const GAP = 12;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ownerShell.bgScreen,
  },
  scroll: {
    paddingHorizontal: layout.screenPadding,
  },
  center: {
    flex: 1,
    backgroundColor: ownerShell.bgScreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
  },
  centerText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  heroCard: {
    borderRadius: ownerShell.radiusHero,
    borderWidth: 1,
    borderColor: ownerShell.cardBorder,
    backgroundColor: ownerShell.cardBg,
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
    color: ownerShell.textMuted,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.6,
    color: ownerShell.textLabel,
    textTransform: "uppercase",
    marginTop: spacing[3],
    marginBottom: spacing[3],
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  statCellWrapFull: {
    width: "100%",
    marginBottom: GAP,
  },
  statCellWrap: {
    width: "48%",
    marginBottom: GAP,
  },
  statCellWrapThird: {
    width: "31%",
    marginBottom: GAP,
  },
  statCard: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: ownerShell.radiusHero,
    borderWidth: 1,
    borderColor: ownerShell.cardBorder,
    backgroundColor: ownerShell.cardBg,
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
    borderRadius: ownerShell.radiusIcon,
    backgroundColor: ownerShell.iconTileBg,
    borderWidth: 1,
    borderColor: ownerShell.iconTileBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  valueRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: spacing[2], 
    marginTop: spacing[4] 
  },
  statHeroValue: {
    fontSize: 30,
    fontWeight: "600",
    color: ownerShell.trendPositive,
    letterSpacing: -0.5,
  },
  statValue: {
    fontSize: 24, 
    fontWeight: "600", 
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: spacing[2],
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.45,
    color: ownerShell.textLabel,
  },
  statSub: {
    ...typography.bodySmall,
    color: ownerShell.textMuted,
    marginTop: spacing[1],
  },
  summaryCard: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: ownerShell.radiusIcon,
    borderWidth: 1,
    borderColor: ownerShell.cardBorder,
    backgroundColor: ownerShell.cardBg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: "center",
    minHeight: layout.touchTarget,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "600",
    color: ownerShell.trendPositive,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.45,
    color: ownerShell.textLabel,
    textAlign: "center",
    marginTop: spacing[1],
  },
  bookingsDisabled: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: ownerShell.cardBg,
    borderRadius: ownerShell.radiusHero,
    borderWidth: 1,
    borderColor: ownerShell.cardBorder,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  bookingsDisabledText: {
    ...typography.bodySmall,
    color: ownerShell.textMuted,
    flex: 1,
  },
  tileCard: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: ownerShell.radiusHero,
    borderWidth: 1,
    borderColor: ownerShell.cardBorder,
    backgroundColor: ownerShell.cardBg,
    padding: spacing[4],
    minHeight: 110,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: spacing[3],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },
  pressed: { opacity: 0.85 },
});
