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
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import {
  DateStrip,
  TableTypePicker,
  TablePicker,
  TimeSlotGrid,
  GlassPageBackground,
} from "@a3/ui/components";
import { colors, typography, spacing, radius, layout, glass } from "@a3/ui/theme";
import {
  resolveBookingRatePerMin,
} from "@a3/utils/bookingRate";
import {
  timeZoneAbbreviation,
  zonedWallTimeToUtcMs,
} from "@a3/utils/timezone";
import { formatHhmm12h } from "@a3/utils/availability";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";

const STEP_KEYS = [
  "customerApp.booking.steps.type",
  "customerApp.booking.steps.table",
  "customerApp.booking.steps.date",
  "customerApp.booking.steps.duration",
  "customerApp.booking.steps.time",
  "customerApp.booking.steps.review",
] as const;

const DURATION_KEY_MAP: Record<number, string> = {
  30: "d30",
  60: "d60",
  90: "d90",
  120: "d120",
  180: "d180",
};

function bookingErrorMessage(
  err: unknown,
  minAdvanceMinutes: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("BOOKING_001")) return t("customerApp.booking.errors.booking001");
  if (raw.includes("BOOKING_002")) return t("customerApp.booking.errors.booking002");
  if (raw.includes("BOOKING_003")) return t("customerApp.booking.errors.booking003");
  if (raw.includes("BOOKING_004")) return t("customerApp.booking.errors.booking004");
  if (raw.includes("BOOKING_008")) return t("customerApp.booking.errors.booking008");
  if (raw.includes("BOOKING_009")) return t("customerApp.booking.errors.booking009");
  if (raw.includes("BOOKING_010")) {
    return t("customerApp.booking.errors.booking010", { minutes: minAdvanceMinutes });
  }
  if (raw.includes("AUTH_002")) return t("customerApp.booking.errors.auth002");
  if (raw.includes("AUTH_004")) return t("customerApp.booking.errors.auth004");
  if (raw.includes("AUTH_006")) return t("customerApp.booking.errors.auth006");
  if (raw.includes("SUBSCRIPTION_003")) return t("customerApp.booking.errors.subscription003");
  if (raw.includes("PAYMENT_004")) return t("customerApp.booking.errors.payment004");
  return raw.replace(/^[A-Z_]+_\d+:\s*/, "") || t("customerApp.booking.errors.generic");
}

