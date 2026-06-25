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
  "loyalty",
  "livestream",
]);

/** Stack-style tab routes that must not appear in the bottom bar. */
const HIDDEN_TAB_ROUTES = new Set(["gst-report"]);

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  home: "home",
  slots: "view-module",
  snacks: "fastfood",
  financials: "bar-chart",
  complaints: "report-problem",
  bookings: "event",
  documents: "folder",
  kitchen: "restaurant",
  loyalty: "stars",
  livestream: "videocam",
  settings: "settings",
};

const TAB_LABEL_KEYS: Record<string, string> = {
  home: "tabs.owner.home",
  slots: "tabs.owner.slots",
  snacks: "tabs.owner.snacks",
  financials: "tabs.owner.financials",
  complaints: "tabs.owner.complaints",
  bookings: "tabs.owner.bookings",
  documents: "tabs.owner.documents",
  kitchen: "tabs.owner.kitchen",
  loyalty: "tabs.owner.loyalty",
  livestream: "tabs.owner.livestream",
  settings: "tabs.owner.settings",
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
            const label =
              (options.title as string | undefined) ??
              (TAB_LABEL_KEYS[route.name]
                ? t(TAB_LABEL_KEYS[route.name])
                : route.name);
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
    left: 0,
    right: 0,
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
    left: 0,
    right: 0,
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
    right: -8,
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
