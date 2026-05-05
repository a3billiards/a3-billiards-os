import { View } from "react-native";
import { Tabs } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import AdminTabBar from "../../components/AdminTabBar";
import { adminShell } from "../../theme/adminShell";

export default function TabsLayout() {
  const user = useQuery(api.users.getCurrentUser, {});
  const canDash =
    user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;
  const dash = useQuery(
    api.admin.getAdminDashboard,
    canDash ? {} : "skip",
  );
  const openComplaints = dash?.openComplaints ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: adminShell.bgScreen }}>
      <Tabs
        tabBar={(props) => <AdminTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: "absolute",
            height: 0,
            borderTopWidth: 0,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="users" options={{ title: "Users" }} />
        <Tabs.Screen
          name="complaints"
          options={{
            title: "Complaints",
            tabBarBadge:
              openComplaints > 0
                ? openComplaints > 99
                  ? "99+"
                  : openComplaints
                : undefined,
          }}
        />
        <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      </Tabs>
    </View>
  );
}
