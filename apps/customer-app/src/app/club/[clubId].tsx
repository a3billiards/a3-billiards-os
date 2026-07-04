import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { GlassPageBackground } from "@a3/ui/components";
import { usePullToRefresh } from "@a3/ui/hooks";
import { colors, typography, spacing, layout, radius, glass } from "@a3/ui/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { canNavigateToClub, openClubNavigation } from "../../lib/openClubNavigation";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import {
  formatHhmm12h,
  localizedAmenityLabel,
  localizedTableTypeLabel,
} from "@a3/utils/clubDisplay";

const { width: SCREEN_W } = Dimensions.get("window");
const GALLERY_H = 200;

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_KEYS = [
  "customerApp.clubProfile.daySun",
  "customerApp.clubProfile.dayMon",
  "customerApp.clubProfile.dayTue",
  "customerApp.clubProfile.dayWed",
  "customerApp.clubProfile.dayThu",
  "customerApp.clubProfile.dayFri",
  "customerApp.clubProfile.daySat",
] as const;

function dayLabel(d: number, t: (key: string) => string): string {
  return t(DAY_KEYS[d]);
}

function currencySymbol(code: string): string {
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return `${code} `;
}

function formatSpecialWindow(start: string, end: string, locale: string): string {
  return `${formatHhmm12h(start, locale)} – ${formatHhmm12h(end, locale)}`;
}

function daysAbbrev(days: number[], t: (key: string) => string): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => dayLabel(d, t))
    .join(", ");
}

const AMENITY_ICON: Record<string, string> = {
  AC: "❄",
  Parking: "🅿",
  Cafe: "☕",
  WiFi: "📶",
  Lounge: "🛋",
  Restrooms: "🚻",
};

