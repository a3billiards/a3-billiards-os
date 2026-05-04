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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ...(typeof process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID === "string" &&
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.length > 0
    ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
    : {}),
  offlineAccess: false,
});

export default function CustomerLoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const resolveGoogle = useAction(api.googleAuthActions.resolveGoogleSignIn);

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
      } else {
        setError("Invalid email or password.");
      }
      setLoading(false);
    }
  }, [canSubmitEmail, email, password, signIn, navigatePostLogin]);

  const handleGoogleLogin = useCallback(async () => {
    if (loading || googleLoading) return;
    setError(null);
    setGoogleLoading(true);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) {
        setError("Google sign-in cancelled or failed.");
        setGoogleLoading(false);
        return;
      }

      const result = await resolveGoogle({ idToken });

      if (result.isNewUser) {
        router.replace({
          pathname: "/register",
          params: {
            googleId: result.pendingProfile.googleId,
            googleEmail: result.pendingProfile.email ?? "",
            googleName: result.pendingProfile.name,
          },
        });
        setGoogleLoading(false);
        return;
      }

      // Existing user — establish a real Convex Auth session via the A3Google provider.
      const { signingIn } = await signIn("google", { idToken });
      if (!signingIn) {
        setError("Google sign-in failed. Please try again.");
        setGoogleLoading(false);
        return;
      }

      navigatePostLogin();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setError("This account is frozen. Contact support.");
      } else if (appError.code === "AUTH_006") {
        setError("This account is pending deletion.");
      } else if (appError.code === "GOOGLE_AUTH_001") {
        setError("Google authentication failed. Please try again.");
      } else {
        setError("Google sign-in failed. Please try again.");
      }
      setGoogleLoading(false);
    }
  }, [loading, googleLoading, signIn, resolveGoogle, navigatePostLogin, router]);

  const busy = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.logo}>A3</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to your A3 Billiards account
          </Text>

          {/* ── Google Sign-In (PRD v23: no password field for Google) ── */}
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              busy && styles.buttonDisabled,
              pressed && !busy && styles.pressed,
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
              placeholder="you@example.com"
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
                styles.primaryButton,
                !canSubmitEmail && styles.buttonDisabled,
                pressed && canSubmitEmail && styles.pressed,
              ]}
              onPress={handleEmailLogin}
              disabled={!canSubmitEmail}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {loading ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {error !== null && (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.errorLabel}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Register link ── */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Don{"'"}t have an account? </Text>
            <Pressable
              onPress={() => router.push("/register")}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.registerLink}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
  },
  container: {
    alignItems: "center",
    width: "100%",
    maxWidth: layout.modalMaxWidth,
    alignSelf: "center",
  },
  logo: {
    ...typography.heading1,
    fontSize: 48,
    color: colors.accent.green,
    letterSpacing: 4,
    marginBottom: spacing[1],
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing[8],
  },
  googleButton: {
    width: "100%",
    height: layout.buttonHeight,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.touchTarget,
  },
  googleButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: spacing[6],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border.default },
  dividerText: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    marginHorizontal: spacing[4],
  },
  form: { width: "100%" },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing[1.5],
  },
  input: {
    height: layout.inputHeight,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
    ...typography.body,
    color: colors.text.primary,
  },
  primaryButton: {
    height: layout.buttonHeight,
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
  },
  primaryButtonText: {
    ...typography.buttonLarge,
    color: colors.bg.primary,
  },
  buttonDisabled: { backgroundColor: colors.status.disabled },
  pressed: { opacity: 0.85 },
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
  errorLabel: {
    ...typography.labelSmall,
    color: colors.status.error,
    marginRight: spacing[2],
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.error,
    flex: 1,
  },
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[8],
  },
  registerText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  registerLink: {
    ...typography.label,
    color: colors.accent.green,
  },
});
