import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { formatCurrency } from "@a3/utils/billing";
import { getActiveRoleId } from "../../lib/activeRoleStorage";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>{todayLabel}</Text>

        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statHero]}>
            <Text style={styles.statLabel}>Today's revenue</Text>
            <Text style={styles.statHeroValue}>
              {stats === undefined
                ? "—"
                : formatCurrency(stats.todayRevenue, stats.currency)}
            </Text>
            <Text style={styles.statSub}>
              {stats === undefined
                ? "Loading…"
                : `${stats.completedToday} session${stats.completedToday === 1 ? "" : "s"} completed`}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <MaterialIcons
              name="play-circle-outline"
              size={22}
              color={colors.accent.green}
            />
            <Text style={styles.statValue}>
              {stats === undefined ? "—" : stats.activeSessions}
            </Text>
            <Text style={styles.statLabel}>Active sessions</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons
              name="view-module"
              size={22}
              color={colors.status.info}
            />
            <Text style={styles.statValue}>
              {stats === undefined ? "—" : stats.activeTables}
            </Text>
            <Text style={styles.statLabel}>Active tables</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons
              name="check-circle-outline"
              size={22}
              color={colors.accent.amberLight}
            />
            <Text style={styles.statValue}>
              {stats === undefined ? "—" : stats.completedToday}
            </Text>
            <Text style={styles.statLabel}>Completed today</Text>
          </View>
        </View>

        {showSummary ? (
          <>
            <Text style={styles.sectionTitle}>Bookings today</Text>
            <View style={styles.statRow}>
              <Pressable
                onPress={() => router.push("/(tabs)/bookings?segment=pending")}
                style={({ pressed }) => [
                  styles.summaryCard,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.summaryValue}>{summary.pending}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/bookings?segment=upcoming")}
                style={({ pressed }) => [
                  styles.summaryCard,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.summaryValue}>{summary.confirmedToday}</Text>
                <Text style={styles.summaryLabel}>Confirmed</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/bookings?segment=history")}
                style={({ pressed }) => [
                  styles.summaryCard,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.summaryValue}>{summary.completedToday}</Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </Pressable>
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
        <View style={styles.tilesGrid}>
          {QUICK_TILES.map((t) => (
            <Pressable
              key={t.href}
              onPress={() => router.push(t.href)}
              style={({ pressed }) => [
                styles.tile,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${t.label}`}
            >
              <View style={[styles.tileIconWrap, { borderColor: t.tint }]}>
                <MaterialIcons name={t.icon} size={26} color={t.tint} />
              </View>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[6],
    paddingBottom: spacing[10],
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
  },
  centerText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[1],
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    alignItems: "flex-start",
    gap: spacing[1],
  },
  statHero: {
    paddingVertical: spacing[5],
    backgroundColor: "rgba(67,160,71,0.08)",
    borderColor: colors.accent.green,
  },
  statHeroValue: {
    ...typography.heading2,
    color: colors.accent.green,
    fontWeight: "700",
  },
  statValue: {
    ...typography.heading3,
    color: colors.text.primary,
    fontWeight: "700",
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  statSub: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: "center",
    minHeight: layout.touchTarget,
  },
  summaryValue: {
    ...typography.heading4,
    color: colors.accent.green,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[1],
  },
  bookingsDisabled: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[3],
    marginTop: spacing[3],
  },
  bookingsDisabledText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  tile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: 72,
  },
  tileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    ...typography.label,
    color: colors.text.primary,
  },
  pressed: { opacity: 0.85 },
});
