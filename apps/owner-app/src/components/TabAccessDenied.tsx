import { View, Text, StyleSheet, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, typography, spacing } from "@a3/ui/theme";

export function TabAccessDenied({
  tabLabel,
}: {
  tabLabel: string;
}): React.JSX.Element {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <MaterialIcons name="lock" size={48} color={colors.text.secondary} />
      <Text style={styles.title}>Access restricted</Text>
      <Text style={styles.body}>
        Your active staff role does not include {tabLabel}. Ask the owner to update your role, or
        enter the settings passcode from Home to switch to owner mode.
      </Text>
      <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.btnText}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    backgroundColor: colors.bg.primary,
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginTop: spacing[4],
    textAlign: "center",
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[3],
    textAlign: "center",
  },
  btn: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: 12,
    backgroundColor: colors.accent.green,
  },
  btnText: { ...typography.label, color: "#fff", fontWeight: "700" },
});
