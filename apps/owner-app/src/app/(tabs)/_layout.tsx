import { View } from "react-native";
import { Tabs } from "expo-router";
import { glass } from "@a3/ui/theme";
import OwnerTabBar from "../../components/OwnerTabBar";
import { StaffRoleProvider } from "../../lib/StaffRoleContext";
import { StaffRoleNavigationGuard } from "../../lib/StaffRoleNavigationGuard";
import { usePushRegistration } from "../../lib/usePushRegistration";

function OwnerTabsWithPush() {
  usePushRegistration();
  return (
    <View style={{ flex: 1, backgroundColor: glass.pageBgBottom }}>
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
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="slots" options={{ title: "Slots" }} />
        <Tabs.Screen name="snacks" options={{ title: "Snacks" }} />
        <Tabs.Screen name="financials" options={{ title: "Financials" }} />
        <Tabs.Screen name="complaints" options={{ title: "Complaints" }} />
        <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
        <Tabs.Screen name="documents" options={{ title: "Documents" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <StaffRoleProvider>
      <StaffRoleNavigationGuard />
      <OwnerTabsWithPush />
    </StaffRoleProvider>
  );
}
