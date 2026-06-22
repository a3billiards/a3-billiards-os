import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import {
  ClubCard,
  type ClubSearchResult,
  GlassPageBackground,
  keyboardScrollDefaults,
} from "@a3/ui/components";
import { colors, spacing, typography, layout, glass } from "@a3/ui/theme";
import { customerTabBarTotalInset } from "../theme/customerShell";
import {
  getCurrentCoords,
  readForegroundLocationPermission,
  requestForegroundLocationPermission,
  type LocationPermission,
} from "../lib/locationAccess";

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

function SkeletonList(): React.JSX.Element {
  return (
    <View style={styles.skeletonWrap}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

export default function DiscoverScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = customerTabBarTotalInset(insets.bottom);
  const user = useQuery(api.users.getCurrentUser);
  const [draft, setDraft] = useState("");
  const [debounced, setDebounced] = useState("");
  const [perm, setPerm] = useState<LocationPermission>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const status = await readForegroundLocationPermission();
        if (cancelled) return;
        setPerm(status);
        if (status === "granted") {
          const pos = await getCurrentCoords();
          if (!cancelled) {
            setCoords(pos);
            setCoordsError(
              pos ? null : "Could not read GPS. Turn on device location and try again.",
            );
          }
        } else {
          setCoords(null);
          setCoordsError(null);
          setNearbyOnly(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const requestLocation = async () => {
    const status = await requestForegroundLocationPermission();
    setPerm(status);
    if (status === "granted") {
      const pos = await getCurrentCoords();
      setCoords(pos);
      if (pos) {
        setCoordsError(null);
        setNearbyOnly(true);
      } else {
        setCoordsError("Could not read GPS. Turn on device location and try again.");
        setNearbyOnly(false);
      }
    } else {
      setCoords(null);
      setCoordsError(null);
      setNearbyOnly(false);
    }
  };

  const isCustomer = user?.role === "customer";
  const hasGps = perm === "granted" && coords !== null;
  const isSearching = debounced.length > 0;

  const queryArgs = useMemo(() => {
    if (!isCustomer) return "skip" as const;
    return {
      searchText: isSearching ? debounced : undefined,
      userLat: hasGps ? coords!.lat : undefined,
      userLng: hasGps ? coords!.lng : undefined,
      radiusKm: 50,
      nearbyOnly: nearbyOnly && hasGps && !isSearching,
      limit: 50,
    };
  }, [isCustomer, isSearching, debounced, hasGps, coords, nearbyOnly]);

  const results = useQuery(api.clubDiscovery.searchClubs, queryArgs);

  const list = (results ?? []) as ClubSearchResult[];
  const queryLoading = isCustomer && results === undefined;

  const emptyMessage = (() => {
    if (queryLoading) return null;
    if (list.length > 0) return null;
    if (perm === "granted" && !hasGps) {
      return coordsError ?? "Waiting for your location…";
    }
    if (nearbyOnly && hasGps) {
      return "No discoverable clubs within 50 km. Try “Show all clubs”, or ask the club owner to set their map pin in Owner app → Settings → Club Profile.";
    }
    if (isSearching) {
      return `No discoverable clubs match "${debounced}". Check the spelling or ask the club owner to enable discovery in the owner app.`;
    }
    return "No clubs are discoverable yet. Club owners must turn on “Discoverable” in Owner app → Settings.";
  })();

  const sectionTitle = (() => {
    if (isSearching || queryLoading || list.length === 0) return null;
    if (nearbyOnly && hasGps) return "Clubs near you (within 50 km)";
    if (hasGps) return "Discoverable clubs (nearest first)";
    return "Clubs on A3 Billiards OS";
  })();

  if (user === undefined) {
    return (
      <GlassPageBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={glass.ctaBg} />
          </View>
        </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (!isCustomer) {
    return (
      <GlassPageBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.center}>
            <Text style={styles.muted}>Sign in as a customer to discover clubs.</Text>
          </View>
        </SafeAreaView>
      </GlassPageBackground>
    );
  }

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Discover</Text>

        {/* Fixed header — TextInput must stay mounted (not inside FlatList header). */}
        <View style={styles.fixedHeader}>
          {perm !== "granted" ? (
            <View style={styles.locBanner}>
              <Text style={styles.locBannerText}>
                Turn on location to find billiards clubs near you (within 50 km)
              </Text>
              <Pressable style={styles.locBannerBtn} onPress={requestLocation}>
                <Text style={styles.locBannerBtnText}>Turn On</Text>
              </Pressable>
            </View>
          ) : coordsError ? (
            <View style={styles.locBanner}>
              <Text style={styles.locBannerText}>{coordsError}</Text>
              <Pressable style={styles.locBannerBtn} onPress={requestLocation}>
                <Text style={styles.locBannerBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {hasGps && !isSearching ? (
            <Pressable
              style={[styles.nearbyChip, nearbyOnly && styles.nearbyChipOn]}
              onPress={() => setNearbyOnly((v) => !v)}
            >
              <Text
                style={[styles.nearbyChipText, nearbyOnly && styles.nearbyChipTextOn]}
              >
                {nearbyOnly ? "Near me only (50 km)" : "Show all clubs"}
              </Text>
            </Pressable>
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

          {!isSearching && !queryLoading && list.length > 0 && sectionTitle ? (
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          ) : null}
        </View>

        <FlatList
          data={queryLoading ? [] : list}
          keyExtractor={(item) => item.clubId}
          style={styles.flex}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPad },
            (queryLoading || list.length === 0) && styles.listContentGrow,
          ]}
          {...keyboardScrollDefaults}
          renderItem={({ item }) => (
            <ClubCard
              club={item}
              onPress={() => router.push(`/club/${item.clubId}` as `/club/${string}`)}
            />
          )}
          ListEmptyComponent={
            queryLoading ? (
              <SkeletonList />
            ) : emptyMessage ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: { flex: 1 },
  title: {
    ...typography.heading3,
    color: glass.textPrimary,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  fixedHeader: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[2],
  },
  locBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
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
  nearbyChip: {
    alignSelf: "flex-start",
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: glass.cardBg,
  },
  nearbyChipOn: {
    borderColor: colors.accent.green,
    backgroundColor: colors.accent.green + "22",
  },
  nearbyChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  nearbyChipTextOn: {
    color: colors.accent.green,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    borderRadius: 12,
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
  sectionTitle: {
    ...typography.label,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  listContent: {
    paddingHorizontal: layout.screenPadding,
  },
  listContentGrow: {
    flexGrow: 1,
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
  skeletonWrap: {
    paddingTop: spacing[2],
  },
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
