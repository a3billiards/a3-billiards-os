import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { ownerShell } from "../theme/ownerShell";
import { useStaffRole } from "../lib/StaffRoleContext";

const STAFF_GATED_TABS = new Set([
  "slots",
  "snacks",
  "financials",
  "complaints",
  "bookings",
  "documents",
  "kitchen",
  "livestream",
]);

/** Stack-style tab routes that must not appear in the bottom bar. */
const HIDDEN_TAB_ROUTES = new Set(["gst-report", "loyalty"]);

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  home: "home",
  slots: "view-module",
  snacks: "fastfood",
  financials: "bar-chart",
  complaints: "report-problem",
  bookings: "event",
  documents: "folder",
  kitchen: "restaurant",
  livestream: "videocam",
  settings: "settings",
};

const TAB_LABEL_KEYS: Record<string, string> = {
  home: "common.tabs.owner.home",
  slots: "common.tabs.owner.slots",
  snacks: "common.tabs.owner.snacks",
  financials: "common.tabs.owner.financials",
  complaints: "common.tabs.owner.complaints",
  bookings: "common.tabs.owner.bookings",
  documents: "common.tabs.owner.documents",
  kitchen: "common.tabs.owner.kitchen",
  livestream: "common.tabs.owner.livestream",
  settings: "common.tabs.owner.settings",
};

export default function OwnerTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { canAccessTab, roleId } = useStaffRole();
  const { t } = useTranslation();

  const visibleRoutes = state.routes.filter((route) => {
    if (HIDDEN_TAB_ROUTES.has(route.name)) return false;
    if (route.name === "settings" && roleId) return false;
    if (!STAFF_GATED_TABS.has(route.name)) return true;
    if (roleId === undefined) return false;
    return canAccessTab(route.name);
  });

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <View pointerEvents="none" style={styles.pillHighlight} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visibleRoutes.map((route) => {
            const index = state.routes.findIndex((r) => r.key === route.key);
            const { options } = descriptors[route.key];
            const label = TAB_LABEL_KEYS[route.name]
              ? t(TAB_LABEL_KEYS[route.name])
              : ((options.title as string | undefined) ?? route.name);
            const isFocused = state.index === index;
            const iconName = TAB_ICONS[route.name] ?? "circle";

            const badge =
              options.tabBarBadge !== undefined && options.tabBarBadge !== null
                ? String(options.tabBarBadge)
                : null;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: "tabLongPress", target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tab}
              >
                <View
                  style={[
                    styles.iconWrap,
                    isFocused && styles.iconWrapActive,
                  ]}
                >
                  <MaterialIcons
                    name={iconName}
                    size={22}
                    color={isFocused ? "#7dd3fc" : "rgba(148, 163, 184, 0.78)"}
                  />
                  {badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    minHeight: ownerShell.tabBarBody,
    borderRadius: glass.tabPillRadius,
    borderWidth: 1,
    borderColor: glass.tabPillBorder,
    backgroundColor: glass.tabPillBg,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  pillHighlight: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    height: 1,
    backgroundColor: glass.tabPillInnerHighlight,
    zIndex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 4,
  },
  iconWrap: {
    position: "relative",
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: "rgba(125, 211, 252, 0.14)",
  },
  badge: {
    position: "absolute",
    end: -8,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.status.error,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.text.primary,
  },
  tab: {
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: "rgba(148, 163, 184, 0.78)",
  },
  tabLabelActive: {
    color: "#7dd3fc",
    fontWeight: "700",
  },
});
