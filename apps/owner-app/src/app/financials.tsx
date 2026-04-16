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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { BarChart } from "react-native-gifted-charts";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import {
  addCalendarDaysYmd,
  toClubDate,
  zonedWallTimeToUtcMs,
  timeZoneAbbreviation,
} from "@a3/utils/timezone";
import { formatCurrency } from "@a3/utils/billing";
import { getActiveRoleId } from "../lib/activeRoleStorage";

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

function countDaysInclusive(
  dateFrom: string,
  dateTo: string,
  timeZone: string,
): number {
  if (dateFrom.localeCompare(dateTo) > 0) return 0;
  let n = 0;
  let cur = dateFrom;
  while (cur.localeCompare(dateTo) <= 0 && n < 400) {
    n += 1;
    cur = addCalendarDaysYmd(cur, 1, timeZone);
  }
  return n;
}

function firstOfMonthYmd(todayYmd: string): string {
  return `${todayYmd.slice(0, 7)}-01`;
}

function startOfLastMonthYmd(todayYmd: string): string {
  const y = Number(todayYmd.slice(0, 4));
  const mo = Number(todayYmd.slice(5, 7));
  if (mo === 1) return `${y - 1}-12-01`;
  return `${y}-${String(mo - 1).padStart(2, "0")}-01`;
}

function endOfLastMonthYmd(todayYmd: string, tz: string): string {
  const firstThis = firstOfMonthYmd(todayYmd);
  return addCalendarDaysYmd(firstThis, -1, tz);
}

function ymdToDate(ymd: string, tz: string): Date {
  return new Date(zonedWallTimeToUtcMs(ymd, "12:00", tz));
}

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
  const d = new Date(ymd + "T12:00:00Z");
  if (totalDays <= 14) {
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  }
  if (totalDays <= 30) {
    if (dayIndex % 3 !== 0) return "";
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  }
  if (dayIndex % 7 !== 0) return "";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function formatEndDateLabel(endTime: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(endTime));
}

