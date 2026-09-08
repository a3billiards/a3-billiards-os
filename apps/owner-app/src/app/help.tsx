import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground, HelpSupportPanel } from "@a3/ui/components";
import { colors, typography, spacing, glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { OWNER_FAQ_IDS, SUPPORT_EMAIL } from "@a3/utils/supportContact";

export default function OwnerHelpScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const myRequests = useQuery(
    api.supportRequests.listMySupportRequests,
    isAuthenticated ? {} : "skip",
  );
  const submit = useMutation(api.supportRequests.submitSupportRequest);

  const onSubmitRequest = useCallback(
    async (args: { category: string; subject: string; message: string }) => {
      await submit({
        audience: "owner",
        category: args.category,
        subject: args.subject,
        message: args.message,
      });
    },
    [submit],
  );

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={12}>
            <Text style={styles.navBtnText}>{"<"}</Text>
          </Pressable>
          <Text style={styles.navTitle}>{t("ownerApp.help.title")}</Text>
          <View style={styles.navBtn} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <HelpSupportPanel
            audience="owner"
            faqIds={OWNER_FAQ_IDS}
            faqKeyPrefix="ownerApp.help.faq"
            t={t}
            supportEmail={SUPPORT_EMAIL}
            onSubmitRequest={onSubmitRequest}
            myRequests={myRequests}
            bottomInset={spacing[8] + insets.bottom}
          />
        </ScrollView>
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  navBtn: { width: 40 },
  navBtnText: { ...typography.heading3, color: glass.ctaBg },
  navTitle: { ...typography.heading4, color: colors.text.primary },
});
