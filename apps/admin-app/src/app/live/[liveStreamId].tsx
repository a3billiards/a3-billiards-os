import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "@a3/convex/_generated/dataModel";
import { LiveStreamPlayer } from "../../components/LiveStreamPlayer";

function resolveLiveStreamId(
  params: { liveStreamId?: string | string[] },
  segments: readonly string[],
): string | undefined {
  const fromParams = Array.isArray(params.liveStreamId)
    ? params.liveStreamId[0]
    : params.liveStreamId;
  if (typeof fromParams === "string" && fromParams.length > 0) {
    return fromParams;
  }

  const liveIdx = segments.indexOf("live");
  const fromPath = liveIdx >= 0 ? segments[liveIdx + 1] : undefined;
  if (typeof fromPath === "string" && fromPath.length > 0 && !fromPath.startsWith("[")) {
    return fromPath;
  }

  return undefined;
}

export default function AdminLiveWatchScreen(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ liveStreamId?: string; clubName?: string }>();

  const liveStreamId = useMemo(
    () => resolveLiveStreamId(params, segments),
    [params.liveStreamId, segments],
  );

  const clubName = Array.isArray(params.clubName) ? params.clubName[0] : params.clubName;

  const closeWatch = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/live-moderation");
  };

  if (!liveStreamId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top", "bottom"]}>
      <LiveStreamPlayer
        liveStreamId={liveStreamId as Id<"liveStreams">}
        clubName={clubName}
        onClose={closeWatch}
        onSwitchStream={(id, name) => {
          router.replace({
            pathname: "/live/[liveStreamId]",
            params: {
              liveStreamId: String(id),
              ...(name ? { clubName: name } : {}),
            },
          } as never);
        }}
      />
    </SafeAreaView>
  );
}
