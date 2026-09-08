import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useTranslation } from "@a3/i18n";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

export type ComplaintBannerType =
  | "violent_behaviour"
  | "theft"
  | "runaway_without_payment"
  | "late_credit_payment";

export type ComplaintBannerRow = {
  type: ComplaintBannerType;
  typeLabel: string;
  clubName: string;
  createdAt: number;
  /** Cross-club advisory: filing club's description when available */
  description?: string;
};

function badgeColors(t: ComplaintBannerType): {
  bg: string;
  text: string;
} {
  switch (t) {
    case "violent_behaviour":
      return { bg: colors.status.error, text: colors.text.primary };
    case "theft":
      return { bg: colors.accent.amber, text: colors.bg.primary };
    case "runaway_without_payment":
      return { bg: colors.accent.amberLight, text: colors.bg.primary };
    case "late_credit_payment":
      return { bg: colors.status.info, text: colors.text.primary };
    default:
      return { bg: colors.status.disabled, text: colors.text.primary };
  }
}

function formatRelativeTime(
  createdAt: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const sec = Math.floor((Date.now() - createdAt) / 1000);
  if (sec < 60) return t("sharedUi.complaintBanner.justNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("sharedUi.complaintBanner.minAgo", { min });
  const hr = Math.floor(min / 60);
  if (hr < 48) return t(hr === 1 ? "sharedUi.complaintBanner.hoursAgo" : "sharedUi.complaintBanner.hoursAgo_other", { hr });
  const day = Math.floor(hr / 24);
  if (day < 60) return t(day === 1 ? "sharedUi.complaintBanner.daysAgo" : "sharedUi.complaintBanner.daysAgo_other", { day });
  const mo = Math.floor(day / 30);
  return t(mo === 1 ? "sharedUi.complaintBanner.monthsAgo" : "sharedUi.complaintBanner.monthsAgo_other", { mo });
}

export interface ComplaintBannerProps {
  complaints: ComplaintBannerRow[];
  onAcknowledge: () => void;
  onCancel: () => void;
  /** When false, only one button area is used by parent (e.g. modal wrapper). */
  showActions?: boolean;
}

export function ComplaintBanner({
  complaints,
  onAcknowledge,
  onCancel,
  showActions = true,
}: ComplaintBannerProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("sharedUi.complaintBanner.warning")}</Text>
      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {complaints.map((c, i) => {
          const badge = badgeColors(c.type);
          return (
            <View key={`${c.createdAt}-${i}`} style={styles.row}>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeTxt, { color: badge.text }]} numberOfLines={2}>
                  {c.typeLabel}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.clubLine}>
                  {t("sharedUi.complaintBanner.filedBy", { clubName: c.clubName })}
                </Text>
                <Text style={styles.timeLine}>{formatRelativeTime(c.createdAt, t)}</Text>
                {c.description ? (
                  <Text style={styles.descLine} numberOfLines={3}>
                    {c.description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.advisory}>{t("sharedUi.complaintBanner.advisory")}</Text>
      {showActions ? (
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelTxt}>{t("sharedUi.complaintBanner.cancel")}</Text>
          </Pressable>
          <Pressable style={styles.ackBtn} onPress={onAcknowledge}>
            <Text style={styles.ackTxt}>{t("sharedUi.complaintBanner.acknowledge")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.status.error,
    padding: spacing[4],
    gap: spacing[3],
  },
  title: { ...typography.label, color: colors.status.error, fontWeight: "700" },
  list: { maxHeight: 160 },
  row: { flexDirection: "row", gap: spacing[3], marginBottom: spacing[2] },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    alignSelf: "flex-start",
    maxWidth: "40%",
  },
  badgeTxt: { ...typography.caption, fontWeight: "600" },
  rowBody: { flex: 1, gap: 2 },
  clubLine: { ...typography.bodySmall, color: colors.text.primary },
  timeLine: { ...typography.caption, color: colors.text.secondary },
  descLine: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  advisory: { ...typography.caption, color: colors.text.secondary },
  actions: { flexDirection: "row", gap: spacing[2] },
  cancelBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTxt: { ...typography.button, color: colors.text.secondary },
  ackBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.accent.green,
    alignItems: "center",
    justifyContent: "center",
  },
  ackTxt: { ...typography.button, color: colors.bg.primary },
});
