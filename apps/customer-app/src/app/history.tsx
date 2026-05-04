import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import {
  computeBillBreakdown,
  formatCurrency,
  formatDuration,
} from "@a3/utils/billing";

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

function formatSessionDate(startTime: number): string {
  const d = new Date(startTime);
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (isSameLocalDay(d, now)) return "Today";
  if (isSameLocalDay(d, y)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function methodLabel(
  m: "cash" | "upi" | "card" | "credit" | null | undefined,
): string {
  if (!m) return "";
  return m.charAt(0).toUpperCase() + m.slice(1);
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
    statusPill = "In Progress";
    pillStyle = styles.pillActive;
  } else if (isCancelled) {
    statusPill = "Cancelled";
    pillStyle = styles.pillMuted;
  } else if (row.paymentStatus === "paid" && row.creditResolvedAt != null) {
    statusPill = "Credit resolved";
    pillStyle = styles.pillMuted;
  } else if (row.paymentStatus === "paid") {
    statusPill = "Paid";
    pillStyle = styles.pillPaid;
  } else if (row.paymentStatus === "credit") {
    statusPill = "Credit owed";
    pillStyle = styles.pillCredit;
  } else {
    statusPill = "Pending";
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
      if (detail.status === "active") {
        return computeBillBreakdown({
          startTime: detail.startTime,
          endTime: null,
          estimateEndMs: Date.now(),
          billableMinutes: detail.billableMinutes,
          ratePerMin: detail.ratePerMin,
          minBillMinutes: detail.minBillMinutes,
          discount: detail.discount,
          snackOrders: detail.snackOrders.map((s) => ({
            qty: s.qty,
            priceAtOrder: s.priceAtOrder,
          })),
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
        snackOrders: detail.snackOrders.map((s) => ({
          qty: s.qty,
          priceAtOrder: s.priceAtOrder,
        })),
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
        ? { label: "Cash", style: styles.payCash }
        : row.paymentMethod === "upi"
          ? { label: "UPI", style: styles.payUpi }
          : row.paymentMethod === "card"
            ? { label: "Card", style: styles.payCard }
            : row.paymentMethod === "credit"
              ? row.creditResolvedAt == null
                ? { label: "Credit", style: styles.payCredit }
                : {
                    label: `Resolved via ${methodLabel(row.creditResolvedMethod)}`,
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
            <Text style={styles.meta}>{formatSessionDate(row.startTime)}</Text>
          </View>
          <View style={styles.botRow}>
            <Text style={styles.meta}>{durationLabel}</Text>
            <Text style={styles.meta}> · </Text>
            <Text style={styles.billText}>{billDisplay}</Text>
            {row.paymentStatus === "credit" &&
            isCompleted &&
            row.creditResolvedAt == null &&
            row.billTotal != null ? (
              <Text style={styles.creditTag}> Credit owed</Text>
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
            <ActivityIndicator color={colors.accent.green} style={{ marginVertical: spacing[3] }} />
          ) : detail === null ? (
            <Text style={styles.noteMuted}>
              Detailed breakdown unavailable.
              {row.billTotal != null ? (
                <>
                  {" "}
                  Total recorded: {formatCurrency(row.billTotal, row.currency)}
                </>
              ) : null}
            </Text>
          ) : detail.status === "cancelled" ? (
            <>
              <Text style={styles.noteMuted}>No bill — session was cancelled.</Text>
              {detail.cancellationReason === "admin_force_end" ? (
                <Text style={[styles.noteMuted, { marginTop: spacing[2], fontStyle: "italic" }]}>
                  Session ended by platform support.
                </Text>
              ) : null}
            </>
          ) : detail.status === "active" && breakdown ? (
            <>
              <Text style={styles.breakdownHeader}>Bill Breakdown</Text>
              <Text style={styles.estimateNote}>
                Estimated bill (in progress). Final bill calculated at checkout.
              </Text>
              <Text style={styles.sectionTitle}>Table time (estimate)</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.lineDetail}>
                  {breakdown.billableMinutes} min @{" "}
                  {formatCurrency(detail.ratePerMin, detail.currency)}/min
                </Text>
                <Text style={styles.lineAmount}>
                  {formatCurrency(breakdown.tableSubtotal, detail.currency)}
                </Text>
              </View>
              {showDiscount ? (
                <Row
                  label={`Discount (${detail.discount}%)`}
                  value={`− ${formatCurrency(breakdown.discountAmount, detail.currency)}`}
                  valueColor={colors.accent.green}
                />
              ) : null}
              {showDiscount ? (
                <Row
                  label="Table subtotal"
                  value={formatCurrency(breakdown.discountedTable, detail.currency)}
                />
              ) : null}
              <View style={styles.dividerThin} />
              <Row
                label="Total (estimate)"
                value={formatCurrency(breakdown.finalBill, detail.currency)}
                bold
              />
            </>
          ) : breakdown ? (
            <>
              <Text style={styles.breakdownHeader}>Bill Breakdown</Text>
              <Text style={styles.sectionTitle}>Table time</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.lineDetail}>
                  {breakdown.billableMinutes} min @{" "}
                  {formatCurrency(detail.ratePerMin, detail.currency)}/min
                </Text>
                <Text style={styles.lineAmount}>
                  {formatCurrency(breakdown.tableSubtotal, detail.currency)}
                </Text>
              </View>
              {breakdown.billableMinutes > breakdown.actualMinutes ? (
                <Text style={styles.noteItalic}>
                  Minimum {detail.minBillMinutes} min charge applied (actual: {breakdown.actualMinutes}{" "}
                  min)
                </Text>
              ) : null}
              {showDiscount ? (
                <Row
                  label={`Discount (${detail.discount}%)`}
                  value={`− ${formatCurrency(breakdown.discountAmount, detail.currency)}`}
                  valueColor={colors.accent.green}
                />
              ) : null}
              {showDiscount ? (
                <Row
                  label="Table subtotal"
                  value={formatCurrency(breakdown.discountedTable, detail.currency)}
                />
              ) : null}
              {detail.snackOrders.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: spacing[2] }]}>Snacks</Text>
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
                  <Row label="Snack total" value={formatCurrency(breakdown.snackTotal, detail.currency)} />
                </>
              ) : null}
              <View style={styles.dividerThin} />
              <Row
                label="Total"
                value={formatCurrency(
                  row.billTotal ?? breakdown.finalBill,
                  row.currency ?? detail.currency,
                )}
                bold
              />
              {detail.paymentStatus === "paid" && detail.paymentMethod ? (
                <Text style={styles.noteMuted}>Paid by {methodLabel(detail.paymentMethod)}</Text>
              ) : null}
              {detail.paymentStatus === "credit" && detail.creditResolvedAt == null ? (
                <Text style={styles.creditNote}>Credit owed — not yet paid</Text>
              ) : null}
              {detail.paymentStatus === "credit" &&
              detail.creditResolvedAt != null &&
              detail.creditResolvedMethod ? (
                <Text style={styles.noteMuted}>
                  Resolved via {methodLabel(detail.creditResolvedMethod)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.noteMuted}>Unable to compute breakdown.</Text>
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Session History</Text>
        {clubIdParam ? (
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>
              At {filterClubName ?? "this club"}
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
          <Text style={styles.muted}>Sign in to see your session history.</Text>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎱</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Visit a club to start your first game!</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  pad: { padding: layout.screenPadding, paddingBottom: spacing[10] },
  header: { paddingHorizontal: layout.screenPadding, paddingTop: spacing[2], paddingBottom: spacing[2] },
  title: { ...typography.heading3, color: colors.text.primary },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: spacing[2],
    backgroundColor: colors.bg.secondary,
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
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
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
  pillMuted: { backgroundColor: colors.bg.tertiary },
  pillNeutral: { backgroundColor: colors.bg.tertiary },
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
  payPill: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm, marginLeft: spacing[2] },
  payPillText: { ...typography.caption, fontWeight: "600" },
  payCash: { backgroundColor: colors.bg.tertiary },
  payUpi: { backgroundColor: "rgba(33, 150, 243, 0.2)" },
  payCard: { backgroundColor: "rgba(255, 193, 7, 0.15)" },
  payCredit: { backgroundColor: "rgba(245, 127, 23, 0.2)" },
  payResolved: { backgroundColor: colors.bg.tertiary },
  chevron: { ...typography.caption, color: colors.text.secondary, marginLeft: spacing[1] },
  breakdownPanel: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  divider: { height: 1, backgroundColor: colors.border.subtle, marginBottom: spacing[2] },
  dividerThin: { height: 1, backgroundColor: colors.border.subtle, marginVertical: spacing[2] },
  breakdownHeader: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[2] },
  sectionTitle: { ...typography.label, color: colors.text.primary, marginTop: spacing[1] },
  lineDetail: { ...typography.caption, color: colors.text.secondary, flex: 1, marginRight: spacing[2] },
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
  snackRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingLeft: spacing[2] },
  snackName: { ...typography.caption, color: colors.text.secondary, flex: 1, marginRight: spacing[2] },
  snackAmt: { ...typography.caption, color: colors.text.primary },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing[3],
    minHeight: 96,
    gap: spacing[2],
  },
  skeletonBar: { width: 4, borderRadius: 2, backgroundColor: colors.bg.tertiary },
  skeletonLineLg: { height: 14, borderRadius: 4, backgroundColor: colors.bg.tertiary, width: "70%" },
  skeletonLineMd: { height: 12, borderRadius: 4, backgroundColor: colors.bg.tertiary, width: "50%" },
  skeletonLineSm: { height: 12, borderRadius: 4, backgroundColor: colors.bg.tertiary, width: "40%" },
});
