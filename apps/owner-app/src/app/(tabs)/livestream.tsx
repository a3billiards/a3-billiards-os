import { useCallback } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAction, useMutation, useQuery } from "convex/react";

import { api } from "@a3/convex/_generated/api";

import type { Id } from "@a3/convex/_generated/dataModel";

import { colors, spacing, typography } from "@a3/ui/theme";
import { TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@a3/i18n";

import { OwnerNoClubPlaceholder } from "../../components/OwnerNoClubPlaceholder";

import { TabAccessDenied } from "../../components/TabAccessDenied";

import { LiveStreamBroadcastControls } from "../../components/LiveStreamBroadcastControls";

import { ownerTabBarTotalInset } from "../../theme/ownerShell";

import {

  useStaffRole,

  staffRoleQueryId,

  useStaffTabQueryArgs,

} from "../../lib/StaffRoleContext";



function LivestreamScreenContent() {

  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();

  const insets = useSafeAreaInsets();

  const bottomPad = ownerTabBarTotalInset(insets.bottom);

  const { roleId, canAccessTab } = useStaffRole();

  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;

  const dashboard = useQuery(api.slotManagement.getSlotDashboard);

  const clubId = dashboard?.clubId;

  const livestreamArgs = useStaffTabQueryArgs(clubId, "livestream");



  const clubStreams = useQuery(

    api.livestream.getActiveStreamsForClub,

    livestreamArgs === "skip" ? "skip" : { ...livestreamArgs, roleId: queryRoleId },

  );



  const activeStream = useQuery(

    api.livestream.getActiveStreamForClub,

    livestreamArgs === "skip" ? "skip" : { ...livestreamArgs, roleId: queryRoleId },

  );



  const startStream = useAction(api.livestream.startStream);

  const endStream = useMutation(api.livestream.endStream);

  const refreshViewerCount = useAction(api.livestream.refreshViewerCount);



  const tables = (dashboard?.tables ?? [])

    .filter((t) => t.isActive)

    .map((t) => ({ _id: t._id, label: t.label }));



  const handleStart = useCallback(

    async (args: {

      title?: string;

      tableLabel?: string;

      tableId?: Id<"tables">;

    }) => {

      if (!clubId) throw new Error("No club");

      const result = await startStream({

        clubId,

        roleId: queryRoleId,

        title: args.title,

        tableLabel: args.tableLabel,

        tableId: args.tableId,

      });

      return {

        ingestEndpoint: result.ingestEndpoint,

        streamKeyValue: result.streamKeyValue,

        liveStreamId: result.liveStreamId as Id<"liveStreams">,

      };

    },

    [clubId, queryRoleId, startStream],

  );



  const handleEnd = useCallback(

    async (liveStreamId: Id<"liveStreams">) => {

      if (!clubId) return;

      await endStream({ clubId, liveStreamId, roleId: queryRoleId });

    },

    [clubId, endStream, queryRoleId],

  );



  const handleRefreshViewers = useCallback(

    async (liveStreamId: Id<"liveStreams">) => {

      if (!clubId) return 0;

      const result = await refreshViewerCount({

        clubId,

        liveStreamId,

        roleId: queryRoleId,

      });

      return result.viewerCount;

    },

    [clubId, queryRoleId, refreshViewerCount],

  );



  if (dashboard === undefined) {

    return (

      <View style={styles.center}>

        <ActivityIndicator size="large" color={colors.accent.green} />

      </View>

    );

  }

  if (dashboard === null) return <OwnerNoClubPlaceholder />;

  if (roleId !== undefined && !canAccessTab("livestream")) {

    return <TabAccessDenied tabLabel={t("common.tabs.owner.livestream")} />;

  }

  if (!clubId) {

    return <OwnerNoClubPlaceholder />;

  }



  return (

    <ScrollView

      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}

      keyboardShouldPersistTaps="handled"

      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }

    >

      <Text style={styles.title}>{t("ownerApp.livestream.title")}</Text>

      <Text style={styles.subtitle}>{t("ownerApp.livestream.subtitle")}</Text>



      {clubStreams && clubStreams.length > 1 ? (

        <Text style={styles.multiHint}>{t("ownerApp.livestream.otherClubStreams")}</Text>

      ) : null}



      {activeStream === undefined || clubStreams === undefined ? (

        <ActivityIndicator color={colors.accent.green} />

      ) : (

        <LiveStreamBroadcastControls

          clubId={clubId}

          roleId={queryRoleId}

          tables={tables}

          clubLiveStreams={clubStreams}

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

  multiHint: { ...typography.bodySmall, color: colors.accent.amberLight },

});

export default function LivestreamScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.livestream")}>
      <LivestreamScreenContent />
    </TabErrorBoundary>
  );
}

