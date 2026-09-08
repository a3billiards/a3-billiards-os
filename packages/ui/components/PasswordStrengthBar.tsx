import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { PasswordStrength } from "@a3/utils/passwordPolicy";

export interface PasswordStrengthBarProps {
  strength: PasswordStrength;
}

const LABEL: Record<PasswordStrength, string> = {
  none: "",
  weak: "Weak",
  good: "Good",
  strong: "Strong",
};

const SEGMENT_COLOR: Record<PasswordStrength, string[]> = {
  none: ["#333", "#333", "#333"],
  weak: ["#E53935", "#333", "#333"],
  good: ["#FB8C00", "#FB8C00", "#333"],
  strong: ["#43A047", "#43A047", "#43A047"],
};

const LABEL_COLOR: Record<PasswordStrength, string> = {
  none: "transparent",
  weak: "#E53935",
  good: "#FB8C00",
  strong: "#43A047",
};

export function PasswordStrengthBar({
  strength,
}: PasswordStrengthBarProps): React.JSX.Element | null {
  if (strength === "none") return null;
  const segs = SEGMENT_COLOR[strength];
  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {segs.map((color, i) => (
          <View key={i} style={[styles.seg, { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={[styles.label, { color: LABEL_COLOR[strength] }]}>
        {LABEL[strength]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  bars: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  seg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 40,
    textAlign: "right",
  },
});

export default PasswordStrengthBar;
