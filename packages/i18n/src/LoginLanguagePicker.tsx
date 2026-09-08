import React from "react";
import { View, StyleSheet } from "react-native";
import { spacing } from "@a3/ui/theme";
import { LanguagePicker } from "./LanguagePicker";

/** Language selector for login / pre-auth screens. */
export function LoginLanguagePicker(): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <LanguagePicker variant="row" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
    marginBottom: spacing[3],
  },
});
