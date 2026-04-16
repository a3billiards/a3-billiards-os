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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useAction, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

function formatMemberSince(createdAt: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
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
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);

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
  const isPasswordAccount = !googleId;
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
        Alert.alert("Email updated.");
      } else {
        Alert.alert("Profile updated.");
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
  }, [user, canSave, name, age, email, updateProfile]);

  const onConfirmExport = useCallback(async () => {
    if (!user?.email) return;
    setExportLoading(true);
    try {
      await requestDataExport();
      setSheet(null);
      Alert.alert(
        "Export requested",
        `Export requested. Check ${user.email} within 72 hours.`,
      );
    } catch (e) {
      const raw = (e as Error).message;
      if (raw.includes("RATE_001")) {
        Alert.alert("You can only request a data export once every 24 hours.");
      } else {
        Alert.alert(parseConvexError(e as Error).message);
      }
    } finally {
      setExportLoading(false);
    }
  }, [user?.email, requestDataExport]);

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
    } catch {
      Alert.alert("Something went wrong. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }, [requestDeletion, user?.email]);

  const finishDeletionSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      /* ignore */
    }
    router.replace("/login");
  }, [signOut, router]);

  const onSignOut = useCallback(() => {
    Alert.alert("Sign out", "Sign out of your account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
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
  }, [signOut, router]);

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
          <Text style={styles.muted}>Sign in to manage your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Profile</Text>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <Text style={styles.heroMeta}>Customer</Text>
          <Text style={styles.heroMeta}>Member since {formatMemberSince(user.createdAt)}</Text>
        </View>

        <Text style={styles.sectionLabel}>Personal Info</Text>
        <View style={styles.card}>
          <FieldRow
            label="Name"
            value={name}
            onPress={() => openSheet("name")}
            error={fieldErrors.name}
          />
          <View style={styles.divider} />
          <FieldRow
            label="Age"
            value={age}
            onPress={() => openSheet("age")}
            error={fieldErrors.age}
            hint="Age must be 18 or older."
          />
          <View style={styles.divider} />
          {emailReadOnlyGoogle ? (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Email</Text>
                  <Text style={styles.rowValue}>{user.email}</Text>
                  <Text style={styles.lockNote}>🔒 Managed by Google</Text>
                </View>
              </View>
            </>
          ) : (
            <FieldRow
              label="Email"
              value={email || (emailEditableGoogle ? "" : user.email ?? "")}
              placeholder={emailEditableGoogle ? "Add an email address" : undefined}
              onPress={() => openSheet("email")}
              error={fieldErrors.email}
            />
          )}
          <View style={styles.divider} />
          <Pressable
            onLongPress={() =>
              Alert.alert("Phone number", "Contact support to update your phone number.")
            }
            delayLongPress={400}
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Phone</Text>
                <Text style={styles.rowValue}>{formatPhoneDisplay(user.phone)}</Text>
                <Text style={styles.lockNote}>🔒 Phone number cannot be changed.</Text>
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
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </Pressable>
        ) : null}

        {isPasswordAccount ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>Account Security</Text>
            <View style={styles.card}>
              <Pressable style={styles.linkRow} onPress={() => router.push("/change-password")}>
                <Text style={styles.rowLabel}>Change Password</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>Data & Privacy</Text>
        <View style={styles.card}>
          <Pressable
            style={[styles.linkRow, !canExportData && styles.rowDisabled]}
            disabled={!canExportData}
            onPress={() => (canExportData ? setSheet("exportConfirm") : undefined)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, !canExportData && styles.textDisabled]}>
                Download My Data
              </Text>
              <Text style={styles.subtitle}>
                {canExportData
                  ? "Receive a JSON export of your data via email"
                  : "Add an email address to request your data"}
              </Text>
            </View>
            <Text style={[styles.chevron, !canExportData && styles.textDisabled]}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.linkRow} onPress={() => setSheet("delete1")}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteLabel}>Delete Account</Text>
              <Text style={styles.subtitle}>Permanently delete your account after 30 days</Text>
            </View>
          </Pressable>
        </View>

        <Pressable style={styles.signOut} onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
        <View style={{ height: spacing[8] }} />
      </ScrollView>

      <Modal transparent visible={sheet !== null} animationType="slide">
        <Pressable style={styles.modalScrim} onPress={() => sheet !== "deleteSuccess" && setSheet(null)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheet}>
                {sheet === "name" ? (
                  <>
                    <Text style={styles.sheetTitle}>Edit name</Text>
                    <TextInput
                      style={styles.input}
                      value={sheetDraft}
                      onChangeText={setSheetDraft}
                      placeholder="Your name"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={applySheetFixed}>
                        <Text style={styles.sheetPrimaryText}>Save</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "age" ? (
                  <>
                    <Text style={styles.sheetTitle}>Edit age</Text>
                    <TextInput
                      style={styles.input}
                      value={sheetDraft}
                      onChangeText={(t) => setSheetDraft(t.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <Text style={styles.hint}>Age must be 18 or older.</Text>
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={applySheetFixed}>
                        <Text style={styles.sheetPrimaryText}>Save</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "email" ? (
                  <>
                    <Text style={styles.sheetTitle}>
                      {emailEditableGoogle ? "Add email" : "Edit email"}
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
                        <Text style={styles.sheetSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={applySheetFixed}>
                        <Text style={styles.sheetPrimaryText}>Save</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "exportConfirm" ? (
                  <>
                    <Text style={styles.sheetTitle}>Request Data Export</Text>
                    <Text style={styles.sheetBody}>
                      A JSON file containing your personal data will be sent to {user.email} within
                      72 hours.
                    </Text>
                    <Text style={styles.sheetBodySmall}>
                      Name, phone, email, age, session history summary, booking history, complaint
                      count
                    </Text>
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={styles.sheetPrimary}
                        disabled={exportLoading}
                        onPress={() => void onConfirmExport()}
                      >
                        {exportLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.sheetPrimaryText}>Request Export</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "delete1" ? (
                  <>
                    <Text style={styles.sheetTitle}>Delete Your Account?</Text>
                    <Text style={styles.bullet}>• Your login will be blocked immediately</Text>
                    <Text style={styles.bullet}>• Active bookings will be automatically cancelled</Text>
                    <Text style={styles.bullet}>• Your data will be permanently deleted after 30 days</Text>
                    <Text style={styles.bullet}>
                      • In-progress sessions and credit balances are unaffected
                    </Text>
                    <Text style={styles.bullet}>
                      • You can cancel this within 30 days using the link in the confirmation email
                    </Text>
                    <View style={styles.warnBanner}>
                      <Text style={styles.warnText}>
                        ⚠ This action cannot be undone after the 30-day grace period.
                      </Text>
                    </View>
                    <View style={styles.sheetActions}>
                      <Pressable style={styles.sheetSecondary} onPress={() => setSheet(null)}>
                        <Text style={styles.sheetSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.sheetPrimary} onPress={() => setSheet("delete2")}>
                        <Text style={styles.sheetPrimaryText}>Continue</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {sheet === "delete2" ? (
                  <>
                    <Text style={styles.sheetTitle}>Confirm Account Deletion</Text>
                    <Text style={styles.hint}>Type DELETE to confirm</Text>
                    <TextInput
                      style={styles.input}
                      value={deleteConfirmText}
                      onChangeText={(t) => setDeleteConfirmText(t.toUpperCase())}
                      autoCapitalize="characters"
                      placeholder="DELETE"
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
                        <Text style={styles.dangerBtnText}>Delete My Account</Text>
                      )}
                    </Pressable>
                    <Pressable style={styles.sheetSecondary} onPress={() => setSheet("delete1")}>
                      <Text style={[styles.sheetSecondaryText, { textAlign: "center", marginTop: 8 }]}>
                        Back
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {sheet === "deleteSuccess" ? (
                  <View style={{ alignItems: "center", gap: spacing[3] }}>
                    <Text style={styles.successIcon}>✉️</Text>
                    <Text style={styles.sheetTitle}>Account Deletion Requested</Text>
                    <Text style={styles.sheetBody}>
                      {deletionMeta?.hadEmail
                        ? `Your account will be deleted in 30 days. A confirmation email has been sent to ${user.email} with a link to cancel if you change your mind.`
                        : "Your account will be deleted in 30 days. Note: You have no email on file, so no cancellation link was sent."}
                    </Text>
                    <Pressable style={styles.sheetPrimary} onPress={() => void finishDeletionSignOut()}>
                      <Text style={styles.sheetPrimaryText}>Sign Out</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
    backgroundColor: colors.bg.tertiary,
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
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
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
  divider: { height: 1, backgroundColor: colors.border.subtle, marginLeft: spacing[3] },
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
    backgroundColor: colors.accent.green,
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
  modalScrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.tertiary,
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
    backgroundColor: colors.bg.secondary,
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
    backgroundColor: colors.bg.secondary,
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
