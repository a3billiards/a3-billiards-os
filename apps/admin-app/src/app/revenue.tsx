import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius, glass } from "@a3/ui/theme";
import { GlassPageBackground, LiquidGlassCard } from "@a3/ui/components";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import { addCalendarDaysYmd, dateYmdInTimeZone } from "@a3/utils/timezone";
import { TabErrorBoundary } from "@a3/ui/errors";

const PLATFORM_TIMEZONE = "Asia/Kolkata";

type RangeKey = "7" | "30" | "90";

type RevenueDay = { date: string; revenue: number; sessionCount: number };
type RevenueData = {
  days: RevenueDay[];
  totalRevenue: number;
  totalSessions: number;
  currency: string;
  timeZone: string;
};

function formatInt(n: number): string {
  return new Intl.NumberFormat(getCurrentLanguage(), {
    maximumFractionDigits: 0,
  }).format(n);
}

/** `YYYY-MM-DD` → localized "Wed, 8 Jul" (parsed at noon UTC to avoid TZ shift). */
function formatDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

function RevenueScreenContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>("7");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const user = useQuery(api.users.getCurrentUser, {});
  const canQuery = user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;

  const { dateFrom, dateTo } = useMemo(() => {
    void refreshNonce;
    const today = dateYmdInTimeZone(Date.now(), PLATFORM_TIMEZONE);
    const from = addCalendarDaysYmd(today, -(Number(range) - 1), PLATFORM_TIMEZONE);
    return { dateFrom: from, dateTo: today };
  }, [range, refreshNonce]);

  const data = useQuery(
    api.admin.getAdminPlatformRevenueByDay,
    canQuery ? { dateFrom, dateTo } : "skip",
  ) as RevenueData | undefined;

  const onRefresh = () => {
    setRefreshing(true);
    setRefreshNonce((n) => n + 1);
    setTimeout(() => setRefreshing(false), 400);
  };

  // Newest day first for the list.
  const orderedDays = useMemo(
    () => (data ? [...data.days].reverse() : []),
    [data],
  );
  const maxRevenue = useMemo(
    () => orderedDays.reduce((m, d) => Math.max(m, d.revenue), 0),
    [orderedDays],
  );

  const rangeLabel = t("adminApp.revenue.rangeSummary", {
    from: formatDayLabel(dateFrom),
    to: formatDayLabel(dateTo),
  });

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t("adminApp.revenue.back")}
          >
            <MaterialIcons name="arrow-back" size={22} color={glass.textPrimary} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>{t("adminApp.revenue.title")}</Text>
            <Text style={styles.subtitle}>{t("adminApp.revenue.subtitle")}</Text>
          </View>
        </View>

        <View style={styles.rangeRow}>
          {(["7", "30", "90"] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  range === r && styles.rangeChipTextActive,
                ]}
              >
                {t("adminApp.revenue.rangeDays", { count: Number(r) })}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing[8] },
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
          {!canQuery || data === undefined ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={glass.chartLine} />
            </View>
          ) : (
            <>
              <LiquidGlassCard style={styles.summaryCard} padding={24}>
                <Text style={styles.summaryLabel}>
                  {t("adminApp.revenue.totalRevenue")}
                </Text>
                <Text style={styles.summaryValue}>
                  ₹{formatInt(data.totalRevenue)}
                </Text>
                <Text style={styles.summaryMeta}>
                  {t("adminApp.revenue.sessionsInRange", {
                    count: data.totalSessions,
                  })}
                </Text>
                <Text style={styles.summaryRange}>{rangeLabel}</Text>
              </LiquidGlassCard>

              {data.totalSessions === 0 ? (
                <Text style={styles.emptyNote}>
                  {t("adminApp.revenue.noRevenue")}
                </Text>
              ) : null}

              <View style={styles.listCard}>
                {orderedDays.map((d, idx) => (
                  <View
                    key={d.date}
                    style={[
                      styles.dayRow,
                      idx < orderedDays.length - 1 && styles.dayRowDivider,
                    ]}
                  >
                    <View style={styles.dayLeft}>
                      <Text style={styles.dayDate}>{formatDayLabel(d.date)}</Text>
                      <Text style={styles.daySessions}>
                        {t("adminApp.revenue.sessionsCount", {
                          count: d.sessionCount,
                        })}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${
                                maxRevenue > 0
                                  ? Math.max(2, (d.revenue / maxRevenue) * 100)
                                  : 0
                              }%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.dayRevenue}>₹{formatInt(d.revenue)}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.tzNote}>
                {t("adminApp.revenue.timezoneNote")}
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: "600", color: glass.textPrimary, letterSpacing: -0.3 },
  subtitle: { marginTop: 2, fontSize: 13, color: glass.textMuted },
  rangeRow: {
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing[3],
  },
  rangeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeChipActive: {
    borderColor: glass.inputBorderFocus,
    backgroundColor: "rgba(56, 189, 248, 0.22)",
  },
  rangeChipText: { fontSize: 13, fontWeight: "600", color: glass.textMuted },
  rangeChipTextActive: { color: glass.textPrimary },
  scroll: { paddingHorizontal: layout.screenPadding },
  loading: { paddingTop: spacing[10], alignItems: "center" },
  summaryCard: { marginBottom: spacing[4] },
  summaryLabel: {
    fontSize: 13,
    letterSpacing: 0.7,
    color: glass.textLabel,
    textTransform: "uppercase",
  },
  summaryValue: {
    marginTop: spacing[2],
    fontSize: 32,
    fontWeight: "600",
    color: glass.textPrimary,
    letterSpacing: -0.5,
  },
  summaryMeta: { marginTop: spacing[2], fontSize: 14, color: glass.trendPositive, fontWeight: "600" },
  summaryRange: { marginTop: spacing[1], fontSize: 12, color: glass.textMuted },
  emptyNote: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[3],
    textAlign: "center",
  },
  listCard: {
    borderRadius: glass.cardRadius,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
    paddingHorizontal: spacing[4],
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  dayRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.cardBorder,
  },
  dayLeft: { flex: 1, minWidth: 0, gap: 4 },
  dayDate: { fontSize: 15, fontWeight: "600", color: glass.textPrimary },
  daySessions: { fontSize: 12, color: glass.textMuted },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: glass.inputBg,
    overflow: "hidden",
    marginTop: 2,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: glass.trendPositive,
  },
  dayRevenue: { fontSize: 16, fontWeight: "700", color: glass.textPrimary },
  tzNote: {
    ...typography.caption,
    color: glass.textLabel,
    textAlign: "center",
    marginTop: spacing[4],
  },
});

export default function AdminRevenueScreen(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("adminApp.revenue.title")}>
      <RevenueScreenContent />
    </TabErrorBoundary>
  );
}
