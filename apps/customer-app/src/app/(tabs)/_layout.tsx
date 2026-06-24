import { Tabs } from "expo-router";
import { View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { glass } from "@a3/ui/theme";
import CustomerTabBar from "../../components/CustomerTabBar";
import { usePushRegistration } from "../../lib/usePushRegistration";

export default function TabsLayout() {
  const user = useQuery(api.users.getCurrentUser);
  usePushRegistration();
  const pending = useQuery(
    api.bookings.getPendingBookingsCount,
    user?._id ? { customerId: user._id } : "skip",
  );

  return (
    <View style={{ flex: 1, backgroundColor: glass.pageBgBottom }}>
      <Tabs
        tabBar={(props) => <CustomerTabBar {...props} />}
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
        <Tabs.Screen name="discover" options={{ title: "Discover" }} />
        <Tabs.Screen name="live" options={{ title: "Live" }} />
        <Tabs.Screen
          name="bookings"
          options={{
            title: "Bookings",
            tabBarBadge:
              (pending?.count ?? 0) > 0 ? pending!.count : undefined,
          }}
        />
        <Tabs.Screen name="history" options={{ title: "History" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </View>
  );
}
