import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import {
  addCalendarDaysYmd,
  timeZoneAbbreviation,
  normalizeIanaTimeZone,
} from "@a3/utils/timezone";
import { formatCurrency } from "@a3/utils/billing";
import { useStaffRole, staffRoleQueryId, useStaffTabQueriesEnabled } from "../lib/StaffRoleContext";
import { TabAccessDenied } from "../components/TabAccessDenied";
import { OwnerNoClubPlaceholder } from "../components/OwnerNoClubPlaceholder";
import { SafeBarChart } from "../components/SafeBarChart";
import { FinancialDateRangeBar } from "../components/FinancialDateRangeBar";
import { countDaysInclusive } from "../lib/financialDateRange";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownerTabBarTotalInset } from "../theme/ownerShell";

const WEEK_DAY_SHORT_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type SortKey = "date" | "amount";

type CreditRow = {
  sessionId: Id<"sessions">;
  customerName: string;
  isGuest: boolean;
  tableLabel: string;
  endTime: number;
  billTotal: number;
  currency: string;
  snackOrders: {
    snackId: Id<"snacks">;
    name: string;
    qty: number;
    priceAtOrder: number;
  }[];
  discount: number | null;
  billableMinutes: number | null;
  ratePerMin: number;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return formatCurrency(amount, currency);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatBarAxisLabel(
  ymd: string,
  dayIndex: number,
  totalDays: number,
): string {
  const locale = getCurrentLanguage();
  const d = new Date(ymd + "T12:00:00Z");
  if (totalDays <= 14) {
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  }
  if (totalDays <= 30) {
    if (dayIndex % 3 !== 0) return "";
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  }
  if (dayIndex % 7 !== 0) return "";
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function formatEndDateLabel(endTime: number, tz: string): string {
  const locale = getCurrentLanguage();
  const timeZone = normalizeIanaTimeZone(tz);
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(endTime));
  } catch {
    return new Date(endTime).toLocaleDateString(locale);
  }
}

