import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { KeyboardFormScroll, PasswordStrengthBar } from "@a3/ui/components";
import { useTranslation } from "@a3/i18n";
import {
  getStrongPasswordError,
  getPasswordStrength,
  isStrongPassword,
} from "@a3/utils/passwordPolicy";

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
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        revealed ? t("auth.owner.changePassword.hidePassword") : t("auth.owner.changePassword.showPassword")
      }
      style={styles.eyeHit}
    >
      <Text style={styles.eyeIcon}>{revealed ? "🙈" : "👁"}</Text>
    </Pressable>
  );
}

export default function ChangePasswordScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const changePassword = useAction(changePasswordAction);
  const requestPasswordReset = useAction(requestPasswordResetAction);

  const currentRef = useRef<TextInput>(null);

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
  const successNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (successNavTimer.current) clearTimeout(successNavTimer.current);
    };
  }, []);

  const hasPasswordLogin =
    user !== undefined &&
    user !== null &&
    user.email !== undefined &&
    user.email.trim().length > 0;

  const match = next === confirm;
  const confirmMismatch = confirmTouched && confirm.length > 0 && !match;

  const canSubmit =
    current.length > 0 &&
    isStrongPassword(next) &&
    match &&
    !loading &&
    hasPasswordLogin;

  const email = user?.email?.trim() ?? "";
  const hasEmail = email.length > 0;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const pwdError = getStrongPasswordError(next);
    if (pwdError) {
      setNextError(pwdError);
      return;
    }
    setCurError(null);
    setNextError(null);
    setLoading(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      showToast(t("auth.owner.changePassword.passwordUpdated"), "success", 2200);
      if (successNavTimer.current) clearTimeout(successNavTimer.current);
      successNavTimer.current = setTimeout(() => {
        successNavTimer.current = null;
        router.replace("/(tabs)/settings");
      }, 800);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Google Sign-In")) {
        showToast(t("auth.owner.changePassword.noPasswordSet"), "info");
      } else if (msg.includes("Current password is incorrect")) {
        setCurError(t("auth.owner.changePassword.incorrectPassword"));
        setCurrent("");
        setTimeout(() => currentRef.current?.focus(), 100);
      } else if (
        msg.includes("New password must be different") ||
        msg.includes("New password must be different from your current password")
      ) {
        setNextError(t("auth.owner.changePassword.mustBeDifferent"));
      } else {
        showToast(parseConvexError(e as Error).message, "error");
      }
    } finally {
      setLoading(false);
    }
  }, [canSubmit, changePassword, current, next, router, showToast, t]);

  const onForgotConfirm = useCallback(async () => {
    if (!hasEmail) return;
    try {
      await requestPasswordReset({ email });
      setForgotSuccess(t("auth.owner.changePassword.resetLinkSent", { email }));
    } catch (err) {
      const raw = (err as Error).message;
      if (raw.includes("RATE_001")) {
        showToast(t("auth.owner.changePassword.tooManyRequests"), "error");
      } else {
        showToast(parseConvexError(err as Error).message, "error");
      }
    }
  }, [hasEmail, email, requestPasswordReset, showToast, t]);

  const onForgotPress = useCallback(() => {
    if (!hasEmail) return;
    Alert.alert(
      t("auth.owner.changePassword.resetAlertTitle"),
      t("auth.owner.changePassword.resetAlertBody", { email }),
      [
        { text: t("auth.owner.changePassword.cancel"), style: "cancel" },
        { text: t("auth.owner.changePassword.sendLink"), onPress: () => void onForgotConfirm() },
      ],
    );
  }, [hasEmail, email, onForgotConfirm, t]);

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
          <Text style={styles.muted}>{t("auth.owner.changePassword.signInRequired")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardFormScroll
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backHit}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(tabs)/settings")
              }
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("auth.owner.changePassword.back")}
            >
              <Text style={styles.backChevron}>‹</Text>
              <Text style={styles.backLabel}>{t("auth.owner.changePassword.back")}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{t("auth.owner.changePassword.title")}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.label}>{t("auth.owner.changePassword.currentPassword")}</Text>
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
              placeholder={t("common.passwordMask")}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <EyeToggle revealed={showCur} onToggle={() => setShowCur((s) => !s)} />
          </View>
          {curError ? <Text style={styles.err}>{curError}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>{t("auth.owner.changePassword.newPassword")}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showNext}
              value={next}
              onChangeText={(t) => {
                setNext(t);
                setNextError(null);
              }}
              placeholder={t("common.passwordMask")}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <EyeToggle revealed={showNext} onToggle={() => setShowNext((s) => !s)} />
          </View>
          <PasswordStrengthBar strength={getPasswordStrength(next)} />
          <Text style={styles.hint}>{t("auth.owner.changePassword.minLengthHint")}</Text>
          {nextError ? <Text style={styles.err}>{nextError}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>{t("auth.owner.changePassword.confirmPassword")}</Text>
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
              placeholder={t("common.passwordMask")}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <EyeToggle revealed={showConf} onToggle={() => setShowConf((s) => !s)} />
          </View>
          {confirmMismatch ? (
            <Text style={styles.err}>{t("auth.owner.changePassword.passwordsMismatch")}</Text>
          ) : null}

          <Pressable
            style={[styles.primary, !canSubmit && styles.primaryDisabled]}
            disabled={!canSubmit}
            onPress={() => void onSubmit()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{t("auth.owner.changePassword.updatePassword")}</Text>
            )}
          </Pressable>

          {forgotSuccess ? (
            <Text style={styles.forgotSuccess}>{forgotSuccess}</Text>
          ) : hasEmail ? (
            <Pressable style={styles.linkWrap} onPress={onForgotPress}>
              <Text style={styles.link}>{t("auth.owner.changePassword.forgotPassword")}</Text>
            </Pressable>
          ) : (
            <View
              style={styles.linkWrap}
              accessibilityHint={t("auth.owner.changePassword.noEmailHint")}
              accessibilityRole="text"
            >
              <Text style={styles.linkDisabledText}>{t("auth.owner.changePassword.forgotPassword")}</Text>
            </View>
          )}

          <View style={{ height: spacing[12] }} />
      </KeyboardFormScroll>

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
