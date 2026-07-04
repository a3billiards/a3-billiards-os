import { useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, spacing, typography, radius, glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { useState } from "react";

type BlockReason = "frozen" | "deletion";

export default function AccountBlockedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { reason: rawReason } = useLocalSearchParams<{ reason?: string | string[] }>();
  const [busy, setBusy] = useState(false);

  const reason = Array.isArray(rawReason) ? rawReason[0] : rawReason;
  const blockReason: BlockReason =
    reason === "deletion" ? "deletion" : "frozen";

  const message =
    blockReason === "deletion"
      ? t("auth.customer.accountBlocked.deletion")
      : t("auth.customer.accountBlocked.frozen");

  const onContinue = useCallback(async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      /* session may already be cleared */
    }
    router.replace({
      pathname: "/login",
      params: blockReason === "frozen" ? { frozen: "1" } : {},
    });
  }, [signOut, router, blockReason]);

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{t("auth.customer.accountBlocked.title")}</Text>
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.hint}>{t("auth.customer.accountBlocked.hint")}</Text>
          <Pressable
            style={[styles.btn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void onContinue()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t("auth.customer.accountBlocked.backToLogin")}</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: glass.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    padding: spacing[6],
    alignItems: "center",
  },
  icon: { fontSize: 48, marginBottom: spacing[4] },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing[3],
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing[3],
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.tertiary,
    textAlign: "center",
    marginBottom: spacing[6],
  },
  btn: {
    backgroundColor: glass.ctaBg,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    minWidth: 200,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
