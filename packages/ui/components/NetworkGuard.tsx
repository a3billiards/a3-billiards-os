import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing } from "../theme/spacing";
 
// TODO Phase 9: implement full component
 
export interface NetworkGuardProps {}
 
export function NetworkGuard(_props: NetworkGuardProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>NetworkGuard</Text>
      <Text style={styles.hint}>Placeholder — Phase 9</Text>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 8,
    padding: spacing[4],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  label: { ...typography.label, color: colors.text.primary },
  hint:  { ...typography.caption, color: colors.text.tertiary, marginTop: spacing[1] },
});
 
export default NetworkGuard;
