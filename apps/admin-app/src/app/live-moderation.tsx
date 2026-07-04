import { useCallback } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, spacing, typography } from "@a3/ui/theme";
import { usePullToRefresh } from "@a3/ui/hooks";
import { adminTabBarTotalInset } from "../theme/adminShell";
import { useTranslation } from "@a3/i18n";
import { LiveStreamModerationList } from "../components/LiveStreamModerationList";

export default function LiveModerationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshing, onRefresh } = usePullToRefresh();
  const insets = useSafeAreaInsets();
  const bottomPad = adminTabBarTotalInset(insets.bottom);
  const streams = useQuery(api.livestream.getActiveStreamsForAdmin, {});
  const forceEnd = useMutation(api.livestream.adminForceEndStream);

  const handleForceEnd = useCallback(
    async (args: { liveStreamId: Parameters<typeof forceEnd>[0]["liveStreamId"]; reason: string }) => {
      await forceEnd(args);
    },
    [forceEnd],
  );

  const handleWatch = useCallback(
    (stream: { liveStreamId: Parameters<typeof forceEnd>[0]["liveStreamId"]; clubName: string }) => {
      router.push({
        pathname: "/live/[liveStreamId]",
        params: { liveStreamId: stream.liveStreamId, clubName: stream.clubName },
      } as never);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("adminApp.moderation.title")}</Text>
        <Text style={styles.subtitle}>{t("adminApp.moderation.subtitle")}</Text>
      </View>
      <LiveStreamModerationList
        streams={streams}
        onForceEnd={handleForceEnd}
        onWatch={handleWatch}
        bottomInset={bottomPad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2] },
  title: { ...typography.heading2, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing[1] },
});
