import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing } from "../theme/spacing";

export type ClubSearchResult = {
  clubId: string;
  name: string;
  address: string;
  distanceKm: number | null;
  thumbnailUrl: string | null;
  tableTypes: string[];
  operatingHours: { open: string; close: string; daysOfWeek: number[] } | null;
  bookingEnabled: boolean;
};

export interface ClubCardProps {
  club: ClubSearchResult;
  onPress: () => void;
}

function to12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDistance(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function hoursSummary(
  oh: ClubSearchResult["operatingHours"],
): { label: string; isSet: boolean } {
  if (!oh) return { label: "Hours not set", isSet: false };
  return {
    label: `${to12h(oh.open)} – ${to12h(oh.close)}`,
    isSet: true,
  };
}

export function ClubCard({ club, onPress }: ClubCardProps): React.JSX.Element {
  const { label: hoursLabel, isSet: hoursOk } = hoursSummary(club.operatingHours);
  const types = club.tableTypes;
  const maxChips = 3;
  const shown = types.slice(0, maxChips);
  const overflow = types.length - shown.length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumbWrap}>
        {club.thumbnailUrl ? (
          <Image source={{ uri: club.thumbnailUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbIcon}>◎</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {club.name}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {club.address}
        </Text>
        {club.distanceKm !== null ? (
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{formatDistance(club.distanceKm)}</Text>
          </View>
        ) : null}
        <View style={styles.chipRow}>
          {shown.map((t) => (
            <View key={t} style={styles.chip}>
              <Text style={styles.chipText}>{t}</Text>
            </View>
          ))}
          {overflow > 0 ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>+{overflow} more</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.hours, !hoursOk && styles.hoursMuted]}>{hoursLabel}</Text>
        {club.bookingEnabled ? (
          <View style={styles.bookBadge}>
            <Text style={styles.bookBadgeText}>Bookable Online</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const THUMB = 80;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.bg.secondary,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[3],
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  cardPressed: { opacity: 0.92 },
  thumbWrap: { marginRight: spacing[3] },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    backgroundColor: colors.bg.tertiary,
  },
  thumbPlaceholder: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbIcon: {
    fontSize: 28,
    color: colors.text.secondary,
  },
  body: { flex: 1, minWidth: 0 },
  name: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text.primary,
  },
  address: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  distBadge: {
    alignSelf: "flex-start",
    marginTop: spacing[2],
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  distText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[1],
    marginTop: spacing[2],
  },
  chip: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text.primary,
  },
  hours: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  hoursMuted: { color: colors.status.disabled },
  bookBadge: {
    alignSelf: "flex-start",
    marginTop: spacing[2],
    backgroundColor: "rgba(67, 160, 71, 0.2)",
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: 4,
  },
  bookBadgeText: {
    ...typography.caption,
    color: colors.accent.green,
    fontWeight: "600",
  },
});

export default ClubCard;
