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

const PIN_LENGTH = 6;

type Stage = "enter" | "confirm";

export default function PasscodeSetupScreen() {
  const router = useRouter();
  const setupPasscode = useAction(api.passcodeActions.setupPasscode);

  const [stage, setStage] = useState<Stage>("enter");
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [firstPasscode, setFirstPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = useRef<(TextInput | null)[]>([]);

  const resetDigits = useCallback(() => {
    setDigits(Array(PIN_LENGTH).fill(""));
    setError(null);
    setTimeout(() => inputs.current[0]?.focus(), 50);
  }, []);

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

      if (cleaned.length === PIN_LENGTH) {
        const split = cleaned.split("");
        setDigits(split);
        inputs.current[PIN_LENGTH - 1]?.focus();
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
  const isComplete = code.length === PIN_LENGTH && /^\d{6}$/.test(code);

  const handleSubmit = useCallback(async () => {
    if (!isComplete || loading) return;

    if (stage === "enter") {
      setFirstPasscode(code);
      setStage("confirm");
      resetDigits();
      return;
    }

    if (code !== firstPasscode) {
      setError("Passcodes do not match. Try again.");
      setStage("enter");
      setFirstPasscode("");
      resetDigits();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await setupPasscode({ passcode: code });
      router.replace("/(tabs)/slots");
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "PASSCODE_003") {
        router.replace("/(tabs)/slots");
        return;
      }
      setError(appError.message);
      setStage("enter");
      setFirstPasscode("");
      resetDigits();
    } finally {
      setLoading(false);
    }
  }, [isComplete, loading, stage, code, firstPasscode, setupPasscode, router, resetDigits]);

  useEffect(() => {
    if (isComplete && !loading) {
      handleSubmit();
    }
  }, [isComplete, loading, handleSubmit]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.logo}>A3</Text>
        <Text style={styles.title}>
          {stage === "enter" ? "Set Settings Passcode" : "Confirm Passcode"}
        </Text>
        <Text style={styles.subtitle}>
          {stage === "enter"
            ? "Choose a 6-digit PIN to protect your club settings"
            : "Enter the same 6-digit PIN again to confirm"}
        </Text>

        <View style={styles.codeRow}>
          {digits.map((d, i) => (
            <TextInput
              key={`${stage}-${i}`}
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
              secureTextEntry
              autoFocus={i === 0}
              editable={!loading}
              accessibilityLabel={`Digit ${i + 1} of ${PIN_LENGTH}`}
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

        <Text style={styles.hint}>
          You'll need this passcode every time you access Settings or approve
          staff actions.
        </Text>
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
    textAlign: "center",
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
  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing[8],
    paddingHorizontal: spacing[4],
  },
});
