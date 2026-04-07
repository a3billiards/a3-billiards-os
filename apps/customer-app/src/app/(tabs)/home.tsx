import { View, Text, StyleSheet } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing } from "@a3/ui/theme";

export default function HomeScreen() {
  const user = useQuery(api.users.getCurrentUser);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {user?.name ? `Welcome, ${user.name}` : "Welcome"}
      </Text>
      <Text style={styles.subtitle}>
        Find a table, book a slot, or check your sessions
      </Text>
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
  greeting: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