function formatMoney(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat(getCurrentLanguage(), {
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

function BookClubScreenContent() {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
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
  const [selectedTableId, setSelectedTableId] = useState<Id<"tables"> | null>(null);
  const [dateYmd, setDateYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
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

  const tablesForType = useMemo(() => {
    if (!ctx || !tableType) return [];
    return ctx.tablesByType[tableType.trim().toLowerCase()] ?? [];
  }, [ctx, tableType]);

  const selectedTableLabel = useMemo(() => {
    if (!selectedTableId) return "";
    return tablesForType.find((t) => t.tableId === selectedTableId)?.label ?? "";
  }, [selectedTableId, tablesForType]);

  const availableSlots = useQuery(
    api.bookings.getAvailableSlots,
    clubIdParam && tableType && selectedTableId && dateYmd
      ? {
          clubId,
          tableType,
          tableId: selectedTableId,
          requestedDate: dateYmd,
          requestedDurationMin: durationForSlots,
        }
      : "skip",
  );

  useEffect(() => {
    if (step !== 5 || !selectedTime || availableSlots === undefined) return;
    if (!availableSlots.includes(selectedTime)) {
      setSelectedTime(null);
      setStep(4);
      Alert.alert(
        t("customerApp.booking.alerts.timeUnavailableTitle"),
        t("customerApp.booking.alerts.timeUnavailableBody"),
      );
    }
  }, [availableSlots, durationForSlots, selectedTime, step, t]);

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
    return new Intl.DateTimeFormat(getCurrentLanguage(), {
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
    if (!ctx || !tableType || !selectedTableId || !dateYmd || !selectedTime || durationMin === null) {
      return;
    }
    if (ctx.bookingSettings.requireBookingCoupon && !couponCode.trim()) {
      Alert.alert(
        t("customerApp.booking.alerts.couponRequiredTitle"),
        t("customerApp.booking.alerts.couponRequiredBody"),
      );
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        clubId,
        tableType,
        requestedTableId: selectedTableId,
        requestedDate: dateYmd,
        requestedStartTime: selectedTime,
        requestedDurationMin: durationMin,
        notes: notes.trim() || undefined,
        couponCode: couponCode.trim() || undefined,
      });
      router.replace("/(tabs)/bookings");
      setTimeout(() => {
        Alert.alert(
          t("customerApp.booking.alerts.requestSentTitle"),
          t("customerApp.booking.alerts.requestSentBody"),
        );
      }, 0);
    } catch (e) {
      Alert.alert(
        t("customerApp.booking.alerts.bookingFailedTitle"),
        bookingErrorMessage(e, ctx.bookingSettings.minAdvanceMinutes, t),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!clubIdParam) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t("customerApp.booking.missingClub")}</Text>
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (ctx === undefined) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={glass.ctaBg} size="large" />
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  if (!ctx.bookingSettings.enabled) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.disabledWrap}>
          <Pressable style={styles.iconBtn} onPress={handleClose}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.disabledTitle}>
            {t("customerApp.booking.onlineBookingUnavailable")}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>{t("customerApp.booking.goBack")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  const bh = ctx.bookingSettings.bookableHours;
  const bookableTypes: string[] = ctx.bookingSettings.bookableTableTypes.map(
    (t: string) => t.trim().toLowerCase(),
  );

  if (bookableTypes.length === 0) {
    return (
      <GlassPageBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={handleClose}>
            <MaterialIcons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
        <View style={styles.disabledWrap}>
          <Text style={styles.disabledTitle}>
            {t("customerApp.booking.onlineBookingUnavailable")}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>{t("customerApp.booking.goBack")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      </GlassPageBackground>
    );
  }

  return (
    <GlassPageBackground>
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
          {STEP_KEYS.map((stepKey, i) => (
            <React.Fragment key={stepKey}>
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
          {STEP_KEYS.map((stepKey, i) => (
            <View key={stepKey} style={styles.stepLabelCell}>
              <Text
                style={[
                  styles.stepLabel,
                  i === step && styles.stepLabelActive,
                  i > step && styles.stepLabelMuted,
                ]}
              >
                {t(stepKey)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
              setSelectedTableId(null);
              setStep(1);
            }}
          />
        )}

        {step === 1 && tableType ? (
          <TablePicker
            tableType={tableType}
            tables={tablesForType}
            selectedTableId={selectedTableId}
            onSelectTable={(id: string) => {
              setSelectedTableId(id as Id<"tables">);
              setDateYmd(null);
              setSelectedTime(null);
              setStep(2);
            }}
            headingLabel={t("customerApp.booking.whichTable")}
            emptyLabel={t("customerApp.booking.noTablesEmpty")}
          />
        ) : null}

        {step === 2 && !bh ? (
          <Text style={styles.errorText}>
            {t("customerApp.booking.setupIncomplete")}
          </Text>
        ) : null}
        {step === 2 && bh ? (
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
                setSelectedTime(null);
                setStep(3);
              }}
              headingLabel={t("customerApp.booking.pickDate")}
              todayLabel={t("customerApp.booking.today")}
              noDatesLabel={t("customerApp.booking.noDatesAvailable")}
            />
            <Text style={styles.tzHint}>{t("customerApp.booking.timesShownIn", { tz: tzLabel })}</Text>
          </>
        ) : null}

        {step === 3 && dateYmd ? (
          <>
            <Text style={styles.reviewHeading}>{t("customerApp.booking.durationHeading")}</Text>
            <View style={styles.durGrid}>
              {slotOptions.map((d: number) => {
                const durKey = DURATION_KEY_MAP[d];
                const chip = durKey
                  ? t(`customerApp.booking.durations.${durKey}.chip`)
                  : t("customerApp.booking.durations.chipFallback", { count: d });
                const sub = durKey ? t(`customerApp.booking.durations.${durKey}.sub`) : null;
                const active = durationMin === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      setDurationMin(d);
                      setSelectedTime(null);
                      setStep(4);
                    }}
                    style={[styles.durCard, active && styles.durCardActive]}
                  >
                    <Text
                      style={[styles.durChip, active && styles.durChipActive]}
                    >
                      {chip}
                    </Text>
                    {sub ? (
                      <Text style={styles.durSub}>{sub}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {durationMin !== null && durationMin < ctx.minBillMinutes ? (
              <View style={styles.warnCard}>
                <Text style={styles.warnText}>
                  {t("customerApp.booking.minChargeWarning", {
                    minutes: ctx.minBillMinutes,
                  })}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 4 && bh && tableType && selectedTableId && dateYmd && durationMin !== null ? (
          <>
            <TimeSlotGrid
              availableSlots={availableSlots}
              requestedDurationMin={durationForSlots}
              selectedTime={selectedTime}
              onSelectTime={(t: string) => {
                setSelectedTime(t);
                setStep(5);
              }}
              bookableOpen={bh.open}
              bookableClose={bh.close}
            />
            <Text style={styles.tzHint}>{t("customerApp.booking.timesShownIn", { tz: tzLabel })}</Text>
          </>
        ) : null}

        {step === 5 && bh && tableType && selectedTableId && dateYmd && selectedTime && durationMin !== null ? (
          <View style={styles.review}>
            <Text style={styles.confirmTitle}>{t("customerApp.booking.confirmTitle")}</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryClub}>{ctx.name}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{t("customerApp.booking.summaryTable")}</Text>
                <Text style={styles.summaryVal}>
                  {selectedTableLabel || t("customerApp.booking.emDash")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{t("customerApp.booking.summaryTableType")}</Text>
                <Text style={styles.summaryVal}>
                  {capitalizeWords(tableType)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{t("customerApp.booking.summaryDate")}</Text>
                <Text style={styles.summaryVal}>{summaryDateLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{t("customerApp.booking.summaryTime")}</Text>
                <Text style={styles.summaryVal}>
                  {formatHhmm12h(selectedTime)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{t("customerApp.booking.summaryDuration")}</Text>
                <Text style={styles.summaryVal}>
                  {durationMin !== null
                    ? (DURATION_KEY_MAP[durationMin]
                        ? t(`customerApp.booking.durations.${DURATION_KEY_MAP[durationMin]}.summary`)
                        : t("customerApp.booking.durations.summaryFallback", { count: durationMin }))
                    : t("customerApp.booking.emDash")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{t("customerApp.booking.summaryEstimatedCost")}</Text>
                <Text style={styles.summaryVal}>
                  {t("customerApp.booking.estimatedCostValue", {
                    amount: formatMoney(ctx.currency, estimatedPreview),
                  })}
                </Text>
              </View>
            </View>
            <Text style={styles.tzHint}>{t("customerApp.booking.timesShownIn", { tz: tzLabel })}</Text>

            {ctx.bookingSettings.requireBookingCoupon ? (
              <>
                <Text style={styles.notesLabel}>{t("customerApp.booking.bookingCoupon")}</Text>
                <Text style={styles.couponHint}>
                  {t("customerApp.booking.couponHint")}
                </Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder={t("customerApp.booking.couponPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  value={couponCode}
                  onChangeText={(t: string) => setCouponCode(t.toUpperCase().slice(0, 32))}
                  autoCapitalize="characters"
                  maxLength={32}
                />
              </>
            ) : null}

            <Text style={styles.notesLabel}>{t("customerApp.booking.notesOptional")}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t("customerApp.booking.notesPlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              value={notes}
              onChangeText={(t: string) => setNotes(t.slice(0, 200))}
              multiline
              maxLength={200}
            />
            <Text style={styles.counter}>{t("customerApp.booking.notesCounter", { count: notes.length })}</Text>

            <Pressable
              style={[
                styles.primaryBtn,
                submitting && styles.primaryBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={glass.ctaText} />
              ) : (
                <Text style={styles.primaryBtnText}>{t("customerApp.booking.confirmBooking")}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
    </GlassPageBackground>
  );
}

const DOT_GAP = 4;

export default function BookClubScreen() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("customerApp.clubProfile.bookTable")}>
      <BookClubScreenContent />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
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
    backgroundColor: glass.ctaBg,
    transform: [{ scale: 1.15 }],
  },
  dotDone: { backgroundColor: glass.ctaBg },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border.default,
    marginHorizontal: DOT_GAP,
    maxWidth: 40,
  },
  stepLineActive: { backgroundColor: glass.ctaBg },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepLabelCell: { flex: 1 },
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
  textBtnLabel: { ...typography.label, color: glass.ctaBg },
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
    backgroundColor: glass.cardBg,
    borderRadius: glass.cardRadiusSmall,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    padding: spacing[4],
  },
  durCardActive: {
    borderColor: glass.inputBorderFocus,
    borderWidth: 2,
  },
  durChip: {
    ...typography.heading3,
    color: colors.text.primary,
    textAlign: "center",
  },
  durChipActive: { color: glass.ctaBg },
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
    backgroundColor: glass.cardBg,
    borderRadius: glass.cardRadiusSmall,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: glass.cardBorder,
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
  couponHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  notesInput: {
    backgroundColor: glass.inputBg,
    borderRadius: radius.md,
    minHeight: 80,
    padding: spacing[3],
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: glass.inputBorder,
  },
  counter: {
    ...typography.caption,
    color: colors.text.tertiary,
    alignSelf: "flex-end",
  },
  primaryBtn: {
    backgroundColor: glass.ctaBg,
    borderRadius: radius.md,
    minHeight: layout.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[4],
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    ...typography.buttonLarge,
    color: glass.ctaText,
  },
});
