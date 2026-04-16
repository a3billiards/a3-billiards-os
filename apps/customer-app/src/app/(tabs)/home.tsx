import { View, Text, StyleSheet, Pressable } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { useRouter } from "expo-router";

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dt);
}

function countdownLabel(startMs: number): string {
  const diff = Math.max(0, startMs - Date.now());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `In ${Math.max(1, minutes)} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `In ${hours} hours`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(startMs);
  if (
    start.getFullYear() === tomorrow.getFullYear() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getDate() === tomorrow.getDate()
  ) {
    return "Tomorrow";
  }
  return `In ${Math.ceil(hours / 24)} days`;
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const next = useQuery(
    api.bookings.getNextConfirmedBooking,
    user?._id ? { customerId: user._id } : "skip",
  );

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {user?.name ? `Welcome, ${user.name}` : "Welcome"}
      </Text>
      <Text style={styles.subtitle}>
        Find a table, book a slot, or check your sessions
      </Text>
      {next ? (
        <Pressable
          style={styles.nextCard}
          onPress={() => router.push(`/booking/${next.log.bookingId}`)}
        >
          <View style={styles.nextAccent} />
          <View style={styles.nextBody}>
            <Text style={styles.nextTitle}>Next Booking</Text>
            <Text style={styles.nextClub} numberOfLines={1}>
              {next.log.clubName}
            </Text>
            <Text style={styles.nextMeta}>
              {formatShortDate(next.log.requestedDate)} • {to12h(next.log.requestedStartTime)}
            </Text>
            <Text style={styles.nextCountdown}>{countdownLabel(next.startMs)}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  greeting: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  nextCard: {
    marginTop: spacing[6],
    width: "100%",
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    flexDirection: "row",
    overflow: "hidden",
  },
  nextAccent: {
    width: 4,
    backgroundColor: colors.accent.green,
  },
  nextBody: {
    flex: 1,
    padding: spacing[4],
    gap: spacing[1],
  },
  nextTitle: { ...typography.caption, color: colors.text.secondary },
  nextClub: { ...typography.heading4, color: colors.text.primary },
  nextMeta: { ...typography.bodySmall, color: colors.text.secondary },
  nextCountdown: { ...typography.labelSmall, color: colors.accent.green },
});
