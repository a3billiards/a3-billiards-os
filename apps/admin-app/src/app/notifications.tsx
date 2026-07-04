import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useAction } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, layout, radius, zIndex, iosKeyboardAvoidingProps } from "@a3/ui/theme";
import { adminTabBarTotalInset } from "../theme/adminShell";
import { parseConvexError } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";

type MainTab = "compose" | "history";

type TargetMode =
  | { kind: "all" }
  | { kind: "role"; role: "owner" | "customer" }
  | { kind: "selected"; ids: Id<"users">[] };

type SearchUserRow = {
  _id: Id<"users">;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "owner" | "customer";
  isFrozen: boolean;
  hasPushToken: boolean;
};

type HistoryRow = {
  _id: Id<"adminNotifications">;
  title: string;
  body: string;
  targetType: "all" | "role" | "selected";
  targetRole: "owner" | "customer" | null;
  targetUserIds: Id<"users">[] | null;
  sentByName: string;
  createdAt: number;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  deliveryStatus: Record<string, "sent" | "delivered" | "failed">;
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

function formatRelativeTime(
  ts: number,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return tr("adminApp.notifications.timeJustNow");
  if (min < 60) return tr("adminApp.notifications.timeMinutesAgo", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return tr("adminApp.notifications.timeHoursAgo", { count: hr });
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startMsg = new Date(ts);
  startMsg.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startToday.getTime() - startMsg.getTime()) / 86400000,
  );
  if (dayDiff === 1) return tr("adminApp.notifications.yesterday");
  if (dayDiff < 7)
    return tr("adminApp.notifications.timeDaysAgo", { count: dayDiff });
  return new Date(ts).toLocaleDateString(getCurrentLanguage());
}

