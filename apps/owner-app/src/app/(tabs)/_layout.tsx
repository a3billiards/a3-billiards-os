import { View } from "react-native";
import { Tabs } from "expo-router";
import { glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import OwnerTabBar from "../../components/OwnerTabBar";
import { StaffRoleProvider } from "../../lib/StaffRoleContext";
import { StaffRoleNavigationGuard } from "../../lib/StaffRoleNavigationGuard";
import { usePushRegistration } from "../../lib/usePushRegistration";
import { useInboxNotificationAlert } from "../../lib/useInboxNotificationAlert";

function OwnerTabsWithPush() {
  const { t } = useTranslation();
  usePushRegistration();
  useInboxNotificationAlert();
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
        <Tabs.Screen name="home" options={{ title: t("common.tabs.owner.home") }} />
        <Tabs.Screen name="slots" options={{ title: t("common.tabs.owner.slots") }} />
        <Tabs.Screen name="snacks" options={{ title: t("common.tabs.owner.snacks") }} />
        <Tabs.Screen name="kitchen" options={{ title: t("common.tabs.owner.kitchen") }} />
        <Tabs.Screen
          name="livestream"
          options={{ title: t("common.tabs.owner.livestream"), unmountOnBlur: false }}
        />
        <Tabs.Screen name="financials" options={{ title: t("common.tabs.owner.financials") }} />
        <Tabs.Screen
          name="gst-report"
          options={{ href: null, title: t("ownerApp.financials.gstReport") }}
        />
        <Tabs.Screen name="complaints" options={{ title: t("common.tabs.owner.complaints") }} />
        <Tabs.Screen name="bookings" options={{ title: t("common.tabs.owner.bookings") }} />
        <Tabs.Screen name="documents" options={{ title: t("common.tabs.owner.documents") }} />
        <Tabs.Screen name="settings" options={{ title: t("common.tabs.owner.settings") }} />
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
