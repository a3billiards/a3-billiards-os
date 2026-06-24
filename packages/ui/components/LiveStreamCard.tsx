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
import { spacing, radius } from "../theme/spacing";

export type LiveStreamCardData = {
  liveStreamId: string;
  clubId: string;
  clubName: string;
  clubBannerImageUrl: string | null;
  title: string | null;
  tableLabel: string | null;
  viewerCount: number;
};

export type LiveStreamCardProps = {
  stream: LiveStreamCardData;
  onPress: () => void;
};

export function LiveStreamCard({ stream, onPress }: LiveStreamCardProps): React.JSX.Element {
  const subtitle = [stream.title, stream.tableLabel].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Watch live stream from ${stream.clubName}`}
    >
      <View style={styles.bannerWrap}>
        {stream.clubBannerImageUrl ? (
          <Image source={{ uri: stream.clubBannerImageUrl }} style={styles.banner} />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]}>
            <Text style={styles.bannerPlaceholderText}>{stream.clubName.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.clubName} numberOfLines={1}>
          {stream.clubName}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={styles.viewers}>
          {stream.viewerCount} viewer{stream.viewerCount === 1 ? "" : "s"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardPressed: { opacity: 0.92 },
  bannerWrap: { position: "relative", width: "100%", aspectRatio: 16 / 9 },
  banner: { width: "100%", height: "100%" },
  bannerPlaceholder: {
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerPlaceholderText: {
    ...typography.heading2,
    color: colors.text.tertiary,
  },
  liveBadge: {
    position: "absolute",
    top: spacing[2],
    left: spacing[2],
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  liveBadgeText: {
    ...typography.labelSmall,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  body: { padding: spacing[3], gap: 4 },
  clubName: { ...typography.heading4, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.secondary },
  viewers: { ...typography.labelSmall, color: colors.text.tertiary, marginTop: 2 },
});
