import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "@a3/ui/theme";
import { ownerShell } from "../theme/ownerShell";

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  home: "dashboard",
  slots: "view-module",
  snacks: "fastfood",
  financials: "attach-money",
  complaints: "report-problem",
  bookings: "event",
  settings: "settings",
};

const TAB_LABELS: Record<string, string> = {
  home: "Home",
  slots: "Slots",
  snacks: "Snacks",
  financials: "Finances",
  complaints: "Complaints",
  bookings: "Bookings",
  settings: "Settings",
};

export default function OwnerTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.outer,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              (options.title as string | undefined) ?? TAB_LABELS[route.name] ?? route.name;
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
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
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
                <View style={styles.iconWrap}>
                  <MaterialIcons
                    name={iconName}
                    size={22}
                    color={isFocused ? ownerShell.accentBlue : ownerShell.textMuted}
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
                  {label.toUpperCase()}
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
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.45)",
    backgroundColor: "rgba(26, 32, 44, 0.92)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 14,
  },
  iconWrap: {
    position: "relative",
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -10,
    top: -6,
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
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.45,
    color: ownerShell.textMuted,
  },
  tabLabelActive: {
    color: ownerShell.accentBlue,
  },
});