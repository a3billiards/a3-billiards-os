import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground, LiquidGlassCard, KeyboardFormScroll } from "@a3/ui/components";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

const MIN_LEN = 8;

export default function SetPasswordScreen(): React.JSX.Element {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const user = useQuery(api.users.getCurrentUser);
  const hasLoginPassword = useQuery(api.customerAuth.hasLoginPassword);
  const setupLoginPassword = useAction(api.customerAuthActions.setupLoginPassword);

  const confirmRef = useRef<TextInput>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const match = password === confirm;
  const canSubmit =
    password.length >= MIN_LEN && match && confirm.length >= MIN_LEN && !loading;

  const goNext = useCallback(() => {
    if (from === "register") {
      router.replace("/post-login-gate");
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/profile");
  }, [router, from]);

  useEffect(() => {
    if (user === undefined || hasLoginPassword === undefined) return;
    if (user === null) {
      router.replace("/login");
      return;
    }
    if (user.googleId || hasLoginPassword) {
      goNext();
    }
  }, [user, hasLoginPassword, router, goNext]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await setupLoginPassword({ password });
      goNext();
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      setError(appErr.message ?? "Could not save password.");
      setLoading(false);
    }
  }, [canSubmit, password, setupLoginPassword, goNext]);

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <KeyboardFormScroll contentContainerStyle={styles.scroll}>
            <View style={styles.container}>
              <Text style={styles.title}>Create Login Password</Text>
              <Text style={styles.subtitle}>
                Optional — set a password to sign in faster next time, or skip
                and keep using WhatsApp OTP.
              </Text>

              <LiquidGlassCard style={styles.formCard} padding={20}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  editable={!loading}
                />

                <Text style={[styles.label, styles.fieldGap]}>Confirm Password</Text>
                <TextInput
                  ref={confirmRef}
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={() => void onSubmit()}
                  editable={!loading}
                />

                {confirm.length > 0 && !match ? (
                  <Text style={styles.inlineErr}>Passwords do not match.</Text>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canSubmit && styles.buttonDisabled,
                    pressed && canSubmit && styles.pressed,
                  ]}
                  onPress={() => void onSubmit()}
                  disabled={!canSubmit}
                >
                  {loading ? (
                    <ActivityIndicator color="#052e16" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save & Continue</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={goNext}
                  disabled={loading}
                  hitSlop={8}
                  style={styles.skipRow}
                >
                  <Text style={styles.skipText}>
                    {from === "register" ? "Skip for now" : "Cancel"}
                  </Text>
                </Pressable>

                {error ? (
                  <View style={styles.errorBox} accessibilityRole="alert">
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </LiquidGlassCard>
            </View>
        </KeyboardFormScroll>
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing[8],
  },
  container: {
    width: "100%",
    maxWidth: layout.modalMaxWidth,
    alignSelf: "center",
  },
  title: {
    ...typography.heading2,
    color: glass.textPrimary,
    textAlign: "center",
    marginBottom: spacing[2],
  },
  subtitle: {
    ...typography.body,
    color: glass.textMuted,
    textAlign: "center",
    marginBottom: spacing[5],
  },
  formCard: { width: "100%" },
  label: {
    ...typography.label,
    color: glass.textMuted,
    marginBottom: spacing[2],
  },
  fieldGap: { marginTop: spacing[4] },
  input: {
    height: layout.inputHeight,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    paddingHorizontal: spacing[4],
    ...typography.body,
    color: glass.textPrimary,
  },
  inlineErr: {
    ...typography.caption,
    color: colors.status.error,
    marginTop: spacing[2],
  },
  primaryButton: {
    height: layout.buttonHeight,
    backgroundColor: "#86efac",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
  },
  primaryButtonText: {
    ...typography.buttonLarge,
    color: "#052e16",
    fontWeight: "700",
  },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  skipRow: { marginTop: spacing[4], alignSelf: "center" },
  skipText: {
    ...typography.label,
    color: glass.textMuted,
  },
  errorBox: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: "rgba(244,67,54,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.4)",
  },
  errorText: {
    ...typography.bodySmall,
    color: "#fca5a5",
  },
});
