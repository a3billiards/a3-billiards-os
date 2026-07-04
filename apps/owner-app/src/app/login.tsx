import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { LoginLanguagePicker, useTranslation } from "@a3/i18n";
import { GlassPageBackground, LiquidGlassCard, KeyboardFormScroll } from "@a3/ui/components";
import { usePostLoginNavigation } from "@a3/ui/hooks";

/** Logs native / Convex errors for Google Sign-In (Metro + adb logcat). */
function logOwnerGoogleError(context: string, err: unknown): void {
  const o = err as Record<string, unknown> & {
    message?: string;
    code?: string;
    stack?: string;
    name?: string;
    userInfo?: unknown;
  };
  let json = "";
  try {
    json = JSON.stringify(err, Object.getOwnPropertyNames(Object(err ?? {})));
  } catch {
    json = "<non-serializable>";
  }
  console.error(`[OwnerLogin:${context}]`, {
    err,
    name: o?.name,
    code: o?.code,
    message: o?.message,
    userInfo: o?.userInfo,
    stack: o?.stack,
    json,
  });
}

async function getGoogleSigninModule() {
  return await import("@react-native-google-signin/google-signin");
}

/** Map native Google Sign-In errors to user-facing copy. */
function googleSignInUserMessage(
  err: unknown,
  t: (key: string) => string,
): string {
  const o = err as Record<string, unknown> & { message?: string; code?: string | number };
  const msg = String(o?.message ?? "");
  const code = o?.code;
  if (code === 10 || code === "10" || msg.includes("DEVELOPER_ERROR")) {
    return t("auth.owner.login.googleDeveloperError");
  }
  if (code === 12501 || code === "12501" || msg.includes("SIGN_IN_CANCELLED")) {
    return t("auth.owner.login.googleCancelled");
  }
  if (msg.includes("GOOGLE_AUTH_001")) {
    return t("auth.owner.login.googleAuthFailed");
  }
  if (msg.length > 0 && msg.length < 200) {
    return msg;
  }
  return t("auth.owner.login.googleFailed");
}

