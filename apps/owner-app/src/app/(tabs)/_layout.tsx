import { Tabs } from "expo-router";
import { colors, typography, layout } from "@a3/ui/theme";

export default function TabsLayout() {
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
      <Tabs.Screen
        name="slots"
        options={{ title: "Slots" }}
      />
      <Tabs.Screen
        name="snacks"
        options={{ title: "Snacks" }}
      />
      <Tabs.Screen
        name="financials"
        options={{ title: "Financials" }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints" }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Tabs>
  );
}
