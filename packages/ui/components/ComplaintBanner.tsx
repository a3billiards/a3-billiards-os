import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
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

function formatRelativeTime(createdAt: number): string {
  const sec = Math.floor((Date.now() - createdAt) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 60) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
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
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{"\u26A0"} Customer has active complaint(s)</Text>
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
                  Filed by {c.clubName}
                </Text>
                <Text style={styles.dateLine}>{formatRelativeTime(c.createdAt)}</Text>
                {c.description ? (
                  <Text style={styles.desc} numberOfLines={4}>
                    {c.description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.disclaimer}>
        This is an advisory warning. You may still proceed or cancel the session.
      </Text>
      {showActions ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.btnSecondaryTxt}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onAcknowledge}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.btnPrimaryTxt}>Acknowledge and Proceed</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.secondary,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.error,
    borderRadius: radius.md,
    padding: spacing[4],
    maxHeight: 420,
  },
  title: {
    ...typography.label,
    color: colors.status.error,
    marginBottom: spacing[3],
  },
  list: { maxHeight: 220 },
  row: {
    flexDirection: "row",
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    maxWidth: 120,
  },
  badgeTxt: {
    ...typography.caption,
    fontWeight: "600",
  },
  rowBody: { flex: 1, minWidth: 0 },
  clubLine: { ...typography.bodySmall, color: colors.text.primary },
  dateLine: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  desc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[2],
    fontStyle: "italic",
  },
  disclaimer: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginBottom: spacing[3],
  },
  actions: { gap: spacing[2] },
  btnSecondary: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  btnSecondaryTxt: { ...typography.buttonLarge, color: colors.text.primary },
  btnPrimary: {
    borderRadius: radius.lg,
    backgroundColor: colors.accent.amber,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  btnPrimaryTxt: {
    ...typography.buttonLarge,
    color: colors.bg.primary,
    fontWeight: "600",
  },
  pressed: { opacity: 0.88 },
});

export default ComplaintBanner;
