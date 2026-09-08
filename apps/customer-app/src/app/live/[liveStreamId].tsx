import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Id } from "@a3/convex/_generated/dataModel";
import { LiveStreamPlayer } from "../../components/LiveStreamPlayer";

export default function LiveStreamWatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ liveStreamId: string; clubName?: string }>();

  const rawId = Array.isArray(params.liveStreamId)
    ? params.liveStreamId[0]
    : params.liveStreamId;
  const valid = typeof rawId === "string" && rawId.length > 0;

  useEffect(() => {
    if (!valid) {
      router.replace("/(tabs)/live");
    }
  }, [valid, router]);

  if (!valid) return null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <LiveStreamPlayer
          liveStreamId={rawId as Id<"liveStreams">}
          clubName={
            typeof params.clubName === "string"
              ? params.clubName
              : Array.isArray(params.clubName)
                ? params.clubName[0]
                : undefined
          }
          onClose={() => router.back()}
          onSwitchStream={(id, name) => {
            router.replace({
              pathname: "/live/[liveStreamId]",
              params: { liveStreamId: id, clubName: name },
            });
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },
});
