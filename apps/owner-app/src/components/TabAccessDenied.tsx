import { View, Text, StyleSheet, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "@a3/i18n";
import { colors, typography, spacing } from "@a3/ui/theme";

export function TabAccessDenied({
  tabLabel,
}: {
  tabLabel: string;
}): React.JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <MaterialIcons name="lock" size={48} color={colors.text.secondary} />
      <Text style={styles.title}>{t("ownerApp.shell.accessDenied.title")}</Text>
      <Text style={styles.body}>
        {t("ownerApp.shell.accessDenied.body", { tabLabel })}
      </Text>
      <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.btnText}>{t("ownerApp.shell.accessDenied.goHome")}</Text>
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
