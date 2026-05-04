import { useMemo } from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, layout } from "@a3/ui/theme";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

function makeTabBarIcon(name: IconName) {
  function TabBarIcon({ color, size }: { color: string; size: number }) {
    return <MaterialIcons name={name} color={color} size={size} />;
  }
  TabBarIcon.displayName = `TabBarIcon(${String(name)})`;
  return TabBarIcon;
}

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

  const user = useQuery(api.users.getCurrentUser);
  const pending = useQuery(
    api.bookings.getPendingBookingsCount,
    user?._id ? { customerId: user._id } : "skip",
  );

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
        name="home"
        options={{ title: "Home", tabBarIcon: makeTabBarIcon("home") }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: "Discover", tabBarIcon: makeTabBarIcon("explore") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: makeTabBarIcon("event"),
          tabBarBadge:
            (pending?.count ?? 0) > 0 ? pending!.count : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent.amberLight,
            color: "#000000",
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "History", tabBarIcon: makeTabBarIcon("history") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: makeTabBarIcon("person") }}
      />
    </Tabs>
  );
}
