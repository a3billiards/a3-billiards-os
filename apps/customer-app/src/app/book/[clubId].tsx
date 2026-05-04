import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import {
  DateStrip,
  TableTypePicker,
  TimeSlotGrid,
} from "@a3/ui/components";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import {
  resolveBookingRatePerMin,
} from "@a3/utils/bookingRate";
import {
  timeZoneAbbreviation,
  zonedWallTimeToUtcMs,
} from "@a3/utils/timezone";
import { formatHhmm12h } from "@a3/utils/availability";

const STEPS = ["Type", "Date", "Time", "Review"] as const;

const DURATION_LABELS: Record<number, { chip: string; summary: string; sub?: string }> = {
  30: { chip: "30m", summary: "30 minutes", sub: "Quick game" },
  60: { chip: "1h", summary: "1 hour", sub: "Standard session" },
  90: { chip: "1.5h", summary: "1.5 hours", sub: "Extended play" },
  120: { chip: "2h", summary: "2 hours", sub: "Tournament practice" },
  180: { chip: "3h", summary: "3 hours", sub: "Long session" },
};

function bookingErrorMessage(err: unknown, minAdvanceMinutes: number): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("BOOKING_001")) {
    return "You already have 2 active bookings at this club.";
  }
  if (raw.includes("BOOKING_002")) {
    return "You already have active bookings at 2 clubs. Please complete or cancel existing bookings before booking at a new club.";
  }
  if (raw.includes("BOOKING_003")) {
    return "This slot is no longer available. Please select a different time.";
  }
  if (raw.includes("BOOKING_004")) {
    return "This club is not accepting online bookings at the moment.";
  }
  if (raw.includes("BOOKING_008")) {
    return "The selected time is outside the club's bookable hours or date range.";
  }
  if (raw.includes("BOOKING_009")) {
    return "This table type is not available for online booking.";
  }
  if (raw.includes("BOOKING_010")) {
    return `Please book at least ${minAdvanceMinutes} minutes in advance.`;
  }
  if (raw.includes("AUTH_002")) {
    return "Your account is currently suspended.";
  }
  if (raw.includes("AUTH_004")) {
    return "Please verify your phone number before booking.";
  }
  if (raw.includes("AUTH_006")) {
    return "Your account is pending deletion.";
  }
  if (raw.includes("SUBSCRIPTION_003")) {
    return "This club is not accepting online bookings at the moment.";
  }
  return raw.replace(/^[A-Z_]+_\d+:\s*/, "") || "Something went wrong. Please try again.";
}

