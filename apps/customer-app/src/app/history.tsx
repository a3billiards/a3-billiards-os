import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { GlassPageBackground } from "@a3/ui/components";
import { usePullToRefresh } from "@a3/ui/hooks";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import {
  computeBillBreakdown,
  formatCurrency,
  formatDuration,
} from "@a3/utils/billing";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";

type SessionLogRow = {
  _id: string;
  sessionId: Id<"sessions">;
  clubId: Id<"clubs">;
  clubName: string;
  tableLabel: string;
  startTime: number;
  endTime: number | null;
  billTotal: number | null;
  currency: string | null;
  paymentStatus: "pending" | "paid" | "credit";
  paymentMethod: "cash" | "upi" | "card" | "credit" | null;
  status: "active" | "completed" | "cancelled";
  creditResolvedAt: number | null;
  creditResolvedMethod: "cash" | "upi" | "card" | null;
  createdAt: number;
  updatedAt: number;
};

type SessionDetail = {
  sessionId: Id<"sessions">;
  startTime: number;
  endTime: number | null;
  billableMinutes: number | null;
  ratePerMin: number;
  minBillMinutes: number;
  currency: string;
  snackOrders: { snackId: string; name: string; qty: number; priceAtOrder: number }[];
  billTotal: number | null;
  discount: number | null;
  paymentMethod: "cash" | "upi" | "card" | "credit" | null;
  paymentStatus: "pending" | "paid" | "credit";
  status: "active" | "completed" | "cancelled";
  creditResolvedAt: number | null;
  creditResolvedMethod: "cash" | "upi" | "card" | null;
  cancellationReason: string | null;
};

