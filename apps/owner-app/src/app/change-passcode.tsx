import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout, iosKeyboardAvoidingProps } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";

const PIN_LENGTH = 6;

type Stage = "current" | "new" | "confirm";

function PinRow({
  digits,
  inputs,
  onChange,
  onKeyPress,
}: {
  digits: string[];
  inputs: React.MutableRefObject<(TextInput | null)[]>;
  onChange: (text: string, index: number) => void;
  onKeyPress: (key: string, index: number) => void;
}): React.JSX.Element {
  return (
    <View style={styles.pinRow}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          style={styles.pinBox}
          value={d}
          onChangeText={(t) => onChange(t, i)}
          onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key, i)}
          keyboardType="number-pad"
          maxLength={i === 0 ? PIN_LENGTH : 1}
          secureTextEntry
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

export default function ChangePasscodeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const changePasscode = useAction(api.passcodeActions.changePasscode);
  const resetViaEmail = useAction(api.passcodeActions.resetPasscodeViaEmail);

  const [stage, setStage] = useState<Stage>("current");
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
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
        setDigits(cleaned.split(""));
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

  const stageTitle =
    stage === "current"
      ? t("ownerApp.settings.passcode.enterCurrent")
      : stage === "new"
        ? t("ownerApp.settings.passcode.enterNew")
        : t("ownerApp.settings.passcode.confirmNew");

  const handleSubmit = useCallback(async () => {
    if (!isComplete || loading) return;

    if (stage === "current") {
      setCurrentPasscode(code);
      setStage("new");
      resetDigits();
      return;
    }

    if (stage === "new") {
      setNewPasscode(code);
      setStage("confirm");
      resetDigits();
      return;
    }

    if (code !== newPasscode) {
      setError(t("ownerApp.settings.passcode.mismatch"));
      setStage("new");
      setNewPasscode("");
      resetDigits();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await changePasscode({ currentPasscode, newPasscode: code });
      Alert.alert(t("ownerApp.settings.passcode.updatedTitle"), t("ownerApp.settings.passcode.updatedBody"), [
        { text: t("ownerApp.settings.passcode.ok"), onPress: () => router.back() },
      ]);
    } catch (e) {
      const appError = parseConvexError(e as Error);
      if (appError.code === "PASSCODE_001") {
        setError(t("ownerApp.settings.passcode.currentIncorrect"));
        setStage("current");
        setCurrentPasscode("");
        setNewPasscode("");
        resetDigits();
      } else {
        setError(appError.message);
      }
    } finally {
      setLoading(false);
    }
  }, [
    isComplete,
    loading,
    stage,
    code,
    newPasscode,
    currentPasscode,
    changePasscode,
    resetDigits,
    router,
    t,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} {...iosKeyboardAvoidingProps}>
        <View style={styles.pad}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backHit}
            accessibilityRole="button"
            accessibilityLabel={t("auth.owner.changePasscode.back")}
          >
            <Text style={styles.backLabel}>{t("auth.owner.changePasscode.back")}</Text>
          </Pressable>

          <Text style={styles.title}>{t("ownerApp.settings.passcode.changeTitle")}</Text>
          <Text style={styles.body}>{stageTitle}</Text>

          <PinRow
            digits={digits}
            inputs={inputs}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
          />

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <Pressable
            style={[styles.primary, (!isComplete || loading) && styles.primaryDisabled]}
            disabled={!isComplete || loading}
            onPress={() => void handleSubmit()}
          >
            {loading ? (
              <ActivityIndicator color="#0D1117" />
            ) : (
              <Text style={styles.primaryText}>
                {stage === "confirm"
                  ? t("ownerApp.settings.passcode.updatePasscode")
                  : t("ownerApp.settings.passcode.continue")}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkWrap}
            disabled={loading}
            onPress={() => {
              Alert.alert(
                t("ownerApp.settings.passcode.resetViaEmailTitle"),
                t("ownerApp.settings.passcode.resetViaEmailBody"),
                [
                  { text: t("auth.owner.changePasscode.cancel"), style: "cancel" },
                  {
                    text: t("ownerApp.settings.passcode.sendEmail"),
                    onPress: () => {
                      void (async () => {
                        setLoading(true);
                        try {
                          await resetViaEmail({});
                          Alert.alert(
                            t("ownerApp.settings.passcode.checkEmailTitle"),
                            t("ownerApp.settings.passcode.checkEmailBody"),
                            [{ text: t("ownerApp.settings.passcode.ok"), onPress: () => router.back() }],
                          );
                        } catch (e) {
                          Alert.alert(parseConvexError(e as Error).message);
                        } finally {
                          setLoading(false);
                        }
                      })();
                    },
                  },
                ],
              );
            }}
          >
            <Text style={styles.link}>{t("ownerApp.settings.passcode.forgotResetLink")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  flex: { flex: 1 },
  pad: { padding: layout.screenPadding },
  backHit: { marginBottom: spacing[3] },
  backLabel: { ...typography.body, color: colors.accent.green, fontWeight: "600" },
  title: { ...typography.heading3, color: colors.text.primary },
  body: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing[2] },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[6],
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  pinBox: {
    flex: 1,
    maxWidth: 48,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    textAlign: "center",
    fontSize: 22,
    color: colors.text.primary,
  },
  err: { ...typography.caption, color: colors.status.error, marginBottom: spacing[2] },
  primary: {
    marginTop: spacing[2],
    backgroundColor: colors.accent.green,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { ...typography.buttonLarge, color: "#0D1117" },
  linkWrap: { marginTop: spacing[5], alignSelf: "center" },
  link: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textDecorationLine: "underline",
  },
});
