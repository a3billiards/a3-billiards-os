import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { adminShell } from "../theme/adminShell";

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: "dashboard",
  clubs: "business",
  users: "people",
  complaints: "flag",
  support: "support-agent",
  "live-moderation": "live-tv",
  audit: "history",
  notifications: "notifications",
};

const TAB_LABEL_KEYS: Record<string, string> = {
  index: "common.tabs.admin.index",
  clubs: "common.tabs.admin.clubs",
  users: "common.tabs.admin.users",
  complaints: "common.tabs.admin.complaints",
  support: "common.tabs.admin.support",
  "live-moderation": "common.tabs.admin.live-moderation",
  audit: "common.tabs.admin.audit",
  notifications: "common.tabs.admin.notifications",
};

export default function AdminTabBar({
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
        {/* Inset top highlight — the "liquid sheen" */}
        <View pointerEvents="none" style={styles.pillHighlight} />

        {state.routes.map((route, index) => {
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
                  color={isFocused ? "#bfdbfe" : "rgba(148, 163, 184, 0.78)"}
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
    maxWidth: 420,
    minHeight: adminShell.tabBarBody,
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
    width: 30,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: "rgba(96, 165, 250, 0.12)",
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
  tabLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.45,
    color: "rgba(148, 163, 184, 0.7)",
  },
  tabLabelActive: {
    color: "#bfdbfe",
    fontWeight: "700",
  },
});
