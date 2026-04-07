import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "@a3/ui/theme";

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bookings — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  text: { ...typography.body, color: colors.text.secondary },
});
