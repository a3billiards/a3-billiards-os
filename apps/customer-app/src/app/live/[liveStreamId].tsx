import { useLocalSearchParams, useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "@a3/convex/_generated/dataModel";
import { LiveStreamPlayer } from "../../components/LiveStreamPlayer";

export default function LiveStreamWatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ liveStreamId: string; clubName?: string }>();

  const liveStreamId = params.liveStreamId;
  if (!liveStreamId || typeof liveStreamId !== "string") {
    router.back();
    return null;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <LiveStreamPlayer
          liveStreamId={liveStreamId as Id<"liveStreams">}
          clubName={typeof params.clubName === "string" ? params.clubName : undefined}
          onClose={() => router.back()}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },
});
