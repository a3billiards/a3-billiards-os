import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { toClubDate } from "@a3/utils/timezone";
import {
  countDaysInclusive,
  dateRangeForChip,
  ymdToDate,
  type DateRangeChip,
} from "../lib/financialDateRange";

type Props = {
  clubTimezone: string;
  todayYmd: string;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (ymd: string) => void;
  onDateToChange: (ymd: string) => void;
  tzAbbr?: string;
};

const RANGE_CHIPS: { k: DateRangeChip; key: string }[] = [
  { k: "7", key: "sharedUi.financialDateRange.last7Days" },
  { k: "30", key: "sharedUi.financialDateRange.last30Days" },
  { k: "this", key: "sharedUi.financialDateRange.thisMonth" },
  { k: "last", key: "sharedUi.financialDateRange.lastMonth" },
];

export function FinancialDateRangeBar({
  clubTimezone,
  todayYmd,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  tzAbbr,
}: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [picker, setPicker] = useState<"from" | "to" | null>(null);

  const rangeInvalid =
    Boolean(dateFrom && dateTo && dateFrom.localeCompare(dateTo) > 0);
  const rangeDays =
    dateFrom && dateTo && !rangeInvalid
      ? countDaysInclusive(dateFrom, dateTo, clubTimezone)
      : 0;
  const largeRange = rangeDays > 90;

  const onPickChip = useCallback(
    (kind: DateRangeChip) => {
      const { from, to } = dateRangeForChip(kind, todayYmd, clubTimezone);
      onDateFromChange(from);
      onDateToChange(to);
    },
    [clubTimezone, todayYmd, onDateFromChange, onDateToChange],
  );

  const onDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        setPicker(null);
        if (event.type === "dismissed" || !date) return;
      }
      if (!date || !picker) return;
      const ymd = toClubDate(date.getTime(), clubTimezone);
      if (picker === "from") onDateFromChange(ymd);
      else onDateToChange(ymd);
    },
    [picker, clubTimezone, onDateFromChange, onDateToChange],
  );

  const pickerValue = ymdToDate(
    (picker === "from" ? dateFrom : dateTo) || todayYmd,
    clubTimezone,
  );

  return (
    <View>
      {tzAbbr ? (
        <Text style={styles.tzNote}>
          {t("sharedUi.financialDateRange.datesInTz", { tzAbbr })}
        </Text>
      ) : null}

      <View style={styles.dateRow}>
        <Pressable style={styles.dateBtn} onPress={() => setPicker("from")}>
          <Text style={styles.dateLbl}>{t("sharedUi.financialDateRange.from")}</Text>
          <Text style={styles.dateVal}>{dateFrom || t("common.emDash")}</Text>
        </Pressable>
        <Pressable style={styles.dateBtn} onPress={() => setPicker("to")}>
          <Text style={styles.dateLbl}>{t("sharedUi.financialDateRange.to")}</Text>
          <Text style={styles.dateVal}>{dateTo || t("common.emDash")}</Text>
        </Pressable>
      </View>

      {picker && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      ) : null}

      {picker && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide" visible>
          <View style={styles.iosPickerBackdrop}>
            <View style={styles.iosPickerSheet}>
              <View style={styles.iosPickerHeader}>
                <Text style={styles.iosPickerTitle}>
                  {picker === "from"
                    ? t("sharedUi.financialDateRange.fromDate")
                    : t("sharedUi.financialDateRange.toDate")}
                </Text>
                <Pressable onPress={() => setPicker(null)} hitSlop={8}>
                  <Text style={styles.iosPickDoneText}>
                    {t("sharedUi.financialDateRange.done")}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                themeVariant="dark"
              />
            </View>
          </View>
        </Modal>
      ) : null}

      <View style={styles.chips}>
        {RANGE_CHIPS.map((c) => (
          <Pressable key={c.k} onPress={() => onPickChip(c.k)} style={styles.chip}>
            <Text style={styles.chipText}>{t(c.key)}</Text>
          </Pressable>
        ))}
      </View>

      {rangeInvalid ? (
        <Text style={styles.errText}>{t("sharedUi.financialDateRange.endBeforeStart")}</Text>
      ) : null}

      {largeRange ? (
        <Text style={styles.warnLarge}>{t("sharedUi.financialDateRange.largeRangeWarning")}</Text>
      ) : null}
    </View>
  );
}

export function useFinancialDateRangeInvalid(
  dateFrom: string,
  dateTo: string,
): boolean {
  return Boolean(
    dateFrom && dateTo && dateFrom.localeCompare(dateTo) > 0,
  );
}

const styles = StyleSheet.create({
  tzNote: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[2] },
  dateRow: { flexDirection: "row", gap: spacing[3], marginBottom: spacing[3] },
  dateBtn: {
    flex: 1,
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  dateLbl: { ...typography.caption, color: colors.text.secondary },
  dateVal: { ...typography.label, color: colors.text.primary, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginBottom: spacing[4] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
  },
  chipText: { ...typography.caption, color: colors.text.primary },
  errText: { color: colors.status.error, marginBottom: spacing[2] },
  warnLarge: { color: colors.accent.amber, marginBottom: spacing[2] },
  iosPickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosPickerSheet: {
    backgroundColor: colors.bg.secondary,
    borderTopStartRadius: radius.lg,
    borderTopEndRadius: radius.lg,
    paddingBottom: spacing[6],
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  iosPickerTitle: { ...typography.label, color: colors.text.primary },
  iosPickDoneText: { ...typography.label, color: colors.accent.green, fontWeight: "600" },
});
