import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, layout } from "@a3/ui/theme";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

function makeTabBarIcon(name: IconName) {
  function TabBarIcon({ color, size }: { color: string; size: number }) {
    return <MaterialIcons name={name} color={color} size={size} />;
  }
  TabBarIcon.displayName = `TabBarIcon(${String(name)})`;
  return TabBarIcon;
}

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
        options={{ title: "Slots", tabBarIcon: makeTabBarIcon("view-module") }}
      />
      <Tabs.Screen
        name="snacks"
        options={{ title: "Snacks", tabBarIcon: makeTabBarIcon("fastfood") }}
      />
      <Tabs.Screen
        name="financials"
        options={{ title: "Financials", tabBarIcon: makeTabBarIcon("attach-money") }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints", tabBarIcon: makeTabBarIcon("report-problem") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarIcon: makeTabBarIcon("event") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: makeTabBarIcon("settings") }}
      />
    </Tabs>
  );
}
