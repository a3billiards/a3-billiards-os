import { Tabs } from "expo-router";
import { colors, typography, layout } from "@a3/ui/theme";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
export default function TabsLayout() {
  const user = useQuery(api.users.getCurrentUser);
  const pending = useQuery(
    api.bookings.getPendingBookingsCount,
    user?._id ? { customerId: user._id } : "skip",
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border.subtle,
          height: layout.tabBarHeight,
        },
        tabBarActiveTintColor: colors.accent.green,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabelStyle: {
          ...typography.tabLabel,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarBadge:
            (pending?.count ?? 0) > 0 ? pending!.count : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent.amberLight,
            color: "#000000",
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
