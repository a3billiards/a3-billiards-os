import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { TabErrorBoundary } from "@a3/ui/errors";
import { colors, spacing, typography } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { adminTabBarTotalInset } from "../../theme/adminShell";
import { AdminSupportQueue } from "../../components/AdminSupportQueue";

export default function SupportTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPad = adminTabBarTotalInset(insets.bottom);

  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.support")}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("adminApp.support.title")}</Text>
          <Text style={styles.subtitle}>{t("adminApp.support.subtitle")}</Text>
        </View>
        <AdminSupportQueue bottomInset={bottomPad} />
      </SafeAreaView>
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2] },
  title: { ...typography.heading2, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing[1] },
});
