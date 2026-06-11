import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type GestureResponderEvent,
} from "react-native";
import { glass } from "../theme/glass";

export interface LiquidGlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override card padding. Default: 18. */
  padding?: number | "none";
  /** Override card radius. Default: glass.cardRadius (24). */
  radius?: number;
  /** Skip the deep drop shadow (useful inside scroll content). Default: false. */
  flat?: boolean;
  /** Ignore the inset top highlight. Default: false. */
  noHighlight?: boolean;
  /** Make the whole card pressable. */
  onPress?: (e: GestureResponderEvent) => void;
  /** Accessibility */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Liquid-glass card primitive.
 *
 * Mirrors the Figma "A3 Billiards OS" surface treatment:
 *  - dark frosted RGBA background
 *  - 1.275px subtle outer border
 *  - 1px inner top highlight ("sheen")
 *  - deep, soft drop shadow
 *
 * Pure RN — no native dependency. Safe in Expo Go.
 */
export function LiquidGlassCard({
  children,
  style,
  padding = 18,
  radius = glass.cardRadius,
  flat = false,
  noHighlight = false,
  onPress,
  accessibilityLabel,
  testID,
}: LiquidGlassCardProps): React.JSX.Element {
  const containerStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      borderRadius: radius,
      padding: padding === "none" ? 0 : padding,
    },
    !flat && glass.cardShadow,
    style,
  ];

  const inner = (
    <>
      {children}
      {noHighlight ? null : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.highlight,
            { borderRadius: radius },
          ]}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          containerStyle,
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle} testID={testID} accessibilityLabel={accessibilityLabel}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    overflow: "hidden",
  },
  highlight: {
    borderTopWidth: 1,
    borderTopColor: glass.cardInnerHighlight,
  },
});

export default LiquidGlassCard;
