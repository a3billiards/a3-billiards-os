import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius, glass } from "@a3/ui/theme";
import { GlassPageBackground, LiquidGlassCard } from "@a3/ui/components";

type BookingRow = {
  bookingId: Id<"bookings">;
  customerId: Id<"users">;
  customerName: string;
  customerPhone: string | null;
  clubId: Id<"clubs">;
  clubName: string;
  tableType: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedDurationMin: number;
  estimatedCost: number | null;
  currency: string;
  notes: string | null;
  createdAt: number;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function formatSubmitted(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export default function PendingBookingsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useQuery(api.users.getCurrentUser, {});
  const canQuery =
    user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const page = useQuery(
    api.admin.getAdminPendingBookings,
    canQuery ? { cursor, limit: 30 } : "skip",
  );

  useEffect(() => {
    if (!page) return;
    if (cursor === undefined) {
      setRows(page.bookings as BookingRow[]);
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((r) => r.bookingId));
        const merged = [...prev];
        for (const row of page.bookings as BookingRow[]) {
          if (!ids.has(row.bookingId)) merged.push(row);
        }
        return merged;
      });
    }
    setNextCursor(page.nextCursor);
    setTotalCount(page.totalCount);
    setLoadingMore(false);
  }, [page, cursor]);

  const onRefresh = useCallback(() => {
    setCursor(undefined);
    setRows([]);
    setNextCursor(null);
  }, []);

  const onEndReached = useCallback(() => {
    if (!nextCursor || loadingMore || !canQuery) return;
    setLoadingMore(true);
    setCursor(nextCursor);
  }, [nextCursor, loadingMore, canQuery]);

  const bottomPad = Math.max(insets.bottom, spacing[4]);

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Pending Bookings</Text>
            <Text style={styles.subtitle}>
              {canQuery && page !== undefined
                ? `${totalCount} booking${totalCount === 1 ? "" : "s"} awaiting club approval`
                : "Awaiting owner approval across all clubs"}
            </Text>
          </View>
          <Pressable
            onPress={onRefresh}
            hitSlop={12}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Refresh pending bookings"
          >
            <MaterialIcons name="refresh" size={20} color={glass.accentBlue} />
          </Pressable>
        </View>

        {!canQuery || page === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent.green} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="event-available" size={40} color={glass.textMuted} />
            <Text style={styles.emptyTitle}>No pending bookings</Text>
            <Text style={styles.emptyBody}>
              Customer booking requests waiting for club approval will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.bookingId}
            contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: spacing[4] }}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  style={{ marginVertical: spacing[4] }}
                  color={colors.accent.green}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <LiquidGlassCard style={styles.card} padding={16}>
                <View style={styles.badgeRow}>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending approval</Text>
                  </View>
                  <Text style={styles.submitted}>Submitted {formatSubmitted(item.createdAt)}</Text>
                </View>
                <Text style={styles.clubName}>{item.clubName}</Text>
                <Text style={styles.slot}>
                  {item.requestedDate} · {item.requestedStartTime} · {item.requestedDurationMin} min
                </Text>
                <Text style={styles.meta}>
                  {item.tableType}
                  {item.estimatedCost != null
                    ? ` · Est. ${formatMoney(item.estimatedCost, item.currency)}`
                    : ""}
                </Text>
                {item.notes ? <Text style={styles.notes}>“{item.notes}”</Text> : null}
                <Pressable
                  onPress={() => router.push(`/user/${item.customerId}`)}
                  style={({ pressed }) => [styles.customerRow, pressed && { opacity: 0.75 }]}
                >
                  <MaterialIcons name="person" size={18} color={glass.accentBlue} />
                  <View style={styles.customerText}>
                    <Text style={styles.customerName}>{item.customerName}</Text>
                    {item.customerPhone ? (
                      <Text style={styles.customerPhone}>{item.customerPhone}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={glass.textMuted} />
                </Pressable>
              </LiquidGlassCard>
            )}
          />
        )}
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  backBtn: { marginTop: 2 },
  headerText: { flex: 1 },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: glass.textMuted,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: glass.inputBg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  emptyTitle: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: glass.textMuted,
    textAlign: "center",
  },
  card: { marginBottom: spacing[3] },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.accent.amber,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.primary,
  },
  submitted: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    color: glass.textMuted,
  },
  clubName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  slot: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent.amberLight,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: glass.textMuted,
  },
  notes: {
    marginTop: spacing[2],
    fontSize: 13,
    fontStyle: "italic",
    color: colors.text.secondary,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: glass.cardBorder,
  },
  customerText: { flex: 1 },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  customerPhone: {
    marginTop: 2,
    fontSize: 12,
    color: glass.textMuted,
  },
});
