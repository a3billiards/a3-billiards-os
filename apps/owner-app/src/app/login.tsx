import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { GlassPageBackground, LiquidGlassCard } from "@a3/ui/components";

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

/** On-screen diagnostic for Google Sign-In failures (no Metro/adb). */
function googleSignInErrorAlertBody(err: unknown): string {
  const o = err as Record<string, unknown> & {
    code?: string | number;
    message?: string;
    name?: string;
    stack?: string;
    userInfo?: unknown;
  };
  const codeStr =
    o.code !== undefined && o.code !== null ? String(o.code) : "(undefined)";
  const msgStr =
    typeof o.message === "string"
      ? o.message
      : err instanceof Error
        ? err.message
        : String(err);
  const lines = [`code: ${codeStr}`, `message: ${msgStr}`];
  if (typeof o.name === "string") lines.push(`name: ${o.name}`);
  if (o.userInfo !== undefined) {
    try {
      lines.push(`userInfo: ${JSON.stringify(o.userInfo)}`);
    } catch {
      lines.push("userInfo: <non-serializable>");
    }
  }
  if (typeof o.stack === "string" && o.stack.length > 0) {
    lines.push(`stack:\n${o.stack}`);
  }
  try {
    lines.push(
      `JSON:\n${JSON.stringify(err, Object.getOwnPropertyNames(Object(err ?? {})))}`,
    );
  } catch {
    lines.push("JSON: <non-serializable>");
  }
  return lines.join("\n\n");
}

async function getGoogleSigninModule() {
  return await import("@react-native-google-signin/google-signin");
}

export default function OwnerLoginScreen() {
  const router = useRouter();
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

  const canSubmitEmail =
    email.trim().length > 0 && password.length >= 8 && !loading && !googleLoading;

  const navigatePostLogin = useCallback(() => {
    router.replace("/post-login-gate");
  }, [router]);

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
        setError("Sign-in failed. Check your email and password.");
        setLoading(false);
        return;
      }

      navigatePostLogin();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setError("This account is frozen. Contact support.");
      } else if (appError.code === "AUTH_006") {
        setError("This account is pending deletion.");
      } else if (appError.code === "AUTH_009") {
        setError(
          "Verify your owner email on register.a3billiards.com before signing in here.",
        );
      } else if (
        appError.code === "AUTH_001" ||
        appError.code === "UNKNOWN"
      ) {
        setError("Invalid email or password.");
      } else {
        setError(appError.message);
      }
      setLoading(false);
    }
  }, [canSubmitEmail, email, password, signIn, navigatePostLogin]);

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
        setError(
          "Google Sign-In is not available in Expo Go. Use email login or run a development build.",
        );
        return;
      }

      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
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
        setError("Google sign-in cancelled or failed.");
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
        setError("Google sign-in failed. Please try again.");
        return;
      }

      navigatePostLogin();
    } catch (e) {
      logOwnerGoogleError("handleGoogleLogin(catch)", e);
      Alert.alert("Google Sign-In error", googleSignInErrorAlertBody(e));
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setError("This account is frozen. Contact support.");
      } else if (appError.code === "AUTH_006") {
        setError("This account is pending deletion.");
      } else if (appError.code === "OWNER_001") {
        setError(
          "This Google account is not registered as an owner. Use the customer app or complete owner onboarding.",
        );
      } else if (appError.code === "GOOGLE_AUTH_001") {
        setError("Google authentication failed. Please try again.");
      } else if (appError.code !== "UNKNOWN") {
        setError(appError.message);
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [loading, googleLoading, signIn, navigatePostLogin, resolveOwnerGoogle, router]);

  const busy = loading || googleLoading;

  return (
    <GlassPageBackground>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.logoTile}>
            <Text style={styles.logoText}>A3</Text>
          </View>
          <Text style={styles.title}>Owner Panel</Text>
          <Text style={styles.subtitle}>
            Sign in with the same email and password from owner onboarding
          </Text>
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
            accessibilityLabel="Continue with Google"
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </Pressable>

          {/* ── OR divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Email + Password ── */}
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="owner@example.com"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
              accessibilityLabel="Email address"
            />

            <Text style={[styles.label, { marginTop: spacing[4] }]}>
              Password
            </Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleEmailLogin}
              editable={!busy}
              accessibilityLabel="Password"
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
              accessibilityLabel="Sign in with email"
              accessibilityState={{ disabled: !canSubmitEmail }}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
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
              <Text style={styles.errorDot}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          </LiquidGlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