export default function OwnerLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { frozen } = useLocalSearchParams<{ frozen?: string }>();
  const { signIn } = useAuthActions();
  const resolveOwnerGoogle = useAction(
    api.googleAuthActions.resolveOwnerGoogleSignIn,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const { schedulePostLogin, isWaitingForAuth } = usePostLoginNavigation();

  useEffect(() => {
    if (frozen === "1") {
      setError(t("auth.owner.login.accountFrozen"));
    }
  }, [frozen, t]);

  const canSubmitEmail =
    email.trim().length > 0 && password.length >= 8 && !loading && !googleLoading && !isWaitingForAuth;

  const handleEmailLogin = useCallback(async () => {
    if (!canSubmitEmail) return;
    setError(null);
    setLoading(true);

    try {
      const { signingIn } = await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });

      if (!signingIn) {
        setError(t("auth.owner.login.signInFailed"));
        setLoading(false);
        return;
      }

      schedulePostLogin();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setError(t("auth.owner.login.accountFrozen"));
      } else if (appError.code === "AUTH_006") {
        setError(t("auth.owner.login.accountPendingDeletion"));
      } else if (appError.code === "AUTH_009") {
        setError(t("auth.owner.login.verifyEmailFirst"));
      } else if (
        appError.code === "AUTH_001" ||
        appError.code === "UNKNOWN"
      ) {
        setError(t("auth.owner.login.invalidCredentials"));
      } else {
        setError(appError.message);
      }
      setLoading(false);
    }
  }, [canSubmitEmail, email, password, signIn, schedulePostLogin, t]);

  const handleGoogleLogin = useCallback(async () => {
    if (loading || googleLoading) return;
    setError(null);
    setGoogleLoading(true);

    try {
      let GoogleSignin: (typeof import("@react-native-google-signin/google-signin"))["GoogleSignin"];
      try {
        ({ GoogleSignin } = await getGoogleSigninModule());
      } catch (e) {
        logOwnerGoogleError("loadGoogleSigninModule", e);
        setError(t("auth.owner.login.googleNotInExpoGo"));
        return;
      }

      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
      if (!webClientId) {
        setError(t("auth.owner.login.googleFailed"));
        return;
      }

      GoogleSignin.configure({
        webClientId,
        ...(typeof process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID === "string" &&
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.length > 0
          ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
          : {}),
        offlineAccess: false,
      });

      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      } catch (e) {
        logOwnerGoogleError("hasPlayServices", e);
        throw e;
      }

      let response;
      try {
        response = await GoogleSignin.signIn();
      } catch (e) {
        logOwnerGoogleError("GoogleSignin.signIn", e);
        throw e;
      }

      const idToken = response.data?.idToken;
      if (!idToken) {
        logOwnerGoogleError("missingIdToken", {
          response,
          user: response.data?.user,
        });
        setError(t("auth.owner.login.googleCancelled"));
        return;
      }

      const probe = await resolveOwnerGoogle({ idToken });
      if (probe.isNewUser) {
        router.replace({
          pathname: "/register",
          params: {
            googleId: probe.pendingProfile.googleId,
            googleEmail: probe.pendingProfile.email ?? "",
            googleName: probe.pendingProfile.name,
          },
        });
        return;
      }

      let signingIn: boolean;
      try {
        const out = await signIn("googleOwner", { idToken });
        signingIn = out.signingIn;
      } catch (e) {
        logOwnerGoogleError("signIn(googleOwner) Convex", e);
        throw e;
      }

      if (!signingIn) {
        logOwnerGoogleError("signInReturnedFalse", { signingIn: false });
        setError(t("auth.owner.login.googleFailed"));
        return;
      }

      schedulePostLogin();
    } catch (e) {
      logOwnerGoogleError("handleGoogleLogin(catch)", e);
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setError(t("auth.owner.login.accountFrozen"));
      } else if (appError.code === "AUTH_006") {
        setError(t("auth.owner.login.accountPendingDeletion"));
      } else if (appError.code === "OWNER_001") {
        setError(t("auth.owner.login.googleNotOwner"));
      } else if (appError.code === "DATA_002") {
        setError(t("auth.owner.login.googleConflict"));
      } else if (appError.code === "GOOGLE_AUTH_001") {
        setError(t("auth.owner.login.googleAuthFailed"));
      } else if (appError.code !== "UNKNOWN") {
        setError(appError.message);
      } else {
        setError(googleSignInUserMessage(e, t));
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [loading, googleLoading, signIn, schedulePostLogin, resolveOwnerGoogle, router, t]);

  const busy = loading || googleLoading || isWaitingForAuth;

  return (
    <GlassPageBackground>
    <KeyboardFormScroll contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <LoginLanguagePicker />
          <View style={styles.logoTile}>
            <Text style={styles.logoText}>{t("auth.owner.login.logo")}</Text>
          </View>
          <Text style={styles.title}>{t("auth.owner.login.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.owner.login.subtitle")}</Text>
          <LiquidGlassCard style={styles.formCard} padding={24}>

          {/* ── Google Sign-In (PRD v23: no password field) ── */}
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              busy && styles.buttonDisabled,
              pressed && !busy && styles.googleButtonPressed,
            ]}
            onPress={handleGoogleLogin}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("auth.owner.login.continueGoogle")}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={styles.googleButtonText}>{t("auth.owner.login.continueGoogle")}</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("auth.owner.login.or")}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Email + Password ── */}
          <View style={styles.form}>
            <Text style={styles.label}>{t("auth.owner.login.email")}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.owner.login.emailPlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
              accessibilityLabel={t("auth.owner.login.email")}
            />

            <Text style={[styles.label, { marginTop: spacing[4] }]}>
              {t("auth.owner.login.password")}
            </Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.owner.login.passwordPlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleEmailLogin}
              editable={!busy}
              accessibilityLabel={t("auth.owner.login.password")}
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                !canSubmitEmail && styles.buttonDisabled,
                pressed && canSubmitEmail && styles.buttonPressed,
              ]}
              onPress={handleEmailLogin}
              disabled={!canSubmitEmail}
              accessibilityRole="button"
              accessibilityLabel={t("auth.owner.login.signIn")}
              accessibilityState={{ disabled: !canSubmitEmail }}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.buttonText}>{t("auth.owner.login.signIn")}</Text>
              )}
            </Pressable>
          </View>

          {/* ── Error ── */}
          {error !== null && (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.errorDot}>{t("common.error")}</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
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
    marginBottom: spacing[5],
  },
  formCard: {
    width: "100%",
  },
  googleButton: {
    width: "100%",
    height: layout.buttonHeight,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.touchTarget,
  },
  googleButtonPressed: { opacity: 0.85 },
  googleButtonText: {
    ...typography.buttonLarge,
    color: glass.textPrimary,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: spacing[5],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: glass.cardBorder,
  },
  dividerText: {
    ...typography.labelSmall,
    color: glass.textLabel,
    marginHorizontal: spacing[4],
  },
  form: { width: "100%" },
  label: {
    ...typography.label,
    color: glass.textMuted,
    marginBottom: spacing[2],
  },
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
  button: {
    height: layout.buttonHeight,
    backgroundColor: "#86efac",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
  },
  buttonDisabled: {
    backgroundColor: colors.status.disabled,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.buttonLarge,
    color: "#052e16",
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    width: "100%",
  },
  errorDot: {
    ...typography.labelSmall,
    color: colors.status.error,
    marginRight: spacing[2],
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.error,
    flex: 1,
  },
});
