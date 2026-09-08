import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { glass } from "../theme/glass";

export interface GlassPageBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Full-screen liquid-glass canvas — Figma "A3 Billiards OS" (33:8218).
 *
 * Layers: base ink → soft ambient orbs (cyan / violet / brand green) →
 * navy haze → mid-depth wash → bottom vignette. Pure RN (no BlurView) so it
 * runs everywhere including Expo Go.
 */
export function GlassPageBackground({
  children,
  style,
}: GlassPageBackgroundProps): React.JSX.Element {
  return (
    <View style={[styles.root, style]}>
      <View pointerEvents="none" style={styles.layerBottom} />
      <View pointerEvents="none" style={styles.orbTopRight} />
      <View pointerEvents="none" style={styles.orbMidLeft} />
      <View pointerEvents="none" style={styles.orbBottom} />
      <View pointerEvents="none" style={styles.layerMid} />
      <View pointerEvents="none" style={styles.layerTop} />
      <View pointerEvents="none" style={styles.vignette} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: glass.pageBgBottom,
  },
  layerBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: glass.pageBgBottom,
  },
  orbTopRight: {
    position: "absolute",
    top: -140,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: glass.orbBlue,
  },
  orbMidLeft: {
    position: "absolute",
    top: "28%",
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: glass.orbViolet,
  },
  orbBottom: {
    position: "absolute",
    bottom: -80,
    left: "15%",
    width: 320,
    height: 240,
    borderRadius: 160,
    backgroundColor: glass.orbGreen,
  },
  layerMid: {
    position: "absolute",
    top: "32%",
    left: 0,
    right: 0,
    height: "38%",
    backgroundColor: "rgba(15, 23, 42, 0.12)",
  },
  layerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "52%",
    backgroundColor: "rgba(10, 17, 40, 0.72)",
  },
  vignette: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: glass.vignetteBottom,
  },
  content: {
    flex: 1,
  },
});

export default GlassPageBackground;