export default function FinancialsScreen(): React.JSX.Element {
  const router = useRouter();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const clubTimezone = dashboard?.timezone ?? "Asia/Kolkata";

  const [roleId, setRoleId] = useState<Id<"staffRoles"> | undefined>(undefined);

  useEffect(() => {
    void getActiveRoleId().then((v) => {
      if (v) setRoleId(v as Id<"staffRoles">);
    });
  }, []);

  const access = useQuery(
    api.financials.getFinancialTabAccess,
    clubId ? { clubId, roleId } : "skip",
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
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
    clubId && dateFrom && dateTo && !rangeInvalid
      ? { clubId, dateFrom, dateTo, roleId }
      : "skip";
  const revenue = useQuery(api.financials.getRevenueByDay, revenueArgs);

  const breakdownArgs =
    clubId && dateFrom && dateTo && !rangeInvalid
      ? { clubId, dateFrom, dateTo, roleId }
      : "skip";
  const breakdown = useQuery(
    api.financials.getPaymentMethodBreakdown,
    breakdownArgs,
  );

  const creditsArgs = clubId ? { clubId, sortBy, roleId } : "skip";
  const credits = useQuery(api.financials.getOutstandingCredits, creditsArgs);

  const resolveCredit = useMutation(api.financials.resolveCredit);

  const onPickChip = useCallback(
    (kind: "7" | "30" | "this" | "last") => {
      const to =
        dashboard?.todayYmd ?? toClubDate(Date.now(), clubTimezone);
      if (kind === "7") {
        setDateFrom(addCalendarDaysYmd(to, -6, clubTimezone));
        setDateTo(to);
      } else if (kind === "30") {
        setDateFrom(addCalendarDaysYmd(to, -29, clubTimezone));
        setDateTo(to);
      } else if (kind === "this") {
        setDateFrom(firstOfMonthYmd(to));
        setDateTo(to);
      } else {
        const end = endOfLastMonthYmd(to, clubTimezone);
        const start = startOfLastMonthYmd(to);
        setDateFrom(start);
        setDateTo(end);
      }
    },
    [clubTimezone, dashboard?.todayYmd],
  );

  const onDateChange = useCallback(
    (_e: DateTimePickerEvent, date?: Date) => {
      if (!date || !picker) return;
      const ymd = toClubDate(date.getTime(), clubTimezone);
      if (picker === "from") setDateFrom(ymd);
      else setDateTo(ymd);
      if (Platform.OS !== "ios") setPicker(null);
    },
    [picker, clubTimezone],
  );

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
      Alert.alert(
        "Confirm",
        `Mark ${row.customerName}'s ${formatMoney(row.billTotal, row.currency)} credit as paid by ${method}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              try {
                await resolveCredit({
                  sessionId: row.sessionId,
                  resolvedMethod: method,
                  roleId,
                });
                setPaySheet(null);
                Alert.alert(
                  "Done",
                  `Credit resolved. ${row.customerName}'s balance cleared.`,
                );
              } catch (e) {
                const msg = parseConvexError(e as Error).message;
                if (msg.toLowerCase().includes("permission")) {
                  Alert.alert(
                    "Permission",
                    "Your current role cannot resolve credits.",
                  );
                } else {
                  Alert.alert("Error", msg);
                }
              }
            },
          },
        ],
      );
    },
    [resolveCredit, roleId],
  );

  if (dashboard === undefined || access === undefined) {
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/slots"))}
          style={styles.backRow}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.deniedBox}>
          <MaterialIcons name="lock" size={48} color={colors.text.secondary} />
          <Text style={styles.deniedTitle}>
            {"You don't have permission to view financial data."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayCurrency = revenue?.currency ?? dashboard.currency ?? "INR";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Financials</Text>
        <Text style={styles.sub}>Revenue and outstanding credits</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tzNote}>Dates in {tzAbbr}</Text>

        <View style={styles.dateRow}>
          <Pressable style={styles.dateBtn} onPress={() => setPicker("from")}>
            <Text style={styles.dateLbl}>From</Text>
            <Text style={styles.dateVal}>{dateFrom || "—"}</Text>
          </Pressable>
          <Pressable style={styles.dateBtn} onPress={() => setPicker("to")}>
            <Text style={styles.dateLbl}>To</Text>
            <Text style={styles.dateVal}>{dateTo || "—"}</Text>
          </Pressable>
        </View>

        {picker ? (
          <DateTimePicker
            value={ymdToDate(picker === "from" ? dateFrom : dateTo, clubTimezone)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
            themeVariant="dark"
          />
        ) : null}
        {Platform.OS === "ios" && picker ? (
          <Pressable style={styles.iosPickDone} onPress={() => setPicker(null)}>
            <Text style={styles.iosPickDoneText}>Done</Text>
          </Pressable>
        ) : null}

        <View style={styles.chips}>
          {(
            [
              { k: "7" as const, label: "Last 7 days" },
              { k: "30" as const, label: "Last 30 days" },
              { k: "this" as const, label: "This month" },
              { k: "last" as const, label: "Last month" },
            ] as const
          ).map((c) => (
            <Pressable key={c.k} onPress={() => onPickChip(c.k)} style={styles.chip}>
              <Text style={styles.chipText}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {rangeInvalid ? (
          <Text style={styles.errText}>
            End date cannot be before start date.
          </Text>
        ) : null}

        {largeRange ? (
          <Text style={styles.warnLarge}>
            Large date ranges may take a moment to load.
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>Revenue</Text>
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
              <BarChart
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
                renderTooltip={(items: ReadonlyArray<{ index?: number }>) => {
                  const it = items?.[0];
                  if (!it) return null;
                  const idx = typeof it.index === "number" ? it.index : 0;
                  const src = revenue.days[idx];
                  if (!src) return null;
                  return (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipTxt}>
                        {src.date}: {formatMoney(src.revenue, revenue.currency)} •{" "}
                        {src.sessionCount} sessions
                      </Text>
                    </View>
                  );
                }}
                {...({
                  pointerConfig: {
                    activatePointersOnLongPress: false,
                    pointerStripColor: colors.border.default,
                    pointerStripWidth: 1,
                  },
                } as object)}
              />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.totalMain}>
                Total: {formatMoney(revenue.totalRevenue, revenue.currency)}
              </Text>
              <Text style={styles.totalSub}>{revenue.totalSessions} sessions</Text>
            </View>
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing[8] }]}>
          Payment methods
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
                    ? "Cash"
                    : b.method === "upi"
                      ? "UPI"
                      : b.method === "card"
                        ? "Card"
                        : "Credit (resolved)";
                return (
                  <View key={b.method} style={styles.methodCard}>
                    <MaterialIcons name={cfg.icon} size={22} color={cfg.color} />
                    <Text style={styles.methodLbl}>{label}</Text>
                    <Text style={styles.methodAmt}>
                      {b.method === "credit"
                        ? `${b.sessionCount} session${b.sessionCount === 1 ? "" : "s"}`
                        : formatMoney(b.totalAmount, displayCurrency)}
                    </Text>
                    <Text style={styles.methodSub}>
                      {b.method === "credit"
                        ? "Allocated above"
                        : `${b.sessionCount} session${b.sessionCount === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.breakdownNote}>
              Credit totals show resolved payments only. Unresolved credits appear
              below.
            </Text>
          </>
        )}

        <View style={styles.creditHeader}>
          <View style={styles.creditTitleRow}>
            <Text style={styles.sectionTitle}>Outstanding Credits</Text>
            {credits && credits.count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{credits.count}</Text>
              </View>
            ) : null}
          </View>
          {credits ? (
            <Text style={styles.creditTotal}>
              Total: {formatMoney(credits.totalOutstanding, displayCurrency)}
            </Text>
          ) : null}
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.sortLbl}>Sort by</Text>
          <Pressable
            onPress={() => setSortBy("date")}
            style={[styles.sortChip, sortBy === "date" && styles.sortChipOn]}
          >
            <Text style={styles.sortChipTxt}>Date</Text>
          </Pressable>
          <Pressable
            onPress={() => setSortBy("amount")}
            style={[styles.sortChip, sortBy === "amount" && styles.sortChipOn]}
          >
            <Text style={styles.sortChipTxt}>Amount</Text>
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
            <Text style={styles.emptyCreditTxt}>
              No outstanding credits. All sessions have been settled.
            </Text>
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
                          <Text style={styles.guestBadge}> (Guest)</Text>
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
                        Table time: {row.billableMinutes ?? "—"} min @ {row.ratePerMin}
                        /min = {tableSub.toFixed(2)}
                      </Text>
                      {row.discount != null && row.discount > 0 ? (
                        <Text style={styles.bdLine}>Discount: −{row.discount}%</Text>
                      ) : null}
                      {row.snackOrders.map((s, si) => (
                        <Text key={`${row.sessionId}-sn-${si}`} style={styles.bdLine}>
                          {s.name} × {s.qty} = {(s.priceAtOrder * s.qty).toFixed(2)}
                        </Text>
                      ))}
                      <Text style={styles.bdTotal}>Total: {row.billTotal.toFixed(2)}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.markRow}>
                  {canResolve ? (
                    <Pressable style={styles.markBtn} onPress={() => setPaySheet(row)}>
                      <Text style={styles.markBtnTxt}>Mark as Paid</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.lockRow}>
                      <MaterialIcons name="lock" size={18} color={colors.text.secondary} />
                      <Text style={styles.lockTxt}>Owner only</Text>
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
            <Text style={styles.sheetTitle}>How was this credit paid?</Text>
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
                  {m === "cash" ? "Cash" : m === "upi" ? "UPI" : "Card"}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPaySheet(null)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing[6], paddingBottom: spacing[2] },
  title: { ...typography.heading3, color: colors.text.primary },
  sub: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 4 },
  scroll: { paddingHorizontal: spacing[6], paddingBottom: spacing[16] },
  tzNote: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[2] },
  dateRow: { flexDirection: "row", gap: spacing[3], marginBottom: spacing[3] },
  dateBtn: {
    flex: 1,
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  dateLbl: { ...typography.caption, color: colors.text.secondary },
  dateVal: { ...typography.label, color: colors.text.primary, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginBottom: spacing[4] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
  },
  chipText: { ...typography.caption, color: colors.text.primary },
  errText: { color: colors.status.error, marginBottom: spacing[2] },
  warnLarge: { color: colors.accent.amber, marginBottom: spacing[2] },
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
  iosPickDone: { alignItems: "flex-end", paddingRight: spacing[4] },
  iosPickDoneText: { color: colors.status.info, ...typography.label },
});
