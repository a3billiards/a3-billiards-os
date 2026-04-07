import { Tabs } from "expo-router";
import { colors, typography, spacing, layout } from "@a3/ui/theme";

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
        name="index"
        options={{ title: "Dashboard" }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: "Users" }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints" }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Alerts" }}
      />
    </Tabs>
  );
}
