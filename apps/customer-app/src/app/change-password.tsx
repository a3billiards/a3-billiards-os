import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

const MIN_LEN = 8;

/** Public actions live in `passwordResetActions` (Node). `passwordReset.ts` is internal-only. */
const changePasswordAction = api.passwordResetActions.changePassword;
const requestPasswordResetAction = api.passwordResetActions.requestReset;

type ToastState = { text: string; variant: "info" | "error" | "success" } | null;

function EyeToggle({
  revealed,
  onToggle,
}: {
  revealed: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={revealed ? "Hide password" : "Show password"}
      style={styles.eyeHit}
    >
      <Text style={styles.eyeIcon}>{revealed ? "🙈" : "👁"}</Text>
    </Pressable>
  );
}

export default function ChangePasswordScreen(): React.JSX.Element {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const changePassword = useAction(changePasswordAction);
  const requestPasswordReset = useAction(requestPasswordResetAction);

  const currentRef = useRef<TextInput>(null);
  const googleNavScheduled = useRef(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [curError, setCurError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastClear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (text: string, variant: "info" | "error" | "success", ms = 4000) => {
      if (toastClear.current) clearTimeout(toastClear.current);
      setToast({ text, variant });
      toastClear.current = setTimeout(() => {
        setToast(null);
        toastClear.current = null;
      }, ms);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastClear.current) clearTimeout(toastClear.current);
    };
  }, []);

  useEffect(() => {
    if (user === undefined || user === null) return;
    if (user.googleId == null || user.googleId === "") return;
    if (googleNavScheduled.current) return;
    googleNavScheduled.current = true;
    showToast(
      "Your account uses Google Sign-In. Password management is handled by Google.",
      "info",
      2800,
    );
    const nav = setTimeout(() => {
      router.replace("/profile");
    }, 2600);
    return () => clearTimeout(nav);
  }, [user, router, showToast]);

  const match = next === confirm;
  const confirmMismatch = confirmTouched && confirm.length > 0 && !match;

  const canSubmit =
    current.length > 0 &&
    next.length >= MIN_LEN &&
    match &&
    !loading &&
    !user?.googleId;

  const email = user?.email?.trim() ?? "";
  const hasEmail = email.length > 0;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setCurError(null);
    setNextError(null);
    setLoading(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      showToast("Password updated successfully.", "success", 2200);
      setTimeout(() => {
        router.replace("/profile");
      }, 800);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Current password is incorrect")) {
        setCurError("Incorrect password. Please try again.");
        setCurrent("");
        setTimeout(() => currentRef.current?.focus(), 100);
      } else if (
        msg.includes("New password must be different") ||
        msg.includes("New password must be different from your current password")
      ) {
        setNextError("New password must be different from your current password.");
      } else {
        showToast(parseConvexError(e as Error).message, "error");
      }
    } finally {
      setLoading(false);
    }
  }, [canSubmit, changePassword, current, next, router, showToast]);

  const onForgotConfirm = useCallback(async () => {
    if (!hasEmail) return;
    try {
      await requestPasswordReset({ email });
      setForgotSuccess(`Reset link sent to ${email}. Check your inbox.`);
    } catch (err) {
      const raw = (err as Error).message;
      if (raw.includes("RATE_001")) {
        showToast("Too many requests. Please wait before trying again.", "error");
      } else {
        showToast(parseConvexError(err as Error).message, "error");
      }
    }
  }, [hasEmail, email, requestPasswordReset, showToast]);

  const onForgotPress = useCallback(() => {
    if (!hasEmail) return;
    Alert.alert(
      "Send Reset Link?",
      `A password reset link will be sent to ${email}. The link expires in 1 hour.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send Link", onPress: () => void onForgotConfirm() },
      ],
    );
  }, [hasEmail, email, onForgotConfirm]);

  if (user === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (user === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.muted}>Sign in to change your password.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user.googleId != null && user.googleId !== "") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.green} />
        </View>
        {toast ? <ToastBar state={toast} /> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.pad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backHit}
              onPress={() => router.replace("/profile")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to profile"
            >
              <Text style={styles.backChevron}>‹</Text>
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Change Password</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={currentRef}
              style={styles.input}
              secureTextEntry={!showCur}
              value={current}
              onChangeText={(t) => {
                setCurrent(t);
                setCurError(null);
              }}
              placeholder="••••••••"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <EyeToggle revealed={showCur} onToggle={() => setShowCur((s) => !s)} />
          </View>
          {curError ? <Text style={styles.err}>{curError}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showNext}
              value={next}
              onChangeText={(t) => {
                setNext(t);
                setNextError(null);
              }}
              placeholder="••••••••"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <EyeToggle revealed={showNext} onToggle={() => setShowNext((s) => !s)} />
          </View>
          <Text style={styles.hint}>Minimum 8 characters</Text>
          {nextError ? <Text style={styles.err}>{nextError}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>Confirm New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showConf}
              value={confirm}
              onChangeText={(t) => {
                setConfirmTouched(true);
                setConfirm(t);
              }}
              onBlur={() => setConfirmTouched(true)}
              placeholder="••••••••"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <EyeToggle revealed={showConf} onToggle={() => setShowConf((s) => !s)} />
          </View>
          {confirmMismatch ? (
            <Text style={styles.err}>Passwords do not match</Text>
          ) : null}

          <Pressable
            style={[styles.primary, !canSubmit && styles.primaryDisabled]}
            disabled={!canSubmit}
            onPress={() => void onSubmit()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Update Password</Text>
            )}
          </Pressable>

          {forgotSuccess ? (
            <Text style={styles.forgotSuccess}>{forgotSuccess}</Text>
          ) : hasEmail ? (
            <Pressable style={styles.linkWrap} onPress={onForgotPress}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          ) : (
            <View
              style={styles.linkWrap}
              accessibilityHint="No email on file"
              accessibilityRole="text"
            >
              <Text style={styles.linkDisabledText}>Forgot password?</Text>
            </View>
          )}

          <View style={{ height: spacing[12] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {toast ? <ToastBar state={toast} /> : null}
    </SafeAreaView>
  );
}

function ToastBar({ state }: { state: NonNullable<ToastState> }): React.JSX.Element {
  const borderColor =
    state.variant === "error"
      ? colors.status.error
      : state.variant === "success"
        ? colors.accent.green
        : colors.border.default;
  return (
    <View style={[styles.toastBar, { borderColor }]}>
      <Text
        style={[
          styles.toastBarText,
          state.variant === "success" && { color: colors.accent.green },
        ]}
      >
        {state.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  flex: { flex: 1 },
  pad: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing[10] },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { ...typography.body, color: colors.text.secondary },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[4],
    minHeight: layout.headerHeight,
  },
  backHit: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 72,
    gap: 2,
  },
  backChevron: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.accent.green,
  },
  backLabel: {
    ...typography.body,
    color: colors.accent.green,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    ...typography.heading3,
    color: colors.text.primary,
    textAlign: "center",
  },
  headerSpacer: { minWidth: 72 },
  label: { ...typography.labelSmall, color: colors.text.primary },
  labelSpaced: { marginTop: spacing[3] },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
    marginBottom: spacing[1],
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    marginTop: spacing[1],
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: spacing[3],
    ...typography.body,
  },
  eyeHit: { padding: spacing[2] },
  eyeIcon: { fontSize: 20 },
  err: {
    ...typography.caption,
    color: colors.status.error,
    marginTop: spacing[1],
  },
  primary: {
    marginTop: spacing[4],
    backgroundColor: colors.accent.green,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
    minHeight: layout.buttonHeight,
    justifyContent: "center",
  },
  primaryDisabled: {
    backgroundColor: colors.status.disabled,
    opacity: 1,
  },
  primaryText: { ...typography.body, color: "#fff", fontWeight: "700" },
  linkWrap: { marginTop: spacing[4], alignSelf: "center" },
  link: {
    ...typography.body,
    color: colors.text.secondary,
    textDecorationLine: "underline",
  },
  linkDisabledText: {
    ...typography.body,
    color: colors.status.disabled,
  },
  forgotSuccess: {
    ...typography.body,
    color: colors.accent.green,
    marginTop: spacing[4],
    textAlign: "center",
  },
  toastBar: {
    position: "absolute",
    left: layout.screenPadding,
    right: layout.screenPadding,
    bottom: spacing[6],
    backgroundColor: colors.bg.secondary,
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  toastBarText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    textAlign: "center",
  },
});
