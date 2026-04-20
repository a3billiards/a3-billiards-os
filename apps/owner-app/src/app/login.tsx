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
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

export default function OwnerLoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();

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
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) {
        setError("Google sign-in cancelled or failed.");
        setGoogleLoading(false);
        return;
      }

      // This establishes a real Convex Auth session via the A3Google provider.
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
      } else if (appError.code === "GOOGLE_AUTH_NEW_USER") {
        setError(
          "No owner account found for this Google account. Register via the Onboarding Website.",
        );
      } else if (appError.code === "GOOGLE_AUTH_001") {
        setError("Google authentication failed. Please try again.");
      } else if (appError.code !== "UNKNOWN") {
        setError(appError.message);
      } else {
        setError("Google sign-in failed. Please try again.");
      }
      setGoogleLoading(false);
    }
  }, [loading, googleLoading, signIn, navigatePostLogin]);

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
          <Text style={styles.title}>Owner Panel</Text>
          <Text style={styles.subtitle}>
            Manage your billiards club
          </Text>

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
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
  googleButtonPressed: {
    opacity: 0.85,
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
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.default,
  },
  dividerText: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    marginHorizontal: spacing[4],
  },
  form: {
    width: "100%",
  },
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
  button: {
    height: layout.buttonHeight,
    backgroundColor: colors.accent.green,
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
    color: colors.bg.primary,
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
