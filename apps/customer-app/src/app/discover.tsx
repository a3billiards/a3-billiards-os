import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { ClubCard, type ClubSearchResult } from "@a3/ui/components";
import { colors, spacing, typography, layout } from "@a3/ui/theme";

function SkeletonCard(): React.JSX.Element {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonThumb} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLineLg} />
        <View style={styles.skeletonLineSm} />
        <View style={styles.skeletonLineSm} />
      </View>
    </View>
  );
}

export default function DiscoverScreen(): React.JSX.Element {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const [draft, setDraft] = useState("");
  const [debounced, setDebounced] = useState("");
  const [perm, setPerm] = useState<Location.PermissionStatus | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const current = await Location.getForegroundPermissionsAsync();
          if (cancelled) return;
          setPerm(current.status);
          if (current.status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (cancelled) return;
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          } else {
            setCoords(null);
          }
        } catch {
          if (!cancelled) {
            setPerm(Location.PermissionStatus.DENIED);
            setCoords(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPerm(status);
    if (status === "granted") {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }
  };

  const isCustomer = user?.role === "customer";
  const hasGps = perm === "granted" && coords !== null;
  const curatedMode = !hasGps && debounced.length === 0;

  const results = useQuery(
    api.clubDiscovery.searchClubs,
    isCustomer
      ? {
          searchText: debounced.length > 0 ? debounced : undefined,
          userLat: hasGps ? coords!.lat : undefined,
          userLng: hasGps ? coords!.lng : undefined,
          radiusKm: 50,
          limit: curatedMode ? 10 : 20,
        }
      : "skip",
  );

  const loading = results === undefined;
  const list = (results ?? []) as ClubSearchResult[];

  const emptyMessage = (() => {
    if (loading) return null;
    if (list.length > 0) return null;
    if (hasGps && debounced.length === 0) {
      return "No clubs found nearby. Try searching by name.";
    }
    if (debounced.length > 0) {
      return `No clubs found for "${debounced}". Try a different name.`;
    }
    return "No clubs available yet. Check back soon.";
  })();

  const header = (
    <View style={styles.headerBlock}>
      {perm !== "granted" ? (
        <View style={styles.locBanner}>
          <Text style={styles.locBannerText}>Enable location for nearby clubs</Text>
          <Pressable style={styles.locBannerBtn} onPress={requestLocation}>
            <Text style={styles.locBannerBtnText}>Turn On</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Search for a billiards club..."
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {draft.length > 0 ? (
          <Pressable
            onPress={() => setDraft("")}
            hitSlop={12}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {curatedMode && !loading ? (
        <Text style={styles.prompt}>Search for a billiards club by name</Text>
      ) : null}
      {curatedMode && !loading && list.length > 0 ? (
        <Text style={styles.sectionTitle}>Clubs on A3 Billiards OS</Text>
      ) : null}
    </View>
  );

  if (!isCustomer) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.muted}>Sign in to discover clubs.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>Discover</Text>
      {loading ? (
        <View style={styles.pad}>
          {header}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.clubId}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ClubCard
              club={item}
              onPress={() => router.push(`/club/${item.clubId}` as any)}
            />
          )}
          ListEmptyComponent={
            emptyMessage ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  pad: { paddingHorizontal: layout.screenPadding },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  headerBlock: {
    paddingBottom: spacing[2],
  },
  locBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.secondary,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  locBannerText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing[2],
  },
  locBannerBtn: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 6,
  },
  locBannerBtnText: {
    ...typography.caption,
    color: colors.accent.amber,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.tertiary,
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    minHeight: 44,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: Platform.OS === "ios" ? spacing[3] : spacing[2],
  },
  clearBtn: { padding: spacing[1] },
  clearBtnText: {
    fontSize: 22,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  prompt: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[4],
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text.primary,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  listContent: {
    paddingBottom: spacing[8],
    paddingHorizontal: layout.screenPadding,
  },
  empty: {
    padding: spacing[6],
    alignItems: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { ...typography.body, color: colors.text.secondary },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: colors.bg.secondary,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  skeletonThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.bg.tertiary,
    marginRight: spacing[3],
  },
  skeletonBody: { flex: 1, gap: spacing[2] },
  skeletonLineLg: {
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.bg.tertiary,
    width: "70%",
  },
  skeletonLineSm: {
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.bg.tertiary,
    width: "50%",
  },
});
