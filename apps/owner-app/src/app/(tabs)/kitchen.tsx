import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError, TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { formatCurrency } from "@a3/utils/billing";
import { useTranslation, getCurrentLanguage } from "@a3/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { TabAccessDenied } from "../../components/TabAccessDenied";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";
import { useStaffRole, staffRoleQueryId, useStaffTabQueryArgs } from "../../lib/StaffRoleContext";

type KitchenStatus = "pending" | "preparing" | "ready" | "served";

type KitchenOrderItem = {
  snackId: Id<"snacks">;
  name: string;
  qty: number;
};

type KitchenOrderRow = {
  orderId: Id<"kitchenOrders">;
  sessionId: Id<"sessions">;
  tableId: Id<"tables">;
  tableLabel: string;
  items: KitchenOrderItem[];
  status: KitchenStatus;
  unavailablePending: boolean;
  unavailableConfirmed: boolean;
  createdAt: number;
  servedAt: number | null;
};

const ADVANCE_KEY: Record<Exclude<KitchenStatus, "served">, string> = {
  pending: "ownerApp.kitchen.startPreparing",
  preparing: "ownerApp.kitchen.markReady",
  ready: "ownerApp.kitchen.markServed",
};

function formatTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

function KitchenScreenContent() {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const locale = getCurrentLanguage();
  const { roleId, canAccessTab, isChefKitchenRole, isOwnerMode } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const [servedOpen, setServedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [busyId, setBusyId] = useState<Id<"kitchenOrders"> | null>(null);

  const [busySnackId, setBusySnackId] = useState<Id<"snacks"> | null>(null);

  const kitchenArgs = useStaffTabQueryArgs(dashboard?.clubId, "kitchen");
  const menuItems = useQuery(
    api.kitchenOrders.listKitchenMenuItems,
    kitchenArgs === "skip" ? "skip" : kitchenArgs,
  );
  const board = useQuery(
    api.kitchenOrders.listKitchenOrders,
    kitchenArgs === "skip"
      ? "skip"
      : {
          ...kitchenArgs,
          todayYmd: dashboard?.todayYmd,
        },
  );

  const advanceKitchenOrder = useMutation(api.kitchenOrders.advanceKitchenOrder);
  const requestOrderUnavailable = useMutation(
    api.kitchenOrders.requestKitchenOrderUnavailable,
  );
  const confirmOrderUnavailable = useMutation(
    api.kitchenOrders.confirmKitchenOrderUnavailable,
  );
  const toggleKitchenSnackAvailability = useMutation(
    api.kitchenOrders.toggleKitchenSnackAvailability,
  );

  const pendingUnavailable = useMemo(
    () =>
      (board?.orders ?? []).filter(
        (order) => order.unavailablePending && !order.unavailableConfirmed,
      ),
    [board?.orders],
  );

  const grouped = useMemo(() => {
    const pending: KitchenOrderRow[] = [];
    const preparing: KitchenOrderRow[] = [];
    const ready: KitchenOrderRow[] = [];
    const served: KitchenOrderRow[] = [];
    for (const o of board?.orders ?? []) {
      if (o.status === "pending") pending.push(o);
      else if (o.status === "preparing") preparing.push(o);
      else if (o.status === "ready") ready.push(o);
      else served.push(o);
    }
    return { pending, preparing, ready, served };
  }, [board?.orders]);

  if (dashboard === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (roleId !== undefined && !canAccessTab("kitchen")) {
    return <TabAccessDenied tabLabel={t("common.tabs.owner.kitchen")} />;
  }

  if (board === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }

  const onToggleAvailability = async (snackId: Id<"snacks">) => {
    if (!isChefKitchenRole || busySnackId) return;
    setBusySnackId(snackId);
    try {
      await toggleKitchenSnackAvailability({ snackId, roleId: queryRoleId });
    } catch (e) {
      Alert.alert(t("ownerApp.kitchen.couldNotUpdate"), parseConvexError(e as Error).message);
    } finally {
      setBusySnackId(null);
    }
  };

  const onRequestUnavailable = async (orderId: Id<"kitchenOrders">) => {
    if (busyId) return;
    setBusyId(orderId);
    try {
      await requestOrderUnavailable({ orderId, roleId: queryRoleId });
    } catch (e) {
      Alert.alert(t("ownerApp.kitchen.couldNotUpdate"), parseConvexError(e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmUnavailable = async (orderId: Id<"kitchenOrders">) => {
    if (busyId) return;
    setBusyId(orderId);
    try {
      await confirmOrderUnavailable({ orderId, roleId: queryRoleId });
    } catch (e) {
      Alert.alert(t("ownerApp.kitchen.couldNotUpdate"), parseConvexError(e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onAdvance = async (orderId: Id<"kitchenOrders">) => {
    if (busyId) return;
    setBusyId(orderId);
    try {
      await advanceKitchenOrder({ orderId, roleId: queryRoleId });
    } catch (e) {
      Alert.alert(t("ownerApp.kitchen.couldNotUpdate"), parseConvexError(e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const renderSection = (
    title: string,
    orders: KitchenOrderRow[],
    accent: string,
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: accent }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{orders.length}</Text>
      </View>
      {orders.length === 0 ? (
        <Text style={styles.emptySection}>{t("ownerApp.kitchen.noActiveOrders")}</Text>
      ) : (
        orders.map((order) => (
          <View key={order.orderId} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.tableLabel}>{order.tableLabel}</Text>
              <Text style={styles.timeLabel}>{formatTime(order.createdAt, locale)}</Text>
            </View>
            {order.items.map((item, idx) => (
              <Text key={`${order.orderId}-${idx}`} style={styles.itemLine}>
                {item.qty}× {item.name}
              </Text>
            ))}
            {order.unavailablePending && !order.unavailableConfirmed ? (
              <Text style={styles.pendingHint}>{t("ownerApp.kitchen.awaitingOwnerConfirm")}</Text>
            ) : null}
            {order.status !== "served" ? (
              isChefKitchenRole && order.status === "pending" ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.advanceBtn,
                      styles.actionBtnHalf,
                      pressed && styles.pressed,
                      busyId === order.orderId && styles.advanceBusy,
                    ]}
                    disabled={busyId === order.orderId || order.unavailablePending}
                    onPress={() => void onAdvance(order.orderId)}
                  >
                    <Text style={styles.advanceBtnText}>
                      {busyId === order.orderId
                        ? t("ownerApp.kitchen.updating")
                        : t(ADVANCE_KEY[order.status])}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.itemUnavailableBtn,
                      styles.actionBtnHalf,
                      pressed && styles.pressed,
                      busyId === order.orderId && styles.advanceBusy,
                    ]}
                    disabled={
                      busyId === order.orderId ||
                      order.unavailablePending ||
                      order.unavailableConfirmed
                    }
                    onPress={() => void onRequestUnavailable(order.orderId)}
                  >
                    <Text style={styles.itemUnavailableBtnText}>
                      {t("ownerApp.kitchen.itemUnavailable")}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.advanceBtn,
                    pressed && styles.pressed,
                    busyId === order.orderId && styles.advanceBusy,
                  ]}
                  disabled={busyId === order.orderId}
                  onPress={() => void onAdvance(order.orderId)}
                >
                  <Text style={styles.advanceBtnText}>
                    {busyId === order.orderId
                      ? t("ownerApp.kitchen.updating")
                      : t(ADVANCE_KEY[order.status])}
                  </Text>
                </Pressable>
              )
            ) : (
              <Text style={styles.servedNote}>
                {t("ownerApp.kitchen.servedAt", {
                  time: order.servedAt
                    ? formatTime(order.servedAt, locale)
                    : t("common.emDash"),
                })}
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const activeTotal =
    grouped.pending.length + grouped.preparing.length + grouped.ready.length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("ownerApp.kitchen.title")}</Text>
        <Text style={styles.sub}>
          {isChefKitchenRole
            ? activeTotal === 0
              ? t("ownerApp.kitchen.noActiveOrders")
              : t("ownerApp.kitchen.subtitle")
            : t("ownerApp.kitchen.chefOnlyBody")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Pressable
          style={styles.menuToggle}
          onPress={() => setMenuOpen((v) => !v)}
        >
          <View style={styles.menuToggleLeft}>
            <MaterialIcons name="restaurant-menu" size={20} color={colors.accent.green} />
            <Text style={styles.menuToggleText}>{t("ownerApp.kitchen.menuTitle")}</Text>
            <Text style={styles.menuCount}>
              {menuItems === undefined ? t("common.loadingEllipsis") : menuItems.length}
            </Text>
          </View>
          <MaterialIcons
            name={menuOpen ? "expand-less" : "expand-more"}
            size={22}
            color={colors.text.secondary}
          />
        </Pressable>
        {menuOpen ? (
          <View style={styles.menuSection}>
            <Text style={styles.menuHint}>
              {isChefKitchenRole
                ? t("ownerApp.kitchen.menuChefSubtitle")
                : t("ownerApp.kitchen.menuSubtitle")}
            </Text>
            {menuItems === undefined ? (
              <ActivityIndicator color={colors.accent.green} />
            ) : menuItems.length === 0 ? (
              <Text style={styles.menuEmpty}>{t("ownerApp.kitchen.menuEmpty")}</Text>
            ) : (
              menuItems.map((item) => (
                <Pressable
                  key={item.snackId}
                  style={({ pressed }) => [
                    styles.menuRow,
                    isChefKitchenRole && pressed && styles.pressed,
                  ]}
                  disabled={!isChefKitchenRole || busySnackId === item.snackId}
                  onPress={() => void onToggleAvailability(item.snackId)}
                >
                  <Text
                    style={[
                      styles.menuName,
                      !item.isAvailable && styles.menuNameUnavailable,
                    ]}
                  >
                    {item.name}
                  </Text>
                  <View style={styles.menuRight}>
                    <Text style={styles.menuPrice}>
                      {formatCurrency(item.price, dashboard?.currency ?? "INR")}
                    </Text>
                    {!item.isAvailable ? (
                      <Text style={styles.menuUnavailable}>
                        {t("ownerApp.kitchen.menuUnavailable")}
                      </Text>
                    ) : null}
                    {isChefKitchenRole ? (
                      <Text style={styles.menuToggleHint}>
                        {busySnackId === item.snackId
                          ? t("ownerApp.kitchen.updating")
                          : item.isAvailable
                            ? t("ownerApp.kitchen.menuMarkUnavailable")
                            : t("ownerApp.kitchen.menuMarkAvailable")}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {isChefKitchenRole ? (
          <>
            {renderSection(t("ownerApp.kitchen.pending"), grouped.pending, colors.accent.amber)}
            {renderSection(t("ownerApp.kitchen.preparing"), grouped.preparing, colors.status.info)}
            {renderSection(t("ownerApp.kitchen.ready"), grouped.ready, colors.accent.green)}

            <Pressable
              style={styles.servedToggle}
              onPress={() => setServedOpen((v) => !v)}
            >
              <Text style={styles.servedToggleText}>
                {t("ownerApp.kitchen.servedToday")} ({grouped.served.length})
              </Text>
              <MaterialIcons
                name={servedOpen ? "expand-less" : "expand-more"}
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
            {servedOpen
              ? renderSection(t("ownerApp.kitchen.servedToday"), grouped.served, colors.text.tertiary)
              : null}
          </>
        ) : isOwnerMode && pendingUnavailable.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionDot, { backgroundColor: colors.accent.amber }]} />
              <Text style={styles.sectionTitle}>{t("ownerApp.kitchen.unavailableRequests")}</Text>
              <Text style={styles.sectionCount}>{pendingUnavailable.length}</Text>
            </View>
            {pendingUnavailable.map((order) => (
              <View key={order.orderId} style={styles.card}>
                <Text style={styles.tableLabel}>{order.tableLabel}</Text>
                {order.items.map((item, idx) => (
                  <Text key={`${order.orderId}-${idx}`} style={styles.itemLine}>
                    {item.qty}× {item.name}
                  </Text>
                ))}
                <Text style={styles.pendingHint}>{t("ownerApp.kitchen.confirmUnavailableHint")}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmUnavailableBtn,
                    pressed && styles.pressed,
                    busyId === order.orderId && styles.advanceBusy,
                  ]}
                  disabled={busyId === order.orderId}
                  onPress={() => void onConfirmUnavailable(order.orderId)}
                >
                  <Text style={styles.confirmUnavailableBtnText}>
                    {busyId === order.orderId
                      ? t("ownerApp.kitchen.updating")
                      : t("ownerApp.kitchen.confirmUnavailable")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.chefOnlyCard}>
            <MaterialIcons name="notifications-active" size={28} color={colors.accent.green} />
            <Text style={styles.chefOnlyTitle}>{t("ownerApp.kitchen.chefOnlyTitle")}</Text>
            <Text style={styles.chefOnlyBody}>{t("ownerApp.kitchen.chefOnlyBody")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  center: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[6],
    paddingBottom: spacing[3],
  },
  title: { ...typography.heading2, color: colors.text.primary },
  sub: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 4 },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing[4],
  },
  section: { gap: spacing[2] },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { ...typography.heading4, color: colors.text.primary, flex: 1 },
  sectionCount: { ...typography.label, color: colors.text.secondary },
  emptySection: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    fontStyle: "italic",
    paddingVertical: spacing[2],
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableLabel: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  timeLabel: { ...typography.caption, color: colors.text.secondary },
  itemLine: { ...typography.bodySmall, color: colors.text.primary },
  actionRow: { flexDirection: "row", gap: spacing[2], marginTop: spacing[2] },
  actionBtnHalf: { flex: 1, marginTop: 0 },
  itemUnavailableBtn: {
    marginTop: spacing[2],
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  itemUnavailableBtnText: { ...typography.button, color: colors.accent.amber },
  pendingHint: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1] },
  confirmUnavailableBtn: {
    marginTop: spacing[2],
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmUnavailableBtnText: { ...typography.button, color: colors.bg.primary },
  advanceBtn: {
    marginTop: spacing[2],
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  advanceBusy: { opacity: 0.6 },
  advanceBtnText: { ...typography.button, color: colors.bg.primary },
  servedNote: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  servedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    marginTop: spacing[2],
  },
  servedToggleText: { ...typography.label, color: colors.text.secondary },
  menuToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  menuToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flex: 1,
  },
  menuToggleText: { ...typography.label, color: colors.text.primary, flex: 1 },
  menuCount: { ...typography.caption, color: colors.text.secondary },
  menuSection: {
    gap: spacing[2],
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  menuHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing[1],
  },
  menuEmpty: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  menuName: { ...typography.bodySmall, color: colors.text.primary, flex: 1 },
  menuNameUnavailable: { color: colors.text.tertiary, textDecorationLine: "line-through" },
  menuRight: { alignItems: "flex-end", gap: 2 },
  menuPrice: { ...typography.labelSmall, color: colors.text.secondary },
  menuUnavailable: { ...typography.caption, color: colors.accent.amber },
  menuToggleHint: { ...typography.caption, color: colors.text.tertiary },
  chefOnlyCard: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chefOnlyTitle: { ...typography.heading4, color: colors.text.primary, textAlign: "center" },
  chefOnlyBody: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center",
  },
  pressed: { opacity: 0.88 },
});

export default function KitchenScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.kitchen")}>
      <KitchenScreenContent />
    </TabErrorBoundary>
  );
}
