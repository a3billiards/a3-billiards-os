import { useMemo } from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, layout } from "@a3/ui/theme";
import { api } from "@a3/convex/_generated/api";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: colors.bg.secondary,
      borderTopColor: colors.border.subtle,
      paddingBottom: insets.bottom,
      height: layout.tabBarHeight + insets.bottom,
    }),
    [insets.bottom],
  );

  const user = useQuery(api.users.getCurrentUser, {});
  const canDash =
    user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;
  const dash = useQuery(
    api.admin.getAdminDashboard,
    canDash ? {} : "skip",
  );
  const openComplaints = dash?.openComplaints ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        safeAreaInsets: { bottom: 0 },
        tabBarStyle,
        tabBarActiveTintColor: colors.accent.green,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabelStyle: {
          ...typography.tabLabel,
        },
      } as React.ComponentProps<typeof Tabs>["screenOptions"]}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: "Complaints",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={styles.iconWrap}>
              <MaterialIcons name="flag" size={size} color={color} />
              {openComplaints > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {openComplaints > 99 ? "99+" : String(openComplaints)}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="notifications" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { position: "relative" },
  badge: {
    position: "absolute",
    right: -10,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.status.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
