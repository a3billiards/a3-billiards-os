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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";

type RoleFilter = "all" | "admin" | "owner" | "customer";

type UserRow = {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "owner" | "customer";
  isFrozen: boolean;
  phoneVerified: boolean;
  complaintCount: number;
  deletionRequested: boolean;
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

function RoleBadge({ role }: { role: UserRow["role"] }): React.JSX.Element {
  const cfg =
    role === "admin"
      ? { label: "Admin", bg: colors.status.info, fg: colors.text.primary }
      : role === "owner"
        ? { label: "Owner", bg: colors.accent.amber, fg: colors.text.primary }
        : { label: "Customer", bg: colors.bg.tertiary, fg: colors.text.secondary };
  return (
    <View style={[styles.roleBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.roleBadgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

export default function UsersScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [fetchCursor, setFetchCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<UserRow[]>([]);

  useEffect(() => {
    const r = params.role;
    if (r === "admin" || r === "owner" || r === "customer") {
      setRoleFilter(r);
    }
  }, [params.role]);

  useEffect(() => {
    setFetchCursor(undefined);
    setRows([]);
  }, [debounced, roleFilter]);

  const roleArg =
    roleFilter === "all"
      ? undefined
      : (roleFilter as "admin" | "owner" | "customer");

  const page = useQuery(api.users.searchUsers, {
    searchText: debounced.trim() || undefined,
    roleFilter: roleArg,
    cursor: fetchCursor,
    limit: 20,
  });

  useEffect(() => {
    if (page === undefined) return;
    if (fetchCursor === undefined) {
      setRows(page.users as UserRow[]);
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((r) => r._id));
        const add = (page.users as UserRow[]).filter((u) => !ids.has(u._id));
        return [...prev, ...add];
      });
    }
  }, [page, fetchCursor]);

  const onRefresh = useCallback(() => {
    setFetchCursor(undefined);
  }, []);

  const loadMore = useCallback(() => {
    if (!page?.nextCursor || rows.length === 0) return;
    if (fetchCursor !== undefined && page.nextCursor === fetchCursor) return;
    setFetchCursor(page.nextCursor);
  }, [page?.nextCursor, fetchCursor, rows.length]);

  const chips: { key: RoleFilter; label: string }[] = useMemo(
    () => [
      { key: "all", label: "All" },
      { key: "customer", label: "Customers" },
      { key: "owner", label: "Owners" },
      { key: "admin", label: "Admins" },
    ],
    [],
  );

  const subtitle = page?.resultCapped
    ? "Showing first 200 results. Use search to narrow down."
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.subtitle}>
          {page ? `${page.totalCount} users` : "…"}
        </Text>
        {subtitle ? <Text style={styles.capped}>{subtitle}</Text> : null}
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
          placeholder="Search by name, phone, or email..."
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
          const active = roleFilter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setRoleFilter(c.key)}
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
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={colors.accent.green}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            page && rows.length === 0 ? (
              <Text style={styles.empty}>
                No users found matching your search.
              </Text>
            ) : null
          }
          ListFooterComponent={
            page?.nextCursor ? (
              <ActivityIndicator
                style={{ marginVertical: spacing[4] }}
                color={colors.accent.green}
              />
            ) : null
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/user/${item._id}`)}
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
                  {item.email ?? item.phone ?? "—"}
                </Text>
                <RoleBadge role={item.role} />
              </View>
              <View style={styles.rowRight}>
                {item.isFrozen ? (
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color={colors.status.error}
                  />
                ) : null}
                {item.deletionRequested ? (
                  <View style={styles.pendingDel}>
                    <Text style={styles.pendingDelText}>Pending deletion</Text>
                  </View>
                ) : null}
                {item.complaintCount > 0 ? (
                  <View style={styles.complaintBadge}>
                    <Text style={styles.complaintBadgeText}>
                      ⚠ {item.complaintCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing[2] },
  title: { ...typography.heading3, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  capped: {
    ...typography.caption,
    color: colors.accent.amber,
    marginTop: spacing[2],
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
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
    backgroundColor: colors.bg.secondary,
  },
  chipActive: { backgroundColor: colors.accent.green },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextActive: { color: colors.text.primary, fontWeight: "600" },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[10],
  },
  skeletonWrap: { paddingHorizontal: layout.screenPadding, gap: spacing[2] },
  skeletonRow: {
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing[3],
    marginBottom: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
  },
  avatarText: { ...typography.heading3, color: colors.text.primary },
  rowMain: { flex: 1, minWidth: 0, gap: 4 },
  rowName: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  rowMeta: { ...typography.caption, color: colors.text.secondary },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "600" },
  rowRight: { alignItems: "flex-end", gap: 6, marginLeft: spacing[2] },
  pendingDel: {
    backgroundColor: "rgba(245, 127, 23, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingDelText: { fontSize: 10, color: colors.accent.amber },
  complaintBadge: {
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  complaintBadgeText: { fontSize: 10, color: colors.status.error },
  empty: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[8],
  },
});
