import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, spacing, typography } from "@a3/ui/theme";
import { adminTabBarTotalInset } from "../theme/adminShell";
import { LiveStreamModerationList } from "../components/LiveStreamModerationList";

export default function LiveModerationScreen() {
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Live moderation</Text>
        <Text style={styles.subtitle}>
          Platform-wide active broadcasts. Force-ending requires a logged reason.
        </Text>
      </View>
      <LiveStreamModerationList
        streams={streams}
        onForceEnd={handleForceEnd}
        bottomInset={bottomPad}
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
