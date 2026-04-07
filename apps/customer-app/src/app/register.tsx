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
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

const PRIVACY_URL = "https://a3billiards.com/privacy";
const TOS_URL = "https://a3billiards.com/terms";

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    googleId?: string;
    googleEmail?: string;
    googleName?: string;
  }>();
  const isGoogleFlow = Boolean(params.googleId);

  const { signIn } = useAuthActions();
  const createUser = useMutation(api.users.createUser);
  const completeGoogleReg = useAction(
    api.googleAuthActions.completeGoogleRegistration,
  );

  const [name, setName] = useState(params.googleName ?? "");
  const [email, setEmail] = useState(params.googleEmail ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+91");
  const [age, setAge] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  const parsedAge = Number(age);
  const ageValid = age.length > 0 && Number.isInteger(parsedAge) && parsedAge > 0;
  const phoneValid = /^\+91\d{10}$/.test(phone.replace(/\s/g, ""));
  const emailValid = email.trim().length > 0 && email.includes("@");
  const nameValid = name.trim().length > 0;

  const canSubmit =
    nameValid &&
    emailValid &&
    (isGoogleFlow || password.length >= 8) &&
    phoneValid &&
    ageValid &&
    consent &&
    !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);

    if (parsedAge < 18) {
      setError("You must be 18 or older to register.");
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = phone.replace(/\s/g, "");

      if (isGoogleFlow) {
        await completeGoogleReg({
          googleId: params.googleId!,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: normalizedPhone,
          age: parsedAge,
          consentGiven: true,
        });
      } else {
        await signIn("password", {
          email: email.trim().toLowerCase(),
          password,
          flow: "signUp",
        });

        await createUser({
          name: name.trim(),
          age: parsedAge,
          consentGiven: true,
        });
      }

      router.replace({
        pathname: "/verify-phone",
        params: { phone: normalizedPhone },
      });
    } catch (e) {
      const appError = parseConvexError(e as Error);
      switch (appError.code) {
        case "AUTH_005":
          setError("You must agree to the Privacy Policy and Terms.");
          break;
        case "AUTH_007":
          setError("You must be 18 or older to register.");
          break;
        case "OTP_005":
          setError("Invalid phone number. Use +91 followed by 10 digits.");
          break;
        case "OTP_006":
          setError("This phone number cannot be used for registration.");
          break;
        case "OTP_007":
          setError(
            "This phone number is already registered. Try signing in instead.",
          );
          break;
        case "CLUB_003":
          setError("This email is already registered. Try signing in.");
          break;
        default:
          setError(appError.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [
    canSubmit,
    parsedAge,
    phone,
    isGoogleFlow,
    completeGoogleReg,
    params.googleId,
    email,
    name,
    signIn,
    password,
    createUser,
    router,
  ]);

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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            {isGoogleFlow
              ? "Complete your profile to get started"
              : "Join A3 Billiards to book tables and more"}
          </Text>

          {/* ── Name ── */}
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
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={!loading}
              accessibilityLabel="Full name"
            />

            {/* ── Email ── */}
            <Text style={[styles.label, styles.fieldGap]}>Email</Text>
            <TextInput
              ref={emailRef}
              style={[
                styles.input,
                isGoogleFlow && styles.inputDisabled,
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() =>
                isGoogleFlow
                  ? phoneRef.current?.focus()
                  : passwordRef.current?.focus()
              }
              editable={!loading && !isGoogleFlow}
              accessibilityLabel="Email address"
            />

            {/* ── Password (hidden for Google flow, PRD v23) ── */}
            {!isGoogleFlow && (
              <>
                <Text style={[styles.label, styles.fieldGap]}>Password</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  editable={!loading}
                  accessibilityLabel="Password"
                />
              </>
            )}

            {/* ── Phone ── */}
            <Text style={[styles.label, styles.fieldGap]}>Phone Number</Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91XXXXXXXXXX"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              returnKeyType="next"
              onSubmitEditing={() => ageRef.current?.focus()}
              editable={!loading}
              accessibilityLabel="Phone number"
            />
            <Text style={styles.hint}>E.164 format: +91 followed by 10 digits</Text>

            {/* ── Age ── */}
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
              accessibilityLabel="Age"
            />

            {/* ── Consent checkbox ── */}
            <Pressable
              style={styles.consentRow}
              onPress={() => setConsent((prev) => !prev)}
              disabled={loading}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              accessibilityLabel="Agree to Privacy Policy and Terms of Service"
            >
              <View
                style={[
                  styles.checkbox,
                  consent && styles.checkboxChecked,
                ]}
              >
                {consent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                I agree to the{" "}
                <Text
                  style={styles.consentLink}
                  onPress={() => Linking.openURL(PRIVACY_URL)}
                  accessibilityRole="link"
                >
                  Privacy Policy
                </Text>
                {" "}and{" "}
                <Text
                  style={styles.consentLink}
                  onPress={() => Linking.openURL(TOS_URL)}
                  accessibilityRole="link"
                >
                  Terms of Service
                </Text>
              </Text>
            </Pressable>

            {/* ── Submit ── */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Create account"
              accessibilityState={{ disabled: !canSubmit }}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
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

          {/* ── Login link ── */}
          {!isGoogleFlow && (
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
          )}
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
    paddingVertical: spacing[8],
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
  form: { width: "100%" },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing[1.5],
  },
  fieldGap: { marginTop: spacing[4] },
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
  inputDisabled: {
    opacity: 0.6,
  },
  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
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
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  checkmark: {
    color: colors.bg.primary,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  consentText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    paddingTop: 2,
  },
  consentLink: {
    color: colors.accent.green,
    textDecorationLine: "underline",
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
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[8],
  },
  loginText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  loginLink: {
    ...typography.label,
    color: colors.accent.green,
  },
});
