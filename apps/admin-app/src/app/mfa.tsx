import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

const CODE_LENGTH = 6;

export default function MfaScreen() {
  const router = useRouter();
  const verifyMfa = useAction(api.mfaActions.verifyMfaCode);
  const generateMfa = useAction(api.mfaActions.generateMfaCode);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      const cleaned = text.replace(/\D/g, "");
      if (cleaned.length === 0) {
        setDigits((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
        return;
      }

      if (cleaned.length === CODE_LENGTH) {
        const split = cleaned.split("");
        setDigits(split);
        inputs.current[CODE_LENGTH - 1]?.focus();
        return;
      }

      const char = cleaned[0];
      setDigits((prev) => {
        const next = [...prev];
        next[index] = char;
        return next;
      });
      if (index < CODE_LENGTH - 1) {
        inputs.current[index + 1]?.focus();
      }
    },
    [],
  );

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
  const isComplete = code.length === CODE_LENGTH && /^\d{6}$/.test(code);

  const handleVerify = useCallback(async () => {
    if (!isComplete || loading || frozen) return;
    setError(null);
    setLoading(true);

    try {
      await verifyMfa({ code });
      router.replace("/(tabs)");
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "AUTH_002") {
        setFrozen(true);
        setError("This account is frozen. Contact support.");
      } else if (appError.code === "AUTH_003") {
        setError("Invalid or expired code. Please try again.");
      } else if (appError.code === "RATE_001") {
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError(appError.message);
      }
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [isComplete, loading, frozen, code, verifyMfa, router]);

  useEffect(() => {
    if (isComplete && !loading && !frozen) {
      handleVerify();
    }
  }, [isComplete, loading, frozen, handleVerify]);

  const handleResend = useCallback(async () => {
    if (resending || resendCooldown > 0 || frozen) return;
    setResending(true);
    setError(null);

    try {
      await generateMfa();
      setResendCooldown(60);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "RATE_001") {
        setError("Code send rate limit reached. Please wait.");
      } else {
        setError(appError.message);
      }
    } finally {
      setResending(false);
    }
  }, [resending, resendCooldown, frozen, generateMfa]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.logo}>A3</Text>
        <Text style={styles.title}>Verification Code</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to your admin email
        </Text>

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
              maxLength={i === 0 ? CODE_LENGTH : 1}
              textContentType="oneTimeCode"
              autoFocus={i === 0}
              editable={!loading && !frozen}
              accessibilityLabel={`Digit ${i + 1} of ${CODE_LENGTH}`}
              selectTextOnFocus
            />
          ))}
        </View>

        {loading && (
          <ActivityIndicator
            color={colors.accent.green}
            style={{ marginTop: spacing[4] }}
          />
        )}

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

        {!frozen && (
          <Pressable
            style={({ pressed }) => [
              styles.resendButton,
              (resending || resendCooldown > 0) && styles.resendDisabled,
              pressed && styles.resendPressed,
            ]}
            onPress={handleResend}
            disabled={resending || resendCooldown > 0}
            accessibilityRole="button"
            accessibilityLabel={
              resendCooldown > 0
                ? `Re-send code available in ${resendCooldown} seconds`
                : "Re-send code"
            }
          >
            <Text
              style={[
                styles.resendText,
                (resending || resendCooldown > 0) && styles.resendTextDisabled,
              ]}
            >
              {resending
                ? "Sending..."
                : resendCooldown > 0
                  ? `Re-send code (${resendCooldown}s)`
                  : "Re-send code"}
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
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
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing[8],
  },
  codeRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
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
  codeBoxFilled: {
    borderColor: colors.accent.green,
  },
  codeBoxError: {
    borderColor: colors.status.error,
  },
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
  resendButton: {
    marginTop: spacing[6],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendPressed: {
    opacity: 0.7,
  },
  resendText: {
    ...typography.button,
    color: colors.accent.green,
  },
  resendTextDisabled: {
    color: colors.text.secondary,
  },
});
