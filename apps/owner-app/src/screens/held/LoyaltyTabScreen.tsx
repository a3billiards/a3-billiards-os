/**
 * Loyalty tab UI — held for a future release. Not registered in the tab navigator.
 * Restore by moving this back to `app/(tabs)/loyalty.tsx` and re-enabling tab routes.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { TabAccessDenied } from "../../components/TabAccessDenied";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";
import {
  useStaffRole,
  staffRoleQueryId,
  useStaffTabQueryArgs,
} from "../../lib/StaffRoleContext";

export default function LoyaltyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const { roleId, canAccessTab } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const loyaltyArgs = useStaffTabQueryArgs(clubId, "loyalty");

  const overview = useQuery(
    api.loyalty.getDashboardOverview,
    loyaltyArgs === "skip" ? "skip" : { ...loyaltyArgs, roleId: queryRoleId },
  );
  const [search, setSearch] = useState("");
  const customers = useQuery(
    api.loyalty.listLoyaltyCustomers,
    loyaltyArgs === "skip"
      ? "skip"
      : { ...loyaltyArgs, roleId: queryRoleId, search: search.trim() || undefined },
  );

  const [detailUserId, setDetailUserId] = useState<Id<"users"> | null>(null);
  const detail = useQuery(
    api.loyalty.getCustomerLoyaltyDetail,
    clubId && detailUserId && loyaltyArgs !== "skip"
      ? { clubId, userId: detailUserId, roleId: queryRoleId }
      : "skip",
  );

  const manualAdjust = useMutation(api.loyalty.manualAdjustCredits);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  const isOwnerMode = roleId === null;

  if (dashboard === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }
  if (dashboard === null) return <OwnerNoClubPlaceholder />;
  if (roleId !== undefined && !canAccessTab("loyalty")) {
    return <TabAccessDenied tabLabel={t("ownerApp.loyalty.tabLabel")} />;
  }

  const programmeStatus = overview?.programme
    ? overview.programme.status === "active"
      ? t("ownerApp.loyalty.statusActive")
      : overview.programme.status
    : t("ownerApp.loyalty.statusNone");

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>{t("ownerApp.loyalty.title")}</Text>

        {overview === undefined ? (
          <ActivityIndicator color={colors.accent.green} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {overview.programme?.name ?? t("ownerApp.loyalty.noProgramme")}
            </Text>
            <Text style={styles.meta}>
              {t("ownerApp.loyalty.statusLine", { status: programmeStatus })}
            </Text>
            {overview.reward ? (
              <Text style={styles.meta}>
                {t("ownerApp.loyalty.ruleDescription", {
                  threshold: overview.reward.thresholdMinutes,
                  windowDays: overview.reward.windowDays,
                })}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {t("ownerApp.loyalty.enrolled", { count: overview.enrolledCount })}
            </Text>
            <Text style={styles.meta}>
              {t("ownerApp.loyalty.creditsLifetime", {
                earned: overview.totalCreditsAwarded,
                redeemed: overview.totalCreditsRedeemed,
              })}
            </Text>
            {isOwnerMode ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => router.push("/(tabs)/settings")}
              >
                <Text style={styles.linkBtnText}>{t("ownerApp.loyalty.configureInSettings")}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <TextInput
          style={styles.search}
          placeholder={t("ownerApp.loyalty.searchPlaceholder")}
          placeholderTextColor={colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
        />

        {customers === undefined ? (
          <ActivityIndicator color={colors.accent.green} />
        ) : customers.length === 0 ? (
          <Text style={styles.empty}>{t("ownerApp.loyalty.noEnrolled")}</Text>
        ) : (
          customers.map((c) => (
            <Pressable
              key={c.ledgerId}
              style={styles.row}
              onPress={() => setDetailUserId(c.userId)}
            >
              <View>
                <Text style={styles.rowName}>{c.name}</Text>
                <Text style={styles.rowSub}>{c.phone ?? t("common.emDash")}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.credits}>
                  {t("ownerApp.loyalty.creditsCount", { count: c.availableCredits })}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={detailUserId !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.cardTitle}>{t("ownerApp.loyalty.customerLoyalty")}</Text>
            {detail === undefined ? (
              <ActivityIndicator color={colors.accent.green} />
            ) : detail ? (
              <>
                <Text style={styles.rowName}>{detail.user?.name}</Text>
                <Text style={styles.meta}>
                  {t("ownerApp.loyalty.availableEarnedRedeemed", {
                    available: detail.ledger.availableCredits,
                    earned: detail.ledger.lifetimeCreditsEarned,
                    redeemed: detail.ledger.lifetimeCreditsRedeemed,
                  })}
                </Text>
                <Text style={styles.sectionLabel}>{t("ownerApp.loyalty.awards")}</Text>
                {detail.awards.slice(0, 8).map((a) => (
                  <Text key={a._id} style={styles.logLine}>
                    {t("ownerApp.loyalty.awardLine", {
                      date: new Date(a.awardedAt).toLocaleDateString(getCurrentLanguage()),
                      count: a.creditsAwarded,
                      tier: a.source,
                    })}
                  </Text>
                ))}
                <Text style={styles.sectionLabel}>{t("ownerApp.loyalty.redemptions")}</Text>
                {detail.redemptions.slice(0, 8).map((r) => (
                  <Text key={r._id} style={styles.logLine}>
                    {t("ownerApp.loyalty.redemptionLine", {
                      date: new Date(r.redeemedAt).toLocaleDateString(getCurrentLanguage()),
                      sessionId: r.sessionId,
                    })}
                  </Text>
                ))}
                {isOwnerMode ? (
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => setAdjustOpen(true)}
                  >
                    <Text style={styles.primaryBtnText}>{t("ownerApp.loyalty.manualAdjustment")}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Text style={styles.empty}>{t("ownerApp.loyalty.notFound")}</Text>
            )}
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setDetailUserId(null);
                setAdjustOpen(false);
              }}
            >
              <Text style={styles.secondaryBtnText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={adjustOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.cardTitle}>{t("ownerApp.loyalty.adjustCredits")}</Text>
            <Text style={styles.meta}>{t("ownerApp.loyalty.adjustHint")}</Text>
            <TextInput
              style={styles.search}
              keyboardType="number-pad"
              placeholder={t("ownerApp.loyalty.adjustPlaceholder")}
              value={adjustDelta}
              onChangeText={setAdjustDelta}
            />
            <TextInput
              style={[styles.search, { minHeight: 80 }]}
              multiline
              placeholder={t("ownerApp.loyalty.reasonRequired")}
              value={adjustReason}
              onChangeText={setAdjustReason}
            />
            <Pressable
              style={styles.primaryBtn}
              disabled={adjustBusy || !detailUserId || !clubId}
              onPress={() => {
                void (async () => {
                  if (!clubId || !detailUserId) return;
                  const delta = Number(adjustDelta);
                  if (!Number.isFinite(delta) || delta === 0) {
                    Alert.alert(
                      t("ownerApp.loyalty.invalidNumber"),
                      t("ownerApp.loyalty.invalidNumberBody"),
                    );
                    return;
                  }
                  setAdjustBusy(true);
                  try {
                    await manualAdjust({
                      clubId,
                      userId: detailUserId,
                      delta,
                      reason: adjustReason,
                    });
                    setAdjustOpen(false);
                    setAdjustDelta("");
                    setAdjustReason("");
                    Alert.alert(
                      t("ownerApp.loyalty.updated"),
                      t("ownerApp.loyalty.updatedBody"),
                    );
                  } catch (e) {
                    Alert.alert(t("ownerApp.loyalty.failed"), parseConvexError(e as Error).message);
                  } finally {
                    setAdjustBusy(false);
                  }
                })();
              }}
            >
              <Text style={styles.primaryBtnText}>
                {adjustBusy ? t("ownerApp.slots.saving") : t("ownerApp.loyalty.saveAdjustment")}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setAdjustOpen(false)}>
              <Text style={styles.secondaryBtnText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: layout.screenPadding, paddingTop: spacing[6], gap: spacing[3] },
  title: { ...typography.heading2, color: colors.text.primary },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing[1],
  },
  cardTitle: { ...typography.heading4, color: colors.text.primary },
  meta: { ...typography.bodySmall, color: colors.text.secondary },
  search: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    backgroundColor: colors.bg.tertiary,
  },
  empty: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing[3],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  rowName: { ...typography.label, color: colors.text.primary },
  rowSub: { ...typography.bodySmall, color: colors.text.secondary },
  rowRight: { alignItems: "flex-end" },
  credits: { ...typography.label, color: colors.accent.green },
  linkBtn: { marginTop: spacing[2] },
  linkBtnText: { ...typography.bodySmall, color: colors.accent.green },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    maxHeight: "85%",
    gap: spacing[2],
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  logLine: { ...typography.bodySmall, color: colors.text.primary },
  primaryBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  primaryBtnText: { ...typography.button, color: colors.bg.primary },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.text.primary },
});
