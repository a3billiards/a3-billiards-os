import { useCallback } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, spacing, typography } from "@a3/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";
import { TabAccessDenied } from "../../components/TabAccessDenied";
import { LiveStreamBroadcastControls } from "../../components/LiveStreamBroadcastControls";
import { ownerTabBarTotalInset } from "../../theme/ownerShell";
import {
  useStaffRole,
  staffRoleQueryId,
  useStaffTabQueryArgs,
} from "../../lib/StaffRoleContext";

export default function LivestreamScreen() {
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);
  const { roleId, canAccessTab } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const livestreamArgs = useStaffTabQueryArgs(clubId, "livestream");

  const activeStream = useQuery(
    api.livestream.getActiveStreamForClub,
    livestreamArgs === "skip" ? "skip" : { ...livestreamArgs, roleId: queryRoleId },
  );

  const startStream = useAction(api.livestream.startStream);
  const endStream = useMutation(api.livestream.endStream);
  const refreshViewerCount = useAction(api.livestream.refreshViewerCount);

  const handleStart = useCallback(
    async (args: { title?: string; tableLabel?: string }) => {
      if (!clubId) throw new Error("No club");
      const result = await startStream({
        clubId,
        roleId: queryRoleId,
        title: args.title,
        tableLabel: args.tableLabel,
      });
      return {
        ingestEndpoint: result.ingestEndpoint,
        streamKeyValue: result.streamKeyValue,
        liveStreamId: result.liveStreamId as Id<"liveStreams">,
      };
    },
    [clubId, queryRoleId, startStream],
  );

  const handleEnd = useCallback(async () => {
    if (!clubId) return;
    await endStream({ clubId, roleId: queryRoleId });
  }, [clubId, endStream, queryRoleId]);

  const handleRefreshViewers = useCallback(async () => {
    if (!clubId) return 0;
    const result = await refreshViewerCount({ clubId, roleId: queryRoleId });
    return result.viewerCount;
  }, [clubId, queryRoleId, refreshViewerCount]);

  if (dashboard === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }
  if (dashboard === null) return <OwnerNoClubPlaceholder />;
  if (roleId !== undefined && !canAccessTab("livestream")) {
    return <TabAccessDenied tabLabel="Live Stream" />;
  }
  if (!clubId) {
    return <OwnerNoClubPlaceholder />;
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Live Stream</Text>
      <Text style={styles.subtitle}>
        Broadcast a game at your club. Customers platform-wide can watch from the
        Customer App Live tab.
      </Text>

      {activeStream === undefined ? (
        <ActivityIndicator color={colors.accent.green} />
      ) : (
        <LiveStreamBroadcastControls
          clubId={clubId}
          roleId={queryRoleId}
          activeStream={activeStream}
          onStartStream={handleStart}
          onEndStream={handleEnd}
          onRefreshViewerCount={handleRefreshViewers}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[4], paddingTop: spacing[6], gap: spacing[2] },
  title: { ...typography.heading2, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing[2] },
});
