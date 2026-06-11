import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { glass } from "../theme/glass";

export interface GlassIconTileProps {
  children: React.ReactNode;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The 40×40 rounded-square frosted icon container used inside cards
 * (Figma stat-card avatar, settings list rows, etc).
 */
export function GlassIconTile({
  children,
  size = glass.iconTileSize,
  radius = glass.iconTileRadius,
  style,
}: GlassIconTileProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: glass.iconTileBg,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default GlassIconTile;
