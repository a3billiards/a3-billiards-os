import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  formatHhmm12h,
  STALE_SLOT_WARNING_MS,
} from "@a3/utils/availability";
import { hhmmToMinutes } from "@a3/utils/timezone";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

export interface TimeSlotGridProps {
  /** `undefined` while loading; empty array when none available. */
  availableSlots: string[] | undefined;
  requestedDurationMin: number;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  bookableOpen: string;
  bookableClose: string;
}

export function TimeSlotGrid({
  availableSlots,
  requestedDurationMin,
  selectedTime,
  onSelectTime,
  bookableOpen,
  bookableClose,
}: TimeSlotGridProps): React.JSX.Element {
  const [staleBanner, setStaleBanner] = useState(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    warnedRef.current = false;
    setStaleBanner(false);
    const t = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true;
        setStaleBanner(true);
      }
    }, STALE_SLOT_WARNING_MS);
    return () => clearTimeout(t);
  }, [availableSlots, requestedDurationMin, bookableOpen, bookableClose]);

  const openMin = hhmmToMinutes(bookableOpen);
  const closeMin = hhmmToMinutes(bookableClose);
  const allSlots: string[] = [];
  for (let m = openMin; m < closeMin; m += 30) {
    const end = m + requestedDurationMin;
    if (end > closeMin) break;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    allSlots.push(`${hh}:${mm}`);
  }

  const availableSet = new Set(availableSlots ?? []);

  const handleSelect = (slot: string) => {
    setStaleBanner(false);
    onSelectTime(slot);
  };

  if (availableSlots === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent.green} />
        <Text style={styles.loadingText}>Loading slots…</Text>
      </View>
    );
  }

  if (allSlots.length === 0) {
    return (
      <Text style={styles.empty}>
        No time slots for this date and duration.
      </Text>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <Text style={styles.empty}>
        No available slots for this date and duration. Try a different date or
        duration.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {staleBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Availability updates in real time — re-check your selection before
            submitting.
          </Text>
        </View>
      ) : null}
      <Text style={styles.title}>Pick a start time</Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridScroll}
      >
        <View style={styles.grid}>
          {allSlots.map((slot) => {
            const isAvailable = availableSet.has(slot);
            const selected = selectedTime === slot;
            return (
              <Pressable
                key={slot}
                disabled={!isAvailable}
                onPress={() => handleSelect(slot)}
                style={({ pressed }) => [
                  styles.slot,
                  !isAvailable && styles.slotDisabled,
                  selected && styles.slotSelected,
                  pressed && isAvailable && styles.slotPressed,
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    !isAvailable && styles.slotTextDisabled,
                    selected && styles.slotTextSelected,
                  ]}
                >
                  {formatHhmm12h(slot)}
                </Text>
                {!isAvailable ? (
                  <Text style={styles.bookedHint}>Unavailable</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", flex: 1 },
  loading: {
    padding: spacing[8],
    alignItems: "center",
    gap: spacing[2],
  },
  loadingText: { ...typography.body, color: colors.text.secondary },
  empty: { ...typography.body, color: colors.text.secondary },
  banner: {
    backgroundColor: "rgba(245, 127, 23, 0.15)",
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.accent.amber,
  },
  bannerText: {
    ...typography.bodySmall,
    color: colors.accent.amberLight,
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  gridScroll: { paddingBottom: spacing[8] },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  slot: {
    width: "31%",
    minWidth: 100,
    minHeight: layout.timeSlotItemHeight,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
  },
  slotDisabled: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
  },
  slotSelected: {
    borderColor: colors.accent.green,
    borderWidth: 2,
    backgroundColor: "rgba(67, 160, 71, 0.12)",
  },
  slotPressed: { opacity: 0.9 },
  slotText: { ...typography.label, color: colors.text.primary },
  slotTextDisabled: { color: colors.status.disabled },
  slotTextSelected: { color: colors.accent.green },
  bookedHint: {
    ...typography.caption,
    color: colors.status.disabled,
    marginTop: spacing[1],
  },
});

export default TimeSlotGrid;
