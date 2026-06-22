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

type SessionRow = {
  sessionId: Id<"sessions">;
  customerId: Id<"users"> | null;
  customerName: string;
  customerPhone: string | null;
  isGuest: boolean;
  clubId: Id<"clubs">;
  clubName: string;
  tableLabel: string;
  startTime: number;
  currency: string;
};

function elapsedLabel(startMs: number): string {
  const m = Math.floor((Date.now() - startMs) / 60000);
  if (m < 1) return "Just started";
  if (m < 60) return `${m} min running`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min running`;
}

function formatStarted(startMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startMs));
}

export default function ActiveSessionsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useQuery(api.users.getCurrentUser, {});
  const canQuery =
    user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const page = useQuery(
    api.admin.getAdminActiveSessions,
    canQuery ? { cursor, limit: 30 } : "skip",
  );

  useEffect(() => {
    if (!page) return;
    if (cursor === undefined) {
      setRows(page.sessions as SessionRow[]);
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((r) => r.sessionId));
        const merged = [...prev];
        for (const row of page.sessions as SessionRow[]) {
          if (!ids.has(row.sessionId)) merged.push(row);
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
            <Text style={styles.title}>Active Sessions</Text>
            <Text style={styles.subtitle}>
              {canQuery && page !== undefined
                ? `${totalCount} session${totalCount === 1 ? "" : "s"} running platform-wide`
                : "Live sessions across all clubs"}
            </Text>
          </View>
          <Pressable
            onPress={onRefresh}
            hitSlop={12}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Refresh active sessions"
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
            <MaterialIcons name="play-circle-outline" size={40} color={glass.textMuted} />
            <Text style={styles.emptyTitle}>No active sessions</Text>
            <Text style={styles.emptyBody}>
              When customers are playing at any club, their sessions will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.sessionId}
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
                <View style={styles.cardTop}>
                  <View style={styles.liveDot} />
                  <Text style={styles.elapsed}>{elapsedLabel(item.startTime)}</Text>
                </View>
                <Text style={styles.clubName}>{item.clubName}</Text>
                <Text style={styles.meta}>
                  {item.tableLabel} · Started {formatStarted(item.startTime)}
                </Text>
                {item.isGuest || item.customerId === null ? (
                  <View style={styles.customerRow}>
                    <MaterialIcons name="person-outline" size={18} color={glass.textMuted} />
                    <View style={styles.customerText}>
                      <Text style={styles.customerName}>{item.customerName}</Text>
                      <Text style={styles.customerPhone}>Guest session</Text>
                    </View>
                  </View>
                ) : (
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
                )}
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
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  elapsed: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.status.success,
  },
  clubName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: glass.textMuted,
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
