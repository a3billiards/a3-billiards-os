import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useAction,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout, iosKeyboardAvoidingProps } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { usePostLoginNavigation } from "@a3/ui/hooks";
import { useTranslation } from "@a3/i18n";

const PIN_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;
const LOCKOUT_SEC = 300; // 5 minutes after 3 wrong attempts

type ScreenMode =
  | "input"       // normal OTP entry
  | "locked"      // OTP_001: 3 wrong attempts → 5-min countdown
  | "expired"     // OTP_002: code expired → show re-send
  | "rateLimited" // OTP_003: hourly limit hit → wait 1 hour
  | "sending"     // initial send or resend in progress
  | "verifying";  // verifyOtp call in flight

export default function VerifyPhoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { schedulePostLogin } = usePostLoginNavigation();
  const raw = useLocalSearchParams<{ phone: string }>().phone;
  // Expo Router can URL-encode '+' as '%2B' — decode it back to E.164
  const phone = Array.isArray(raw)
    ? decodeURIComponent(raw[0] ?? "")
    : decodeURIComponent(raw ?? "");
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const sendOtp = useAction(api.otp.sendOtp);
  const verifyOtp = useAction(api.otp.verifyOtp);
  const updateUser = useMutation(api.users.updateUser);
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  const [mode, setMode] = useState<ScreenMode>("input");
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [otpRequested, setOtpRequested] = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  // ── Resend cooldown timer (60s between sends) ──
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(
      () => setResendCooldown((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [resendCooldown]);

  // ── Lock countdown timer (5-min after 3 wrong attempts) ──
  useEffect(() => {
    if (lockCountdown <= 0) return;
    const id = setInterval(() => {
      setLockCountdown((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setMode("expired");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockCountdown]);

  const resetDigits = useCallback(() => {
    setDigits(Array(PIN_LENGTH).fill(""));
    setError(null);
    setTimeout(() => inputs.current[0]?.focus(), 50);
  }, []);

  const requestOtp = useCallback(async () => {
    if (!phone) {
      setError(t("auth.owner.verifyPhone.missingPhone"));
      return;
    }
    if (authLoading) return;
    if (isAuthenticated && currentUser === undefined) return;

    setError(null);
    setMode("sending");
    try {
      const verificationUserId =
        isAuthenticated && currentUser != null ? currentUser._id : undefined;
      await sendOtp({ phone, verificationUserId });
      setOtpRequested(true);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setLockCountdown(0);
      setMode("input");
      resetDigits();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "OTP_003") {
        setMode("rateLimited");
        setOtpRequested(false);
      } else {
        setError(appError.message);
        setMode("input");
      }
    }
  }, [
    phone,
    authLoading,
    isAuthenticated,
    currentUser,
    sendOtp,
    resetDigits,
  ]);

  // ── Digit input handling ──
  const handleChange = useCallback((text: string, index: number) => {
    const cleaned = text.replace(/\D/g, "");

    if (cleaned.length === PIN_LENGTH) {
      setDigits(cleaned.split(""));
      inputs.current[PIN_LENGTH - 1]?.focus();
      return;
    }

    if (cleaned.length === 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    const char = cleaned[0];
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (index < PIN_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace" && digits[index] === "" && index > 0) {
        inputs.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
      }
    },
    [digits],
  );

  const code = digits.join("");
  const isComplete = code.length === PIN_LENGTH && /^\d{6}$/.test(code);

  // ── Verify OTP ──
  const handleVerify = useCallback(async () => {
    if (!otpRequested) {
      setError(t("auth.owner.verifyPhone.sendOtpFirst"));
      return;
    }
    if (!isComplete || mode !== "input" || !phone) {
      return;
    }
    if (authLoading) {
      return;
    }
    if (isAuthenticated && currentUser === undefined) {
      return;
    }
    setError(null);
    setMode("verifying");

    try {
      const userIdForOtp =
        isAuthenticated && currentUser != null ? currentUser._id : undefined;

      await verifyOtp({
        phone,
        code,
        userId: userIdForOtp,
      });

      if (isAuthenticated) {
        await updateUser({ phone });
      }

      schedulePostLogin();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      switch (appError.code) {
        case "OTP_001":
          setLockCountdown(LOCKOUT_SEC);
          setMode("locked");
          setError(null);
          break;
        case "OTP_002":
          if (appError.message.toLowerCase().includes("expired")) {
            setMode("expired");
            setError(null);
          } else {
            setError(appError.message || t("auth.owner.verifyPhone.wrongOtp"));
            setMode("input");
          }
          break;
        case "OTP_003":
          setMode("rateLimited");
          setError(null);
          break;
        default:
          setError(appError.message);
          setMode("input");
      }
      resetDigits();
    }
  }, [
    isComplete,
    mode,
    phone,
    verifyOtp,
    code,
    updateUser,
    router,
    resetDigits,
    isAuthenticated,
    currentUser,
    authLoading,
    otpRequested,
    t,
  ]);

  // ── Resend OTP ──
  const handleResend = useCallback(async () => {
    if (!otpRequested) return;
    if (resendCooldown > 0 || !phone) return;
    if (mode === "verifying" || mode === "sending") return;
    void requestOtp();
  }, [otpRequested, resendCooldown, phone, mode, requestOtp]);

  const maskedPhone = phone
    ? `${phone.slice(0, 4)}••••${phone.slice(-3)}`
    : "";

  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // True while auth or current-user query is still resolving — gate action buttons.
  const awaitingUser =
    authLoading || (isAuthenticated && currentUser === undefined);

  const inputVisible = otpRequested && (mode === "input" || mode === "verifying");
  const showResend =
    mode === "input" || mode === "expired";

  return (
    <KeyboardAvoidingView style={styles.flex} {...iosKeyboardAvoidingProps}>
      <View style={styles.container}>
        <Text style={styles.logo}>{t("auth.owner.verifyPhone.logo")}</Text>
        <Text style={styles.title}>{t("auth.owner.verifyPhone.title")}</Text>
        <Text style={styles.subtitle}>
          {t("auth.owner.verifyPhone.subtitle")}{"\n"}
          <Text style={styles.phoneBold}>{maskedPhone}</Text>
        </Text>

        {/* ── OTP_001: locked (3 wrong attempts) ── */}
        {mode === "locked" && (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>⏳</Text>
            <Text style={styles.lockTitle}>{t("auth.owner.verifyPhone.lockedTitle")}</Text>
            <Text style={styles.lockTimer}>
              {t("auth.owner.verifyPhone.tryAgainIn", { time: formatCountdown(lockCountdown) })}
            </Text>
            <Text style={styles.lockHint}>{t("auth.owner.verifyPhone.lockedHint")}</Text>
          </View>
        )}

        {/* ── OTP_003: rate limited ── */}
        {mode === "rateLimited" && (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>🚫</Text>
            <Text style={styles.lockTitle}>{t("auth.owner.verifyPhone.rateLimitedTitle")}</Text>
            <Text style={styles.lockHint}>{t("auth.owner.verifyPhone.rateLimitedBody")}</Text>
          </View>
        )}

        {/* ── OTP_002: expired ── */}
        {mode === "expired" && (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>⏰</Text>
            <Text style={styles.lockTitle}>{t("auth.owner.verifyPhone.expiredTitle")}</Text>
            <Text style={styles.lockHint}>{t("auth.owner.verifyPhone.expiredHint")}</Text>
          </View>
        )}

        {/* ── Sending spinner ── */}
        {mode === "sending" && (
          <View style={styles.sendingBox}>
            <ActivityIndicator size="large" color={colors.accent.green} />
            <Text style={styles.sendingText}>{t("auth.owner.verifyPhone.sendingCode")}</Text>
          </View>
        )}

        {/* ── Manual send button: OTP only on click ── */}
        {!otpRequested && mode !== "rateLimited" && mode !== "sending" && (
          <Pressable
            style={({ pressed }) => [
              styles.verifyButton,
              awaitingUser && styles.resendDisabled,
              pressed && !awaitingUser && styles.pressed,
            ]}
            onPress={requestOtp}
            disabled={awaitingUser}
            accessibilityRole="button"
            accessibilityLabel={t("auth.owner.verifyPhone.sendOtp")}
          >
            <Text style={styles.verifyButtonText}>{t("auth.owner.verifyPhone.sendOtp")}</Text>
          </Pressable>
        )}

        {/* ── Normal OTP input ── */}
        {inputVisible && (
          <>
            <View style={styles.codeRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  style={[
                    styles.codeBox,
                    d !== "" && styles.codeBoxFilled,
                    error !== null && styles.codeBoxError,
                  ]}
                  value={d}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, i)
                  }
                  keyboardType="number-pad"
                  maxLength={i === 0 ? PIN_LENGTH : 1}
                  autoFocus={i === 0}
                  editable={mode === "input"}
                  accessibilityLabel={t("auth.owner.verifyPhone.digitLabel", {
                    index: i + 1,
                    total: PIN_LENGTH,
                  })}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* ── Verify button (shown when all 6 digits filled) ── */}
            {mode === "input" && otpRequested && isComplete && !awaitingUser && (
              <Pressable
                style={({ pressed }) => [
                  styles.verifyButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleVerify}
                accessibilityRole="button"
                accessibilityLabel={t("auth.owner.verifyPhone.verifyCode")}
              >
                <Text style={styles.verifyButtonText}>{t("auth.owner.verifyPhone.verifyCode")}</Text>
              </Pressable>
            )}

            {(mode === "verifying" || (isComplete && awaitingUser)) && (
              <ActivityIndicator
                color={colors.accent.green}
                style={{ marginTop: spacing[4] }}
              />
            )}
          </>
        )}

        {/* ── Generic error ── */}
        {error !== null && (
          <View
            style={styles.errorBox}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.errorLabel}>{t("auth.owner.verifyPhone.error")}</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Resend button ── */}
        {otpRequested && showResend && (
          <Pressable
            style={({ pressed }) => [
              mode === "expired"
                ? styles.resendButtonPrimary
                : styles.resendButton,
              (resendCooldown > 0 && mode !== "expired") &&
                styles.resendDisabled,
              pressed &&
                resendCooldown === 0 &&
                styles.pressed,
            ]}
            onPress={handleResend}
            disabled={resendCooldown > 0 && mode !== "expired"}
            accessibilityRole="button"
            accessibilityLabel={
              resendCooldown > 0
                ? t("auth.owner.verifyPhone.resendIn", { seconds: resendCooldown })
                : t("auth.owner.verifyPhone.resendCode")
            }
          >
            <Text
              style={[
                mode === "expired"
                  ? styles.resendButtonPrimaryText
                  : styles.resendText,
                resendCooldown > 0 &&
                  mode !== "expired" &&
                  styles.resendTextDisabled,
              ]}
            >
              {mode === "expired"
                ? t("auth.owner.verifyPhone.sendNewCode")
                : resendCooldown > 0
                  ? t("auth.owner.verifyPhone.resendIn", { seconds: resendCooldown })
                  : t("auth.owner.verifyPhone.resendCode")}
            </Text>
          </Pressable>
        )}

        {/* ── Resend after lockout ends ── */}
        {mode === "locked" && lockCountdown <= 0 && (
          <Pressable
            style={styles.resendButtonPrimary}
            onPress={handleResend}
            accessibilityRole="button"
            accessibilityLabel={t("auth.owner.verifyPhone.sendNewCode")}
          >
            <Text style={styles.resendButtonPrimaryText}>{t("auth.owner.verifyPhone.sendNewCode")}</Text>
          </Pressable>
        )}

        {inputVisible && (
          <Text style={styles.hint}>{t("auth.owner.verifyPhone.continueHint")}</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg.primary },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
    maxWidth: layout.modalMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  logo: {
    ...typography.heading1,
    fontSize: 48,
    color: colors.accent.green,
    letterSpacing: 4,
    marginBottom: spacing[1],
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[1],
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing[8],
  },
  phoneBold: {
    ...typography.label,
    color: colors.text.primary,
  },

  // ── Code input ──
  codeRow: { flexDirection: "row", gap: spacing[2] },
  codeBox: {
    width: 48,
    height: 56,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
    textAlign: "center",
    ...typography.monoLarge,
    color: colors.text.primary,
  },
  codeBoxFilled: { borderColor: colors.accent.green },
  codeBoxError: { borderColor: colors.status.error },

  // ── Lock / rate limit / expired states ──
  lockBox: {
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    width: "100%",
  },
  lockIcon: { fontSize: 40, marginBottom: spacing[4] },
  lockTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing[2],
  },
  lockTimer: {
    ...typography.monoLarge,
    color: colors.accent.amber,
    textAlign: "center",
    marginBottom: spacing[3],
  },
  lockHint: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center",
  },

  // ── Sending state ──
  sendingBox: { alignItems: "center", gap: spacing[4] },
  sendingText: {
    ...typography.body,
    color: colors.text.secondary,
  },

  // ── Error ──
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,67,54,0.12)",
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    maxWidth: "100%",
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

  // ── Resend (text link style) ──
  resendButton: {
    marginTop: spacing[6],
    minHeight: layout.touchTarget,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing[4],
  },
  resendDisabled: { opacity: 0.5 },
  resendText: { ...typography.label, color: colors.accent.green },
  resendTextDisabled: { color: colors.text.secondary },

  // ── Resend (prominent button for expired / post-lock) ──
  resendButtonPrimary: {
    height: layout.buttonHeight,
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    paddingHorizontal: spacing[8],
    minHeight: layout.touchTarget,
  },
  resendButtonPrimaryText: {
    ...typography.buttonLarge,
    color: colors.bg.primary,
  },
  pressed: { opacity: 0.85 },

  verifyButton: {
    height: layout.buttonHeight,
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    paddingHorizontal: spacing[8],
    minWidth: 180,
  },
  verifyButtonText: {
    ...typography.buttonLarge,
    color: colors.bg.primary,
  },

  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing[8],
    paddingHorizontal: spacing[4],
  },
});
