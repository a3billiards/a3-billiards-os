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
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { GlassPageBackground, LiquidGlassCard } from "@a3/ui/components";

type Mode = "phone" | "email";
type PhoneStep = "enterPhone" | "enterCode";

export default function CustomerLoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const sendLoginOtp = useAction(api.phoneOtp.sendLoginOtp);

  const [mode, setMode] = useState<Mode>("phone");

  // Phone+OTP state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enterPhone");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  // Email+password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const phoneValid = /^\+[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ""));
  const codeValid = /^\d{6}$/.test(code.replace(/\s/g, ""));

  const navigatePostLogin = useCallback(() => {
    router.replace("/post-login-gate");
  }, [router]);

  // ───── Phone + OTP ─────
  const handleSendOtp = useCallback(async () => {
    if (!phoneValid || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await sendLoginOtp({ phone: phone.replace(/\s/g, "") });
      setPhoneStep("enterCode");
      setInfo("OTP sent via WhatsApp.");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      switch (appErr.code) {
        case "AUTH_009":
          setError(
            "No account found for this phone. Please sign up first.",
          );
          break;
        case "AUTH_002":
          setError("This account is frozen. Contact support.");
          break;
        case "AUTH_006":
          setError("This account is pending deletion.");
          break;
        case "OTP_003":
          setError("Too many OTP requests. Please wait a few minutes.");
          break;
        case "OTP_005":
          setError("Invalid phone number. Use country code, e.g. +91...");
          break;
        default:
          setError(appErr.message ?? "Could not send OTP.");
      }
    } finally {
      setLoading(false);
    }
  }, [phone, phoneValid, loading, sendLoginOtp]);

  const handleVerifyOtp = useCallback(async () => {
    if (!codeValid || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { signingIn } = await signIn("phoneOtp", {
        phone: phone.replace(/\s/g, ""),
        code: code.replace(/\s/g, ""),
        flow: "signIn",
      });
      if (!signingIn) {
        setError("Sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      navigatePostLogin();
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      switch (appErr.code) {
        case "OTP_001":
          setError(
            "Too many failed attempts. Please request a new OTP in 5 minutes.",
          );
          break;
        case "OTP_002":
          setError(appErr.message ?? "Wrong or expired OTP.");
          break;
        case "AUTH_002":
          setError("This account is frozen. Contact support.");
          break;
        case "AUTH_006":
          setError("This account is pending deletion.");
          break;
        case "AUTH_009":
          setError("No account found for this phone. Please sign up first.");
          break;
        default:
          setError("Could not verify OTP. Please try again.");
      }
      setLoading(false);
    }
  }, [code, codeValid, phone, loading, signIn, navigatePostLogin]);

  // ───── Email + password (fallback) ─────
  const canSubmitEmail =
    email.trim().length > 0 && password.length >= 8 && !loading;

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
      const appErr = parseConvexError(e as Error);
      if (appErr.code === "AUTH_002") {
        setError("This account is frozen. Contact support.");
      } else if (appErr.code === "AUTH_006") {
        setError("This account is pending deletion.");
      } else {
        setError("Invalid email or password.");
      }
      setLoading(false);
    }
  }, [canSubmitEmail, email, password, signIn, navigatePostLogin]);

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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to your A3 Billiards account
          </Text>
          <LiquidGlassCard style={styles.formCard} padding={24}>

          {mode === "phone" ? (
            <View style={styles.form}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (phoneStep === "enterCode") setPhoneStep("enterPhone");
                }}
                placeholder="+91XXXXXXXXXX"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                editable={!loading}
                accessibilityLabel="Phone number"
              />
              <Text style={styles.hint}>
                E.164 format. We&apos;ll send a 6-digit OTP via WhatsApp.
              </Text>

              {phoneStep === "enterCode" ? (
                <>
                  <Text style={[styles.label, styles.fieldGap]}>OTP Code</Text>
                  <TextInput
                    ref={codeRef}
                    style={styles.input}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="number-pad"
                    returnKeyType="go"
                    onSubmitEditing={handleVerifyOtp}
                    editable={!loading}
                    accessibilityLabel="OTP code"
                  />
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={loading || !phoneValid}
                    hitSlop={8}
                    style={styles.resendRow}
                  >
                    <Text
                      style={[
                        styles.resendText,
                        (loading || !phoneValid) && styles.disabledText,
                      ]}
                    >
                      Resend OTP
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (loading ||
                    (phoneStep === "enterPhone" && !phoneValid) ||
                    (phoneStep === "enterCode" && !codeValid)) &&
                    styles.buttonDisabled,
                  pressed && !loading && styles.pressed,
                ]}
                onPress={
                  phoneStep === "enterPhone" ? handleSendOtp : handleVerifyOtp
                }
                disabled={
                  loading ||
                  (phoneStep === "enterPhone" && !phoneValid) ||
                  (phoneStep === "enterCode" && !codeValid)
                }
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={glass.ctaText} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {phoneStep === "enterPhone" ? "Send OTP" : "Verify & Sign In"}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            // ── Email + password fallback ──
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
                editable={!loading}
                accessibilityLabel="Email address"
              />
              <Text style={[styles.label, styles.fieldGap]}>Password</Text>
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
                editable={!loading}
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
              >
                {loading ? (
                  <ActivityIndicator color={glass.ctaText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ── Mode toggle ── */}
          <Pressable
            onPress={() => {
              setMode((m) => (m === "phone" ? "email" : "phone"));
              setError(null);
              setInfo(null);
              setPhoneStep("enterPhone");
              setCode("");
              setPassword("");
            }}
            disabled={loading}
            hitSlop={8}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleText}>
              {mode === "phone"
                ? "Use email & password instead"
                : "Use phone number & OTP instead"}
            </Text>
          </Pressable>

          {info !== null && (
            <View style={styles.infoBox} accessibilityLiveRegion="polite">
              <Text style={styles.infoText}>{info}</Text>
            </View>
          )}

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

          </LiquidGlassCard>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Don{"'"}t have an account? </Text>
            <Pressable
              onPress={() => router.push("/register")}
              disabled={loading}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.registerLink}>Sign Up</Text>
            </Pressable>
          </View>
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
  formCard: { width: "100%" },
  form: { width: "100%" },
  label: {
    ...typography.label,
    color: glass.textMuted,
    marginBottom: spacing[2],
  },
  fieldGap: { marginTop: spacing[4] },
  input: {
    height: layout.inputHeight,
    backgroundColor: glass.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    paddingHorizontal: spacing[4],
    ...typography.body,
    color: glass.textPrimary,
  },
  hint: {
    ...typography.caption,
    color: glass.textLabel,
    marginTop: spacing[1],
  },
  resendRow: {
    alignSelf: "flex-end",
    marginTop: spacing[2],
  },
  resendText: {
    ...typography.label,
    color: "#86efac",
  },
  disabledText: { opacity: 0.45 },
  primaryButton: {
    height: layout.buttonHeight,
    backgroundColor: glass.ctaBg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
  },
  primaryButtonText: {
    ...typography.buttonLarge,
    color: glass.ctaText,
    fontWeight: "700",
  },
  buttonDisabled: { backgroundColor: colors.status.disabled, opacity: 0.7 },
  pressed: { opacity: 0.85 },
  toggleRow: {
    marginTop: spacing[6],
    alignSelf: "center",
  },
  toggleText: {
    ...typography.label,
    color: "#86efac",
  },
  infoBox: {
    backgroundColor: "rgba(67,160,71,0.14)",
    borderColor: "rgba(67,160,71,0.4)",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    width: "100%",
  },
  infoText: {
    ...typography.bodySmall,
    color: "#86efac",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,67,54,0.12)",
    borderColor: "rgba(244,67,54,0.4)",
    borderWidth: 1,
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
    color: "#fca5a5",
    flex: 1,
  },
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[6],
  },
  registerText: {
    ...typography.body,
    color: glass.textMuted,
  },
  registerLink: {
    ...typography.label,
    color: "#86efac",
    fontWeight: "700",
  },
});
