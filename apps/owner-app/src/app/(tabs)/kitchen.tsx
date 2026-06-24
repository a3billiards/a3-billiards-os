import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { parseConvexError } from "@a3/ui/errors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { TabAccessDenied } from "../../components/TabAccessDenied";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";
import { useStaffRole, staffRoleQueryId, useStaffTabQueryArgs } from "../../lib/StaffRoleContext";

type KitchenStatus = "pending" | "preparing" | "ready" | "served";

type KitchenOrderRow = {
  orderId: Id<"kitchenOrders">;
  sessionId: Id<"sessions">;
  tableId: Id<"tables">;
  tableLabel: string;
  items: { name: string; qty: number }[];
  status: KitchenStatus;
  createdAt: number;
  servedAt: number | null;
};

const ADVANCE_LABEL: Record<Exclude<KitchenStatus, "served">, string> = {
  pending: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark served",
};

function formatTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

export default function KitchenScreen() {
  const { roleId, canAccessTab } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const [servedOpen, setServedOpen] = useState(false);
  const [busyId, setBusyId] = useState<Id<"kitchenOrders"> | null>(null);

  const kitchenArgs = useStaffTabQueryArgs(dashboard?.clubId, "kitchen");
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
    return <TabAccessDenied tabLabel="Kitchen" />;
  }

  if (board === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }

  const onAdvance = async (orderId: Id<"kitchenOrders">) => {
    if (busyId) return;
    setBusyId(orderId);
    try {
      await advanceKitchenOrder({ orderId, roleId: queryRoleId });
    } catch (e) {
      Alert.alert("Could not update order", parseConvexError(e as Error).message);
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
        <Text style={styles.emptySection}>No orders</Text>
      ) : (
        orders.map((order) => (
          <View key={order.orderId} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.tableLabel}>{order.tableLabel}</Text>
              <Text style={styles.timeLabel}>{formatTime(order.createdAt)}</Text>
            </View>
            {order.items.map((item, idx) => (
              <Text key={`${order.orderId}-${idx}`} style={styles.itemLine}>
                {item.qty}× {item.name}
              </Text>
            ))}
            {order.status !== "served" ? (
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
                    ? "Updating…"
                    : ADVANCE_LABEL[order.status]}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.servedNote}>
                Served {order.servedAt ? formatTime(order.servedAt) : "—"}
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
        <Text style={styles.title}>Kitchen</Text>
        <Text style={styles.sub}>
          {activeTotal === 0
            ? "No active orders"
            : `${activeTotal} active order${activeTotal === 1 ? "" : "s"}`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {renderSection("Pending", grouped.pending, colors.accent.amber)}
        {renderSection("Preparing", grouped.preparing, colors.status.info)}
        {renderSection("Ready", grouped.ready, colors.accent.green)}

        <Pressable
          style={styles.servedToggle}
          onPress={() => setServedOpen((v) => !v)}
        >
          <Text style={styles.servedToggleText}>
            Served today ({grouped.served.length})
          </Text>
          <MaterialIcons
            name={servedOpen ? "expand-less" : "expand-more"}
            size={22}
            color={colors.text.secondary}
          />
        </Pressable>
        {servedOpen
          ? renderSection("Served today", grouped.served, colors.text.tertiary)
          : null}
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
  pressed: { opacity: 0.88 },
});
