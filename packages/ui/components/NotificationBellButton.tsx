import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, glass } from "../theme";

export type NotificationBellButtonProps = {
  unreadCount: number | undefined;
  onPress: () => void;
  accessibilityLabel: string;
};

export function NotificationBellButton({
  unreadCount,
  onPress,
  accessibilityLabel,
}: NotificationBellButtonProps): React.JSX.Element {
  const showBadge = (unreadCount ?? 0) > 0;
  return (
    <Pressable
      hitSlop={10}
      style={styles.btn}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <MaterialIcons
        name="notifications-none"
        size={20}
        color={glass.textMuted}
      />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {(unreadCount ?? 0) > 9 ? "9+" : String(unreadCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});