function normalizeClubId(raw: string | string[] | undefined): Id<"clubs"> | undefined {
  if (!raw) return undefined;
  const s = Array.isArray(raw) ? raw[0] : raw;
  return (s || undefined) as Id<"clubs"> | undefined;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatSessionDate(
  startTime: number,
  t: (key: string) => string,
): string {
  const d = new Date(startTime);
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (isSameLocalDay(d, now)) return t("customerApp.history.today");
  if (isSameLocalDay(d, y)) return t("customerApp.history.yesterday");
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function methodLabel(
  m: "cash" | "upi" | "card" | "credit" | null | undefined,
  t: (key: string) => string,
): string {
  if (!m) return "";
  switch (m) {
    case "cash":
      return t("customerApp.history.cash");
    case "upi":
      return t("customerApp.history.upi");
    case "card":
      return t("customerApp.history.card");
    case "credit":
      return t("customerApp.history.credit");
    default:
      return "";
  }
}

function StatusBar({ color }: { color: string }): React.JSX.Element {
  return <View style={[styles.statusBar, { backgroundColor: color }]} />;
}

function Row({
  label,
  value,
  valueColor,
  bold,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

function SessionCard({
  row,
  expanded,
  onToggle,
  tick,
  detail,
  detailLoading,
}: {
  row: SessionLogRow;
  expanded: boolean;
  onToggle: () => void;
  tick: number;
  detail: SessionDetail | null | undefined;
  detailLoading: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const now = Date.now();
  const isActive = row.status === "active";
  const isCancelled = row.status === "cancelled";
  const isCompleted = row.status === "completed";

  const barColor = isActive
    ? colors.accent.green
    : isCancelled
      ? colors.status.disabled
      : row.paymentStatus === "credit"
        ? colors.accent.amber
        : colors.status.info;

  const durationLabel = isCancelled
    ? "—"
    : isActive
      ? formatDuration(now - row.startTime)
      : row.endTime != null
        ? formatDuration(row.endTime - row.startTime)
        : "—";

  const billDisplay =
    isActive || isCancelled
      ? "—"
      : row.billTotal != null
        ? formatCurrency(row.billTotal, row.currency)
        : "—";

  let statusPill = "";
  let pillStyle: object = styles.pillNeutral;
  if (isActive) {
    statusPill = t("customerApp.history.inProgress");
    pillStyle = styles.pillActive;
  } else if (isCancelled) {
    statusPill = t("customerApp.history.cancelled");
    pillStyle = styles.pillMuted;
  } else if (row.paymentStatus === "paid" && row.creditResolvedAt != null) {
    statusPill = t("customerApp.history.creditResolved");
    pillStyle = styles.pillMuted;
  } else if (row.paymentStatus === "paid") {
    statusPill = t("customerApp.history.paid");
    pillStyle = styles.pillPaid;
  } else if (row.paymentStatus === "credit") {
    statusPill = t("customerApp.history.creditOwed");
    pillStyle = styles.pillCredit;
  } else {
    statusPill = t("customerApp.history.pending");
    pillStyle = styles.pillNeutral;
  }

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, pulse]);

  const breakdown = useMemo(() => {
    if (!detail) return null;
    if (detail.status === "cancelled") return null;
    try {
      const snackOrders = detail.snackOrders.map((s) => ({
        qty: s.qty,
        priceAtOrder: s.priceAtOrder,
      }));
      if (detail.status === "active") {
        return computeBillBreakdown({
          startTime: detail.startTime,
          endTime: null,
          estimateEndMs: Date.now(),
          billableMinutes: detail.billableMinutes,
          ratePerMin: detail.ratePerMin,
          minBillMinutes: detail.minBillMinutes,
          discount: detail.discount,
          snackOrders,
        });
      }
      if (detail.endTime == null) return null;
      return computeBillBreakdown({
        startTime: detail.startTime,
        endTime: detail.endTime,
        billableMinutes: detail.billableMinutes,
        ratePerMin: detail.ratePerMin,
        minBillMinutes: detail.minBillMinutes,
        discount: detail.discount,
        snackOrders,
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` advances the running clock for active-session breakdown (`Date.now()` above).
  }, [detail, tick]);

  const discountPct = detail?.discount ?? 0;
  const showDiscount = detail && discountPct > 0 && breakdown && breakdown.discountAmount > 0;

  const payMethodBadge =
    isCompleted && row.paymentMethod
      ? row.paymentMethod === "cash"
        ? { label: t("customerApp.history.cash"), style: styles.payCash }
        : row.paymentMethod === "upi"
          ? { label: t("customerApp.history.upi"), style: styles.payUpi }
          : row.paymentMethod === "card"
            ? { label: t("customerApp.history.card"), style: styles.payCard }
            : row.paymentMethod === "credit"
              ? row.creditResolvedAt == null
                ? { label: t("customerApp.history.credit"), style: styles.payCredit }
                : {
                    label: t("customerApp.history.resolvedVia", {
                      method: methodLabel(row.creditResolvedMethod, t),
                    }),
                    style: styles.payResolved,
                  }
              : null
      : null;

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={styles.cardInner}>
        <StatusBar color={barColor} />
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <Text style={styles.clubName} numberOfLines={1}>
              {row.clubName}
            </Text>
            <View style={[styles.pill, pillStyle]}>
              {isActive ? (
                <Animated.View style={[styles.pulseDot, { opacity: pulse }]} />
              ) : null}
              <Text style={styles.pillText}>{statusPill}</Text>
            </View>
          </View>
          <View style={styles.midRow}>
            <Text style={styles.meta}>🎱 {row.tableLabel}</Text>
            <Text style={styles.meta}> · </Text>
            <Text style={styles.meta}>{formatSessionDate(row.startTime, t)}</Text>
          </View>
          <View style={styles.botRow}>
            <Text style={styles.meta}>{durationLabel}</Text>
            <Text style={styles.meta}> · </Text>
            <Text style={styles.billText}>{billDisplay}</Text>
            {row.paymentStatus === "credit" &&
            isCompleted &&
            row.creditResolvedAt == null &&
            row.billTotal != null ? (
              <Text style={styles.creditTag}> {t("customerApp.history.creditOwed")}</Text>
            ) : null}
            <View style={{ flex: 1 }} />
            {payMethodBadge ? (
              <View style={[styles.payPill, payMethodBadge.style]}>
                <Text style={styles.payPillText}>{payMethodBadge.label}</Text>
              </View>
            ) : null}
            <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.breakdownPanel}>
          <View style={styles.divider} />
          {detailLoading || detail === undefined ? (
            <ActivityIndicator color={glass.ctaBg} style={{ marginVertical: spacing[3] }} />
          ) : detail === null ? (
            <Text style={styles.noteMuted}>
              {t("customerApp.history.breakdownUnavailable")}
              {row.billTotal != null ? (
                <>
                  {" "}
                  {t("customerApp.history.totalRecorded", {
                    amount: formatCurrency(row.billTotal, row.currency),
                  })}
                </>
              ) : null}
            </Text>
          ) : detail.status === "cancelled" ? (
            <>
              <Text style={styles.noteMuted}>{t("customerApp.history.noBillCancelled")}</Text>
              {detail.cancellationReason === "admin_force_end" ? (
                <Text style={[styles.noteMuted, { marginTop: spacing[2], fontStyle: "italic" }]}>
                  {t("customerApp.history.endedBySupport")}
                </Text>
              ) : null}
            </>
          ) : detail.status === "active" && breakdown ? (
            <>
              <Text style={styles.breakdownHeader}>{t("customerApp.history.billBreakdown")}</Text>
              <Text style={styles.estimateNote}>{t("customerApp.history.estimatedBillNote")}</Text>
              <Text style={styles.sectionTitle}>{t("customerApp.history.tableTimeEstimate")}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.lineDetail}>
                  {t("customerApp.history.minAtRate", {
                    minutes: breakdown.billableMinutes,
                    rate: formatCurrency(detail.ratePerMin, detail.currency),
                  })}
                </Text>
                <Text style={styles.lineAmount}>
                  {formatCurrency(breakdown.tableSubtotal, detail.currency)}
                </Text>
              </View>
              {showDiscount ? (
                <Row
                  label={t("customerApp.history.discount", { percent: detail.discount })}
                  value={`− ${formatCurrency(breakdown.discountAmount, detail.currency)}`}
                  valueColor={colors.accent.green}
                />
              ) : null}
              {showDiscount ? (
                <Row
                  label={t("customerApp.history.tableSubtotal")}
                  value={formatCurrency(breakdown.discountedTable, detail.currency)}
                />
              ) : null}
              <View style={styles.dividerThin} />
              <Row
                label={t("customerApp.history.totalEstimate")}
                value={formatCurrency(breakdown.finalBill, detail.currency)}
                bold
              />
            </>
          ) : breakdown ? (
            <>
              <Text style={styles.breakdownHeader}>{t("customerApp.history.billBreakdown")}</Text>
              <Text style={styles.sectionTitle}>{t("customerApp.history.tableTime")}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.lineDetail}>
                  {t("customerApp.history.minAtRate", {
                    minutes: breakdown.billableMinutes,
                    rate: formatCurrency(detail.ratePerMin, detail.currency),
                  })}
                </Text>
                <Text style={styles.lineAmount}>
                  {formatCurrency(breakdown.tableSubtotal, detail.currency)}
                </Text>
              </View>
              {breakdown.billableMinutes > breakdown.actualMinutes ? (
                <Text style={styles.noteItalic}>
                  {t("customerApp.history.minimumCharge", {
                    min: detail.minBillMinutes,
                    actual: breakdown.actualMinutes,
                  })}
                </Text>
              ) : null}
              {showDiscount ? (
                <Row
                  label={t("customerApp.history.discount", { percent: detail.discount })}
                  value={`− ${formatCurrency(breakdown.discountAmount, detail.currency)}`}
                  valueColor={colors.accent.green}
                />
              ) : null}
              {showDiscount ? (
                <Row
                  label={t("customerApp.history.tableSubtotal")}
                  value={formatCurrency(breakdown.discountedTable, detail.currency)}
                />
              ) : null}
              {detail.snackOrders.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: spacing[2] }]}>
                    {t("customerApp.history.snacks")}
                  </Text>
                  {detail.snackOrders.map((s, i) => (
                    <View key={`${s.snackId}-${i}`} style={styles.snackRow}>
                      <Text style={styles.snackName} numberOfLines={1}>
                        {s.name} × {s.qty}
                      </Text>
                      <Text style={styles.snackAmt}>
                        {formatCurrency(s.priceAtOrder * s.qty, detail.currency)}
                      </Text>
                    </View>
                  ))}
                  <Row
                    label={t("customerApp.history.snackTotal")}
                    value={formatCurrency(breakdown.snackTotal, detail.currency)}
                  />
                </>
              ) : null}
              <View style={styles.dividerThin} />
              <Row
                label={t("customerApp.history.total")}
                value={formatCurrency(
                  row.billTotal ?? breakdown.finalBill,
                  row.currency ?? detail.currency,
                )}
                bold
              />
              {detail.paymentStatus === "paid" && detail.paymentMethod ? (
                <Text style={styles.noteMuted}>
                  {t("customerApp.history.paidBy", {
                    method: methodLabel(detail.paymentMethod, t),
                  })}
                </Text>
              ) : null}
              {detail.paymentStatus === "credit" && detail.creditResolvedAt == null ? (
                <Text style={styles.creditNote}>{t("customerApp.history.creditOwedNote")}</Text>
              ) : null}
              {detail.paymentStatus === "credit" &&
              detail.creditResolvedAt != null &&
              detail.creditResolvedMethod ? (
                <Text style={styles.noteMuted}>
                  {t("customerApp.history.resolvedVia", {
                    method: methodLabel(detail.creditResolvedMethod, t),
                  })}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.noteMuted}>{t("customerApp.history.unableCompute")}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SkeletonList(): React.JSX.Element {
  return (
    <View style={{ gap: spacing[3] }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonBar} />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <View style={styles.skeletonLineLg} />
            <View style={styles.skeletonLineSm} />
            <View style={styles.skeletonLineMd} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SessionHistoryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId?: string | string[] }>();
  const clubIdParam = normalizeClubId(params.clubId);

  const user = useQuery(api.users.getCurrentUser);
  const history = useQuery(
    api.sessions.getCustomerSessionHistory,
    user?._id ? { customerId: user._id, clubId: clubIdParam } : "skip",
  ) as SessionLogRow[] | undefined;

  const [expandedId, setExpandedId] = useState<Id<"sessions"> | null>(null);
  const [detailCache, setDetailCache] = useState<
    Record<string, SessionDetail | null | undefined>
  >({});

  const expandedKey = expandedId ? String(expandedId) : null;
  const cacheHasKey = expandedKey !== null && expandedKey in detailCache;
  const shouldFetchDetail =
    expandedId !== null && expandedKey !== null && !cacheHasKey;

  const detailRemote = useQuery(
    api.sessions.getSessionDetail,
    shouldFetchDetail ? { sessionId: expandedId } : "skip",
  );

  useEffect(() => {
    if (!expandedId || !expandedKey) return;
    if (detailRemote === undefined) return;
    setDetailCache((c) => ({ ...c, [expandedKey]: detailRemote }));
  }, [expandedId, expandedKey, detailRemote]);

  const sessions = useMemo(() => history ?? [], [history]);
  const hasActive = useMemo(() => sessions.some((s) => s.status === "active"), [sessions]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [hasActive]);

  const filterClubName = useMemo(() => {
    if (!clubIdParam) return null;
    const fromRow = sessions.find((s) => s.clubId === clubIdParam)?.clubName;
    return fromRow ?? null;
  }, [clubIdParam, sessions]);

  const toggle = useCallback((id: Id<"sessions">) => {
    setExpandedId((cur) => (cur === id ? null : id));
  }, []);

  const clearClubFilter = useCallback(() => {
    router.replace("/(tabs)/history");
  }, [router]);

  return (
    <GlassPageBackground>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("customerApp.history.title")}</Text>
        {clubIdParam ? (
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>
              {t("customerApp.history.filterAtClub", {
                clubName: filterClubName ?? t("customerApp.history.filterThisClub"),
              })}
            </Text>
            <Pressable onPress={clearClubFilter} hitSlop={12}>
              <Text style={styles.filterClear}>✕</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {user === undefined || history === undefined ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <SkeletonList />
        </ScrollView>
      ) : user === null ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("customerApp.history.signInRequired")}</Text>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎱</Text>
          <Text style={styles.emptyTitle}>{t("customerApp.history.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("customerApp.history.emptySub")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {sessions.map((row) => {
            const sid = row.sessionId;
            const expanded = expandedId === sid;
            const key = String(sid);
            const rowIsExpanded = expanded && expandedKey === key;
            const rowCacheHas = rowIsExpanded && key in detailCache;
            const detailLoading =
              rowIsExpanded && !rowCacheHas && detailRemote === undefined;
            const detail = rowIsExpanded
              ? rowCacheHas
                ? detailCache[key]
                : detailRemote
              : undefined;

            return (
              <SessionCard
                key={row._id}
                row={row}
                expanded={expanded}
                onToggle={() => toggle(sid)}
                tick={tick}
                detail={detail as SessionDetail | null | undefined}
                detailLoading={detailLoading}
              />
            );
          })}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  pad: { padding: layout.screenPadding, paddingBottom: spacing[10] },
  header: { paddingHorizontal: layout.screenPadding, paddingTop: spacing[2], paddingBottom: spacing[2] },
  title: { ...typography.heading3, color: colors.text.primary },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: spacing[2],
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    gap: spacing[2],
  },
  filterChipText: { ...typography.caption, color: colors.text.primary },
  filterClear: { ...typography.caption, color: colors.text.secondary, fontSize: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing[6] },
  muted: { ...typography.body, color: colors.text.secondary },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing[8] },
  emptyEmoji: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { ...typography.heading3, color: colors.text.primary },
  emptySub: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing[2], textAlign: "center" },
  card: {
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
    marginBottom: spacing[3],
    overflow: "hidden",
  },
  cardInner: { flexDirection: "row" },
  statusBar: { width: 4, minHeight: 88 },
  cardBody: { flex: 1, padding: spacing[3] },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[2] },
  clubName: { ...typography.label, color: colors.text.primary, fontWeight: "700", flex: 1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillText: { ...typography.caption, fontWeight: "600" },
  pillActive: { backgroundColor: "rgba(67, 160, 71, 0.2)" },
  pillPaid: { backgroundColor: "rgba(33, 150, 243, 0.2)" },
  pillCredit: { backgroundColor: "rgba(245, 127, 23, 0.2)" },
  pillMuted: { backgroundColor: glass.inputBg },
  pillNeutral: { backgroundColor: glass.inputBg },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.amberLight,
  },
  midRow: { flexDirection: "row", alignItems: "center", marginTop: spacing[2], flexWrap: "wrap" },
  meta: { ...typography.caption, color: colors.text.secondary },
  botRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[2],
    flexWrap: "wrap",
    gap: 2,
  },
  billText: { ...typography.caption, color: colors.text.primary, fontWeight: "600" },
  creditTag: { ...typography.caption, color: colors.accent.amber, fontWeight: "600" },
  payPill: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm, marginStart: spacing[2] },
  payPillText: { ...typography.caption, fontWeight: "600" },
  payCash: { backgroundColor: glass.inputBg },
  payUpi: { backgroundColor: "rgba(33, 150, 243, 0.2)" },
  payCard: { backgroundColor: "rgba(255, 193, 7, 0.15)" },
  payCredit: { backgroundColor: "rgba(245, 127, 23, 0.2)" },
  payResolved: { backgroundColor: glass.inputBg },
  chevron: { ...typography.caption, color: colors.text.secondary, marginStart: spacing[1] },
  breakdownPanel: {
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  divider: { height: 1, backgroundColor: colors.border.subtle, marginBottom: spacing[2] },
  dividerThin: { height: 1, backgroundColor: colors.border.subtle, marginVertical: spacing[2] },
  breakdownHeader: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[2] },
  sectionTitle: { ...typography.label, color: colors.text.primary, marginTop: spacing[1] },
  lineDetail: { ...typography.caption, color: colors.text.secondary, flex: 1, marginEnd: spacing[2] },
  lineAmount: { ...typography.caption, color: colors.text.primary, fontWeight: "600" },
  noteMuted: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[2] },
  noteItalic: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginTop: spacing[1],
  },
  estimateNote: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginBottom: spacing[2],
  },
  creditNote: { ...typography.caption, color: colors.accent.amber, marginTop: spacing[2] },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing[1],
  },
  rowLabel: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  rowValue: { ...typography.caption, color: colors.text.primary },
  rowBold: { fontWeight: "700", fontSize: 16 },
  snackRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingStart: spacing[2] },
  snackName: { ...typography.caption, color: colors.text.secondary, flex: 1, marginEnd: spacing[2] },
  snackAmt: { ...typography.caption, color: colors.text.primary },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
    padding: spacing[3],
    minHeight: 96,
    gap: spacing[2],
  },
  skeletonBar: { width: 4, borderRadius: 2, backgroundColor: glass.inputBg },
  skeletonLineLg: { height: 14, borderRadius: 4, backgroundColor: glass.inputBg, width: "70%" },
  skeletonLineMd: { height: 12, borderRadius: 4, backgroundColor: glass.inputBg, width: "50%" },
  skeletonLineSm: { height: 12, borderRadius: 4, backgroundColor: glass.inputBg, width: "40%" },
});