function formatResetClock(resetsAt: number): string {
  return new Date(resetsAt).toLocaleTimeString(getCurrentLanguage(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function targetDescription(
  mode: TargetMode,
  selectedCount: number,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (mode.kind === "all") return tr("adminApp.notifications.targetAllUsersShort");
  if (mode.kind === "role" && mode.role === "owner")
    return tr("adminApp.notifications.targetAllOwnersShort");
  if (mode.kind === "role" && mode.role === "customer")
    return tr("adminApp.notifications.targetAllCustomersShort");
  return tr("adminApp.notifications.targetSelected", { count: selectedCount });
}

function RoleMini({
  role,
  tr,
}: {
  role: "admin" | "owner" | "customer";
  tr: (key: string) => string;
}): React.JSX.Element {
  const cfg =
    role === "admin"
      ? { label: tr("adminApp.roles.admin"), bg: colors.status.info }
      : role === "owner"
        ? { label: tr("adminApp.roles.owner"), bg: colors.accent.amber }
        : { label: tr("adminApp.roles.customer"), bg: colors.bg.tertiary };
  return (
    <View style={[styles.roleMini, { backgroundColor: cfg.bg }]}>
      <Text style={styles.roleMiniText}>{cfg.label}</Text>
    </View>
  );
}

function TargetPill({
  row,
  tr,
}: {
  row: HistoryRow;
  tr: (key: string, opts?: Record<string, unknown>) => string;
}): React.JSX.Element {
  if (row.targetType === "all") {
    return (
      <View style={[styles.pill, { backgroundColor: colors.status.disabled }]}>
        <Text style={styles.pillTextDark}>{tr("adminApp.notifications.targetAllUsersShort")}</Text>
      </View>
    );
  }
  if (row.targetType === "role" && row.targetRole === "owner") {
    return (
      <View style={[styles.pill, { backgroundColor: colors.accent.amber }]}>
        <Text style={styles.pillTextDark}>{tr("adminApp.notifications.targetAllOwnersShort")}</Text>
      </View>
    );
  }
  if (row.targetType === "role" && row.targetRole === "customer") {
    return (
      <View style={[styles.pill, { backgroundColor: colors.status.info }]}>
        <Text style={styles.pillTextDark}>{tr("adminApp.notifications.targetAllCustomersShort")}</Text>
      </View>
    );
  }
  const n = row.targetUserIds?.length ?? row.totalRecipients;
  return (
    <View style={[styles.pill, { backgroundColor: "#26A69A" }]}>
      <Text style={styles.pillTextDark}>
        {tr("adminApp.notifications.targetSelected", { count: n })}
      </Text>
    </View>
  );
}

function HistoryCard({
  row,
  expanded,
  onToggle,
  tr,
}: {
  row: HistoryRow;
  expanded: boolean;
  onToggle: () => void;
  tr: (key: string, opts?: Record<string, unknown>) => string;
}): React.JSX.Element {
  const [showFullBody, setShowFullBody] = useState(false);
  const breakdown = useQuery(
    api.notifications.getNotificationRecipientBreakdown,
    expanded ? { notificationId: row._id } : "skip",
  );

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.historyCard,
        pressed && expanded && { opacity: 0.96 },
      ]}
    >
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.historyWhen}>{formatRelativeTime(row.createdAt, tr)}</Text>
      </View>
      <Text
        style={styles.historyBody}
        numberOfLines={showFullBody ? undefined : 2}
      >
        {row.body}
      </Text>
      {row.body.split("\n").length > 2 || row.body.length > 120 ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            setShowFullBody((s) => !s);
          }}
          hitSlop={8}
        >
          <Text style={styles.showMore}>{showFullBody ? tr("adminApp.notifications.showLess") : tr("adminApp.notifications.showMore")}</Text>
        </Pressable>
      ) : null}
      <View style={styles.pillRow}>
        <TargetPill row={row} tr={tr} />
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.statOk}>
          {tr("adminApp.notifications.historyDelivered", { count: row.sentCount })}
        </Text>
        {row.failedCount > 0 ? (
          <Text style={styles.statBad}>{tr("adminApp.notifications.historyFailed", { count: row.failedCount })}</Text>
        ) : null}
        <Text style={styles.statMuted}>{tr("adminApp.notifications.historyTotal", { count: row.totalRecipients })}</Text>
      </View>
      <Text style={styles.sentBySmall}>{tr("adminApp.notifications.sentBy", { name: row.sentByName })}</Text>
      {expanded ? (
        <View style={styles.expandPanel}>
          {breakdown === undefined ? (
            <ActivityIndicator color={colors.accent.green} />
          ) : breakdown === null ? (
            <Text style={styles.statMuted}>{tr("adminApp.notifications.unableLoadRecipients")}</Text>
          ) : (
            <>
              <Text style={styles.expandHeading}>{tr("adminApp.notifications.expandDelivered")}</Text>
              {breakdown.delivered.map((r) => (
                <Text key={r.userId} style={styles.expandName}>
                  {r.name}
                </Text>
              ))}
              {breakdown.moreDelivered > 0 ? (
                <Text style={styles.moreHint}>
                  {tr("adminApp.notifications.moreRecipients", { count: breakdown.moreDelivered })}
                </Text>
              ) : null}
              <Text style={[styles.expandHeading, { marginTop: spacing[3] }]}>
                {tr("adminApp.notifications.expandFailed")}
              </Text>
              {breakdown.failed.map((r) => (
                <Text key={r.userId} style={styles.expandName}>
                  {r.name}
                  <Text style={styles.tokenInvalid}>{tr("adminApp.notifications.tokenInvalid")}</Text>
                </Text>
              ))}
              {breakdown.moreFailed > 0 ? (
                <Text style={styles.moreHint}>{tr("adminApp.notifications.moreRecipients", { count: breakdown.moreFailed })}</Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function NotificationCenterScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const insets = useSafeAreaInsets();
  const tabBarBottomPad = adminTabBarTotalInset(insets.bottom);
  const user = useQuery(api.users.getCurrentUser, {});
  const adminId = user?._id;
  const canQuery = user?.role === "admin";

  const [mainTab, setMainTab] = useState<MainTab>("compose");
  const [target, setTarget] = useState<TargetMode>({ kind: "all" });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [composeRateError, setComposeRateError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  const [histCursor, setHistCursor] = useState<string | undefined>(undefined);
  const [histRows, setHistRows] = useState<HistoryRow[]>([]);
  const [expandedId, setExpandedId] = useState<Id<"adminNotifications"> | null>(
    null,
  );
  const [selectedNames, setSelectedNames] = useState<
    Partial<Record<Id<"users">, string>>
  >({});

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const recipientArgs = useMemo(() => {
    if (target.kind === "all") {
      return { targetType: "all" as const };
    }
    if (target.kind === "role") {
      return { targetType: "role" as const, targetRole: target.role };
    }
    return {
      targetType: "selected" as const,
      targetUserIds: target.ids,
    };
  }, [target]);

  const recipientPreview = useQuery(
    api.notifications.getRecipientCount,
    canQuery ? recipientArgs : "skip",
  );

  const rate = useQuery(
    api.notifications.checkBroadcastRateLimit,
    canQuery && adminId ? { adminId } : "skip",
  );

  const searchPage = useQuery(
    api.users.searchUsers,
    canQuery && target.kind === "selected" && debouncedSearch.trim().length > 0
      ? { searchText: debouncedSearch.trim(), limit: 20 }
      : canQuery && target.kind === "selected"
        ? { searchText: undefined, limit: 20 }
        : "skip",
  );

  const histPage = useQuery(
    api.notifications.getAdminNotificationHistory,
    canQuery && mainTab === "history"
      ? { cursor: histCursor, limit: 20 }
      : "skip",
  );

  useEffect(() => {
    if (histPage === undefined) return;
    if (histCursor === undefined) {
      setHistRows(histPage.notifications as HistoryRow[]);
    } else {
      setHistRows((prev) => {
        const ids = new Set(prev.map((r) => r._id));
        const add = (histPage.notifications as HistoryRow[]).filter(
          (r) => !ids.has(r._id),
        );
        return [...prev, ...add];
      });
    }
  }, [histPage, histCursor]);

  useEffect(() => {
    setHistCursor(undefined);
    setHistRows([]);
    setExpandedId(null);
  }, [mainTab]);

  const sendBroadcast = useAction(api.notificationsActions.sendAdminBroadcast);

  const titleTrim = title.trim();
  const bodyTrim = body.trim();
  const selectedIds = target.kind === "selected" ? target.ids : [];

  const recipientCount = recipientPreview?.withPushEnabled ?? recipientPreview?.count ?? 0;
  const matchingUsers = recipientPreview?.matchingUsers ?? 0;
  const recipientLoading = recipientPreview === undefined && canQuery;

  const rateAllowed = rate?.allowed !== false;
  const resetsAt = rate?.resetsAt ?? 0;
  const minutesLeft = Math.max(0, Math.ceil((resetsAt - tick) / 60_000));

  const canSend =
    titleTrim.length > 0 &&
    bodyTrim.length > 0 &&
    rateAllowed &&
    recipientCount > 0 &&
    (target.kind !== "selected" || selectedIds.length > 0);

  const openConfirm = useCallback(() => {
    setSheetError(null);
    setConfirmOpen(true);
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setBody("");
    setSelectedNames({});
    setTarget({ kind: "all" });
    setSearch("");
  }, []);

  const onConfirmSend = useCallback(async () => {
    setSendLoading(true);
    setSheetError(null);
    try {
      const res = await sendBroadcast({
        title: titleTrim,
        body: bodyTrim,
        targetType:
          target.kind === "all"
            ? "all"
            : target.kind === "role"
              ? "role"
              : "selected",
        targetRole: target.kind === "role" ? target.role : undefined,
        targetUserIds: target.kind === "selected" ? target.ids : undefined,
      });
      setConfirmOpen(false);
      resetForm();
      if (res.sentCount === 0 && res.recipientCount > 0) {
        Alert.alert(
          t("adminApp.notifications.savedNoPushTitle"),
          t("adminApp.notifications.savedNoPushBody", { count: res.recipientCount }),
        );
      } else {
        Alert.alert(
          t("adminApp.notifications.sentTitle"),
          t("adminApp.notifications.sentBody", {
            recipients: res.recipientCount,
            devices: res.sentCount,
            count: res.sentCount,
          }),
        );
      }
    } catch (e) {
      const parsed = parseConvexError(e as Error);
      const msg = parsed.message;
      if (parsed.code === "RATE_001" || msg.includes("RATE_001")) {
        setConfirmOpen(false);
        setComposeRateError(msg.replace(/^RATE_001:\s*/i, ""));
      } else if (parsed.code === "PUSH_001" || msg.includes("PUSH_001")) {
        setConfirmOpen(false);
        setSheetError(
          msg.replace(/^PUSH_001:\s*/i, "") || t("adminApp.notifications.pushNotConfigured"),
        );
      } else {
        setSheetError(msg || t("adminApp.notifications.sendFailed"));
      }
    } finally {
      setSendLoading(false);
    }
  }, [
    sendBroadcast,
    titleTrim,
    bodyTrim,
    target,
    resetForm,
  ]);

  const loadMoreHistory = useCallback(() => {
    if (!histPage?.nextCursor || histRows.length === 0) return;
    if (histCursor !== undefined && histPage.nextCursor === histCursor) return;
    setHistCursor(histPage.nextCursor);
  }, [histPage?.nextCursor, histCursor, histRows.length]);

  const toggleUser = useCallback((id: Id<"users">, name?: string) => {
    setTarget((prev) => {
      if (prev.kind !== "selected") return prev;
      const has = prev.ids.includes(id);
      if (has) {
        setSelectedNames((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
        return {
          kind: "selected",
          ids: prev.ids.filter((x) => x !== id),
        };
      }
      if (name) {
        setSelectedNames((m) => ({ ...m, [id]: name }));
      }
      return { kind: "selected", ids: [...prev.ids, id] };
    });
  }, []);

  const renderTargetCard = (
    key: string,
    icon: React.ReactNode,
    label: string,
    sub: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.targetCard,
        {
          borderColor: active ? colors.accent.green : colors.border.subtle,
          borderWidth: active ? 2 : 1,
          backgroundColor: colors.bg.secondary,
        },
      ]}
    >
      {active ? (
        <View style={styles.targetCheck}>
          <MaterialIcons name="check" size={14} color={colors.text.primary} />
        </View>
      ) : null}
      <View style={styles.targetCardInner}>
        <View style={styles.targetIconWrap}>{icon}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.targetTitle}>{label}</Text>
          <Text style={styles.targetSub} numberOfLines={2}>
            {sub}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} {...iosKeyboardAvoidingProps}>
        <View style={styles.topSection}>
          <View style={styles.hero}>
            <Text style={styles.screenTitle}>{t("adminApp.notifications.title")}</Text>
            <Text style={styles.screenSub}>{t("adminApp.notifications.subtitle")}</Text>
          </View>

          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setMainTab("compose")}
              style={[
                styles.tabBtn,
                mainTab === "compose" && styles.tabBtnOn,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  mainTab === "compose" && styles.tabBtnTextOn,
                ]}
              >
                {t("adminApp.notifications.tabCompose")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMainTab("history")}
              style={[
                styles.tabBtn,
                mainTab === "history" && styles.tabBtnOn,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  mainTab === "history" && styles.tabBtnTextOn,
                ]}
              >
                {t("adminApp.notifications.tabHistory")}
              </Text>
            </Pressable>
          </View>
        </View>

        {mainTab === "compose" ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.composeScroll,
              { paddingBottom: tabBarBottomPad },
            ]}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
              {rate && rate.allowed && rate.remainingCount < 10 ? (
                <View style={styles.rateInfo}>
                  <MaterialIcons
                    name="info"
                    size={18}
                    color={colors.accent.amber}
                  />
                  <Text style={styles.rateInfoText}>
                    {t("adminApp.notifications.rateRemaining", { remaining: rate.remainingCount, time: formatResetClock(rate.resetsAt) })}
                  </Text>
                </View>
              ) : null}
              {rate && !rate.allowed ? (
                <View style={styles.rateBlock}>
                  <Text style={styles.rateBlockText}>
                    {t("adminApp.notifications.rateBlocked", { count: minutesLeft, minutes: minutesLeft })}
                  </Text>
                </View>
              ) : null}
              {composeRateError ? (
                <View style={styles.rateBlock}>
                  <Text style={styles.rateBlockText}>{composeRateError}</Text>
                  <Pressable
                    onPress={() => setComposeRateError(null)}
                    style={styles.dismissErr}
                  >
                    <Text style={styles.dismissErrText}>{t("adminApp.notifications.dismiss")}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>
                  {t("adminApp.notifications.titleLabel")}<Text style={styles.req}>{t("adminApp.notifications.required")}</Text>
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t("adminApp.notifications.titlePlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  style={styles.input}
                  maxLength={100}
                />
                <Text style={styles.counter}>
                  {title.length}/100
                </Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>
                  {t("adminApp.notifications.messageLabel")}<Text style={styles.req}>{t("adminApp.notifications.required")}</Text>
                </Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder={t("adminApp.notifications.messagePlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  style={[styles.input, styles.textArea]}
                  maxLength={500}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.counter}>{body.length}/500</Text>
              </View>

              <Text style={styles.label}>{t("adminApp.notifications.sendTo")}</Text>
              <View style={styles.targetGrid}>
                {renderTargetCard(
                  "all",
                  <MaterialIcons name="campaign" size={22} color={colors.text.primary} />,
                  t("adminApp.notifications.targetAllUsers"),
                  t("adminApp.notifications.targetAllUsersSub"),
                  target.kind === "all",
                  () => setTarget({ kind: "all" }),
                )}
                {renderTargetCard(
                  "owners",
                  <MaterialIcons name="business" size={22} color={colors.text.primary} />,
                  t("adminApp.notifications.targetAllOwners"),
                  t("adminApp.notifications.targetAllOwnersSub"),
                  target.kind === "role" && target.role === "owner",
                  () => setTarget({ kind: "role", role: "owner" }),
                )}
                {renderTargetCard(
                  "customers",
                  <MaterialIcons name="groups" size={22} color={colors.text.primary} />,
                  t("adminApp.notifications.targetAllCustomers"),
                  t("adminApp.notifications.targetAllCustomersSub"),
                  target.kind === "role" && target.role === "customer",
                  () => setTarget({ kind: "role", role: "customer" }),
                )}
                {renderTargetCard(
                  "sel",
                  <MaterialIcons name="touch-app" size={22} color={colors.text.primary} />,
                  t("adminApp.notifications.targetSelectUsers"),
                  t("adminApp.notifications.targetSelectUsersSub"),
                  target.kind === "selected",
                  () => {
                    setSelectedNames({});
                    setTarget({ kind: "selected", ids: [] });
                  },
                )}
              </View>

              {target.kind === "selected" ? (
                <View style={styles.selectPanel}>
                  <Text style={styles.selectedCount}>
                    {t("adminApp.notifications.selectedCount", { count: selectedIds.length })}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                  >
                    {selectedIds.map((id) => {
                      const name = selectedNames[id] ?? t("adminApp.notifications.defaultUserName");
                      return (
                        <View key={id} style={styles.chip}>
                          <View style={styles.chipAv}>
                            <Text style={styles.chipAvText}>{initials(name)}</Text>
                          </View>
                          <Text style={styles.chipName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Pressable onPress={() => toggleUser(id)} hitSlop={8}>
                            <MaterialIcons
                              name="close"
                              size={18}
                              color={colors.text.secondary}
                            />
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.searchRow}>
                    <MaterialIcons
                      name="search"
                      size={22}
                      color={colors.text.secondary}
                      style={{ marginRight: spacing[2] }}
                    />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder={t("adminApp.notifications.searchPlaceholder")}
                      placeholderTextColor={colors.text.secondary}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {searchPage === undefined ? (
                    <ActivityIndicator
                      style={{ marginVertical: spacing[4] }}
                      color={colors.accent.green}
                    />
                  ) : (searchPage.users as SearchUserRow[]).length === 0 ? (
                    <Text style={styles.hitEmpty}>{t("adminApp.notifications.noMatches")}</Text>
                  ) : (
                    (searchPage.users as SearchUserRow[]).map((item) => {
                      const selected = selectedIds.includes(item._id);
                      return (
                        <Pressable
                          key={item._id}
                          onPress={() => toggleUser(item._id, item.name)}
                          style={[
                            styles.searchHit,
                            selected && { borderColor: colors.accent.green },
                          ]}
                        >
                          <View style={styles.hitAv}>
                            <Text style={styles.hitAvText}>
                              {initials(item.name)}
                            </Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.hitName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.hitMeta} numberOfLines={1}>
                              {item.email ?? item.phone ?? "—"}
                            </Text>
                            <View
                              style={{ flexDirection: "row", gap: 8, marginTop: 4 }}
                            >
                              <RoleMini role={item.role} tr={t} />
                              {item.isFrozen ? (
                                <Text style={styles.frozenBadge}>{t("adminApp.notifications.frozenBadge")}</Text>
                              ) : null}
                              {!item.hasPushToken ? (
                                <Text style={styles.noPushBadge}>{t("adminApp.notifications.noPushBadge")}</Text>
                              ) : null}
                            </View>
                          </View>
                          {selected ? (
                            <MaterialIcons
                              name="check-circle"
                              size={22}
                              color={colors.accent.green}
                            />
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}

              <View style={styles.previewRow}>
                {recipientLoading ? (
                  <ActivityIndicator size="small" color={colors.accent.green} />
                ) : (
                  <Text style={styles.previewText}>
                    {t("adminApp.notifications.recipientsPreview", { count: recipientCount })}
                  </Text>
                )}
              </View>
              {recipientCount === 0 && !recipientLoading && canQuery ? (
                <Text style={styles.warnZero}>
                  {matchingUsers > 0
                    ? t("adminApp.notifications.warnNoPush", { count: matchingUsers })
                    : t("adminApp.notifications.warnNoMatch")}
                </Text>
              ) : null}

              <Pressable
                onPress={openConfirm}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendBtn,
                  !canSend && styles.sendBtnOff,
                  pressed && canSend && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.sendBtnText}>{t("adminApp.notifications.sendNotification")}</Text>
              </Pressable>
          </ScrollView>
        ) : (
          <View style={styles.historyWrap}>
            {histPage === undefined && histRows.length === 0 ? (
              <View style={styles.skeletonWrap}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonCard} />
                ))}
              </View>
            ) : (
              <FlatList
                data={histRows}
                keyExtractor={(item) => item._id}
                contentContainerStyle={[
                  styles.historyList,
                  { paddingBottom: tabBarBottomPad },
                ]}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onEndReached={loadMoreHistory}
                onEndReachedThreshold={0.35}
                ListEmptyComponent={
                  histPage && histRows.length === 0 ? (
                    <Text style={styles.emptyHist}>
                      {t("adminApp.notifications.emptyHistory")}
                    </Text>
                  ) : null
                }
                ListFooterComponent={
                  histPage?.nextCursor ? (
                    <ActivityIndicator
                      style={{ marginVertical: spacing[4] }}
                      color={colors.accent.green}
                    />
                  ) : null
                }
                renderItem={({ item }) => (
                  <HistoryCard
                    row={item}
                    expanded={expandedId === item._id}
                    onToggle={() =>
                      setExpandedId((id) => (id === item._id ? null : item._id))
                    }
                    tr={t}
                  />
                )}
              />
            )}
          </View>
        )}

        <Modal
          visible={confirmOpen}
          transparent
          animationType="slide"
          onRequestClose={() => (!sendLoading ? setConfirmOpen(false) : null)}
        >
          <Pressable
            style={styles.sheetScrim}
            onPress={() => (!sendLoading ? setConfirmOpen(false) : null)}
          >
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>{t("adminApp.notifications.confirmTitle")}</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.sumLabel}>{t("adminApp.notifications.confirmTitleLabel")}</Text>
                <Text style={styles.sumVal}>{titleTrim}</Text>
                <Text style={[styles.sumLabel, { marginTop: spacing[2] }]}>
                  {t("adminApp.notifications.confirmMessageLabel")}
                </Text>
                <Text style={styles.sumVal} numberOfLines={3}>
                  {bodyTrim}
                </Text>
                <Text style={[styles.sumLabel, { marginTop: spacing[2] }]}>
                  {t("adminApp.notifications.confirmRecipientsLabel")}
                </Text>
                <Text style={styles.sumVal}>
                  {targetDescription(target, target.kind === "selected" ? selectedIds.length : 0, t)}{" "}
                  ({recipientCount})
                </Text>
              </View>
              {sheetError ? (
                <Text style={styles.sheetErr}>{sheetError}</Text>
              ) : null}
              <View style={styles.sheetActions}>
                <Pressable
                  disabled={sendLoading}
                  onPress={() => setConfirmOpen(false)}
                  style={[styles.sheetBtnSec, sendLoading && { opacity: 0.5 }]}
                >
                  <Text style={styles.sheetBtnSecText}>{t("adminApp.notifications.cancel")}</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmSend}
                  disabled={sendLoading}
                  style={styles.sheetBtnPri}
                >
                  {sendLoading ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <>
                      <MaterialIcons
                        name="send"
                        size={18}
                        color={colors.text.primary}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.sheetBtnPriText}>{t("adminApp.notifications.sendNow")}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  topSection: {
    paddingHorizontal: spacing[8],
    paddingTop: spacing[2],
  },
  composeScroll: {
    paddingHorizontal: spacing[8],
  },
  hero: {
    marginBottom: spacing[6],
    padding: spacing[6],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(71,85,105,0.35)",
    backgroundColor: colors.bg.secondary,
  },
  screenTitle: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  screenSub: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  tabBar: {
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[2],
    marginBottom: spacing[6],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(71,85,105,0.35)",
    backgroundColor: colors.bg.secondary,
  },
  tabBtn: {
    flex: 1,
    height: layout.buttonHeight - 2,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnOn: { backgroundColor: "rgba(71,85,105,0.55)" },
  tabBtnText: { ...typography.button, color: colors.text.secondary },
  tabBtnTextOn: { color: colors.text.primary },
  rateInfo: {
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[3],
    marginBottom: spacing[4],
    borderRadius: radius.md,
    backgroundColor: "rgba(245, 127, 23, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 127, 23, 0.35)",
  },
  rateInfoText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.accent.amberLight,
  },
  rateBlock: {
    padding: spacing[4],
    marginBottom: spacing[4],
    borderRadius: radius.md,
    backgroundColor: "rgba(244, 67, 54, 0.12)",
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  rateBlockText: { ...typography.body, color: colors.status.error },
  dismissErr: { marginTop: spacing[2], alignSelf: "flex-end" },
  dismissErrText: { ...typography.labelSmall, color: colors.text.secondary },
  fieldBlock: { marginBottom: spacing[6] },
  label: { ...typography.label, color: colors.text.primary, marginBottom: spacing[2] },
  req: { color: colors.status.error },
  input: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.bg.tertiary,
    ...typography.body,
    color: colors.text.primary,
  },
  textArea: { minHeight: 120 },
  counter: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
    textAlign: "right",
  },
  targetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  targetCard: {
    width: "48%",
    borderRadius: 24,
    padding: spacing[4],
    minHeight: 100,
  },
  targetCheck: {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
    zIndex: zIndex.card,
  },
  targetCardInner: { flexDirection: "row", gap: spacing[3], alignItems: "flex-start" },
  targetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  targetTitle: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: "700",
  },
  targetSub: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  selectPanel: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectedCount: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  chipsScroll: { gap: spacing[2], paddingBottom: spacing[2] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
    marginRight: spacing[2],
  },
  chipAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  chipAvText: { fontSize: 12, fontWeight: "700", color: colors.text.primary },
  chipName: {
    maxWidth: 120,
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing[3],
  },
  searchHit: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing[3],
    marginBottom: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.tertiary,
  },
  hitAv: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
  },
  hitAvText: { fontWeight: "700", color: colors.text.primary },
  hitName: { ...typography.label, color: colors.text.primary },
  hitMeta: { ...typography.caption, color: colors.text.secondary },
  hitEmpty: { ...typography.body, color: colors.text.secondary, padding: spacing[4] },
  frozenBadge: {
    ...typography.caption,
    color: colors.accent.amberLight,
    fontWeight: "600",
  },
  noPushBadge: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  roleMini: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleMiniText: { fontSize: 10, fontWeight: "600", color: colors.text.primary },
  previewRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[2],
  },
  previewText: { ...typography.body, color: colors.text.secondary },
  warnZero: {
    ...typography.bodySmall,
    color: colors.accent.amberLight,
    marginBottom: spacing[4],
  },
  sendBtn: {
    marginTop: spacing[2],
    height: layout.buttonHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnOff: { backgroundColor: colors.status.disabled },
  sendBtnText: { ...typography.button, color: colors.text.primary },
  historyWrap: { flex: 1, paddingHorizontal: spacing[8], minHeight: 0 },
  historyList: { gap: spacing[3] },
  skeletonWrap: { gap: spacing[3] },
  skeletonCard: {
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
  },
  emptyHist: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[10],
    paddingHorizontal: spacing[4],
  },
  historyCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    marginBottom: spacing[3],
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  historyTitle: {
    flex: 1,
    ...typography.label,
    color: colors.text.primary,
    fontWeight: "700",
  },
  historyWhen: { ...typography.caption, color: colors.text.secondary },
  historyBody: { ...typography.body, color: colors.text.secondary },
  showMore: {
    ...typography.labelSmall,
    color: colors.status.info,
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing[2] },
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  pillTextDark: { fontSize: 12, fontWeight: "600", color: colors.text.primary },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4], marginBottom: 4 },
  statOk: { ...typography.bodySmall, color: colors.accent.green, fontWeight: "600" },
  statBad: { ...typography.bodySmall, color: colors.status.error, fontWeight: "600" },
  statMuted: { ...typography.bodySmall, color: colors.text.secondary },
  sentBySmall: { ...typography.caption, color: colors.text.secondary },
  expandPanel: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  expandHeading: {
    ...typography.sectionHeader,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  expandName: { ...typography.bodySmall, color: colors.text.primary, marginBottom: 4 },
  tokenInvalid: { color: colors.text.secondary, fontStyle: "italic" },
  moreHint: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  sheetScrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
    zIndex: zIndex.modal,
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing[6],
    paddingBottom: spacing[10],
  },
  sheetTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  summaryCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.tertiary,
    marginBottom: spacing[4],
  },
  sumLabel: { ...typography.caption, color: colors.text.secondary },
  sumVal: { ...typography.body, color: colors.text.primary },
  sheetErr: { color: colors.status.error, marginBottom: spacing[3] },
  sheetActions: { flexDirection: "row", gap: spacing[3] },
  sheetBtnSec: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnSecText: { ...typography.button, color: colors.text.secondary },
  sheetBtnPri: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnPriText: { ...typography.button, color: colors.text.primary },
});
