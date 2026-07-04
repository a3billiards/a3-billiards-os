import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "@a3/convex/_generated/dataModel";
import { LiveStreamPlayer } from "../../components/LiveStreamPlayer";

export default function AdminLiveWatchScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ liveStreamId: string; clubName?: string }>();
  const rawId = Array.isArray(params.liveStreamId)
    ? params.liveStreamId[0]
    : params.liveStreamId;
  const clubName = Array.isArray(params.clubName) ? params.clubName[0] : params.clubName;

  if (!rawId) {
    router.back();
    return <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top", "bottom"]}>
      <LiveStreamPlayer
        liveStreamId={rawId as Id<"liveStreams">}
        clubName={clubName}
        onClose={() => router.back()}
        onSwitchStream={(id, name) => {
          router.replace({
            pathname: "/live/[liveStreamId]",
            params: { liveStreamId: id, clubName: name },
          } as never);
        }}
      />
    </SafeAreaView>
  );
}