export default function PublicClubProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const locale = getCurrentLanguage();
  const { refreshing, onRefresh } = usePullToRefresh();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const profile = useQuery(
    api.clubDiscovery.getClubProfile,
    clubId ? { clubId: clubId as any } : "skip",
  );
  const user = useQuery(api.users.getCurrentUser);
  const visits = useQuery(
    api.clubDiscovery.getCustomerVisitCountAtClub,
    user?.role === "customer" && clubId ? { clubId: clubId as Id<"clubs"> } : "skip",
  );

  const [galleryIndex, setGalleryIndex] = useState(0);

  const onGalleryScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / SCREEN_W);
      setGalleryIndex(i);
    },
    [],
  );

  const photoData: (string | null)[] = useMemo(() => {
    if (!profile?.photoUrls?.length) return [null];
    return profile.photoUrls;
  }, [profile]);

  if (!clubId) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Unavailable onDiscover={() => router.replace("/discover")} />
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (profile === undefined) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={glass.ctaBg} />
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (profile === null) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Unavailable onDiscover={() => router.replace("/discover")} />
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  const oh = profile.operatingHours;
  const navigationTarget = {
    lat: profile.location?.lat,
    lng: profile.location?.lng,
    address: profile.address,
    label: profile.name,
  };
  const showNavigate = canNavigateToClub(navigationTarget);

  const handleNavigate = () => {
    void openClubNavigation(navigationTarget).then((opened) => {
      if (!opened) {
        Alert.alert(
          t("customerApp.clubProfile.couldNotOpenMaps"),
          t("customerApp.clubProfile.mapsErrorBody"),
        );
      }
    });
  };

  return (
    <GlassPageBackground>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>{t("customerApp.clubProfile.back")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <FlatList
          data={photoData}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `p-${i}`}
          onMomentumScrollEnd={onGalleryScroll}
          getItemLayout={(_, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          renderItem={({ item }) =>
            item ? (
              <Image
                source={{ uri: item }}
                style={{ width: SCREEN_W, height: GALLERY_H }}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.galleryPlaceholder, { width: SCREEN_W }]}>
                <Text style={styles.galleryPlaceholderIcon}>◎</Text>
              </View>
            )
          }
        />
        {photoData.length > 1 ? (
          <View style={styles.dots}>
            {photoData.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === galleryIndex ? styles.dotActive : null]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.pad}>
          <Text style={styles.clubName}>{profile.name}</Text>
          <View style={styles.addrRow}>
            <MaterialIcons name="place" size={18} color={colors.text.secondary} />
            <Text style={styles.address}>{profile.address}</Text>
          </View>
          {showNavigate ? (
            <Pressable style={styles.navigateBtn} onPress={handleNavigate}>
              <MaterialIcons name="directions" size={20} color={glass.ctaBg} />
              <Text style={styles.navigateBtnText}>{t("customerApp.clubProfile.getDirections")}</Text>
            </Pressable>
          ) : null}
          {profile.description ? (
            <Text style={styles.desc}>{profile.description}</Text>
          ) : null}

          <Text style={styles.sectionTitle}>{t("customerApp.clubProfile.openingHours")}</Text>
          {!oh ? (
            <Text style={styles.muted}>{t("customerApp.clubProfile.hoursNotAvailable")}</Text>
          ) : (
            DAY_ORDER.map((d) => {
              const open = oh.daysOfWeek.includes(d);
              return (
                <View key={d} style={styles.hoursRow}>
                  <Text style={styles.dayLabel}>{dayLabel(d, t)}</Text>
                  {open ? (
                    <Text style={styles.hoursOpen}>
                      {formatHhmm12h(oh.open, locale)} – {formatHhmm12h(oh.close, locale)}
                    </Text>
                  ) : (
                    <Text style={styles.closed}>{t("customerApp.clubProfile.closed")}</Text>
                  )}
                </View>
              );
            })
          )}

          {profile.amenities.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t("customerApp.clubProfile.amenities")}</Text>
              <View style={styles.amenityWrap}>
                {profile.amenities.map((a) => (
                  <View key={a} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>
                      {AMENITY_ICON[a] ? `${AMENITY_ICON[a]} ` : ""}
                      {localizedAmenityLabel(a, t)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>{t("customerApp.clubProfile.tables")}</Text>
          {profile.tableTypes.length === 0 ? (
            <Text style={styles.muted}>{t("customerApp.clubProfile.noTablesListed")}</Text>
          ) : (
            profile.tableTypes.map((row) => (
              <Text key={row.type} style={styles.tableRow}>
                {localizedTableTypeLabel(row.type, t)} <Text style={styles.tableDot}>•</Text>{" "}
                {row.count}{" "}
                {row.count === 1
                  ? t("customerApp.clubProfile.tableSingular")
                  : t("customerApp.clubProfile.tablePlural")}
              </Text>
            ))
          )}

          <Text style={styles.sectionTitle}>{t("customerApp.clubProfile.pricing")}</Text>
          <Text style={styles.rateLine}>
            {currencySymbol(profile.currency)}
            {profile.baseRatePerMin.toFixed(2)}{t("customerApp.clubProfile.perMin")}
          </Text>
          {profile.specialRates.map((r) => (
            <View key={r.id} style={styles.specialBlock}>
              <Text style={styles.specialLabel}>{r.label}</Text>
              <Text style={styles.specialRate}>
                {currencySymbol(profile.currency)}
                {r.ratePerMin.toFixed(2)}{t("customerApp.clubProfile.perMin")}
              </Text>
              <Text style={styles.specialMeta}>
                {formatSpecialWindow(r.startTime, r.endTime, locale)}
              </Text>
              <Text style={styles.specialMeta}>{daysAbbrev(r.daysOfWeek, t)}</Text>
            </View>
          ))}

          {user?.role === "customer" && visits && visits.count > 0 ? (
            <View style={styles.visitBox}>
              <Text style={styles.visitText}>
                {t("customerApp.clubProfile.playedHere")}{" "}
                {visits.count}{" "}
                {visits.count === 1
                  ? t("customerApp.clubProfile.timeSingular")
                  : t("customerApp.clubProfile.timePlural")}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/history",
                    params: { clubId: profile.clubId },
                  } as any)
                }
              >
                <Text style={styles.visitLink}>{t("customerApp.clubProfile.viewHistory")}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ height: layout.buttonHeight + spacing[8] + insets.bottom }} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {profile.bookingEnabled ? (
          <Pressable
            style={styles.primaryCta}
            onPress={() => router.push(`/book/${profile.clubId}` as any)}
          >
            <Text style={styles.primaryCtaText}>{t("customerApp.clubProfile.bookTable")}</Text>
          </Pressable>
        ) : (
          <View style={styles.disabledCta}>
            <Text style={styles.disabledCtaText}>
              {t("customerApp.clubProfile.bookingUnavailable")}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
    </GlassPageBackground>
  );
}

function Unavailable({ onDiscover }: { onDiscover: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.unavailableTitle}>{t("customerApp.clubProfile.unavailableTitle")}</Text>
      <Pressable style={styles.primaryCta} onPress={onDiscover}>
        <Text style={styles.primaryCtaText}>{t("customerApp.clubProfile.discoverClubs")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6] },
  topNav: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing[2],
  },
  backBtn: { alignSelf: "flex-start" },
  backBtnText: { ...typography.body, color: glass.ctaBg },
  scroll: { paddingBottom: spacing[4] },
  galleryPlaceholder: {
    height: GALLERY_H,
    backgroundColor: glass.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: glass.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryPlaceholderIcon: { fontSize: 48, color: colors.text.secondary },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.disabled,
  },
  dotActive: { backgroundColor: colors.text.primary },
  pad: { paddingHorizontal: layout.screenPadding, paddingTop: spacing[4] },
  clubName: { ...typography.heading2, color: colors.text.primary },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[1], marginTop: spacing[2] },
  address: { ...typography.body, color: colors.text.secondary, flex: 1 },
  navigateBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing[2],
    marginTop: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: glass.ctaBg,
    backgroundColor: "rgba(245, 166, 35, 0.08)",
  },
  navigateBtnText: { ...typography.label, color: glass.ctaBg },
  desc: { ...typography.body, color: colors.text.primary, marginTop: spacing[4] },
  sectionTitle: {
    ...typography.sectionHeader,
    color: colors.text.secondary,
    marginTop: spacing[6],
    marginBottom: spacing[2],
  },
  muted: { ...typography.body, color: colors.text.secondary },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  dayLabel: { ...typography.body, color: colors.text.primary, width: 48 },
  hoursOpen: { ...typography.body, color: colors.text.primary },
  closed: { ...typography.body, color: colors.text.secondary },
  amenityWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  amenityChip: {
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  amenityText: { ...typography.caption, color: colors.text.primary, fontSize: 13 },
  tableRow: { ...typography.body, color: colors.text.primary, marginBottom: spacing[2] },
  tableDot: { color: colors.text.secondary },
  rateLine: { ...typography.bodyLarge, color: colors.text.primary, fontWeight: "600" },
  specialBlock: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
  },
  specialLabel: { ...typography.label, color: colors.text.primary },
  specialRate: { ...typography.body, color: colors.accent.green, marginTop: spacing[1] },
  specialMeta: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  loyaltyCard: {
    marginTop: spacing[5],
    padding: spacing[4],
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
    gap: spacing[2],
  },
  loyaltyScope: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing[2] },
  loyaltyProgramme: { ...typography.label, color: colors.text.primary },
  loyaltyCredits: { ...typography.bodyLarge, color: colors.accent.green, fontWeight: "600" },
  loyaltyProgress: { ...typography.bodySmall, color: colors.text.secondary },
  loyaltyMeta: { ...typography.caption, color: colors.text.tertiary },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: glass.inputBg,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent.green,
    borderRadius: radius.full,
  },
  visitBox: {
    marginTop: spacing[6],
    padding: spacing[4],
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
  },
  visitText: { ...typography.body, color: colors.text.primary },
  visitLink: {
    ...typography.label,
    color: glass.ctaBg,
    marginTop: spacing[2],
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[3],
    backgroundColor: glass.tabPillBg,
    borderTopWidth: 1,
    borderTopColor: glass.tabPillBorder,
  },
  primaryCta: {
    backgroundColor: glass.ctaBg,
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: { ...typography.buttonLarge, color: glass.ctaText },
  disabledCta: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
  },
  disabledCtaText: { ...typography.button, color: colors.text.secondary },
  unavailableTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing[4],
  },
});
