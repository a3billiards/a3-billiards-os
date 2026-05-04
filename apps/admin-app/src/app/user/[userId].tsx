import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useAction } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

const COMPLAINT_LABEL: Record<string, string> = {
  violent_behaviour: "Violent Behaviour",
  theft: "Theft",
  runaway_without_payment: "Runaway Without Payment",
  late_credit_payment: "Late Credit Payment",
};

function elapsedAgo(startMs: number): string {
  const m = Math.floor((Date.now() - startMs) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function RoleHeaderBadge({
  role,
}: {
  role: "admin" | "owner" | "customer";
}): React.JSX.Element {
  const cfg =
    role === "admin"
      ? { bg: colors.status.info, label: "Admin" }
      : role === "owner"
        ? { bg: colors.accent.amber, label: "Owner" }
        : { bg: colors.bg.tertiary, label: "Customer" };
  return (
    <View style={[styles.roleHdr, { backgroundColor: cfg.bg }]}>
      <Text style={styles.roleHdrText}>{cfg.label}</Text>
    </View>
  );
}

export default function UserProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { userId: rawId } = useLocalSearchParams<{ userId: string }>();
  const userId = rawId as Id<"users">;

  const profile = useQuery(api.users.getUserProfile, { userId });
  const editUser = useMutation(api.users.adminEditUser);
  const updatePhone = useMutation(api.users.adminUpdatePhone);
  const freezeUser = useMutation(api.users.adminFreezeUser);
  const unfreezeUser = useMutation(api.users.adminUnfreezeUser);
  const resetPasscode = useMutation(api.users.adminResetOwnerPasscode);
  const promoteAdmin = useMutation(api.users.adminPromoteToAdmin);
  const forceEnd = useMutation(api.sessions.forceEndSession);
  const sendResetEmail = useAction(api.usersAdminActions.adminResetUserPassword);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneVal, setPhoneVal] = useState("");

  const [forceOpen, setForceOpen] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forceSessionId, setForceSessionId] = useState<Id<"sessions"> | null>(
    null,
  );

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteConfirm, setPromoteConfirm] = useState("");

  const [expandedComplaint, setExpandedComplaint] = useState<string | null>(
    null,
  );

  const openEdit = useCallback(() => {
    if (!profile) return;
    setEditName(profile.user.name);
    setEditAge(String(profile.user.age));
    setEditEmail(profile.user.email ?? "");
    setEditOpen(true);
  }, [profile]);

  const onSaveEdit = async () => {
    try {
      const age = parseInt(editAge, 10);
      if (Number.isNaN(age)) {
        Alert.alert("Invalid age");
        return;
      }
      await editUser({
        userId,
        name: editName.trim(),
        age,
        ...(editEmail.trim().length > 0 ? { email: editEmail.trim() } : {}),
      });
      setEditOpen(false);
      Alert.alert("Saved", "Profile updated.");
    } catch (e) {
      Alert.alert("Error", parseConvexError(e as Error).message);
    }
  };

  const onSavePhone = async () => {
    try {
      await updatePhone({ userId, phone: phoneVal.trim() });
      setPhoneOpen(false);
      setPhoneVal("");
      Alert.alert("Saved", "Phone updated.");
    } catch (e) {
      Alert.alert("Error", parseConvexError(e as Error).message);
    }
  };

  const onFreeze = () => {
    if (!profile) return;
    Alert.alert(
      "Freeze account",
      `Freeze ${profile.user.name}'s account? They will be immediately locked out.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Freeze",
          style: "destructive",
          onPress: async () => {
            try {
              await freezeUser({ userId });
            } catch (e) {
              Alert.alert("Error", parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onUnfreeze = () => {
    if (!profile) return;
    Alert.alert(
      "Unfreeze account",
      `Unfreeze ${profile.user.name}'s account? They will regain access immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfreeze",
          onPress: async () => {
            try {
              await unfreezeUser({ userId });
            } catch (e) {
              Alert.alert("Error", parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onResetPassword = () => {
    if (!profile?.user.email) return;
    Alert.alert(
      "Reset password",
      `Send a password reset email to ${profile.user.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              await sendResetEmail({ userId });
              Alert.alert("Sent", "Password reset email sent.");
            } catch (e) {
              Alert.alert("Error", parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onResetPasscode = () => {
    if (!profile) return;
    Alert.alert(
      "Reset settings passcode",
      `Clear ${profile.user.name}'s settings passcode? They will be forced to set a new one on next login.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            try {
              await resetPasscode({ userId });
              Alert.alert("Done", "Passcode cleared.");
            } catch (e) {
              Alert.alert("Error", parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onPromote = async () => {
    if (promoteConfirm.trim() !== "CONFIRM") {
      Alert.alert("Type CONFIRM to enable promotion.");
      return;
    }
    try {
      await promoteAdmin({ userId });
      setPromoteOpen(false);
      setPromoteConfirm("");
      Alert.alert("Done", "User promoted to admin.");
    } catch (e) {
      Alert.alert("Error", parseConvexError(e as Error).message);
    }
  };

  const onForceEnd = async () => {
    if (!forceSessionId) return;
    const r = forceReason.trim();
    if (!r || r.length > 300) {
      Alert.alert("Reason required", "Enter 1–300 characters.");
      return;
    }
    try {
      await forceEnd({ sessionId: forceSessionId, reason: r });
      setForceOpen(false);
      setForceReason("");
      setForceSessionId(null);
      Alert.alert("Ended", "Session was force-ended.");
    } catch (e) {
      const msg = parseConvexError(e as Error).message;
      if (msg.includes("FORCE_001")) {
        Alert.alert("Already ended", "This session has already ended.");
      } else {
        Alert.alert("Error", msg);
      }
    }
  };

  const affiliationsText = useMemo(() => {
    if (!profile?.clubAffiliations.length) return null;
    return profile.clubAffiliations.map((c) => c.clubName).join(" · ");
  }, [profile?.clubAffiliations]);

  if (profile === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.bootRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
        <View style={styles.skelBlock} />
        <View style={styles.skelBlock} />
        <View style={styles.skelBlock} />
      </SafeAreaView>
    );
  }

  if (profile === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.err}>User not found.</Text>
      </SafeAreaView>
    );
  }

  const { user, complaints, activeSessions, ownedClub } = profile;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>
              {user.name.trim().slice(0, 1).toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <RoleHeaderBadge role={user.role} />
          {user.email ? (
            <Text style={styles.heroMeta}>{user.email}</Text>
          ) : null}
          {user.phone ? (
            <Text style={styles.heroMeta}>{user.phone}</Text>
          ) : null}
        </View>

        {user.isFrozen ? (
          <View style={styles.bannerFrozen}>
            <Text style={styles.bannerFrozenText}>⛔ Account Frozen</Text>
          </View>
        ) : null}
        {user.deletionRequestedAt != null ? (
          <View style={styles.bannerDel}>
            <Text style={styles.bannerDelText}>
              🕐 Pending Deletion (30-day grace)
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.rowLine}>Age: {user.age}</Text>
          <Text style={styles.rowLine}>
            Phone verified: {user.phoneVerified ? "Yes" : "No"}
          </Text>
          <Text style={styles.rowLine}>
            Consent:{" "}
            {user.consentGivenAt != null
              ? `Consent given on ${formatDate(user.consentGivenAt)}`
              : "Legacy account"}
          </Text>
          <Text style={styles.rowLine}>Joined: {formatDate(user.createdAt)}</Text>
          {user.role === "owner" && ownedClub ? (
            <>
              <Text style={styles.rowLine}>Club: {ownedClub.name}</Text>
              <Text style={styles.rowLine}>
                Subscription: {ownedClub.subscriptionStatus}
              </Text>
              <Text style={styles.rowLine}>
                Settings passcode: {user.settingsPasscodeSet ? "Set" : "Not set"}
              </Text>
            </>
          ) : null}
          {user.role === "customer" && affiliationsText ? (
            <Text style={styles.rowLine}>Played at: {affiliationsText}</Text>
          ) : null}
        </View>

        {activeSessions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Sessions</Text>
            {activeSessions.map((s) => (
              <View key={s.sessionId} style={styles.sessionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLine}>
                    {s.clubName} · {s.tableLabel}
                  </Text>
                  <Text style={styles.subtle}>
                    Started {elapsedAgo(s.startTime)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.dangerBtn, { marginLeft: spacing[2] }]}
                  onPress={() => {
                    setForceSessionId(s.sessionId);
                    setForceReason("");
                    setForceOpen(true);
                  }}
                >
                  <Text style={styles.dangerBtnText}>Force End</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {complaints.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Complaints ({complaints.length})</Text>
            {complaints.map((c) => {
              const open = expandedComplaint === c._id;
              return (
                <Pressable
                  key={c._id}
                  onPress={() =>
                    setExpandedComplaint(open ? null : c._id)
                  }
                  style={styles.complaintBox}
                >
                  <View style={styles.complaintHead}>
                    <Text style={styles.complaintType}>
                      {COMPLAINT_LABEL[c.type] ?? c.type}
                    </Text>
                    {c.removedAt != null ? (
                      <View style={styles.dismissed}>
                        <Text style={styles.dismissedText}>Dismissed</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.subtle} numberOfLines={open ? undefined : 1}>
                    {c.description}
                  </Text>
                  <Text style={styles.subtle}>
                    {c.clubName} · {formatDate(c.createdAt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          <Pressable style={styles.actionBtn} onPress={openEdit}>
            <Text style={styles.actionBtnText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              setPhoneVal(user.phone ?? "");
              setPhoneOpen(true);
            }}
          >
            <Text style={styles.actionBtnText}>Update Phone</Text>
          </Pressable>

          {user.role !== "admin" && !user.isFrozen ? (
            <Pressable style={styles.actionBtnDanger} onPress={onFreeze}>
              <Text style={styles.actionBtnDangerText}>Freeze Account</Text>
            </Pressable>
          ) : null}
          {user.isFrozen ? (
            <Pressable style={styles.actionBtnOk} onPress={onUnfreeze}>
              <Text style={styles.actionBtnOkText}>Unfreeze Account</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.actionBtn,
              !user.email && { opacity: 0.45 },
            ]}
            onPress={user.email ? onResetPassword : undefined}
            disabled={!user.email}
          >
            <Text style={styles.actionBtnText}>
              Reset Password
              {!user.email ? " (no email on file)" : ""}
            </Text>
          </Pressable>

          {user.role === "owner" ? (
            <Pressable style={styles.actionBtnSecondary} onPress={onResetPasscode}>
              <Text style={styles.actionBtnSecondaryText}>
                Reset Settings Passcode
              </Text>
            </Pressable>
          ) : null}

          {user.role === "owner" ? (
            <Pressable
              style={styles.actionBtnSecondary}
              onPress={() => setPromoteOpen(true)}
            >
              <Text style={styles.actionBtnSecondaryText}>Promote to Admin</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Text style={styles.warn}>
              Editing email updates the login credential for this account.
            </Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor={colors.text.secondary}
            />
            <TextInput
              style={styles.input}
              value={editAge}
              onChangeText={setEditAge}
              placeholder="Age"
              keyboardType="number-pad"
              placeholderTextColor={colors.text.secondary}
            />
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Email"
              autoCapitalize="none"
              placeholderTextColor={colors.text.secondary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditOpen(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onSaveEdit}>
                <Text style={styles.linkStrong}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={phoneOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update phone (E.164)</Text>
            <TextInput
              style={styles.input}
              value={phoneVal}
              onChangeText={setPhoneVal}
              placeholder="+919876543210"
              autoCapitalize="none"
              placeholderTextColor={colors.text.secondary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPhoneOpen(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onSavePhone}>
                <Text style={styles.linkStrong}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={forceOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Force end session</Text>
            <Text style={styles.subtle}>Reason (required, max 300 chars)</Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={forceReason}
              onChangeText={setForceReason}
              multiline
              placeholderTextColor={colors.text.secondary}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setForceOpen(false);
                  setForceSessionId(null);
                }}
              >
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onForceEnd}>
                <Text style={styles.linkStrong}>End session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={promoteOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Promote to Admin</Text>
            <Text style={styles.warn}>
              Promote {user.name} to Admin? This grants full platform access. This
              action cannot be undone. Type CONFIRM to enable the button.
            </Text>
            <TextInput
              style={styles.input}
              value={promoteConfirm}
              onChangeText={setPromoteConfirm}
              placeholder="CONFIRM"
              autoCapitalize="characters"
              placeholderTextColor={colors.text.secondary}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setPromoteOpen(false);
                  setPromoteConfirm("");
                }}
              >
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onPromote}
                disabled={promoteConfirm.trim() !== "CONFIRM"}
              >
                <Text
                  style={[
                    styles.linkStrong,
                    promoteConfirm.trim() !== "CONFIRM" && { opacity: 0.4 },
                  ]}
                >
                  Promote
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  bootRow: {
    flexDirection: "row",
    padding: layout.screenPadding,
  },
  skelBlock: {
    height: 100,
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  err: { ...typography.body, color: colors.status.error, padding: spacing[4] },
  topBar: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing[2] },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing[10] },
  hero: { alignItems: "center", marginBottom: spacing[4] },
  avatarLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  avatarLgText: { fontSize: 36, color: colors.text.primary, fontWeight: "700" },
  heroName: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: "center",
  },
  roleHdr: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  roleHdrText: { fontSize: 12, fontWeight: "700", color: colors.text.primary },
  heroMeta: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 4 },
  bannerFrozen: {
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  bannerFrozenText: { color: colors.status.error, fontWeight: "600" },
  bannerDel: {
    backgroundColor: "rgba(245, 127, 23, 0.15)",
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  bannerDelText: { color: colors.accent.amber, fontWeight: "600" },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTitle: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing[2],
    fontWeight: "700",
  },
  rowLine: { ...typography.bodySmall, color: colors.text.primary, marginBottom: 6 },
  subtle: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[3],
  },
  dangerBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: "rgba(244, 67, 54, 0.2)",
  },
  dangerBtnText: { color: colors.status.error, fontWeight: "600", fontSize: 12 },
  complaintBox: {
    borderTopWidth: 1,
    borderTopColor: colors.bg.tertiary,
    paddingVertical: spacing[3],
  },
  complaintHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complaintType: { ...typography.label, color: colors.text.primary },
  dismissed: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dismissedText: { fontSize: 10, color: colors.status.disabled },
  actionBtn: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
    alignItems: "center",
  },
  actionBtnText: { color: colors.text.primary, fontWeight: "600" },
  actionBtnDanger: {
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    padding: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
    alignItems: "center",
  },
  actionBtnDangerText: { color: colors.status.error, fontWeight: "700" },
  actionBtnOk: {
    backgroundColor: "rgba(67, 160, 71, 0.2)",
    padding: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
    alignItems: "center",
  },
  actionBtnOkText: { color: colors.accent.green, fontWeight: "700" },
  actionBtnSecondary: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
    alignItems: "center",
  },
  actionBtnSecondaryText: { color: colors.text.secondary, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bg.secondary,
    padding: spacing[4],
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  modalTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  warn: { ...typography.caption, color: colors.accent.amber, marginBottom: spacing[2] },
  input: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    padding: spacing[3],
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[3],
  },
  link: { color: colors.text.secondary },
  linkStrong: { color: colors.accent.green, fontWeight: "700" },
});
