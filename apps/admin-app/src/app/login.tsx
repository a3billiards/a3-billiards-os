import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { LoginLanguagePicker, useTranslation } from "@a3/i18n";
import { GlassPageBackground, LiquidGlassCard, KeyboardFormScroll } from "@a3/ui/components";
import { MaterialIcons } from "@expo/vector-icons";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 8 && !loading;

  /**
   * After signIn() succeeds, the Convex Auth JWT must propagate to the client
   * before any authenticated action will resolve. AdminAuthShell (in _layout)
   * watches `useConvexAuth().isAuthenticated` and `user.adminMfaVerifiedAt` and
   * redirects to `/mfa`, where `generateMfaCode` is dispatched on mount. Calling
   * `generateMfa()` here would race the JWT propagation and throw AUTH_001.
   */
  const handleLogin = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setFrozen(false);
    setLoading(true);

    try {
      const { signingIn } = await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });

      if (!signingIn) {
        setError(t("auth.admin.login.signInFailed"));
        setLoading(false);
        return;
      }
      // Leave loading=true; AdminAuthShell will redirect to /mfa once auth + role check resolve.
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setFrozen(true);
        setError(t("auth.admin.login.frozen"));
      } else if (appError.code === "AUTH_006") {
        setError(t("auth.admin.login.pendingDeletion"));
      } else if (appError.code === "AUTH_010") {
        setError(appError.message);
      } else if (
        appError.code === "AUTH_001" ||
        appError.code === "UNKNOWN"
      ) {
        setError(t("auth.admin.login.invalidCredentials"));
      } else {
        setError(appError.message);
      }
      setLoading(false);
    }
  }, [canSubmit, email, password, signIn, t]);

  return (
    <GlassPageBackground>
      <KeyboardFormScroll contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <LoginLanguagePicker />
            <View style={styles.logoTile}>
              <Text style={styles.logoText}>A3</Text>
            </View>
            <Text style={styles.title}>{t("auth.admin.login.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.admin.login.subtitle")}</Text>

            <LiquidGlassCard style={styles.form} padding={24}>
              <Text style={styles.label}>{t("auth.admin.login.email")}</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons
                  name="mail-outline"
                  size={18}
                  color={glass.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("auth.admin.login.emailPlaceholder")}
                  placeholderTextColor="rgba(148,163,184,0.45)"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  editable={!loading && !frozen}
                  accessibilityLabel={t("auth.admin.login.email")}
                />
              </View>

              <Text style={[styles.label, { marginTop: spacing[4] }]}>
                {t("auth.admin.login.password")}
              </Text>
              <View style={styles.inputWrap}>
                <MaterialIcons
                  name="lock-outline"
                  size={18}
                  color={glass.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("auth.admin.login.passwordPlaceholder")}
                  placeholderTextColor="rgba(148,163,184,0.45)"
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  editable={!loading && !frozen}
                  accessibilityLabel={t("auth.admin.login.password")}
                />
              </View>

              {error !== null && (
                <View
                  style={styles.errorBox}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <MaterialIcons
                    name="error-outline"
                    size={16}
                    color={colors.status.error}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  (!canSubmit || frozen) && styles.buttonDisabled,
                  pressed && canSubmit && !frozen && styles.buttonPressed,
                ]}
                onPress={handleLogin}
                disabled={!canSubmit || frozen}
                accessibilityRole="button"
                accessibilityLabel={t("auth.admin.login.signIn")}
                accessibilityState={{ disabled: !canSubmit || frozen }}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.buttonText}>{t("auth.admin.login.signIn")}</Text>
                )}
              </Pressable>
            </LiquidGlassCard>
          </View>
      </KeyboardFormScroll>
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
    alignItems: "center",
    width: "100%",
    maxWidth: layout.modalMaxWidth,
    alignSelf: "center",
  },
  logoTile: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  logoText: {
    fontSize: 28,
    fontWeight: "700",
    color: glass.textPrimary,
    letterSpacing: 2,
  },
  title: {
    ...typography.heading2,
    color: glass.textPrimary,
    marginBottom: spacing[1],
  },
  subtitle: {
    ...typography.body,
    color: glass.textMuted,
    textAlign: "center",
    marginBottom: spacing[6],
  },
  form: {
    width: "100%",
  },
  label: {
    ...typography.label,
    color: glass.textMuted,
    marginBottom: spacing[2],
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: layout.inputHeight,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    paddingHorizontal: spacing[3],
  },
  inputIcon: { marginRight: spacing[2] },
  input: {
    flex: 1,
    height: "100%",
    ...typography.body,
    color: glass.textPrimary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(244,67,54,0.12)",
    borderColor: "rgba(244,67,54,0.4)",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    marginTop: spacing[4],
  },
  errorText: {
    ...typography.bodySmall,
    color: "#fca5a5",
    flex: 1,
  },
  button: {
    height: layout.buttonHeight,
    backgroundColor: "#bfdbfe",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
  },
  buttonDisabled: {
    backgroundColor: colors.status.disabled,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    ...typography.buttonLarge,
    color: "#0f172a",
    fontWeight: "700",
  },
});