function formatMoney(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function BookClubScreen() {
  const router = useRouter();
  const { clubId: clubIdParam } = useLocalSearchParams<{ clubId: string }>();
  const clubId = (clubIdParam ?? "") as Id<"clubs">;

  const ctx = useQuery(
    api.bookings.getClubBookingFlowContext,
    clubIdParam ? { clubId } : "skip",
  );
  const submit = useMutation(api.bookings.submitBooking);

  const [step, setStep] = useState(0);
  const [tableType, setTableType] = useState<string | null>(null);
  const [dateYmd, setDateYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const slotDurationOptions = ctx?.bookingSettings.slotDurationOptions;
  const slotOptions = useMemo(
    () => slotDurationOptions ?? [30, 60, 90, 120],
    [slotDurationOptions],
  );
  const defaultDuration = slotOptions[0] ?? 30;

  useEffect(() => {
    if (durationMin === null && slotOptions.length > 0) {
      setDurationMin(slotOptions[0]!);
    }
  }, [durationMin, slotOptions]);

  const durationForSlots = durationMin ?? defaultDuration;

  const availableSlots = useQuery(
    api.bookings.getAvailableSlots,
    clubIdParam && tableType && dateYmd
      ? {
          clubId,
          tableType,
          requestedDate: dateYmd,
          requestedDurationMin: durationForSlots,
        }
      : "skip",
  );

  useEffect(() => {
    if (step !== 3 || !selectedTime || availableSlots === undefined) return;
    if (!availableSlots.includes(selectedTime)) {
      setSelectedTime(null);
      setStep(2);
      Alert.alert(
        "Time unavailable",
        "Your selected time is no longer available for this duration. Please pick a new time.",
      );
    }
  }, [availableSlots, durationForSlots, selectedTime, step]);

  const tzLabel = useMemo(
    () => (ctx ? timeZoneAbbreviation(ctx.timezone) : ""),
    [ctx],
  );

  const rateForPreview = useMemo(() => {
    if (!ctx || !dateYmd || !selectedTime) return ctx?.baseRatePerMin ?? 0;
    return resolveBookingRatePerMin(
      ctx.baseRatePerMin,
      ctx.specialRates,
      ctx.timezone,
      dateYmd,
      selectedTime,
    );
  }, [ctx, dateYmd, selectedTime]);

  const estimatedPreview =
    ctx && durationMin !== null
      ? Math.max(durationMin, ctx.minBillMinutes) * rateForPreview
      : 0;

  const summaryDateLabel = useMemo(() => {
    if (!ctx || !dateYmd) return "";
    const ms = zonedWallTimeToUtcMs(dateYmd, "12:00", ctx.timezone);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: ctx.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(ms));
  }, [ctx, dateYmd]);

  const handleBack = () => {
    if (step > 0) setStep((s: number) => s - 1);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const goStep = (i: number) => {
    if (i < step) setStep(i);
  };

  const onConfirm = async () => {
    if (!ctx || !tableType || !dateYmd || !selectedTime || durationMin === null) {
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        clubId,
        tableType,
        requestedDate: dateYmd,
        requestedStartTime: selectedTime,
        requestedDurationMin: durationMin,
        notes: notes.trim() || undefined,
      });
      router.replace("/(tabs)/bookings");
      setTimeout(() => {
        Alert.alert(
          "Booking request sent!",
          "You'll be notified once the club responds.",
        );
      }, 0);
    } catch (e) {
      Alert.alert(
        "Booking failed",
        bookingErrorMessage(e, ctx.bookingSettings.minAdvanceMinutes),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!clubIdParam) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing club.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (ctx === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.green} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!ctx.bookingSettings.enabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.disabledWrap}>
          <Pressable style={styles.iconBtn} onPress={handleClose}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.disabledTitle}>
            Online booking is not available at this club.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const bh = ctx.bookingSettings.bookableHours;
  const bookableTypes: string[] = ctx.bookingSettings.bookableTableTypes.map(
    (t: string) => t.trim().toLowerCase(),
  );

  if (bookableTypes.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={handleClose}>
            <MaterialIcons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
        <View style={styles.disabledWrap}>
          <Text style={styles.disabledTitle}>
            Online booking is not available at this club.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ctx.name}
        </Text>
        <Pressable style={styles.iconBtn} onPress={handleClose}>
          <MaterialIcons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <View style={styles.stepper}>
        <View style={styles.dotsRow}>
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 ? (
                <View
                  style={[
                    styles.stepLine,
                    i <= step && styles.stepLineActive,
                  ]}
                />
              ) : null}
              <Pressable onPress={() => goStep(i)} disabled={i > step}>
                <View
                  style={[
                    styles.dot,
                    i === step && styles.dotActive,
                    i < step && styles.dotDone,
                  ]}
                />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
        <View style={styles.labelsRow}>
          {STEPS.map((label, i) => (
            <View key={label} style={styles.stepLabelCell}>
              <Text
                style={[
                  styles.stepLabel,
                  i === step && styles.stepLabelActive,
                  i > step && styles.stepLabelMuted,
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && (
          <TableTypePicker
            bookableTypes={bookableTypes}
            activeCountByType={ctx.activeTableCountByType}
            currencyCode={ctx.currency}
            baseRatePerMin={ctx.baseRatePerMin}
            selectedType={tableType}
            onSelectType={(t: string) => {
              setTableType(t);
              setStep(1);
            }}
          />
        )}

        {step === 1 && !bh ? (
          <Text style={styles.errorText}>
            This club has not finished booking setup (hours missing).
          </Text>
        ) : null}
        {step === 1 && bh ? (
          <>
            <DateStrip
              timeZone={ctx.timezone}
              nowMs={Date.now()}
              maxAdvanceDays={ctx.bookingSettings.maxAdvanceDays}
              minAdvanceMinutes={ctx.bookingSettings.minAdvanceMinutes}
              bookableDaysOfWeek={bh.daysOfWeek}
              bookableOpen={bh.open}
              bookableClose={bh.close}
              slotDurationOptions={ctx.bookingSettings.slotDurationOptions}
              selectedYmd={dateYmd}
              onSelectYmd={(d: string) => {
                setDateYmd(d);
                setStep(2);
              }}
            />
            <Text style={styles.tzHint}>Times shown in {tzLabel}</Text>
          </>
        ) : null}

        {step === 2 && bh && tableType && dateYmd ? (
          <>
            <TimeSlotGrid
              availableSlots={availableSlots}
              requestedDurationMin={durationForSlots}
              selectedTime={selectedTime}
              onSelectTime={(t: string) => {
                setSelectedTime(t);
                setStep(3);
              }}
              bookableOpen={bh.open}
              bookableClose={bh.close}
            />
            <Text style={styles.tzHint}>Times shown in {tzLabel}</Text>
          </>
        ) : null}

        {step === 3 && bh && tableType && dateYmd && selectedTime ? (
          <View style={styles.review}>
            <Text style={styles.reviewHeading}>How long do you want to play?</Text>
            <View style={styles.durGrid}>
              {slotOptions.map((d: number) => {
                const meta = DURATION_LABELS[d] ?? {
                  chip: `${d}m`,
                  summary: `${d} minutes`,
                };
                const active = durationMin === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDurationMin(d)}
                    style={[
                      styles.durCard,
                      active && styles.durCardActive,
                    ]}
                  >
                    <Text
                      style={[styles.durChip, active && styles.durChipActive]}
                    >
                      {meta.chip}
                    </Text>
                    {meta.sub ? (
                      <Text style={styles.durSub}>{meta.sub}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {durationMin !== null && durationMin < ctx.minBillMinutes ? (
              <View style={styles.warnCard}>
                <Text style={styles.warnText}>
                  Minimum charge is {ctx.minBillMinutes} minutes. Your booking
                  will be billed at the {ctx.minBillMinutes}-minute rate.
                </Text>
              </View>
            ) : null}

            <Text style={styles.confirmTitle}>Confirm your booking</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryClub}>{ctx.name}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Table Type</Text>
                <Text style={styles.summaryVal}>
                  {capitalizeWords(tableType)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Date</Text>
                <Text style={styles.summaryVal}>{summaryDateLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Time</Text>
                <Text style={styles.summaryVal}>
                  {formatHhmm12h(selectedTime)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Duration</Text>
                <Text style={styles.summaryVal}>
                  {durationMin !== null
                    ? (DURATION_LABELS[durationMin]?.summary ??
                      `${durationMin} minutes`)
                    : "—"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Estimated Cost</Text>
                <Text style={styles.summaryVal}>
                  Est. {formatMoney(ctx.currency, estimatedPreview)} — actual
                  bill may vary
                </Text>
              </View>
            </View>
            <Text style={styles.tzHint}>Times shown in {tzLabel}</Text>

            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add a note for the club"
              placeholderTextColor={colors.text.tertiary}
              value={notes}
              onChangeText={(t: string) => setNotes(t.slice(0, 200))}
              multiline
              maxLength={200}
            />
            <Text style={styles.counter}>{notes.length}/200</Text>

            <Pressable
              style={[
                styles.primaryBtn,
                submitting && styles.primaryBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.primaryBtnText}>Confirm Booking</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const DOT_GAP = 4;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { ...typography.body, color: colors.status.error },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[10],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minHeight: layout.headerHeight,
  },
  headerTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: spacing[2],
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border.default,
  },
  dotActive: {
    backgroundColor: colors.accent.green,
    transform: [{ scale: 1.15 }],
  },
  dotDone: { backgroundColor: colors.accent.green },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border.default,
    marginHorizontal: DOT_GAP,
    maxWidth: 40,
  },
  stepLineActive: { backgroundColor: colors.accent.green },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepLabelCell: { width: "25%" },
  stepLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: "center",
  },
  stepLabelActive: { color: colors.text.primary, fontWeight: "600" },
  stepLabelMuted: { opacity: 0.5 },
  tzHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  disabledWrap: {
    flex: 1,
    padding: spacing[6],
    justifyContent: "center",
  },
  disabledTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    textAlign: "center",
    marginVertical: spacing[6],
  },
  textBtn: { alignSelf: "center", marginTop: spacing[4] },
  textBtnLabel: { ...typography.label, color: colors.accent.green },
  review: { gap: spacing[3] },
  reviewHeading: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  durGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  durCard: {
    width: "47%",
    minHeight: 94,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
  },
  durCardActive: {
    borderColor: colors.accent.green,
    borderWidth: 2,
  },
  durChip: {
    ...typography.heading3,
    color: colors.text.primary,
    textAlign: "center",
  },
  durChipActive: { color: colors.accent.green },
  durSub: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[2],
  },
  warnCard: {
    backgroundColor: "rgba(245, 127, 23, 0.15)",
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.accent.amber,
  },
  warnText: { ...typography.body, color: colors.accent.amberLight },
  confirmTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  summaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryClub: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  summaryKey: { ...typography.body, color: colors.text.secondary },
  summaryVal: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
    textAlign: "right",
  },
  notesLabel: { ...typography.label, color: colors.text.secondary },
  notesInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    minHeight: 80,
    padding: spacing[3],
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  counter: {
    ...typography.caption,
    color: colors.text.tertiary,
    alignSelf: "flex-end",
  },
  primaryBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    minHeight: layout.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[4],
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    ...typography.buttonLarge,
    color: colors.bg.primary,
  },
});