function FinancialsContent(): React.JSX.Element {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const clubTimezone = normalizeIanaTimeZone(dashboard?.timezone);
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);

  const { roleId, canAccessTab } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const financialsEnabled = useStaffTabQueriesEnabled("financials");

  const access = useQuery(
    api.financials.getFinancialTabAccess,
    clubId && financialsEnabled ? { clubId, roleId: queryRoleId } : "skip",
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [expandedId, setExpandedId] = useState<Id<"sessions"> | null>(null);
  const [paySheet, setPaySheet] = useState<CreditRow | null>(null);
  const datesInit = useRef(false);

  useEffect(() => {
    if (!dashboard?.todayYmd || datesInit.current) return;
    datesInit.current = true;
    const to = dashboard.todayYmd;
    const from = addCalendarDaysYmd(to, -29, clubTimezone);
    setDateFrom(from);
    setDateTo(to);
  }, [dashboard?.todayYmd, clubTimezone]);

  const rangeInvalid =
    Boolean(dateFrom && dateTo && dateFrom.localeCompare(dateTo) > 0);
  const rangeDays =
    dateFrom && dateTo && !rangeInvalid
      ? countDaysInclusive(dateFrom, dateTo, clubTimezone)
      : 0;
  const largeRange = rangeDays > 90;

  const revenueArgs =
    clubId && dateFrom && dateTo && !rangeInvalid && financialsEnabled
      ? { clubId, dateFrom, dateTo, roleId: queryRoleId }
      : "skip";
  const revenue = useQuery(api.financials.getRevenueByDay, revenueArgs);

  const breakdownArgs =
    clubId && dateFrom && dateTo && !rangeInvalid && financialsEnabled
      ? { clubId, dateFrom, dateTo, roleId: queryRoleId }
      : "skip";
  const breakdown = useQuery(
    api.financials.getPaymentMethodBreakdown,
    breakdownArgs,
  );

  const creditsArgs =
    clubId && financialsEnabled ? { clubId, sortBy, roleId: queryRoleId } : "skip";
  const credits = useQuery(api.financials.getOutstandingCredits, creditsArgs);

  const analyticsArgs =
    clubId && dateFrom && dateTo && !rangeInvalid && financialsEnabled
      ? { clubId, dateFrom, dateTo, roleId: queryRoleId }
      : "skip";
  const bestTables = useQuery(
    api.financials.getBestPerformingTables,
    analyticsArgs === "skip" ? "skip" : { ...analyticsArgs, limit: 5 },
  );
  const snackSales = useQuery(
    api.financials.getSnackSalesBreakdown,
    analyticsArgs === "skip" ? "skip" : { ...analyticsArgs, limit: 8 },
  );
  const heatmap = useQuery(api.financials.getPeakHourHeatmap, analyticsArgs);

  const resolveCredit = useMutation(api.financials.resolveCredit);

  const chartWidth = Dimensions.get("window").width - spacing[6] * 2;

  const barData = useMemo(() => {
    if (!revenue?.days) return [];
    return revenue.days.map((d, i) => ({
      value: Math.max(0, d.revenue),
      label: formatBarAxisLabel(d.date, i, revenue.days.length),
      frontColor: d.revenue > 0 ? colors.accent.green : colors.bg.tertiary,
      sessionCount: d.sessionCount,
      date: d.date,
    }));
  }, [revenue?.days]);

  const maxBar = useMemo(() => {
    const m = Math.max(1, ...barData.map((b) => b.value));
    return m * 1.1;
  }, [barData]);

  const tzAbbr = timeZoneAbbreviation(clubTimezone, Date.now());

  const canResolve = access?.canResolveCredits === true;

  const onResolve = useCallback(
    async (row: CreditRow, method: "cash" | "upi" | "card") => {
      const methodLabel =
        method === "cash"
          ? t("ownerApp.financials.cash")
          : method === "upi"
            ? t("ownerApp.financials.upi")
            : t("ownerApp.financials.card");
      Alert.alert(
        t("ownerApp.financials.confirm"),
        `${t("ownerApp.financials.confirmPayment", { name: row.customerName })} ${formatMoney(row.billTotal, row.currency)} (${methodLabel})`,
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("ownerApp.financials.confirm"),
            onPress: async () => {
              try {
                await resolveCredit({
                  sessionId: row.sessionId,
                  resolvedMethod: method,
                  roleId: queryRoleId,
                });
                setPaySheet(null);
                Alert.alert(t("common.done"), row.customerName);
              } catch (e) {
                const msg = parseConvexError(e as Error).message;
                if (msg.toLowerCase().includes("permission")) {
                  Alert.alert(t("ownerApp.financials.error"), t("ownerApp.financials.permissionDenied"));
                } else {
                  Alert.alert(t("ownerApp.financials.error"), msg);
                }
              }
            },
          },
        ],
      );
    },
    [resolveCredit, queryRoleId, t],
  );

  if (dashboard === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (dashboard === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <OwnerNoClubPlaceholder />
      </SafeAreaView>
    );
  }

  if (roleId !== undefined && !canAccessTab("financials")) {
    return <TabAccessDenied tabLabel={t("common.tabs.owner.financials")} />;
  }

  if (access === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (!clubId || access.canViewFinancials === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
          style={styles.backRow}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
          <Text style={styles.backText}>{t("ownerApp.financials.back")}</Text>
        </Pressable>
        <View style={styles.deniedBox}>
          <MaterialIcons name="lock" size={48} color={colors.text.secondary} />
          <Text style={styles.deniedTitle}>{t("ownerApp.financials.noPermission")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayCurrency = revenue?.currency ?? dashboard.currency ?? "INR";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("ownerApp.financials.title")}</Text>
        <Text style={styles.sub}>{t("ownerApp.financials.subtitle")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <FinancialDateRangeBar
          clubTimezone={clubTimezone}
          todayYmd={dashboard.todayYmd}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          tzAbbr={tzAbbr}
        />

        <Pressable
          style={styles.gstLink}
          onPress={() => router.push("/(tabs)/gst-report")}
          accessibilityRole="button"
          accessibilityLabel={t("ownerApp.financials.gstReport")}
        >
          <View style={styles.gstLinkIcon}>
            <MaterialIcons name="receipt-long" size={22} color={colors.accent.green} />
          </View>
          <View style={styles.gstLinkText}>
            <Text style={styles.gstLinkTitle}>{t("ownerApp.financials.gstReport")}</Text>
            <Text style={styles.gstLinkSub}>{t("ownerApp.financials.gstReportSub")}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.text.secondary} />
        </Pressable>

        <Text style={styles.sectionTitle}>{t("ownerApp.financials.revenue")}</Text>
        {revenue === undefined ? (
          <View style={styles.skelChart}>
            {[40, 70, 35, 55, 80, 45, 60].map((h, i) => (
              <View key={i} style={[styles.skelBar, { height: h }]} />
            ))}
          </View>
        ) : (
          <>
            <View style={styles.chartWrap}>
              {largeRange ? (
                <ActivityIndicator
                  color={colors.accent.green}
                  style={styles.chartOverlay}
                />
              ) : null}
              <SafeBarChart
                emptyMessage={t("ownerApp.financials.noRevenue")}
                parentWidth={chartWidth}
                data={barData}
                maxValue={maxBar}
                noOfSections={4}
                barWidth={Math.max(
                  8,
                  Math.min(22, chartWidth / Math.max(barData.length + 4, 8)),
                )}
                spacing={4}
                initialSpacing={6}
                yAxisTextStyle={styles.axisTxt}
                xAxisLabelTextStyle={styles.axisTxt}
                xAxisThickness={1}
                yAxisThickness={1}
                yAxisColor={colors.border.subtle}
                xAxisColor={colors.border.subtle}
                rulesColor={colors.border.subtle}
                rulesType="solid"
                yAxisLabelWidth={44}
                hideRules={false}
                showFractionalValues={false}
                renderTooltip={(items: readonly { index?: number }[]) => {
                  const it = items?.[0];
                  if (!it) return null;
                  const idx = typeof it.index === "number" ? it.index : 0;
                  const src = revenue.days[idx];
                  if (!src) return null;
                  return (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipTxt}>
                        {src.date}: {formatMoney(src.revenue, revenue.currency)} •{" "}
                        {t("ownerApp.financials.sessions", { count: src.sessionCount })}
                      </Text>
                    </View>
                  );
                }}
                pointerConfig={{
                  activatePointersOnLongPress: false,
                  pointerStripColor: colors.border.default,
                  pointerStripWidth: 1,
                }}
              />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.totalMain}>
                {t("ownerApp.financials.total", {
                  amount: formatMoney(revenue.totalRevenue, revenue.currency),
                })}
              </Text>
              <Text style={styles.totalSub}>
                {t("ownerApp.financials.sessions", { count: revenue.totalSessions })}
              </Text>
            </View>
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing[8] }]}>
          {t("ownerApp.financials.paymentMethods")}
        </Text>
        {breakdown === undefined ? (
          <View style={styles.grid4}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skelCard} />
            ))}
          </View>
        ) : (
          <>
            <View style={styles.grid4}>
              {breakdown.breakdown.map((b) => {
                const cfg =
                  b.method === "cash"
                    ? { icon: "payments" as const, color: colors.accent.green }
                    : b.method === "upi"
                      ? { icon: "smartphone" as const, color: colors.status.info }
                      : b.method === "card"
                        ? { icon: "credit-card" as const, color: colors.accent.amber }
                        : { icon: "sync" as const, color: colors.status.disabled };
                const label =
                  b.method === "cash"
                    ? t("ownerApp.financials.cash")
                    : b.method === "upi"
                      ? t("ownerApp.financials.upi")
                      : b.method === "card"
                        ? t("ownerApp.financials.card")
                        : t("ownerApp.financials.creditResolved");
                return (
                  <View key={b.method} style={styles.methodCard}>
                    <MaterialIcons name={cfg.icon} size={22} color={cfg.color} />
                    <Text style={styles.methodLbl}>{label}</Text>
                    <Text style={styles.methodAmt}>
                      {b.method === "credit"
                        ? t("ownerApp.financials.session_one", { count: b.sessionCount })
                        : formatMoney(b.totalAmount, displayCurrency)}
                    </Text>
                    <Text style={styles.methodSub}>
                      {b.method === "credit"
                        ? t("ownerApp.financials.allocatedAbove")
                        : t("ownerApp.financials.sessions", { count: b.sessionCount })}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.breakdownNote}>{t("ownerApp.financials.creditNote")}</Text>
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing[8] }]}>
          {t("ownerApp.financials.bestTables")}
        </Text>
        {bestTables === undefined ? (
          <View style={{ gap: spacing[2] }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skelRow} />
            ))}
          </View>
        ) : bestTables.tables.length === 0 ? (
          <View style={styles.emptyAnalytics}>
            <MaterialIcons
              name="bar-chart"
              size={32}
              color={colors.text.secondary}
            />
            <Text style={styles.emptyAnalyticsTxt}>{t("ownerApp.financials.noData")}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
            {bestTables.tables.map((row, idx) => {
              const top = bestTables.tables[0]!;
              const pct =
                top.revenue > 0
                  ? Math.max(0.04, row.revenue / top.revenue)
                  : 0;
              return (
                <View key={row.tableId} style={styles.tableRow}>
                  <View style={styles.tableRowHead}>
                    <Text style={styles.tableRank}>#{idx + 1}</Text>
                    <Text style={styles.tableLbl} numberOfLines={1}>
                      {row.tableLabel}
                    </Text>
                    <Text style={styles.tableAmt}>
                      {formatMoney(row.revenue, bestTables.currency)}
                    </Text>
                  </View>
                  <View style={styles.tableBarTrack}>
                    <View
                      style={[
                        styles.tableBarFill,
                        { width: `${Math.round(pct * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.tableSub}>
                    {t("ownerApp.financials.sessions", { count: row.sessionCount })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t("ownerApp.financials.snackRevenue")}</Text>
        {snackSales === undefined ? (
          <View style={{ gap: spacing[2] }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skelRow} />
            ))}
          </View>
        ) : snackSales.snacks.length === 0 ? (
          <View style={styles.emptyAnalytics}>
            <MaterialIcons
              name="fastfood"
              size={32}
              color={colors.text.secondary}
            />
            <Text style={styles.emptyAnalyticsTxt}>{t("ownerApp.financials.noData")}</Text>
          </View>
        ) : (
          <View style={{ marginBottom: spacing[6] }}>
            <Text style={styles.snackTotalLine}>
              {t("ownerApp.financials.total", {
                amount: formatMoney(snackSales.totalRevenue, snackSales.currency),
              })}{" "}
              · {t("ownerApp.financials.sessions", { count: snackSales.totalUnits })}
            </Text>
            <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
              {snackSales.snacks.map((row) => {
                const top = snackSales.snacks[0]!;
                const pct =
                  top.revenue > 0
                    ? Math.max(0.04, row.revenue / top.revenue)
                    : 0;
                return (
                  <View key={row.snackId} style={styles.tableRow}>
                    <View style={styles.tableRowHead}>
                      <Text style={styles.tableLbl} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text style={styles.tableAmt}>
                        {formatMoney(row.revenue, snackSales.currency)}
                      </Text>
                    </View>
                    <View style={styles.tableBarTrack}>
                      <View
                        style={[
                          styles.tableBarFill,
                          {
                            width: `${Math.round(pct * 100)}%`,
                            backgroundColor: colors.accent.amber,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.tableSub}>{row.units} sold</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t("ownerApp.financials.peakHours")}</Text>
        {heatmap === undefined ? (
          <View style={[styles.heatmapSkel]} />
        ) : heatmap.totalSessions === 0 ? (
          <View style={styles.emptyAnalytics}>
            <MaterialIcons
              name="schedule"
              size={32}
              color={colors.text.secondary}
            />
            <Text style={styles.emptyAnalyticsTxt}>{t("ownerApp.financials.noData")}</Text>
          </View>
        ) : (
          <View style={{ marginBottom: spacing[6] }}>
            <View style={styles.heatmapHeader}>
              <View style={styles.heatmapDayCol} />
              {[0, 6, 12, 18, 23].map((h) => (
                <Text
                  key={h}
                  style={[
                    styles.heatmapAxis,
                    {
                      position: "absolute",
                      left: `${(h / 23) * 100}%`,
                      transform: [{ translateX: -8 }],
                    },
                  ]}
                >
                  {h}
                </Text>
              ))}
            </View>
            {WEEK_DAY_SHORT_KEYS.map((dayKey, dow) => {
                const label = t(`common.weekDaysShort.${dayKey}`);
                const dayCells = heatmap.cells.filter(
                  (c) => c.dayOfWeek === dow,
                );
                return (
                  <View key={label} style={styles.heatmapRow}>
                    <Text style={styles.heatmapDayLbl}>{label}</Text>
                    <View style={styles.heatmapCells}>
                      {dayCells.map((c) => {
                        const intensity =
                          heatmap.maxCellSessions > 0
                            ? c.sessions / heatmap.maxCellSessions
                            : 0;
                        const bg =
                          c.sessions === 0
                            ? colors.bg.tertiary
                            : `rgba(67,160,71,${0.15 + intensity * 0.85})`;
                        return (
                          <View
                            key={c.hour}
                            style={[
                              styles.heatmapCell,
                              { backgroundColor: bg },
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            <Text style={styles.heatmapNote}>
              {heatmap.peak
                ? t("ownerApp.financials.busiest", {
                    day: t(
                      `common.weekDaysShort.${WEEK_DAY_SHORT_KEYS[heatmap.peak.dayOfWeek] ?? "sun"}`,
                    ),
                    hour: heatmap.peak.hour,
                    count: heatmap.peak.sessions,
                  })
                : t("ownerApp.financials.noData")}
            </Text>
          </View>
        )}

        <View style={styles.creditHeader}>
          <View style={styles.creditTitleRow}>
            <Text style={styles.sectionTitle}>{t("ownerApp.financials.outstandingCredits")}</Text>
            {credits && credits.count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{credits.count}</Text>
              </View>
            ) : null}
          </View>
          {credits ? (
            <Text style={styles.creditTotal}>
              {t("ownerApp.financials.total", {
                amount: formatMoney(credits.totalOutstanding, displayCurrency),
              })}
            </Text>
          ) : null}
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.sortLbl}>{t("ownerApp.financials.sortBy")}</Text>
          <Pressable
            onPress={() => setSortBy("date")}
            style={[styles.sortChip, sortBy === "date" && styles.sortChipOn]}
          >
            <Text style={styles.sortChipTxt}>{t("ownerApp.financials.sortByDate")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setSortBy("amount")}
            style={[styles.sortChip, sortBy === "amount" && styles.sortChipOn]}
          >
            <Text style={styles.sortChipTxt}>{t("ownerApp.financials.sortByAmount")}</Text>
          </Pressable>
        </View>

        {credits === undefined ? (
          <View style={{ gap: spacing[2] }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skelCredit} />
            ))}
          </View>
        ) : credits.count === 0 ? (
          <View style={styles.emptyCredit}>
            <MaterialIcons name="check-circle" size={40} color={colors.accent.green} />
            <Text style={styles.emptyCreditTxt}>{t("ownerApp.financials.noCredits")}</Text>
          </View>
        ) : (
          (credits.credits as CreditRow[]).map((row) => {
            const open = expandedId === row.sessionId;
            const tableSub =
              row.billableMinutes != null
                ? row.billableMinutes * row.ratePerMin
                : 0;
            return (
              <View key={row.sessionId} style={styles.creditCard}>
                <Pressable
                  onPress={() =>
                    setExpandedId((id) => (id === row.sessionId ? null : row.sessionId))
                  }
                >
                  <View style={styles.creditTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.custName}>
                        {row.customerName}
                        {row.isGuest ? (
                          <Text style={styles.guestBadge}> ({t("ownerApp.financials.guest")})</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.meta}>{row.tableLabel}</Text>
                      <Text style={styles.meta}>
                        {formatEndDateLabel(row.endTime, clubTimezone)}
                      </Text>
                    </View>
                    <Text style={styles.creditAmt}>
                      {formatMoney(row.billTotal, row.currency)}
                    </Text>
                  </View>
                  {open ? (
                    <View style={styles.breakdown}>
                      <Text style={styles.bdLine}>
                        {t("ownerApp.financials.minutes", { count: row.billableMinutes ?? 0 })} @ {row.ratePerMin}
                        /min = {tableSub.toFixed(2)}
                      </Text>
                      {row.discount != null && row.discount > 0 ? (
                        <Text style={styles.bdLine}>
                          {t("ownerApp.financials.discount")}: −{row.discount}%
                        </Text>
                      ) : null}
                      {row.snackOrders.map((s, si) => (
                        <Text key={`${row.sessionId}-sn-${si}`} style={styles.bdLine}>
                          {s.name} × {s.qty} = {(s.priceAtOrder * s.qty).toFixed(2)}
                        </Text>
                      ))}
                      <Text style={styles.bdTotal}>
                        {t("ownerApp.financials.total", { amount: row.billTotal.toFixed(2) })}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.markRow}>
                  {canResolve ? (
                    <Pressable style={styles.markBtn} onPress={() => setPaySheet(row)}>
                      <Text style={styles.markBtnTxt}>{t("ownerApp.financials.markPaid")}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.lockRow}>
                      <MaterialIcons name="lock" size={18} color={colors.text.secondary} />
                      <Text style={styles.lockTxt}>{t("ownerApp.complaints.ownerOnly")}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={paySheet !== null} transparent animationType="slide">
        <Pressable style={styles.sheetScrim} onPress={() => setPaySheet(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.sheetTitle}>{t("ownerApp.financials.creditPaymentTitle")}</Text>
            {(["cash", "upi", "card"] as const).map((m) => (
              <Pressable
                key={m}
                style={styles.methodPick}
                onPress={() => paySheet && onResolve(paySheet, m)}
              >
                <MaterialIcons
                  name={
                    m === "cash" ? "payments" : m === "upi" ? "smartphone" : "credit-card"
                  }
                  size={24}
                  color={colors.text.primary}
                />
                <Text style={styles.methodPickTxt}>
                  {m === "cash"
                    ? t("ownerApp.financials.cash")
                    : m === "upi"
                      ? t("ownerApp.financials.upi")
                      : t("ownerApp.financials.card")}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPaySheet(null)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelTxt}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export default function FinancialsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.financials")}>
      <FinancialsContent />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing[6], paddingBottom: spacing[2] },
  title: { ...typography.heading3, color: colors.text.primary },
  sub: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 4 },
  scroll: { paddingHorizontal: spacing[6], paddingBottom: spacing[16] },
  gstLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    marginBottom: spacing[6],
  },
  gstLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(67,160,71,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  gstLinkText: { flex: 1 },
  gstLinkTitle: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  gstLinkSub: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  sectionTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[3] },
  skelChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 180,
    gap: 6,
    marginBottom: spacing[4],
  },
  skelBar: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 4,
  },
  chartWrap: { marginBottom: spacing[2], minHeight: 220 },
  chartOverlay: { position: "absolute", alignSelf: "center", marginTop: 80, zIndex: 10 },
  axisTxt: { color: colors.text.secondary, fontSize: 10 },
  tooltip: {
    backgroundColor: colors.bg.secondary,
    padding: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tooltipTxt: { ...typography.caption, color: colors.text.primary },
  summaryRow: { marginBottom: spacing[6] },
  totalMain: {
    ...typography.heading3,
    color: colors.text.primary,
    fontWeight: "700",
  },
  totalSub: { ...typography.body, color: colors.text.secondary, marginTop: 4 },
  grid4: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  methodCard: {
    width: "47%",
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    gap: 4,
  },
  methodLbl: { ...typography.caption, color: colors.text.secondary },
  methodAmt: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  methodSub: { ...typography.caption, color: colors.text.secondary },
  skelCard: {
    width: "47%",
    height: 100,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
  },
  breakdownNote: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  emptyAnalytics: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[6],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    marginBottom: spacing[6],
  },
  emptyAnalyticsTxt: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center",
  },
  skelRow: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
  },
  tableRow: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[1.5],
  },
  tableRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  tableRank: {
    ...typography.caption,
    color: colors.text.secondary,
    width: 24,
  },
  tableLbl: {
    ...typography.label,
    color: colors.text.primary,
    flex: 1,
  },
  tableAmt: {
    ...typography.label,
    color: colors.accent.green,
    fontWeight: "700",
  },
  tableBarTrack: {
    height: 6,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 3,
    overflow: "hidden",
  },
  tableBarFill: {
    height: "100%",
    backgroundColor: colors.accent.green,
    borderRadius: 3,
  },
  tableSub: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  snackTotalLine: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: "600",
  },
  heatmapSkel: {
    height: 200,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    marginBottom: spacing[6],
  },
  heatmapHeader: {
    height: 18,
    flexDirection: "row",
    marginLeft: 32,
    position: "relative",
  },
  heatmapDayCol: {
    width: 0,
  },
  heatmapAxis: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
  heatmapRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  heatmapDayLbl: {
    width: 32,
    ...typography.caption,
    color: colors.text.secondary,
  },
  heatmapCells: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
  },
  heatmapCell: {
    flex: 1,
    height: 18,
    borderRadius: 2,
  },
  heatmapNote: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  creditHeader: { marginBottom: spacing[2] },
  creditTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  badge: {
    backgroundColor: colors.status.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeTxt: { color: colors.text.primary, fontWeight: "700", fontSize: 12 },
  creditTotal: {
    ...typography.label,
    color: colors.text.secondary,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  sortLbl: { ...typography.caption, color: colors.text.secondary },
  sortChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  sortChipOn: { borderColor: colors.accent.green, backgroundColor: "rgba(67,160,71,0.15)" },
  sortChipTxt: { ...typography.caption, color: colors.text.primary },
  creditCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    marginBottom: spacing[3],
  },
  creditTop: { flexDirection: "row", gap: spacing[3] },
  custName: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  guestBadge: { ...typography.caption, color: colors.text.secondary },
  meta: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  creditAmt: {
    ...typography.heading4,
    color: colors.status.error,
    fontWeight: "700",
  },
  breakdown: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  bdLine: { ...typography.caption, color: colors.text.secondary, marginBottom: 4 },
  bdTotal: { ...typography.label, color: colors.text.primary, marginTop: 4 },
  markRow: { marginTop: spacing[3], alignItems: "flex-end" },
  markBtn: {
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  markBtnTxt: { ...typography.button, color: colors.text.primary },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  lockTxt: { ...typography.caption, color: colors.text.secondary },
  skelCredit: {
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
  },
  emptyCredit: { alignItems: "center", paddingVertical: spacing[8] },
  emptyCreditTxt: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[3],
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    padding: spacing[6],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[4] },
  methodPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    marginBottom: spacing[2],
  },
  methodPickTxt: { ...typography.button, color: colors.text.primary },
  sheetCancel: { marginTop: spacing[2], alignItems: "center" },
  sheetCancelTxt: { color: colors.text.secondary },
  deniedBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[8] },
  deniedTitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[4],
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[4],
  },
  backText: { ...typography.label, color: colors.text.primary },
});
