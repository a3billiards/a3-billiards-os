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
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { LoginLanguagePicker, useTranslation } from "@a3/i18n";
import { GlassPageBackground, LiquidGlassCard, KeyboardFormScroll, PhoneInput } from "@a3/ui/components";
import { usePostLoginNavigation } from "@a3/ui/hooks";
import { DEFAULT_PHONE_E164, isValidE164, normalizeE164 } from "@a3/utils/phone";
import { parseOtpAttemptsRemaining, parseOtpLockoutSeconds } from "@a3/utils/otp";

type Mode = "password" | "otp";
type PhoneStep = "enterPhone" | "enterCode";

const FROZEN_MESSAGE_KEY = "auth.customer.login.frozen";

export default function CustomerLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { frozen } = useLocalSearchParams<{ frozen?: string }>();
  const { signIn } = useAuthActions();
  const sendLoginOtp = useAction(api.phoneOtp.sendLoginOtp);

  const [mode, setMode] = useState<Mode>("otp");

  const [phone, setPhone] = useState(DEFAULT_PHONE_E164);
  const [password, setPassword] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enterPhone");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<TextInput>(null);
  const sendingOtpRef = useRef(false);
  const passwordRef = useRef<TextInput>(null);
  const { schedulePostLogin, isWaitingForAuth } = usePostLoginNavigation();

  useEffect(() => {
    if (frozen === "1") {
      setError(t(FROZEN_MESSAGE_KEY));
    }
  }, [frozen, t]);

  const normalizedPhone = normalizeE164(phone);
  const phoneValid = isValidE164(normalizedPhone);
  const codeValid = /^\d{6}$/.test(code.replace(/\s/g, ""));
  const canSubmitPassword =
    phoneValid && password.length >= 8 && !loading && !isWaitingForAuth;

  const handlePasswordLogin = useCallback(async () => {
    if (!canSubmitPassword) return;
    setError(null);
    setLoading(true);
    try {
      const { signingIn } = await signIn("password", {
        email: normalizedPhone,
        password,
        flow: "signIn",
      });
      if (!signingIn) {
        setError(t("auth.customer.login.signInFailed"));
        setLoading(false);
        return;
      }
      schedulePostLogin();
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      if (appErr.code === "AUTH_002") {
        setError(t(FROZEN_MESSAGE_KEY));
      } else if (appErr.code === "AUTH_006") {
        setError(t("auth.customer.login.pendingDeletion"));
      } else {
        setError(t("auth.customer.login.invalidCredentials"));
      }
      setLoading(false);
    }
  }, [canSubmitPassword, normalizedPhone, password, signIn, schedulePostLogin, t]);

  const handleSendOtp = useCallback(async () => {
    if (!phoneValid || loading) return;
    if (sendingOtpRef.current) return;
    sendingOtpRef.current = true;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await sendLoginOtp({ phone: normalizedPhone });
      setPhoneStep("enterCode");
      setInfo(t("auth.customer.login.otpSent"));
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      switch (appErr.code) {
        case "AUTH_009":
          setError(t("auth.customer.login.noAccount"));
          break;
        case "AUTH_002":
          setError(t(FROZEN_MESSAGE_KEY));
          break;
        case "AUTH_006":
          setError(t("auth.customer.login.pendingDeletion"));
          break;
        case "OTP_003":
          setError(t("auth.customer.login.tooManyOtp"));
          break;
        case "OTP_005":
          setError(t("auth.customer.login.invalidPhone"));
          break;
        default:
          setError(appErr.message ?? t("auth.customer.login.couldNotSendOtp"));
      }
    } finally {
      sendingOtpRef.current = false;
      setLoading(false);
    }
  }, [phoneValid, normalizedPhone, loading, sendLoginOtp, t]);

  const handleVerifyOtp = useCallback(async () => {
    if (!codeValid || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { signingIn } = await signIn("phoneOtp", {
        phone: normalizedPhone,
        code: code.replace(/\s/g, ""),
        flow: "signIn",
      });
      if (!signingIn) {
        setError(t("auth.customer.login.signInFailedGeneric"));
        setLoading(false);
        return;
      }
      schedulePostLogin();
    } catch (e) {
      const appErr = parseConvexError(e as Error);
      switch (appErr.code) {
        case "OTP_001": {
          const lockSec = parseOtpLockoutSeconds(appErr.message);
          if (lockSec) {
            const mins = Math.max(1, Math.ceil(lockSec / 60));
            setError(t("auth.customer.login.lockoutWait", { minutes: mins }));
          } else {
            setError(t("auth.customer.login.tooManyAttempts"));
          }
          break;
        }
        case "OTP_002": {
          const remaining = parseOtpAttemptsRemaining(appErr.message);
          setError(
            remaining !== null
              ? t("auth.customer.login.wrongOtpRemaining", { remaining })
              : appErr.message ?? t("auth.customer.login.wrongOtp"),
          );
          break;
        }
        case "AUTH_002":
          setError(t(FROZEN_MESSAGE_KEY));
          break;
        case "AUTH_006":
          setError(t("auth.customer.login.pendingDeletion"));
          break;
        case "AUTH_009":
          setError(t("auth.customer.login.noAccount"));
          break;
        default:
          setError(t("auth.customer.login.couldNotVerifyOtp"));
      }
      setLoading(false);
    }
  }, [code, codeValid, normalizedPhone, loading, signIn, schedulePostLogin, t]);

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setError(null);
      setInfo(null);
      setPhoneStep("enterPhone");
      setCode("");
      setPassword("");
    },
    [],
  );

  return (
    <GlassPageBackground>
    <KeyboardFormScroll contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <LoginLanguagePicker />
          <View style={styles.logoTile}>
            <Text style={styles.logoText}>A3</Text>
          </View>
          <Text style={styles.title}>{t("auth.customer.login.title")}</Text>
          <Text style={styles.subtitle}>
            {mode === "password"
              ? t("auth.customer.login.subtitlePassword")
              : t("auth.customer.login.subtitleOtp")}
          </Text>
          <LiquidGlassCard style={styles.formCard} padding={24}>

          {mode === "password" ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t("auth.customer.login.phone")}</Text>
              <PhoneInput
                value={phone}
                onChangeValue={setPhone}
                editable={!loading}
                countryCodeLabel={t("auth.phone.countryCode")}
                selectCountryLabel={t("auth.phone.selectCountry")}
                accessibilityLabel={t("auth.phone.number")}
                inputStyle={styles.input}
              />
              <Text style={styles.hint}>
                {mode === "password"
                  ? t("auth.customer.login.phoneHint")
                  : t("auth.customer.login.phoneHintOtp")}
              </Text>

              <Text style={[styles.label, styles.fieldGap]}>{t("auth.customer.login.password")}</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t("auth.customer.login.passwordPlaceholder")}
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handlePasswordLogin}
                editable={!loading}
                accessibilityLabel={t("common.accessibilityPassword")}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSubmitPassword && styles.buttonDisabled,
                  pressed && canSubmitPassword && styles.pressed,
                ]}
                onPress={handlePasswordLogin}
                disabled={!canSubmitPassword}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={glass.ctaText} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t("auth.customer.login.signIn")}</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>{t("auth.customer.login.phone")}</Text>
              <PhoneInput
                value={phone}
                onChangeValue={(value) => {
                  setPhone(value);
                  if (phoneStep === "enterCode") setPhoneStep("enterPhone");
                }}
                editable={!loading}
                countryCodeLabel={t("auth.phone.countryCode")}
                selectCountryLabel={t("auth.phone.selectCountry")}
                accessibilityLabel={t("auth.phone.number")}
                inputStyle={styles.input}
              />
              <Text style={styles.hint}>{t("auth.customer.login.phoneHintOtp")}</Text>

              {phoneStep === "enterCode" ? (
                <>
                  <Text style={[styles.label, styles.fieldGap]}>{t("auth.customer.login.otp")}</Text>
                  <TextInput
                    ref={codeRef}
                    style={styles.input}
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder={t("auth.customer.login.otpPlaceholder")}
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="number-pad"
                    returnKeyType="go"
                    onSubmitEditing={handleVerifyOtp}
                    editable={!loading}
                    accessibilityLabel={t("common.accessibilityOtpCode")}
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
                      {t("auth.customer.login.resendOtp")}
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
                    {phoneStep === "enterPhone"
                      ? t("auth.customer.login.sendOtp")
                      : t("auth.customer.login.verifySignIn")}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => switchMode(mode === "password" ? "otp" : "password")}
            disabled={loading}
            hitSlop={8}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleText}>
              {mode === "password"
                ? t("auth.customer.login.useOtpInstead")
                : t("auth.customer.login.usePasswordInstead")}
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
              <Text style={styles.errorLabel}>{t("common.error")}</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          </LiquidGlassCard>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t("auth.customer.login.noAccountSignup")} </Text>
            <Pressable
              onPress={() => router.push("/register")}
              disabled={loading}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.registerLink}>{t("auth.customer.login.signUp")}</Text>
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
