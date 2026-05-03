import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, layout } from "@a3/ui/theme";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <MaterialIcons name={name} color={color} size={size} />
  );
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
        options={{ title: "Slots", tabBarIcon: tabIcon("view-module") }}
      />
      <Tabs.Screen
        name="snacks"
        options={{ title: "Snacks", tabBarIcon: tabIcon("fastfood") }}
      />
      <Tabs.Screen
        name="financials"
        options={{ title: "Financials", tabBarIcon: tabIcon("attach-money") }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints", tabBarIcon: tabIcon("report-problem") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarIcon: tabIcon("event") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: tabIcon("settings") }}
      />
    </Tabs>
  );
}
