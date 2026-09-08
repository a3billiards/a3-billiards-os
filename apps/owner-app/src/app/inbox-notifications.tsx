import { useCallback } from "react";

import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter } from "expo-router";

import { useMutation, useQuery } from "convex/react";

import { MaterialIcons } from "@expo/vector-icons";

import { api } from "@a3/convex/_generated/api";

import type { Id } from "@a3/convex/_generated/dataModel";

import { InboxNotificationsPanel } from "@a3/ui/components";

import { colors, glass, layout, spacing, typography } from "@a3/ui/theme";

import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import { usePullToRefresh } from "@a3/ui/hooks";



export default function InboxNotificationsScreen(): React.JSX.Element {

  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();

  const router = useRouter();

  const page = useQuery(api.notifications.listMyInboxNotifications, { limit: 50 });

  const markRead = useMutation(api.notifications.markInboxNotificationRead);

  const markAllRead = useMutation(api.notifications.markAllInboxNotificationsRead);



  const formatWhen = useCallback(

    (createdAt: number): string => {

      const diff = Date.now() - createdAt;

      const min = Math.floor(diff / 60_000);

      if (min < 1) return t("common.justNow");

      if (min < 60) return t("common.minutesAgo", { min });

      const hr = Math.floor(min / 60);

      if (hr < 24) return t("common.hoursAgo", { hr });

      return new Intl.DateTimeFormat(getCurrentLanguage(), {

        day: "numeric",

        month: "short",

        year: "numeric",

      }).format(new Date(createdAt));

    },

    [t],

  );



  const onOpen = useCallback(

    async (id: string) => {

      const row = page?.notifications.find((r) => r._id === id);

      if (row && !row.isRead) {

        await markRead({

          notificationId: id as Id<"userInboxNotifications">,

        });

      }

      if (
        row?.kind === "kitchen_order_preparing" ||
        row?.kind === "kitchen_order_ready" ||
        row?.kind === "kitchen_order_served" ||
        row?.kind === "kitchen_item_unavailable"
      ) {
        router.push("/(tabs)/kitchen");
      }

    },

    [markRead, page?.notifications, router],

  );



  return (

    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>

      <View style={styles.header}>

        <Pressable

          onPress={() => router.back()}

          hitSlop={10}

          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}

          accessibilityRole="button"

        >

          <MaterialIcons name="arrow-back" size={22} color={glass.textMuted} />

        </Pressable>

        <View style={styles.headerText}>

          <Text style={styles.title}>{t("common.inbox.title")}</Text>

          <Text style={styles.subtitle}>{t("common.inbox.subtitle")}</Text>

        </View>

      </View>

      <View style={styles.body}>

        <InboxNotificationsPanel

          rows={page?.notifications?.map((row) => {
            const isKitchen =
              row.kind === "kitchen_order_preparing" ||
              row.kind === "kitchen_order_ready" ||
              row.kind === "kitchen_order_served" ||
              row.kind === "kitchen_item_unavailable";
            const localizedTitle = isKitchen
              ? row.kind === "kitchen_order_preparing"
                ? t("common.inbox.kitchenOrderPreparing")
                : row.kind === "kitchen_order_served"
                  ? t("common.inbox.kitchenOrderServed")
                  : row.kind === "kitchen_item_unavailable"
                    ? t("common.inbox.kitchenItemUnavailable")
                    : t("common.inbox.kitchenOrderReady")
              : row.title;
            return {
              ...row,
              title: localizedTitle,
              sourceLabel: isKitchen
                ? t("common.inbox.fromKitchen")
                : t("common.inbox.fromAdmin"),
            };
          })}

          onOpen={(id) => void onOpen(id)}

          onMarkAllRead={() => void markAllRead({})}

          emptyLabel={t("common.inbox.empty")}

          markAllReadLabel={t("common.inbox.markAllRead")}

          fromAdminLabel={t("common.inbox.fromAdmin")}

          loadMoreLabel={t("common.inbox.loadMore")}

          formatWhen={formatWhen}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }

        />

      </View>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  safe: {

    flex: 1,

    backgroundColor: glass.pageBgBottom,

  },

  header: {

    flexDirection: "row",

    alignItems: "center",

    gap: spacing[3],

    paddingHorizontal: layout.screenPadding,

    paddingTop: spacing[2],

    paddingBottom: spacing[4],

  },

  backBtn: {

    width: 40,

    height: 40,

    alignItems: "center",

    justifyContent: "center",

  },

  headerText: { flex: 1, minWidth: 0 },

  title: {

    ...typography.heading3,

    color: colors.text.primary,

  },

  subtitle: {

    ...typography.bodySmall,

    color: colors.text.secondary,

    marginTop: spacing[0.5],

  },

  body: {

    flex: 1,

    paddingHorizontal: layout.screenPadding,

  },

  pressed: { opacity: 0.85 },

});

