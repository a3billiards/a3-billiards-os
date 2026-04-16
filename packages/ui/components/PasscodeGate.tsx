import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/spacing";

export interface PasscodeGateProps {
  /** Called after the 6-digit PIN verifies successfully. */
  onUnlock: () => void;
  /** Back / cancel — e.g. `router.back()`. */
  onCancel: () => void;
  /** Must throw on invalid PIN (e.g. Convex `verifyPasscode` action). */
  verifyPasscode: (passcode: string) => Promise<void>;
  title?: string;
  subtitle?: string;
}

export function PasscodeGate({
  onUnlock,
  onCancel,
  verifyPasscode,
  title = "Settings",
  subtitle = "Enter your 6-digit settings passcode to continue.",
}: PasscodeGateProps): React.JSX.Element {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const digits = pin.trim();
    if (!/^\d{6}$/.test(digits)) {
      setError("Enter your 6-digit settings passcode.");
      return;
    }
    setLoading(true);
    try {
      await verifyPasscode(digits);
      setPin("");
      onUnlock();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid passcode.";
      setError(msg.replace(/^[A-Z0-9_]+:\s*/, ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <TextInput
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          placeholder="••••••"
          placeholderTextColor={colors.text.tertiary}
          style={styles.pinInput}
          editable={!loading}
          onSubmitEditing={onSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D1117" />
          ) : (
            <Text style={styles.primaryBtnText}>Unlock</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg.primary },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
  },
  title: { ...typography.heading3, color: colors.text.primary },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  pinInput: {
    marginTop: spacing[5],
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    fontSize: 22,
    letterSpacing: 6,
    color: colors.text.primary,
    textAlign: "center",
  },
  error: {
    ...typography.caption,
    color: colors.status.error,
    marginTop: spacing[2],
  },
  primaryBtn: {
    marginTop: spacing[4],
    backgroundColor: colors.accent.green,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { ...typography.buttonLarge, color: "#0D1117" },
  cancelBtn: {
    marginTop: spacing[3],
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelBtnText: { ...typography.button, color: colors.text.secondary },
});

export default PasscodeGate;
