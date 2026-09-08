import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useAction, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, typography, spacing, radius, layout, glass, iosKeyboardAvoidingProps, keyboardScrollDefaults } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import QRCode from "react-native-qrcode-svg";
import { LanguagePicker, getCurrentLanguage, useTranslation } from "@a3/i18n";

function formatMemberSince(createdAt: number): string {
  return new Intl.DateTimeFormat(getCurrentLanguage(), { month: "long", year: "numeric" }).format(
    new Date(createdAt),
  );
}

function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "—";
  return phone;
}

function isValidEmailLoose(s: string): boolean {
  const t = s.trim();
  return t.includes("@") && t.includes(".");
}

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);
  const hasLoginPassword = useQuery(api.customerAuth.hasLoginPassword);
  const canCreateLoginPassword = useQuery(api.customerAuth.canCreateLoginPassword);

  const updateProfile = useMutation(api.users.updateCustomerProfile);
  const requestDeletion = useAction(api.deletionActions.requestCustomerDeletion);
  const requestDataExport = useAction(api.usersActions.requestCustomerDataExport);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [seeded, setSeeded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    age?: string;
    email?: string;
  }>({});

  const [sheet, setSheet] = useState<
    | null
    | "name"
    | "age"
    | "email"
    | "exportConfirm"
    | "delete1"
    | "delete2"
    | "deleteSuccess"
  >(null);
  const [sheetDraft, setSheetDraft] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deletionMeta, setDeletionMeta] = useState<{
    scheduledPurgeAt: number;
    hadEmail: boolean;
  } | null>(null);

  useEffect(() => {
    if (!user || seeded) return;
    setName(user.name);
    setAge(String(user.age));
    setEmail(user.email ?? "");
    setSeeded(true);
  }, [user, seeded]);

  const googleId = user?.googleId ?? null;
  const userEmail = user?.email ?? null;
  const emailReadOnlyGoogle = Boolean(
    googleId && userEmail && String(userEmail).trim().length > 0,
  );
  const emailEditableGoogle = Boolean(googleId && !emailReadOnlyGoogle);
  const isPasswordAccount = Boolean(hasLoginPassword) && !googleId;
  const canExportData = Boolean(userEmail && String(userEmail).trim().length > 0);

  const dirty = useMemo(() => {
    if (!user) return false;
    const n = name.trim();
    const a = parseInt(age, 10);
    const e = email.trim().toLowerCase();
    const prevE = (user.email ?? "").trim().toLowerCase();
    return n !== user.name || a !== user.age || e !== prevE;
  }, [user, name, age, email]);

  const nameValid = name.trim().length >= 2 && name.trim().length <= 100;
  const ageNum = parseInt(age, 10);
  const ageValid = Number.isInteger(ageNum) && ageNum >= 18;
  const emailChanged =
    user && email.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase();
  const emailValid =
    !emailChanged || (email.trim().length > 0 && isValidEmailLoose(email));

  const canSave =
    dirty &&
    nameValid &&
    ageValid &&
    emailValid &&
    (!emailChanged || !emailReadOnlyGoogle);

  const initials = useMemo(() => {
    const t = (user?.name ?? name).trim();
    if (!t) return "?";
    return t.charAt(0).toUpperCase();
  }, [user?.name, name]);

  const openSheet = useCallback((kind: "name" | "age" | "email") => {
    if (kind === "email" && emailReadOnlyGoogle) return;
    setSaveError(null);
    setFieldErrors({});
    if (kind === "name") setSheetDraft(name);
    if (kind === "age") setSheetDraft(age);
    if (kind === "email") setSheetDraft(email);
    setSheet(kind);
  }, [name, age, email, emailReadOnlyGoogle]);

  const applySheetFixed = useCallback(() => {
    if (sheet === "name") {
      setName(sheetDraft.trim());
    } else if (sheet === "age") {
      setAge(sheetDraft.replace(/[^0-9]/g, ""));
    } else if (sheet === "email") {
      setEmail(sheetDraft.trim());
    }
    setSheet(null);
  }, [sheet, sheetDraft]);

  const onSaveProfile = useCallback(async () => {
    if (!user || !canSave) return;
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const args: { name?: string; age?: number; email?: string } = {};
      const changedName = name.trim() !== user.name;
      const changedAge = parseInt(age, 10) !== user.age;
      const nextE = email.trim().toLowerCase();
      const prevE = (user.email ?? "").trim().toLowerCase();
      const changedEmail = nextE !== prevE;
      if (changedName) args.name = name.trim();
      if (changedAge) args.age = parseInt(age, 10);
      if (changedEmail) args.email = email.trim();
      await updateProfile(args);
      if (changedEmail && !changedName && !changedAge) {
        Alert.alert(t("customerApp.profile.emailUpdated"));
      } else {
        Alert.alert(t("customerApp.profile.profileUpdated"));
      }
    } catch (e) {
      const parsed = parseConvexError(e as Error);
      const msg = parsed.message;
      if (msg.includes("Name")) setFieldErrors((f) => ({ ...f, name: msg }));
      else if (msg.includes("18")) setFieldErrors((f) => ({ ...f, age: msg }));
      else if (msg.includes("email") || msg.includes("Email"))
        setFieldErrors((f) => ({ ...f, email: msg }));
      else setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [user, canSave, name, age, email, updateProfile, t]);

  const onConfirmExport = useCallback(async () => {
    if (!user?.email) return;
    setExportLoading(true);
    try {
      await requestDataExport();
      setSheet(null);
      Alert.alert(
        t("customerApp.profile.exportRequested"),
        t("customerApp.profile.exportRequestedBody", { email: user.email }),
      );
    } catch (e) {
      const raw = (e as Error).message;
      if (raw.includes("RATE_001")) {
        Alert.alert(t("customerApp.profile.exportRateLimit"));
      } else {
        Alert.alert(parseConvexError(e as Error).message);
      }
    } finally {
      setExportLoading(false);
    }
  }, [user?.email, requestDataExport, t]);

  const runDeletion = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const res = await requestDeletion();
      setDeletionMeta({
        scheduledPurgeAt: res.scheduledPurgeAt,
        hadEmail: Boolean(user?.email),
      });
      setSheet("deleteSuccess");
      setDeleteConfirmText("");
    } catch (e) {
      Alert.alert(parseConvexError(e as Error).message || t("customerApp.profile.deletionFailed"));
    } finally {
      setDeleteLoading(false);
    }
  }, [requestDeletion, user?.email, t]);

  const finishDeletionSignOut = useCallback(() => {
    setSheet(null);
    router.replace({
      pathname: "/account-blocked",
      params: { reason: "deletion" },
    });
  }, [router]);

  const onSignOut = useCallback(() => {
    Alert.alert(t("customerApp.profile.signOut"), t("customerApp.profile.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("customerApp.profile.signOut"),
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch {
            /* ignore */
          }
          router.replace("/login");
        },
      },
    ]);
  }, [signOut, router, t]);

  if (user === undefined) {
    return (
      <GlassPageBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.center}>
            <ActivityIndicator color={glass.ctaBg} />
          </View>
        </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (user === null) {
    return (
      <GlassPageBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.center}>
            <Text style={styles.muted}>{t("customerApp.profile.signInRequired")}</Text>
          </View>
        </SafeAreaView>
      </GlassPageBackground>
    );
  }

  return (
    <GlassPageBackground>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        {...keyboardScrollDefaults}
      >
        <Text style={styles.screenTitle}>{t("customerApp.profile.title")}</Text>

        <View style={styles.card}>
          <LanguagePicker />
        </View>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <Text style={styles.heroMeta}>{t("customerApp.profile.customerRole")}</Text>
          <Text style={styles.heroMeta}>
            {t("customerApp.profile.memberSince", {
              date: formatMemberSince(user.createdAt),
            })}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{t("customerApp.profile.personalInfo")}</Text>
        <View style={styles.card}>
          <FieldRow
            label={t("customerApp.profile.name")}
            value={name}
            onPress={() => openSheet("name")}
            error={fieldErrors.name}
          />
          <View style={styles.divider} />
          <FieldRow
            label={t("customerApp.profile.age")}
            value={age}
            onPress={() => openSheet("age")}
            error={fieldErrors.age}
            hint={t("customerApp.profile.ageHint")}
          />
          <View style={styles.divider} />
          {emailReadOnlyGoogle ? (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t("customerApp.profile.email")}</Text>
                  <Text style={styles.rowValue}>{user.email}</Text>
                  <Text style={styles.lockNote}>{t("customerApp.profile.managedByGoogle")}</Text>
                </View>
              </View>
            </>
          ) : (
            <FieldRow
              label={t("customerApp.profile.email")}
              value={email || (emailEditableGoogle ? "" : user.email ?? "")}
              placeholder={
                emailEditableGoogle ? t("customerApp.profile.addEmailPlaceholder") : undefined
              }
              onPress={() => openSheet("email")}
              error={fieldErrors.email}
            />
          )}
          <View style={styles.divider} />
          <Pressable
            onLongPress={() =>
              Alert.alert(
                t("customerApp.profile.phoneAlertTitle"),
                t("customerApp.profile.phoneAlertMessage"),
              )
            }
            delayLongPress={400}
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t("customerApp.profile.phone")}</Text>
                <Text style={styles.rowValue}>{formatPhoneDisplay(user.phone)}</Text>
                <Text style={styles.lockNote}>{t("customerApp.profile.phoneLocked")}</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {saveError ? <Text style={styles.inlineErr}>{saveError}</Text> : null}

        {dirty ? (
          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            disabled={!canSave || saving}
            onPress={() => void onSaveProfile()}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{t("customerApp.profile.saveChanges")}</Text>
            )}
          </Pressable>
        ) : null}

        {canCreateLoginPassword || isPasswordAccount ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>
              {t("customerApp.profile.accountSecurity")}
            </Text>
            <View style={styles.card}>
              {canCreateLoginPassword ? (
                <Pressable
                  style={styles.linkRow}
                  onPress={() => router.push("/set-password")}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      {t("customerApp.profile.createLoginPassword")}
                    </Text>
                    <Text style={styles.subtitle}>
                      {t("customerApp.profile.createLoginPasswordHint")}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ) : null}
              {canCreateLoginPassword && isPasswordAccount ? (
                <View style={styles.divider} />
              ) : null}
              {isPasswordAccount ? (
                <Pressable
                  style={styles.linkRow}
                  onPress={() => router.push("/change-password")}
                >
                  <Text style={styles.rowLabel}>{t("customerApp.profile.changePassword")}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>
          {t("customerApp.help.title")}
        </Text>
        <View style={styles.card}>
          <Pressable style={styles.linkRow} onPress={() => router.push("/help")}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t("customerApp.help.profileLink")}</Text>
              <Text style={styles.subtitle}>{t("customerApp.help.profileLinkHint")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>
          {t("customerApp.profile.dataPrivacy")}
        </Text>
        <View style={styles.card}>
          <Pressable
            style={[styles.linkRow, !canExportData && styles.rowDisabled]}
            disabled={!canExportData}
            onPress={() => (canExportData ? setSheet("exportConfirm") : undefined)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, !canExportData && styles.textDisabled]}>
                {t("customerApp.profile.downloadMyData")}
              </Text>
              <Text style={styles.subtitle}>
                {canExportData
                  ? t("customerApp.profile.exportViaEmail")
                  : t("customerApp.profile.addEmailForExport")}
              </Text>
            </View>
            <Text style={[styles.chevron, !canExportData && styles.textDisabled]}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.linkRow} onPress={() => setSheet("delete1")}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteLabel}>{t("customerApp.profile.deleteAccount")}</Text>
              <Text style={styles.subtitle}>{t("customerApp.profile.deleteAccountSubtitle")}</Text>
            </View>
          </Pressable>
        </View>

        {user?._id ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t("customerApp.profile.checkInCode")}</Text>
            <Text style={styles.subtitle}>{t("customerApp.profile.checkInCodeHint", { id: user._id })}</Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={`a3customer:${user._id}`}
                size={180}
                backgroundColor={colors.bg.secondary}
                color={colors.text.primary}
              />
            </View>
            <Text selectable style={styles.checkInPayload}>
              {`a3customer:${user._id}`}
            </Text>
          </View>
        ) : null}

        <Pressable style={styles.signOut} onPress={onSignOut}>
          <Text style={styles.signOutText}>{t("customerApp.profile.signOut")}</Text>
        </Pressable>
        <View style={{ height: spacing[8] }} />
      </ScrollView>

      <Modal transparent visible={sheet !== null} animationType="slide">
        <Pressable style={styles.modalScrim} onPress={() => sheet !== "deleteSuccess" && setSheet(null)}>
          <KeyboardAvoidingView
            {...iosKeyboardAvoidingProps}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheet}>
                {sheet === "name" ? (
                  <>
                    <Text style={styles.sheetTitle}>{t("customerApp.profile.editName")}</Text>
                    <TextInput
                      style={styles.input}
                      value={sheetDraft}
                      onChangeText={setSheetDraft}
                      placeholder={t("customerApp.profile.yourName")}
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>{t("common.cancel")}</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={applySheetFixed}>
                        <Text style={styles.sheetPrimaryText}>{t("common.save")}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "age" ? (
                  <>
                    <Text style={styles.sheetTitle}>{t("customerApp.profile.editAge")}</Text>
                    <TextInput
                      style={styles.input}
                      value={sheetDraft}
                      onChangeText={(text) => setSheetDraft(text.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <Text style={styles.hint}>{t("customerApp.profile.ageHint")}</Text>
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>{t("common.cancel")}</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={applySheetFixed}>
                        <Text style={styles.sheetPrimaryText}>{t("common.save")}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "email" ? (
                  <>
                    <Text style={styles.sheetTitle}>
                      {emailEditableGoogle
                        ? t("customerApp.profile.addEmail")
                        : t("customerApp.profile.editEmail")}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={sheetDraft}
                      onChangeText={setSheetDraft}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>{t("common.cancel")}</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={applySheetFixed}>
                        <Text style={styles.sheetPrimaryText}>{t("common.save")}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "exportConfirm" ? (
                  <>
                    <Text style={styles.sheetTitle}>{t("customerApp.profile.requestDataExport")}</Text>
                    <Text style={styles.sheetBody}>
                      {t("customerApp.profile.exportBody", { email: user.email })}
                    </Text>
                    <Text style={styles.sheetBodySmall}>
                      {t("customerApp.profile.exportFieldsList")}
                    </Text>
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>{t("common.cancel")}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.sheetPrimary}
                        disabled={exportLoading}
                        onPress={() => void onConfirmExport()}
                      >
                        {exportLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.sheetPrimaryText}>
                            {t("customerApp.profile.requestExport")}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "delete1" ? (
                  <>
                    <Text style={styles.sheetTitle}>{t("customerApp.profile.deleteTitle")}</Text>
                    <Text style={styles.bullet}>{t("customerApp.profile.deleteBulletLogin")}</Text>
                    <Text style={styles.bullet}>{t("customerApp.profile.deleteBulletBookings")}</Text>
                    <Text style={styles.bullet}>{t("customerApp.profile.deleteBulletData")}</Text>
                    <Text style={styles.bullet}>{t("customerApp.profile.deleteBulletSessions")}</Text>
                    <Text style={styles.bullet}>{t("customerApp.profile.deleteBulletGrace")}</Text>
                    <View style={styles.warnBanner}>
                      <Text style={styles.warnText}>{t("customerApp.profile.deleteWarning")}</Text>
                    </View>
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>{t("common.cancel")}</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={() => setSheet("delete2")}>
                        <Text style={styles.sheetPrimaryText}>{t("customerApp.profile.continue")}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "delete2" ? (
                  <>
                    <Text style={styles.sheetTitle}>{t("customerApp.profile.confirmDeletion")}</Text>
                    <Text style={styles.hint}>{t("customerApp.profile.typeDelete")}</Text>
                    <TextInput
                      style={styles.input}
                      value={deleteConfirmText}
                      onChangeText={(text) => setDeleteConfirmText(text.toUpperCase())}
                      autoCapitalize="characters"
                      placeholder={t("customerApp.profile.deletePlaceholder")}
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <Pressable
                      style={[
                        styles.dangerBtn,
                        deleteConfirmText !== "DELETE" || deleteLoading
                          ? styles.saveBtnDisabled
                          : null,
                      ]}
                      disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                      onPress={() => void runDeletion()}
                    >
                      {deleteLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.dangerBtnText}>
                          {t("customerApp.profile.deleteMyAccount")}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable style={styles.sheetSecondary} onPress={() => setSheet("delete1")}>
                      <Text style={[styles.sheetSecondaryText, { textAlign: "center", marginTop: 8 }]}>
                        {t("customerApp.profile.back")}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {sheet === "deleteSuccess" ? (
                  <View style={{ alignItems: "center", gap: spacing[3] }}>
                    <Text style={styles.successIcon}>✉️</Text>
                    <Text style={styles.sheetTitle}>{t("customerApp.profile.deletionRequested")}</Text>
                    <Text style={styles.sheetBody}>
                      {deletionMeta?.hadEmail
                        ? t("customerApp.profile.deletionWithEmail", { email: user.email })
                        : t("customerApp.profile.deletionNoEmail")}
                    </Text>
                    <Pressable style={styles.sheetPrimary} onPress={() => void finishDeletionSignOut()}>
                      <Text style={styles.sheetPrimaryText}>{t("customerApp.profile.signOut")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
    </GlassPageBackground>
  );
}

function FieldRow({
  label,
  value,
  placeholder,
  onPress,
  error,
  hint,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, !value && styles.placeholder]}>
          {value || placeholder || "—"}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {error ? <Text style={styles.inlineErr}>{error}</Text> : null}
      </View>
      <Text style={styles.editGlyph}>✎</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing[10] },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { ...typography.body, color: colors.text.secondary },
  screenTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[3] },
  hero: { alignItems: "center", marginBottom: spacing[4] },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: glass.iconTileBg,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: colors.text.primary },
  heroName: { ...typography.heading3, color: colors.text.primary },
  heroMeta: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  sectionLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing[2],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  rowDisabled: { opacity: 0.45 },
  textDisabled: { color: colors.status.disabled },
  divider: { height: 1, backgroundColor: colors.border.subtle, marginStart: spacing[3] },
  rowLabel: { ...typography.caption, color: colors.text.secondary, marginBottom: 4 },
  rowValue: { ...typography.body, color: colors.text.primary },
  placeholder: { color: colors.text.secondary },
  lockNote: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  subtitle: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  deleteLabel: { ...typography.body, color: colors.status.error, fontWeight: "600" },
  chevron: { fontSize: 22, color: colors.text.secondary },
  editGlyph: { fontSize: 16, color: colors.text.secondary },
  saveBtn: {
    marginTop: spacing[3],
    backgroundColor: glass.ctaBg,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { ...typography.body, color: "#fff", fontWeight: "600" },
  inlineErr: { ...typography.caption, color: colors.status.error, marginTop: 4 },
  signOut: {
    marginTop: spacing[6],
    backgroundColor: colors.bg.tertiary,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
  },
  signOutText: { ...typography.body, color: colors.text.primary, fontWeight: "600" },
  checkInPayload: {
    marginTop: spacing[2],
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.accent.green,
    textAlign: "center",
  },
  qrWrap: {
    alignItems: "center",
    marginTop: spacing[3],
    marginBottom: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    alignSelf: "center",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: glass.tabPillBg,
    borderTopWidth: 1,
    borderTopColor: glass.tabPillBorder,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[6],
  },
  sheetTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[2] },
  sheetBody: { ...typography.body, color: colors.text.secondary, marginBottom: spacing[2] },
  sheetBodySmall: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[3] },
  bullet: { ...typography.body, color: colors.text.secondary, marginBottom: 6 },
  warnBanner: {
    backgroundColor: "rgba(245, 127, 23, 0.15)",
    padding: spacing[2],
    borderRadius: radius.sm,
    marginVertical: spacing[2],
  },
  warnText: { color: colors.accent.amber, ...typography.caption },
  input: {
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  hint: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[2] },
  sheetActions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[2] },
  sheetPrimary: {
    flex: 1,
    backgroundColor: colors.accent.green,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
  },
  sheetPrimaryText: { color: "#fff", fontWeight: "600" },
  sheetSecondary: {
    flex: 1,
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
  },
  sheetSecondaryText: { color: colors.text.primary, fontWeight: "600" },
  dangerBtn: {
    marginTop: spacing[2],
    backgroundColor: colors.status.error,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
  },
  dangerBtnText: { color: "#fff", fontWeight: "700" },
  successIcon: { fontSize: 44, color: colors.accent.green },
});
