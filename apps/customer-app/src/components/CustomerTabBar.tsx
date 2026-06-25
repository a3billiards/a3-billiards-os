import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { customerShell } from "../theme/customerShell";

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  home: "home",
  discover: "explore",
  live: "videocam",
  bookings: "event",
  history: "history",
  profile: "person",
};

const TAB_LABEL_KEYS: Record<string, string> = {
  home: "tabs.customer.home",
  discover: "tabs.customer.discover",
  live: "tabs.customer.live",
  bookings: "tabs.customer.bookings",
  history: "tabs.customer.history",
  profile: "tabs.customer.profile",
};

export default function CustomerTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

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
        {state.routes.map((route, index) => {
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
                  color={isFocused ? customerShell.accentGreenLight : "rgba(148, 163, 184, 0.78)"}
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
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 460,
    minHeight: customerShell.tabBarBody,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
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
    backgroundColor: "rgba(134, 239, 172, 0.16)",
  },
  badge: {
    position: "absolute",
    right: -10,
    top: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.accent.amberLight,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#000",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: "rgba(148, 163, 184, 0.78)",
  },
  tabLabelActive: {
    color: customerShell.accentGreenLight,
    fontWeight: "700",
  },
});
