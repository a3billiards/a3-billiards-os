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
  useQuery,
} from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, typography, spacing, radius, layout, glass, iosKeyboardAvoidingProps } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import { parseOtpAttemptsRemaining, parseOtpLockoutSeconds } from "@a3/utils/otp";

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
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { isAuthenticated } = useConvexAuth();
  const sendOtp = useAction(api.otp.sendOtp);
  const verifyOtp = useAction(api.otp.verifyOtp);
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  const [mode, setMode] = useState<ScreenMode>("sending");
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  const inputs = useRef<(TextInput | null)[]>([]);
  const sentInitial = useRef(false);

  // ── Auto-send OTP on mount (wait for current user when signed in — sendOtp needs verificationUserId) ──
  useEffect(() => {
    if (!phone || sentInitial.current) return;
    if (isAuthenticated && currentUser === undefined) return;

    sentInitial.current = true;

    setMode("sending");
    const verificationUserId =
      isAuthenticated && currentUser != null ? currentUser._id : undefined;
    sendOtp({ phone, verificationUserId })
      .then(() => {
        setResendCooldown(RESEND_COOLDOWN_SEC);
        setMode("input");
      })
      .catch((e) => {
        const appError = parseConvexError(e as Error);
        if (appError.code === "OTP_003") {
          setMode("rateLimited");
        } else {
          setError(appError.message);
          setMode("input");
        }
      });
  }, [phone, sendOtp, isAuthenticated, currentUser]);

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
    if (!isComplete || mode !== "input" || !phone) return;
    if (isAuthenticated && currentUser === undefined) return;
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

      // `verifyOtp` already persists `phone` (if missing) + `phoneVerified=true`
      // on the user. Calling `updateUser({ phone })` here is redundant and
      // hits PERM_001 because `phoneVerified` is now true on a customer.

      router.replace("/(tabs)/home");
    } catch (e) {
      const appError = parseConvexError(e as Error);
      switch (appError.code) {
        case "OTP_001": {
          const lockSec = parseOtpLockoutSeconds(appError.message) ?? LOCKOUT_SEC;
          setLockCountdown(lockSec);
          setMode("locked");
          setError(null);
          break;
        }
        case "OTP_002":
          if (appError.message.toLowerCase().includes("expired")) {
            setMode("expired");
            setError(null);
          } else {
            const remaining = parseOtpAttemptsRemaining(appError.message);
            setError(
              remaining !== null
                ? t("auth.customer.verifyPhone.incorrectCodeRemaining", { remaining })
                : appError.message,
            );
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
    router,
    resetDigits,
    isAuthenticated,
    currentUser,
    t,
  ]);

  // ── Auto-submit when all 6 digits entered ──
  useEffect(() => {
    if (isComplete && mode === "input") {
      handleVerify();
    }
  }, [isComplete, mode, handleVerify]);

  // ── Resend OTP ──
  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !phone) return;
    if (mode === "verifying" || mode === "sending") return;

    setError(null);
    setMode("sending");

    try {
      const verificationUserId =
        isAuthenticated && currentUser != null ? currentUser._id : undefined;
      await sendOtp({ phone, verificationUserId });
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setLockCountdown(0);
      setMode("input");
      resetDigits();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "OTP_003") {
        setMode("rateLimited");
      } else {
        setError(appError.message);
        setMode("input");
      }
    }
  }, [resendCooldown, phone, mode, sendOtp, resetDigits, isAuthenticated, currentUser]);

  const maskedPhone = phone
    ? `${phone.slice(0, 4)}••••${phone.slice(-3)}`
    : "";

  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const inputVisible = mode === "input" || mode === "verifying";
  const showResend =
    mode === "input" || mode === "expired";

  return (
    <GlassPageBackground>
    <KeyboardAvoidingView style={styles.flex} {...iosKeyboardAvoidingProps}>
      <View style={styles.container}>
        <Text style={styles.logo}>A3</Text>
        <Text style={styles.title}>{t("auth.customer.verifyPhone.title")}</Text>
        <Text style={styles.subtitle}>
          {t("auth.customer.verifyPhone.subtitle")}{"\n"}
          <Text style={styles.phoneBold}>{maskedPhone}</Text>
        </Text>

        {/* ── OTP_001: locked (3 wrong attempts) ── */}
        {mode === "locked" && (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>⏳</Text>
            <Text style={styles.lockTitle}>{t("auth.customer.verifyPhone.lockedTitle")}</Text>
            <Text style={styles.lockTimer}>
              {t("auth.customer.verifyPhone.tryAgainIn", {
                time: formatCountdown(lockCountdown),
              })}
            </Text>
            <Text style={styles.lockHint}>{t("auth.customer.verifyPhone.lockedHint")}</Text>
          </View>
        )}

        {/* ── OTP_003: rate limited ── */}
        {mode === "rateLimited" && (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>🚫</Text>
            <Text style={styles.lockTitle}>{t("auth.customer.verifyPhone.rateLimitedTitle")}</Text>
            <Text style={styles.lockHint}>{t("auth.customer.verifyPhone.rateLimitedBody")}</Text>
          </View>
        )}

        {/* ── OTP_002: expired ── */}
        {mode === "expired" && (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>⏰</Text>
            <Text style={styles.lockTitle}>{t("auth.customer.verifyPhone.expiredTitle")}</Text>
            <Text style={styles.lockHint}>{t("auth.customer.verifyPhone.expiredHint")}</Text>
          </View>
        )}

        {/* ── Sending spinner ── */}
        {mode === "sending" && (
          <View style={styles.sendingBox}>
            <ActivityIndicator size="large" color={glass.ctaBg} />
            <Text style={styles.sendingText}>{t("auth.customer.verifyPhone.sending")}</Text>
          </View>
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
                  accessibilityLabel={t("auth.customer.verifyPhone.digitAccessibility", {
                    index: i + 1,
                    total: PIN_LENGTH,
                  })}
                  selectTextOnFocus
                />
              ))}
            </View>

            {mode === "verifying" && (
              <ActivityIndicator
                color={glass.ctaBg}
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
            <Text style={styles.errorLabel}>{t("auth.customer.verifyPhone.errorLabel")}</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Resend button ── */}
        {showResend && (
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
                ? t("auth.customer.verifyPhone.resendAvailableIn", { seconds: resendCooldown })
                : t("auth.customer.verifyPhone.resendCode")
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
                ? t("auth.customer.verifyPhone.sendNewCode")
                : resendCooldown > 0
                  ? t("auth.customer.verifyPhone.resendCodeIn", { seconds: resendCooldown })
                  : t("auth.customer.verifyPhone.resendCode")}
            </Text>
          </Pressable>
        )}

        {/* ── Resend after lockout ends ── */}
        {mode === "locked" && lockCountdown <= 0 && (
          <Pressable
            style={styles.resendButtonPrimary}
            onPress={handleResend}
            accessibilityRole="button"
            accessibilityLabel={t("auth.customer.verifyPhone.sendNewCode")}
          >
            <Text style={styles.resendButtonPrimaryText}>
              {t("auth.customer.verifyPhone.sendNewCode")}
            </Text>
          </Pressable>
        )}

        {inputVisible && (
          <Text style={styles.hint}>{t("auth.customer.verifyPhone.inactiveHint")}</Text>
        )}
      </View>
    </KeyboardAvoidingView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "transparent" },
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
    color: glass.ctaBg,
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
    backgroundColor: glass.inputBg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: glass.inputBorder,
    textAlign: "center",
    ...typography.monoLarge,
    color: colors.text.primary,
  },
  codeBoxFilled: { borderColor: glass.inputBorderFocus },
  codeBoxError: { borderColor: colors.status.error },

  // ── Lock / rate limit / expired states ──
  lockBox: {
    alignItems: "center",
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
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
  resendText: { ...typography.label, color: glass.ctaBg },
  resendTextDisabled: { color: colors.text.secondary },

  // ── Resend (prominent button for expired / post-lock) ──
  resendButtonPrimary: {
    height: layout.buttonHeight,
    backgroundColor: glass.ctaBg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[6],
    paddingHorizontal: spacing[8],
    minHeight: layout.touchTarget,
  },
  resendButtonPrimaryText: {
    ...typography.buttonLarge,
    color: glass.ctaText,
  },
  pressed: { opacity: 0.85 },

  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing[8],
    paddingHorizontal: spacing[4],
  },
});
