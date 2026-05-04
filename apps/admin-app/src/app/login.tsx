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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const generateMfa = useAction(api.mfaActions.generateMfaCode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 8 && !loading;

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
        setError("Sign-in failed. Check your email and password.");
        setLoading(false);
        return;
      }

      await generateMfa();

      router.replace("/mfa");
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setFrozen(true);
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
  }, [canSubmit, email, password, signIn, generateMfa, router]);

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
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>
            Sign in to manage your billiards network
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@example.com"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading && !frozen}
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
              onSubmitEditing={handleLogin}
              editable={!loading && !frozen}
              accessibilityLabel="Password"
            />

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

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!canSubmit || frozen) && styles.buttonDisabled,
                pressed && canSubmit && !frozen && styles.buttonPressed,
              ]}
              onPress={handleLogin}
              disabled={!canSubmit || frozen}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityState={{ disabled: !canSubmit || frozen }}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>
          </View>
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
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
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
});
