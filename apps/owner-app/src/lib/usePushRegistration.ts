/**
 * Registers native FCM token for owner push (admin broadcasts, booking alerts).
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";

async function resolvePushToken(): Promise<string | null> {
  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "A3 Billiards",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#43A047",
    });
  }

  try {
    const device = await Notifications.getDevicePushTokenAsync();
    if (device.data && !device.data.startsWith("ExponentPushToken[")) {
      return device.data;
    }
  } catch {
    // Missing Firebase in build.
  }

  return null;
}

export function usePushRegistration(): void {
  const user = useQuery(api.users.getCurrentUser);
  const saveToken = useMutation(api.users.saveFcmToken);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!user?._id || user.role !== "owner") return;

    void (async () => {
      try {
        const token = await resolvePushToken();
        if (!token) return;
        await saveToken({ token });
      } catch {
        // Non-critical.
      }
    })();
  }, [user?._id, user?.role, saveToken]);
}
