/**
 * Registers the device for push notifications and saves the token to the backend.
 *
 * Works in Expo Go for foreground notification display (local notifications).
 * Remote push token registration requires a development build with Firebase configured
 * (SDK 53+ removed remote push token support from Expo Go).
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@a3/convex/_generated/api";

export function usePushRegistration() {
  const saveToken = useMutation(api.users.saveFcmToken);
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    if (Platform.OS === "web") return;

    void (async () => {
      try {
        const Notifications = await import("expo-notifications");

        // Configure foreground notification behaviour (works in Expo Go)
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "A3 Billiards",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#43A047",
          });
        }

        // getExpoPushTokenAsync is not available in Expo Go SDK 53+.
        // Skip token registration silently; it will work in dev/production builds.
        const tokenData = await Notifications.getExpoPushTokenAsync().catch(
          () => null,
        );
        if (!tokenData) return;

        await saveToken({ token: tokenData.data });
      } catch {
        // Non-critical: silently skip if push setup fails in this environment
      }
    })();
  }, [saveToken]);
}
