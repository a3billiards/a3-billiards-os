import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, spacing, typography } from "@a3/ui/theme";
import { GlassPageBackground, LiveStreamCard } from "@a3/ui/components";
import { MaterialIcons } from "@expo/vector-icons";
import { customerTabBarTotalInset } from "../../theme/customerShell";

export default function LiveTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = customerTabBarTotalInset(insets.bottom);
  const streams = useQuery(api.livestream.getActiveStreamsPlatformWide, {});

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Live</Text>
          <Text style={styles.subtitle}>
            Watch games broadcasting now from clubs across the platform.
          </Text>
        </View>

        {streams === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent.green} />
          </View>
        ) : streams.length === 0 ? (
          <View style={[styles.empty, { paddingBottom: bottomPad }]}>
            <MaterialIcons name="videocam-off" size={56} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No live streams right now</Text>
            <Text style={styles.emptyMeta}>
              When a club goes live, it will appear here automatically.
            </Text>
          </View>
        ) : (
          <FlatList
            data={streams}
            keyExtractor={(item) => item.liveStreamId}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <LiveStreamCard
                stream={item}
                onPress={() =>
                  router.push({
                    pathname: "/live/[liveStreamId]",
                    params: {
                      liveStreamId: item.liveStreamId,
                      clubName: item.clubName,
                    },
                  })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3] },
  title: { ...typography.heading2, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing[1] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing[4], gap: spacing[4] },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginTop: spacing[2] },
  emptyMeta: { ...typography.bodySmall, color: colors.text.secondary, textAlign: "center" },
});
