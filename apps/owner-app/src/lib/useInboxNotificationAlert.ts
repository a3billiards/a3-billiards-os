import { useEffect, useRef } from "react";
import { Alert, AppState, Platform } from "react-native";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@a3/convex/_generated/api";
import { useTranslation } from "@a3/i18n";

export function useInboxNotificationAlert(): void {
  const { t } = useTranslation();
  const router = useRouter();
  const latest = useQuery(api.notifications.getLatestUnreadInboxNotification);
  const sessionStart = useRef(Date.now());
  const lastAlertedId = useRef<string | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sessionStart.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let remove: (() => void) | undefined;
    void import("expo-notifications").then((Notifications) => {
      const sub = Notifications.addNotificationResponseReceivedListener(() => {
        router.push("/inbox-notifications");
      });
      remove = () => sub.remove();
    });
    return () => remove?.();
  }, [router]);

  useEffect(() => {
    if (latest === undefined) return;
    if (!ready.current) {
      ready.current = true;
      if (latest) lastAlertedId.current = latest._id;
      return;
    }
    if (!latest || latest.isRead) return;
    if (latest.createdAt < sessionStart.current - 2000) return;
    if (lastAlertedId.current === latest._id) return;
    lastAlertedId.current = latest._id;

    Alert.alert(latest.title, latest.body, [
      { text: t("common.inbox.alertLater"), style: "cancel" },
      {
        text: t("common.inbox.alertView"),
        onPress: () => router.push("/inbox-notifications"),
      },
    ]);
  }, [latest, router, t]);
}
