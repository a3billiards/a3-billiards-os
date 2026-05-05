import { useMemo } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, layout } from "@a3/ui/theme";
import OwnerTabBar from "../../components/OwnerTabBar";
import { ownerShell } from "../../theme/ownerShell";

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
    <View style={{ flex: 1, backgroundColor: ownerShell.bgScreen }}>
      <Tabs
        initialRouteName="home"
        tabBar={(props) => <OwnerTabBar {...props} />}
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
        <Tabs.Screen
          name="home"
          options={{ title: "Home" }}
        />
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
    </View>
  );
}
