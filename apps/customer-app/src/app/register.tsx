import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { GlassPageBackground, LiquidGlassCard, KeyboardFormScroll } from "@a3/ui/components";

const PRIVACY_URL = "https://a3billiards.com/privacy";
const TOS_URL = "https://a3billiards.com/terms";

type Step = "details" | "code";

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const sendSignupOtp = useAction(api.phoneOtp.sendSignupOtp);

  const [step, setStep] = useState<Step>("details");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91");
  const [age, setAge] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  const parsedAge = Number(age);
  const ageValid =
    age.length > 0 && Number.isInteger(parsedAge) && parsedAge >= 18;
  const phoneValid = /^\+[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ""));
  const emailValid =
    email.trim().length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameValid = name.trim().length >= 2;
  const codeValid = /^\d{6}$/.test(code.replace(/\s/g, ""));

  const canSendOtp =
    nameValid && emailValid && phoneValid && ageValid && consent && !loading;

  const handleSendOtp = useCallback(async () => {
    if (!canSendOtp) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await sendSignupOtp({ phone: phone.replace(/\s/g, "") });
      setStep("code");
      setInfo("OTP sent via WhatsApp.");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      switch (appErr.code) {
        case "OTP_005":
          setError(
            "Invalid phone number. Use country code, e.g. +91XXXXXXXXXX",
          );
          break;
        case "OTP_006":
          setError("This phone number cannot be used for registration.");
          break;
        case "OTP_007":
          setError(
            "This phone is already registered. Please sign in instead.",
          );
          break;
        case "OTP_003":
          setError("Too many OTP requests. Please wait a few minutes.");
          break;
        default:
          setError(appErr.message ?? "Could not send OTP.");
      }
    } finally {
      setLoading(false);
    }
  }, [canSendOtp, phone, sendSignupOtp]);

  const handleVerifyAndSignUp = useCallback(async () => {
    if (!codeValid || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const { signingIn } = await signIn("phoneOtp", {
        phone: phone.replace(/\s/g, ""),
        code: code.replace(/\s/g, ""),
        flow: "signUp",
        name: name.trim(),
        age: parsedAge,
        consentGiven: true,
        ...(trimmedEmail.length > 0 ? { email: trimmedEmail } : {}),
      });
      if (!signingIn) {
        setError("Sign-up failed. Please try again.");
        setLoading(false);
        return;
      }
      router.replace("/set-password?from=register");
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
        case "OTP_007":
          setError(
            "This phone is already registered. Please sign in instead.",
          );
          break;
        case "AUTH_005":
          setError("You must agree to the Privacy Policy and Terms.");
          break;
        case "AUTH_007":
          setError("You must be 18 or older to register.");
          break;
        case "DATA_001":
          setError("Name is required.");
          break;
        default:
          setError("Could not complete sign-up. Please try again.");
      }
      setLoading(false);
    }
  }, [
    codeValid,
    loading,
    email,
    signIn,
    phone,
    code,
    name,
    parsedAge,
    router,
  ]);

  return (
    <GlassPageBackground>
    <KeyboardFormScroll contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <View style={styles.logoTile}>
            <Text style={styles.logoText}>A3</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            {step === "details"
              ? "Join A3 Billiards. We'll verify your phone via WhatsApp."
              : "Enter the 6-digit code we sent to your WhatsApp."}
          </Text>

          <LiquidGlassCard style={styles.formCard} padding={20}>
          {step === "details" ? (
            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!loading}
              />

              <Text style={[styles.label, styles.fieldGap]}>
                Email <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                ref={emailRef}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                editable={!loading}
              />

              <Text style={[styles.label, styles.fieldGap]}>Phone Number</Text>
              <TextInput
                ref={phoneRef}
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91XXXXXXXXXX"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => ageRef.current?.focus()}
                editable={!loading}
              />
              <Text style={styles.hint}>
                E.164 format. We&apos;ll send a 6-digit OTP via WhatsApp.
              </Text>

              <Text style={[styles.label, styles.fieldGap]}>Age</Text>
              <TextInput
                ref={ageRef}
                style={styles.input}
                value={age}
                onChangeText={(t) => setAge(t.replace(/\D/g, ""))}
                placeholder="18"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
                returnKeyType="done"
                editable={!loading}
              />

              <Pressable
                style={styles.consentRow}
                onPress={() => setConsent((p) => !p)}
                disabled={loading}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
              >
                <View
                  style={[styles.checkbox, consent && styles.checkboxChecked]}
                >
                  {consent && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentText}>
                  I agree to the{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(PRIVACY_URL)}
                  >
                    Privacy Policy
                  </Text>
                  {" "}and{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(TOS_URL)}
                  >
                    Terms of Service
                  </Text>
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSendOtp && styles.buttonDisabled,
                  pressed && canSendOtp && styles.pressed,
                ]}
                onPress={handleSendOtp}
                disabled={!canSendOtp}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg.primary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>OTP Code</Text>
              <TextInput
                ref={codeRef}
                style={styles.input}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
                returnKeyType="go"
                onSubmitEditing={handleVerifyAndSignUp}
                editable={!loading}
              />
              <Text style={styles.hint}>
                Sent to {phone.replace(/\s/g, "")} via WhatsApp.
              </Text>

              <Pressable
                onPress={handleSendOtp}
                disabled={loading || !canSendOtp}
                hitSlop={8}
                style={styles.resendRow}
              >
                <Text
                  style={[
                    styles.resendText,
                    (loading || !canSendOtp) && styles.disabledText,
                  ]}
                >
                  Resend OTP
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!codeValid || loading) && styles.buttonDisabled,
                  pressed && codeValid && !loading && styles.pressed,
                ]}
                onPress={handleVerifyAndSignUp}
                disabled={!codeValid || loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg.primary} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Verify & Create Account
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setStep("details");
                  setCode("");
                  setError(null);
                  setInfo(null);
                }}
                disabled={loading}
                hitSlop={8}
                style={styles.toggleRow}
              >
                <Text style={styles.toggleText}>← Edit details</Text>
              </Pressable>
            </View>
          )}

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

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable
              onPress={() => router.replace("/login")}
              disabled={loading}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.loginLink}>Sign In</Text>
            </Pressable>
          </View>
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
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    backgroundColor: glass.iconTileBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  logoText: {
    fontSize: 24,
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
  optional: {
    ...typography.caption,
    color: glass.textLabel,
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
  hint: {
    ...typography.caption,
    color: glass.textLabel,
    marginTop: spacing[1],
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: glass.cardBorder,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#86efac",
    borderColor: "#86efac",
  },
  checkmark: {
    color: "#052e16",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  consentText: {
    ...typography.bodySmall,
    color: glass.textMuted,
    flex: 1,
    paddingTop: 2,
  },
  consentLink: {
    color: "#86efac",
    textDecorationLine: "underline",
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
    backgroundColor: "#86efac",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
  },
  primaryButtonText: {
    ...typography.buttonLarge,
    color: "#052e16",
    fontWeight: "700",
  },
  buttonDisabled: { backgroundColor: colors.status.disabled, opacity: 0.7 },
  pressed: { opacity: 0.85 },
  toggleRow: { marginTop: spacing[4], alignSelf: "center" },
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
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[6],
  },
  loginText: {
    ...typography.body,
    color: glass.textMuted,
  },
  loginLink: {
    ...typography.label,
    color: "#86efac",
    fontWeight: "700",
  },
});
