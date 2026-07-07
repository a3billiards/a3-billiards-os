import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, typography, spacing, layout, radius, glass } from "@a3/ui/theme";
import { TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { useTranslation } from "@a3/i18n";
import { adminTabBarTotalInset } from "../../theme/adminShell";

type StatusFilter = "all" | "active" | "grace" | "frozen";

type ClubRow = {
  clubId: string;
  ownerId: string;
  name: string;
  address: string;
  subscriptionStatus: "active" | "grace" | "frozen";
  subscriptionExpiresAt: number;
  isDiscoverable: boolean;
  ownerName: string;
  ownerPhone: string | null;
  ownerFrozen: boolean;
  tableCount: number;
  createdAt: number;
};

function useDebounced<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 1).toUpperCase();
}

function StatusBadge({
  status,
  t,
}: {
  status: ClubRow["subscriptionStatus"];
  t: (key: string) => string;
}): React.JSX.Element {
  const cfg =
    status === "active"
      ? { label: t("adminApp.clubs.statusActive"), bg: colors.accent.green, fg: "#04210f" }
      : status === "grace"
        ? { label: t("adminApp.clubs.statusGrace"), bg: colors.accent.amber, fg: "#2b1a00" }
        : { label: t("adminApp.clubs.statusFrozen"), bg: colors.status.error, fg: colors.text.primary };
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusBadgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function ClubsScreenContent(): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fetchCursor, setFetchCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<ClubRow[]>([]);

  useEffect(() => {
    setFetchCursor(undefined);
    setRows([]);
  }, [debounced, statusFilter]);

  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const page = useQuery(api.admin.getAdminClubs, {
    searchText: debounced.trim() || undefined,
    statusFilter: statusArg,
    cursor: fetchCursor,
    limit: 20,
  });

  useEffect(() => {
    if (page === undefined) return;
    if (fetchCursor === undefined) {
      setRows(page.clubs as ClubRow[]);
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((r) => r.clubId));
        const add = (page.clubs as ClubRow[]).filter((c) => !ids.has(c.clubId));
        return [...prev, ...add];
      });
    }
  }, [page, fetchCursor]);

  const { refreshing, onRefresh } = usePullToRefresh(
    useCallback(() => {
      setFetchCursor(undefined);
      setRows([]);
    }, []),
  );

  const loadMore = useCallback(() => {
    if (!page?.nextCursor || rows.length === 0) return;
    if (fetchCursor !== undefined && page.nextCursor === fetchCursor) return;
    setFetchCursor(page.nextCursor);
  }, [page?.nextCursor, fetchCursor, rows.length]);

  const chips: { key: StatusFilter; label: string }[] = useMemo(
    () => [
      { key: "all", label: t("adminApp.clubs.filterAll") },
      { key: "active", label: t("adminApp.clubs.statusActive") },
      { key: "grace", label: t("adminApp.clubs.statusGrace") },
      { key: "frozen", label: t("adminApp.clubs.statusFrozen") },
    ],
    [t],
  );

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("adminApp.clubs.title")}</Text>
          <Text style={styles.subtitle}>
            {page ? t("adminApp.clubs.clubCount", { count: page.totalCount }) : "…"}
          </Text>
        </View>

        <View style={styles.searchRow}>
          <MaterialIcons
            name="search"
            size={22}
            color={colors.text.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("adminApp.clubs.searchPlaceholder")}
            placeholderTextColor={colors.text.secondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.text.secondary} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chipsRow}>
          {chips.map((c) => {
            const active = statusFilter === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setStatusFilter(c.key)}
                style={[styles.chip, active && styles.chipActive, styles.chipWrap]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {page === undefined && rows.length === 0 ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.clubId}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={glass.ctaBg}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              page && rows.length === 0 ? (
                <Text style={styles.empty}>{t("adminApp.clubs.empty")}</Text>
              ) : null
            }
            ListFooterComponent={
              page?.nextCursor ? (
                <ActivityIndicator
                  style={{ marginVertical: spacing[4] }}
                  color={glass.ctaBg}
                />
              ) : null
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: adminTabBarTotalInset(insets.bottom) },
            ]}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/user/${item.ownerId}`)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.address}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {t("adminApp.clubs.ownerLabel", { name: item.ownerName })}
                    {item.ownerFrozen ? ` · ${t("adminApp.clubs.ownerFrozenTag")}` : ""}
                  </Text>
                  <View style={styles.rowBadges}>
                    <StatusBadge status={item.subscriptionStatus} t={t} />
                    <Text style={styles.tableCount}>
                      {t("adminApp.clubs.tableCount", { count: item.tableCount })}
                    </Text>
                  </View>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={colors.text.tertiary}
                />
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  header: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing[2] },
  title: { ...typography.heading3, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
  },
  searchIcon: { marginRight: spacing[2] },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing[2],
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing[3],
  },
  chipWrap: { marginRight: spacing[2], marginBottom: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
  },
  chipActive: { backgroundColor: glass.ctaBg, borderColor: glass.ctaBg },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextActive: { color: glass.ctaText, fontWeight: "600" },
  listContent: { paddingHorizontal: layout.screenPadding },
  skeletonWrap: { paddingHorizontal: layout.screenPadding, gap: spacing[2] },
  skeletonRow: {
    height: 88,
    borderRadius: radius.md,
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing[3],
    marginBottom: spacing[2],
    borderRadius: radius.md,
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: glass.iconTileBg,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
  },
  avatarText: { ...typography.heading3, color: colors.text.primary },
  rowMain: { flex: 1, minWidth: 0, gap: 4 },
  rowName: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  rowMeta: { ...typography.caption, color: colors.text.secondary },
  rowBadges: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: 2 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  tableCount: { ...typography.caption, color: colors.text.tertiary },
  empty: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[8],
  },
});

export default function ClubsScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.clubs")}>
      <ClubsScreenContent />
    </TabErrorBoundary>
  );
}
