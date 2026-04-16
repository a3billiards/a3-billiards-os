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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";
import { MaterialIcons } from "@expo/vector-icons";

const { width: SCREEN_W } = Dimensions.get("window");
const GALLERY_H = 200;

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_LABEL: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

function currencySymbol(code: string): string {
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return `${code} `;
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatSpecialWindow(start: string, end: string): string {
  return `${to12h(start)} – ${to12h(end)}`;
}

function daysAbbrev(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABEL[d])
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
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const profile = useQuery(
    api.clubDiscovery.getClubProfile,
    clubId ? { clubId: clubId as any } : "skip",
  );
  const user = useQuery(api.users.getCurrentUser);
  const visits = useQuery(
    api.clubDiscovery.getCustomerVisitCountAtClub,
    user?.role === "customer" && clubId
      ? { clubId: clubId as any }
      : "skip",
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
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Unavailable onDiscover={() => router.replace("/discover")} />
      </SafeAreaView>
    );
  }

  if (profile === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (profile === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Unavailable onDiscover={() => router.replace("/discover")} />
      </SafeAreaView>
    );
  }

  const oh = profile.operatingHours;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>{"<"} Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
          {profile.description ? (
            <Text style={styles.desc}>{profile.description}</Text>
          ) : null}

          <Text style={styles.sectionTitle}>Opening Hours</Text>
          {!oh ? (
            <Text style={styles.muted}>Hours not available</Text>
          ) : (
            DAY_ORDER.map((d) => {
              const open = oh.daysOfWeek.includes(d);
              return (
                <View key={d} style={styles.hoursRow}>
                  <Text style={styles.dayLabel}>{DAY_LABEL[d]}</Text>
                  {open ? (
                    <Text style={styles.hoursOpen}>
                      {to12h(oh.open)} – {to12h(oh.close)}
                    </Text>
                  ) : (
                    <Text style={styles.closed}>Closed</Text>
                  )}
                </View>
              );
            })
          )}

          {profile.amenities.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenityWrap}>
                {profile.amenities.map((a) => (
                  <View key={a} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>
                      {AMENITY_ICON[a] ? `${AMENITY_ICON[a]} ` : ""}
                      {a}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Tables</Text>
          {profile.tableTypes.length === 0 ? (
            <Text style={styles.muted}>No tables listed</Text>
          ) : (
            profile.tableTypes.map((row) => (
              <Text key={row.type} style={styles.tableRow}>
                {row.type} <Text style={styles.tableDot}>•</Text>{" "}
                {row.count} {row.count === 1 ? "table" : "tables"}
              </Text>
            ))
          )}

          <Text style={styles.sectionTitle}>Pricing</Text>
          <Text style={styles.rateLine}>
            {currencySymbol(profile.currency)}
            {profile.baseRatePerMin.toFixed(2)}/min
          </Text>
          {profile.specialRates.map((r) => (
            <View key={r.id} style={styles.specialBlock}>
              <Text style={styles.specialLabel}>{r.label}</Text>
              <Text style={styles.specialRate}>
                {currencySymbol(profile.currency)}
                {r.ratePerMin.toFixed(2)}/min
              </Text>
              <Text style={styles.specialMeta}>{formatSpecialWindow(r.startTime, r.endTime)}</Text>
              <Text style={styles.specialMeta}>{daysAbbrev(r.daysOfWeek)}</Text>
            </View>
          ))}

          {user?.role === "customer" && visits && visits.count > 0 ? (
            <View style={styles.visitBox}>
              <Text style={styles.visitText}>
                {"You've played here "}
                {visits.count}{" "}
                {visits.count === 1 ? "time" : "times"}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/history",
                    params: { clubId: profile.clubId },
                  } as any)
                }
              >
                <Text style={styles.visitLink}>View History</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ height: layout.buttonHeight + spacing[8] }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {profile.bookingEnabled ? (
          <Pressable
            style={styles.primaryCta}
            onPress={() => router.push(`/book/${profile.clubId}` as any)}
          >
            <Text style={styles.primaryCtaText}>Book a Table</Text>
          </Pressable>
        ) : (
          <View style={styles.disabledCta}>
            <Text style={styles.disabledCtaText}>Online Booking Unavailable</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Unavailable({ onDiscover }: { onDiscover: () => void }): React.JSX.Element {
  return (
    <View style={styles.center}>
      <Text style={styles.unavailableTitle}>This club is no longer available.</Text>
      <Pressable style={styles.primaryCta} onPress={onDiscover}>
        <Text style={styles.primaryCtaText}>Discover Clubs</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6] },
  topNav: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing[2],
  },
  backBtn: { alignSelf: "flex-start" },
  backBtnText: { ...typography.body, color: colors.accent.green },
  scroll: { paddingBottom: spacing[4] },
  galleryPlaceholder: {
    height: GALLERY_H,
    backgroundColor: colors.bg.secondary,
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
    backgroundColor: colors.bg.tertiary,
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
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  specialLabel: { ...typography.label, color: colors.text.primary },
  specialRate: { ...typography.body, color: colors.accent.green, marginTop: spacing[1] },
  specialMeta: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  visitBox: {
    marginTop: spacing[6],
    padding: spacing[4],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  visitText: { ...typography.body, color: colors.text.primary },
  visitLink: {
    ...typography.label,
    color: colors.accent.green,
    marginTop: spacing[2],
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.bg.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
  primaryCta: {
    backgroundColor: colors.accent.green,
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: { ...typography.buttonLarge, color: "#0D1117" },
  disabledCta: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.tertiary,
  },
  disabledCtaText: { ...typography.button, color: colors.text.secondary },
  unavailableTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing[4],
  },
});
