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
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useAction, useMutation } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, typography, spacing, layout, radius, glass } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { shareCsvExport } from "@a3/ui/shareJson";
import { useTranslation } from "@a3/i18n";
import { adminTabBarTotalInset } from "../../theme/adminShell";

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
  clubName: string | null;
  subscriptionStatus: "active" | "grace" | "frozen" | null;
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

function RoleBadge({
  role,
  t,
}: {
  role: UserRow["role"];
  t: (key: string) => string;
}): React.JSX.Element {
  const cfg =
    role === "admin"
      ? { label: t("adminApp.roles.admin"), bg: colors.status.info, fg: colors.text.primary }
      : role === "owner"
        ? { label: t("adminApp.roles.owner"), bg: colors.accent.amber, fg: colors.text.primary }
        : { label: t("adminApp.roles.customer"), bg: glass.inputBg, fg: colors.text.secondary };
  return (
    <View style={[styles.roleBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.roleBadgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function UsersScreenContent(): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; activeClubs?: string }>();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [fetchCursor, setFetchCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [exporting, setExporting] = useState(false);
  const exportAllUsers = useAction(api.dataExportActions.adminExportAllUsersData);
  const sendResetEmail = useAction(api.usersAdminActions.adminResetUserPassword);
  const cancelDeletion = useMutation(api.users.adminCancelDeletion);

  const onSendResetPassword = useCallback(
    (item: UserRow) => {
      if (item.role === "admin") return;
      if (!item.email) {
        Alert.alert(
          t("adminApp.userProfile.resetPasswordTitle"),
          t("adminApp.users.resetPasswordNoEmailHint"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("adminApp.users.openProfile"),
              onPress: () => router.push(`/user/${item._id}`),
            },
          ],
        );
        return;
      }
      Alert.alert(
        t("adminApp.userProfile.resetPasswordTitle"),
        t("adminApp.userProfile.resetPasswordMessage", { email: item.email }),
        [
          { text: t("adminApp.userProfile.cancel"), style: "cancel" },
          {
            text: t("adminApp.userProfile.send"),
            onPress: () => {
              void (async () => {
                try {
                  await sendResetEmail({ userId: item._id as Id<"users"> });
                  Alert.alert(
                    t("adminApp.userProfile.done"),
                    t("adminApp.userProfile.passwordResetSent"),
                  );
                } catch (e) {
                  Alert.alert(
                    t("auth.admin.mfa.errorLabel"),
                    parseConvexError(e as Error).message,
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [router, sendResetEmail, t],
  );

  const onCancelDeletion = useCallback(
    (item: UserRow) => {
      Alert.alert(
        t("adminApp.userProfile.cancelDeletionTitle"),
        t("adminApp.userProfile.cancelDeletionMessage", { name: item.name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("adminApp.userProfile.cancelDeletion"),
            onPress: () => {
              void (async () => {
                try {
                  await cancelDeletion({ userId: item._id as Id<"users"> });
                  Alert.alert(
                    t("adminApp.userProfile.done"),
                    t("adminApp.userProfile.deletionCancelled"),
                  );
                } catch (e) {
                  Alert.alert(
                    t("auth.admin.mfa.errorLabel"),
                    parseConvexError(e as Error).message,
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [cancelDeletion, t],
  );

  useEffect(() => {
    const r = params.role;
    if (r === "admin" || r === "owner" || r === "customer") {
      setRoleFilter(r);
    }
  }, [params.role]);

  const activeClubsOnly = params.activeClubs === "1";

  useEffect(() => {
    setFetchCursor(undefined);
    setRows([]);
  }, [debounced, roleFilter, activeClubsOnly]);

  const roleArg =
    roleFilter === "all"
      ? undefined
      : (roleFilter as "admin" | "owner" | "customer");

  const page = useQuery(api.users.searchUsers, {
    searchText: debounced.trim() || undefined,
    roleFilter: roleArg,
    cursor: fetchCursor,
    limit: 20,
    activeClubsOnly: activeClubsOnly || undefined,
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

  const { refreshing, onRefresh } = usePullToRefresh(useCallback(() => {
    setFetchCursor(undefined);
  }, []));

  const loadMore = useCallback(() => {
    if (!page?.nextCursor || rows.length === 0) return;
    if (fetchCursor !== undefined && page.nextCursor === fetchCursor) return;
    setFetchCursor(page.nextCursor);
  }, [page?.nextCursor, fetchCursor, rows.length]);

  const chips: { key: RoleFilter; label: string }[] = useMemo(
    () => [
      { key: "all", label: t("adminApp.users.filterAll") },
      { key: "customer", label: t("adminApp.users.filterCustomers") },
      { key: "owner", label: t("adminApp.users.filterOwners") },
      { key: "admin", label: t("adminApp.users.filterAdmins") },
    ],
    [t],
  );

  const subtitle = page?.resultCapped ? t("adminApp.users.capped") : null;

  const onExportAll = useCallback(() => {
    Alert.alert(t("adminApp.users.exportConfirmTitle"), t("adminApp.users.exportConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("adminApp.users.exportDownload"),
        onPress: () => {
          void (async () => {
            setExporting(true);
            try {
              const roleArg =
                roleFilter === "all"
                  ? undefined
                  : (roleFilter as "admin" | "owner" | "customer");
              const data = await exportAllUsers({ roleFilter: roleArg });
              await shareCsvExport(data.filename, data.csv);
              if (data.truncated) {
                Alert.alert(
                  t("adminApp.users.exportTruncatedTitle"),
                  t("adminApp.users.exportTruncatedBody", { count: data.userCount }),
                );
              }
            } catch (e) {
              Alert.alert(
                t("adminApp.users.exportFailed"),
                parseConvexError(e as Error).message,
              );
            } finally {
              setExporting(false);
            }
          })();
        },
      },
    ]);
  }, [exportAllUsers, roleFilter, t]);

  return (
    <GlassPageBackground>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("adminApp.users.title")}</Text>
            <Text style={styles.subtitle}>
              {page ? t("adminApp.users.userCount", { count: page.totalCount }) : "…"}
            </Text>
            {subtitle ? <Text style={styles.capped}>{subtitle}</Text> : null}
          </View>
          <Pressable
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={onExportAll}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <MaterialIcons name="download" size={20} color={colors.text.primary} />
            )}
            <Text style={styles.exportBtnText}>{t("adminApp.users.exportAll")}</Text>
          </Pressable>
        </View>
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
          placeholder={t("adminApp.users.searchPlaceholder")}
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
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={glass.ctaBg}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            page && rows.length === 0 ? (
              <Text style={styles.empty}>{t("adminApp.users.empty")}</Text>
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
          renderItem={({ item }) => {
            const showClubName = activeClubsOnly && item.clubName;
            const primaryLabel = showClubName ? item.clubName! : item.name;
            const secondaryLabel = showClubName
              ? item.name
              : (item.email ?? item.phone ?? "—");
            return (
            <Pressable
              onPress={() => router.push(`/user/${item._id}`)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(primaryLabel)}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {primaryLabel}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {secondaryLabel}
                </Text>
                <RoleBadge role={item.role} t={t} />
              </View>
              <View style={styles.rowRight}>
                {item.role !== "admin" ? (
                  <Pressable
                    onPress={() => onSendResetPassword(item)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t("adminApp.userProfile.resetPassword")}
                  >
                    <MaterialIcons
                      name="mail-outline"
                      size={20}
                      color={item.email ? glass.accentBlue : colors.text.secondary}
                    />
                  </Pressable>
                ) : null}
                {item.isFrozen ? (
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color={colors.status.error}
                  />
                ) : null}
                {item.deletionRequested ? (
                  <Pressable
                    onPress={() => onCancelDeletion(item)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t("adminApp.userProfile.cancelDeletion")}
                  >
                    <MaterialIcons
                      name="undo"
                      size={20}
                      color={colors.accent.green}
                    />
                  </Pressable>
                ) : null}
                {item.deletionRequested ? (
                  <View style={styles.pendingDel}>
                    <Text style={styles.pendingDelText}>{t("adminApp.users.pendingDeletion")}</Text>
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
            );
          }}
        />
      )}
    </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  header: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing[2] },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    minHeight: layout.touchTarget,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: "600",
  },
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
  listContent: {
    paddingHorizontal: layout.screenPadding,
  },
  skeletonWrap: { paddingHorizontal: layout.screenPadding, gap: spacing[2] },
  skeletonRow: {
    height: 72,
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
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "600" },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: spacing[2],
  },
  resetBtn: {
    padding: spacing[1],
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
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

export default function UsersScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.users")}>
      <UsersScreenContent />
    </TabErrorBoundary>
  );
}
