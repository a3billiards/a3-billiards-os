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
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useAction } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { shareCsvExport } from "@a3/ui/shareJson";
import { PhoneInput } from "@a3/ui/components";
import { DEFAULT_PHONE_E164 } from "@a3/utils/phone";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import { usePullToRefresh } from "@a3/ui/hooks";

const COMPLAINT_TYPE_KEYS: Record<string, string> = {
  violent_behaviour: "adminApp.userProfile.complaintViolentBehaviour",
  theft: "adminApp.userProfile.complaintTheft",
  runaway_without_payment: "adminApp.userProfile.complaintRunaway",
  late_credit_payment: "adminApp.userProfile.complaintLateCredit",
};

function elapsedAgo(
  startMs: number,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const m = Math.floor((Date.now() - startMs) / 60000);
  if (m < 1) return tr("adminApp.userProfile.elapsedJustNow");
  if (m < 60) return tr("adminApp.userProfile.elapsedMinAgo", { minutes: m });
  const h = Math.floor(m / 60);
  return tr("adminApp.userProfile.elapsedHoursAgo", { hours: h, minutes: m % 60 });
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function RoleHeaderBadge({
  role,
  tr,
}: {
  role: "admin" | "owner" | "customer";
  tr: (key: string) => string;
}): React.JSX.Element {
  const cfg =
    role === "admin"
      ? { bg: colors.status.info, label: tr("adminApp.roles.admin") }
      : role === "owner"
        ? { bg: colors.accent.amber, label: tr("adminApp.roles.owner") }
        : { bg: colors.bg.tertiary, label: tr("adminApp.roles.customer") };
  return (
    <View style={[styles.roleHdr, { backgroundColor: cfg.bg }]}>
      <Text style={styles.roleHdrText}>{cfg.label}</Text>
    </View>
  );
}

export default function UserProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const { userId: rawParam } = useLocalSearchParams<{ userId: string | string[] }>();
  const rawId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

  const userId = (rawId ?? "") as Id<"users">;
  const validId = typeof rawId === "string" && rawId.length > 0;

  const profile = useQuery(api.users.getUserProfile, validId ? { userId } : "skip");
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const editUser = useMutation(api.users.adminEditUser);
  const updatePhone = useMutation(api.users.adminUpdatePhone);
  const freezeUser = useMutation(api.users.adminFreezeUser);
  const unfreezeUser = useMutation(api.users.adminUnfreezeUser);
  const resetPasscode = useMutation(api.users.adminResetOwnerPasscode);
  const cancelDeletion = useMutation(api.users.adminCancelDeletion);
  const endClubSubscription = useMutation(api.users.adminEndClubSubscription);
  const promoteAdmin = useMutation(api.users.adminPromoteToAdmin);
  const demoteAdmin = useMutation(api.users.adminDemoteToOwner);
  const forceEnd = useMutation(api.sessions.forceEndSession);
  const sendResetEmail = useAction(api.usersAdminActions.adminResetUserPassword);
  const exportUserData = useAction(api.dataExportActions.adminExportUserData);

  const [exportingUser, setExportingUser] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneVal, setPhoneVal] = useState(DEFAULT_PHONE_E164);

  const [forceOpen, setForceOpen] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forceSessionId, setForceSessionId] = useState<Id<"sessions"> | null>(
    null,
  );

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteConfirm, setPromoteConfirm] = useState("");
  const [demoteOpen, setDemoteOpen] = useState(false);
  const [demoteConfirm, setDemoteConfirm] = useState("");

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
        Alert.alert(t("adminApp.userProfile.invalidAge"));
        return;
      }
      await editUser({
        userId,
        name: editName.trim(),
        age,
        ...(editEmail.trim().length > 0 ? { email: editEmail.trim() } : {}),
      });
      setEditOpen(false);
      Alert.alert(t("adminApp.userProfile.saved"), t("adminApp.userProfile.profileUpdated"));
    } catch (e) {
      Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
    }
  };

  const onSavePhone = async () => {
    try {
      await updatePhone({ userId, phone: phoneVal.trim() });
      setPhoneOpen(false);
      setPhoneVal(DEFAULT_PHONE_E164);
      Alert.alert(t("adminApp.userProfile.saved"), t("adminApp.userProfile.phoneUpdated"));
    } catch (e) {
      Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
    }
  };

  const onFreeze = () => {
    if (!profile) return;
    Alert.alert(
      t("adminApp.userProfile.freezeTitle"),
      t("adminApp.userProfile.freezeMessage", { name: profile.user.name }),
      [
        { text: t("adminApp.userProfile.cancel"), style: "cancel" },
        {
          text: t("adminApp.userProfile.freeze"),
          style: "destructive",
          onPress: async () => {
            try {
              await freezeUser({ userId });
            } catch (e) {
              Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onUnfreeze = () => {
    if (!profile) return;
    Alert.alert(
      t("adminApp.userProfile.unfreezeTitle"),
      t("adminApp.userProfile.unfreezeMessage", { name: profile.user.name }),
      [
        { text: t("adminApp.userProfile.cancel"), style: "cancel" },
        {
          text: t("adminApp.userProfile.unfreeze"),
          onPress: async () => {
            try {
              await unfreezeUser({ userId });
            } catch (e) {
              Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onResetPassword = () => {
    if (!profile) return;
    if (!profile.user.email) {
      Alert.alert(
        t("adminApp.userProfile.resetPasswordTitle"),
        t("adminApp.users.resetPasswordNoEmailHint"),
        [
          { text: t("adminApp.userProfile.cancel"), style: "cancel" },
          { text: t("adminApp.userProfile.editProfile"), onPress: openEdit },
        ],
      );
      return;
    }
    Alert.alert(
      t("adminApp.userProfile.resetPasswordTitle"),
      t("adminApp.userProfile.resetPasswordMessage", { email: profile.user.email }),
      [
        { text: t("adminApp.userProfile.cancel"), style: "cancel" },
        {
          text: t("adminApp.userProfile.send"),
          onPress: async () => {
            try {
              await sendResetEmail({ userId });
              Alert.alert(t("adminApp.userProfile.done"), t("adminApp.userProfile.passwordResetSent"));
            } catch (e) {
              Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onCancelDeletion = () => {
    if (!profile) return;
    Alert.alert(
      t("adminApp.userProfile.cancelDeletionTitle"),
      t("adminApp.userProfile.cancelDeletionMessage", { name: profile.user.name }),
      [
        { text: t("adminApp.userProfile.cancel"), style: "cancel" },
        {
          text: t("adminApp.userProfile.cancelDeletion"),
          onPress: async () => {
            try {
              await cancelDeletion({ userId });
              Alert.alert(t("adminApp.userProfile.done"), t("adminApp.userProfile.deletionCancelled"));
            } catch (e) {
              Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onEndSubscription = () => {
    if (!profile?.ownedClub) return;
    Alert.alert(
      t("adminApp.userProfile.endSubscriptionTitle"),
      t("adminApp.userProfile.endSubscriptionMessage", { clubName: profile.ownedClub.name }),
      [
        { text: t("adminApp.userProfile.cancel"), style: "cancel" },
        {
          text: t("adminApp.userProfile.endSubscription"),
          style: "destructive",
          onPress: async () => {
            try {
              const result = await endClubSubscription({ userId });
              Alert.alert(
                t("adminApp.userProfile.done"),
                result.alreadyEnded
                  ? t("adminApp.userProfile.subscriptionAlreadyEnded")
                  : t("adminApp.userProfile.subscriptionEnded"),
              );
            } catch (e) {
              Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onResetPasscode = () => {
    if (!profile) return;
    Alert.alert(
      t("adminApp.userProfile.resetPasscodeTitle"),
      t("adminApp.userProfile.resetPasscodeMessage", { name: profile.user.name }),
      [
        { text: t("adminApp.userProfile.cancel"), style: "cancel" },
        {
          text: t("adminApp.userProfile.reset"),
          onPress: async () => {
            try {
              await resetPasscode({ userId });
              Alert.alert(t("adminApp.userProfile.done"), t("adminApp.userProfile.passcodeCleared"));
            } catch (e) {
              Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const onPromote = async () => {
    if (promoteConfirm.trim() !== "CONFIRM") {
      Alert.alert(t("adminApp.userProfile.typeConfirmPromote"));
      return;
    }
    try {
      await promoteAdmin({ userId });
      setPromoteOpen(false);
      setPromoteConfirm("");
      Alert.alert(
        t("adminApp.userProfile.done"),
        t("adminApp.userProfile.promoted"),
      );
    } catch (e) {
      Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
    }
  };

  const onDemote = async () => {
    if (demoteConfirm.trim() !== "CONFIRM") {
      Alert.alert(t("adminApp.userProfile.typeConfirmDemote"));
      return;
    }
    try {
      await demoteAdmin({ userId });
      setDemoteOpen(false);
      setDemoteConfirm("");
      Alert.alert(
        t("adminApp.userProfile.done"),
        t("adminApp.userProfile.demoted"),
      );
    } catch (e) {
      Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
    }
  };

  const onExportUser = async () => {
    setExportingUser(true);
    try {
      const data = await exportUserData({ targetUserId: userId });
      await shareCsvExport(data.filename, data.csv);
    } catch (e) {
      Alert.alert(
        t("adminApp.userProfile.exportFailed"),
        parseConvexError(e as Error).message,
      );
    } finally {
      setExportingUser(false);
    }
  };

  const onForceEnd = async () => {
    if (!forceSessionId) return;
    const r = forceReason.trim();
    if (!r || r.length > 300) {
      Alert.alert(t("adminApp.userProfile.reasonRequired"), t("adminApp.userProfile.reasonRequiredBody"));
      return;
    }
    try {
      await forceEnd({ sessionId: forceSessionId, reason: r });
      setForceOpen(false);
      setForceReason("");
      setForceSessionId(null);
      Alert.alert(t("adminApp.userProfile.sessionEnded"), t("adminApp.userProfile.sessionForceEnded"));
    } catch (e) {
      const msg = parseConvexError(e as Error).message;
      if (msg.includes("FORCE_001")) {
        Alert.alert(t("adminApp.userProfile.sessionAlreadyEnded"), t("adminApp.userProfile.sessionAlreadyEndedBody"));
      } else {
        Alert.alert(t("auth.admin.mfa.errorLabel"), msg);
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

  if (!validId || profile === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.bootRow}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.err}>{t("adminApp.userProfile.notFound")}</Text>
      </SafeAreaView>
    );
  }

  const { user, complaints, activeSessions, ownedClub } = profile;

  const canDemote =
    currentUser?.isSuperAdmin === true &&
    currentUser._id !== userId &&
    user.role === "admin" &&
    !user.isSuperAdmin;

  const showAdminPasswordWarning =
    user.role === "admin" && user.email && !user.hasPasswordLogin;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>
              {user.name.trim().slice(0, 1).toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <RoleHeaderBadge role={user.role} tr={t} />
          {user.email ? (
            <Text style={styles.heroMeta}>{user.email}</Text>
          ) : null}
          {user.phone ? (
            <Text style={styles.heroMeta}>{user.phone}</Text>
          ) : null}
        </View>

        {user.isFrozen ? (
          <View style={styles.bannerFrozen}>
            <Text style={styles.bannerFrozenText}>{t("adminApp.userProfile.accountFrozen")}</Text>
          </View>
        ) : null}
        {user.deletionRequestedAt != null ? (
          <View style={styles.bannerDel}>
            <Text style={styles.bannerDelText}>{t("adminApp.userProfile.pendingDeletion")}</Text>
          </View>
        ) : null}
        {showAdminPasswordWarning ? (
          <View style={styles.bannerWarn}>
            <Text style={styles.bannerWarnText}>{t("adminApp.userProfile.noPasswordWarning")}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("adminApp.userProfile.accountSection")}</Text>
          <Text style={styles.rowLine}>{t("adminApp.userProfile.age", { age: user.age })}</Text>
          <Text style={styles.rowLine}>
            {t("adminApp.userProfile.phoneVerified", { value: user.phoneVerified ? t("adminApp.userProfile.yes") : t("adminApp.userProfile.no") })}
          </Text>
          <Text style={styles.rowLine}>
            {user.consentGivenAt != null
              ? t("adminApp.userProfile.consentGiven", { date: formatDate(user.consentGivenAt) })
              : t("adminApp.userProfile.legacyAccount")}
          </Text>
          <Text style={styles.rowLine}>{t("adminApp.userProfile.joined", { date: formatDate(user.createdAt) })}</Text>
          {user.role === "owner" && ownedClub ? (
            <>
              <Text style={styles.rowLine}>{t("adminApp.userProfile.club", { name: ownedClub.name })}</Text>
              <Text style={styles.rowLine}>
                {t("adminApp.userProfile.subscription", { status: ownedClub.subscriptionStatus })}
              </Text>
              <Text style={styles.rowLine}>
                {t("adminApp.userProfile.settingsPasscode", { value: user.settingsPasscodeSet ? t("adminApp.userProfile.passcodeSet") : t("adminApp.userProfile.passcodeNotSet") })}
              </Text>
            </>
          ) : null}
          {user.role === "customer" && affiliationsText ? (
            <Text style={styles.rowLine}>{t("adminApp.userProfile.playedAt", { clubs: affiliationsText })}</Text>
          ) : null}
        </View>

        {activeSessions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("adminApp.userProfile.activeSessionsSection")}</Text>
            {activeSessions.map((s) => (
              <View key={s.sessionId} style={styles.sessionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLine}>
                    {s.clubName} · {s.tableLabel}
                  </Text>
                  <Text style={styles.subtle}>
                    {t("adminApp.userProfile.started", { time: elapsedAgo(s.startTime, t) })}
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
                  <Text style={styles.dangerBtnText}>{t("adminApp.userProfile.forceEnd")}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {complaints.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("adminApp.userProfile.complaintsSection", { count: complaints.length })}</Text>
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
                      {t(COMPLAINT_TYPE_KEYS[c.type] ?? c.type)}
                    </Text>
                    {c.removedAt != null ? (
                      <View style={styles.dismissed}>
                        <Text style={styles.dismissedText}>{t("adminApp.userProfile.dismissed")}</Text>
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
          <Text style={styles.cardTitle}>{t("adminApp.userProfile.actionsSection")}</Text>
          <Pressable style={styles.actionBtn} onPress={openEdit}>
            <Text style={styles.actionBtnText}>{t("adminApp.userProfile.editProfile")}</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              setPhoneVal(user.phone ?? DEFAULT_PHONE_E164);
              setPhoneOpen(true);
            }}
          >
            <Text style={styles.actionBtnText}>{t("adminApp.userProfile.updatePhone")}</Text>
          </Pressable>

          {user.role !== "admin" && !user.isFrozen ? (
            <Pressable style={styles.actionBtnDanger} onPress={onFreeze}>
              <Text style={styles.actionBtnDangerText}>{t("adminApp.userProfile.freezeAccount")}</Text>
            </Pressable>
          ) : null}
          {user.isFrozen ? (
            <Pressable style={styles.actionBtnOk} onPress={onUnfreeze}>
              <Text style={styles.actionBtnOkText}>{t("adminApp.userProfile.unfreezeAccount")}</Text>
            </Pressable>
          ) : null}

          {user.deletionRequestedAt != null && user.role !== "admin" ? (
            <Pressable style={styles.actionBtnOk} onPress={onCancelDeletion}>
              <Text style={styles.actionBtnOkText}>{t("adminApp.userProfile.cancelDeletion")}</Text>
            </Pressable>
          ) : null}

          {user.role === "owner" &&
          ownedClub &&
          ownedClub.subscriptionStatus !== "frozen" ? (
            <Pressable style={styles.actionBtnDanger} onPress={onEndSubscription}>
              <Text style={styles.actionBtnDangerText}>
                {t("adminApp.userProfile.endSubscription")}
              </Text>
            </Pressable>
          ) : null}

          {(user.role === "customer" || user.role === "owner") ? (
            <Pressable
              style={styles.actionBtn}
              onPress={onResetPassword}
            >
              <Text style={styles.actionBtnText}>
                {t("adminApp.userProfile.resetPassword")}
                {!user.email ? ` — ${t("adminApp.userProfile.resetPasswordNoEmail")}` : ""}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.actionBtn, exportingUser && { opacity: 0.6 }]}
            onPress={() => void onExportUser()}
            disabled={exportingUser}
          >
            <Text style={styles.actionBtnText}>
              {exportingUser
                ? t("adminApp.userProfile.exporting")
                : t("adminApp.userProfile.downloadUserData")}
            </Text>
          </Pressable>

          {user.role === "owner" ? (
            <Pressable style={styles.actionBtnSecondary} onPress={onResetPasscode}>
              <Text style={styles.actionBtnSecondaryText}>
                {t("adminApp.userProfile.resetSettingsPasscode")}
              </Text>
            </Pressable>
          ) : null}

          {user.role === "owner" ? (
            <Pressable
              style={styles.actionBtnSecondary}
              onPress={() => setPromoteOpen(true)}
            >
              <Text style={styles.actionBtnSecondaryText}>{t("adminApp.userProfile.promoteToAdmin")}</Text>
            </Pressable>
          ) : null}

          {canDemote ? (
            <Pressable
              style={styles.actionBtnDanger}
              onPress={() => setDemoteOpen(true)}
            >
              <Text style={styles.actionBtnDangerText}>{t("adminApp.userProfile.demoteToOwner")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("adminApp.userProfile.editProfileTitle")}</Text>
            <Text style={styles.warn}>
              {t("adminApp.userProfile.editEmailWarning")}
            </Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder={t("adminApp.userProfile.namePlaceholder")}
              placeholderTextColor={colors.text.secondary}
            />
            <TextInput
              style={styles.input}
              value={editAge}
              onChangeText={setEditAge}
              placeholder={t("adminApp.userProfile.agePlaceholder")}
              keyboardType="number-pad"
              placeholderTextColor={colors.text.secondary}
            />
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder={t("adminApp.userProfile.emailPlaceholder")}
              autoCapitalize="none"
              placeholderTextColor={colors.text.secondary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditOpen(false)}>
                <Text style={styles.link}>{t("adminApp.userProfile.cancel")}</Text>
              </Pressable>
              <Pressable onPress={onSaveEdit}>
                <Text style={styles.linkStrong}>{t("adminApp.userProfile.save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={phoneOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("adminApp.userProfile.updatePhoneTitle")}</Text>
            <PhoneInput
              value={phoneVal}
              onChangeValue={setPhoneVal}
              countryCodeLabel={t("auth.phone.countryCode")}
              selectCountryLabel={t("auth.phone.selectCountry")}
              accessibilityLabel={t("auth.phone.number")}
              inputStyle={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPhoneOpen(false)}>
                <Text style={styles.link}>{t("adminApp.userProfile.cancel")}</Text>
              </Pressable>
              <Pressable onPress={onSavePhone}>
                <Text style={styles.linkStrong}>{t("adminApp.userProfile.save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={forceOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("adminApp.userProfile.forceEndTitle")}</Text>
            <Text style={styles.subtle}>{t("adminApp.userProfile.forceEndReasonHint")}</Text>
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
                <Text style={styles.link}>{t("adminApp.userProfile.cancel")}</Text>
              </Pressable>
              <Pressable onPress={onForceEnd}>
                <Text style={styles.linkStrong}>{t("adminApp.userProfile.endSession")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={promoteOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("adminApp.userProfile.promoteTitle")}</Text>
            <Text style={styles.warn}>
              {t("adminApp.userProfile.promoteWarning", { name: user.name })}
            </Text>
            <TextInput
              style={styles.input}
              value={promoteConfirm}
              onChangeText={setPromoteConfirm}
              placeholder={t("common.confirmKeyword")}
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
                <Text style={styles.link}>{t("adminApp.userProfile.cancel")}</Text>
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
                  {t("adminApp.userProfile.promote")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={demoteOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("adminApp.userProfile.demoteTitle")}</Text>
            <Text style={styles.warn}>
              {t("adminApp.userProfile.demoteWarning", { name: user.name })}
            </Text>
            <TextInput
              style={styles.input}
              value={demoteConfirm}
              onChangeText={setDemoteConfirm}
              placeholder={t("common.confirmKeyword")}
              autoCapitalize="characters"
              placeholderTextColor={colors.text.secondary}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setDemoteOpen(false);
                  setDemoteConfirm("");
                }}
              >
                <Text style={styles.link}>{t("adminApp.userProfile.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={onDemote}
                disabled={demoteConfirm.trim() !== "CONFIRM"}
              >
                <Text
                  style={[
                    styles.linkStrong,
                    demoteConfirm.trim() !== "CONFIRM" && { opacity: 0.4 },
                  ]}
                >
                  {t("adminApp.userProfile.demote")}
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
  bannerWarn: {
    backgroundColor: colors.accent.amber + "22",
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  bannerWarnText: { color: colors.accent.amber, fontWeight: "600" },
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
