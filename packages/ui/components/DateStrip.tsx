import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import {
  addCalendarDaysYmd,
  dateYmdInTimeZone,
  hhmmToMinutes,
  zonedWallTimeToUtcMs,
} from "@a3/utils/timezone";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

export interface DateStripProps {
  timeZone: string;
  nowMs: number;
  maxAdvanceDays: number;
  minAdvanceMinutes: number;
  bookableDaysOfWeek: number[];
  bookableOpen: string;
  bookableClose: string;
  slotDurationOptions: number[];
  selectedYmd: string | null;
  onSelectYmd: (ymd: string) => void;
}

function monthShort(ymd: string, tz: string): string {
  const ms = zonedWallTimeToUtcMs(ymd, "12:00", tz);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    month: "short",
  }).format(new Date(ms));
}

function dayNum(ymd: string, tz: string): string {
  const ms = zonedWallTimeToUtcMs(ymd, "12:00", tz);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
  }).format(new Date(ms));
}

function weekdayShort(ymd: string, tz: string): string {
  const ms = zonedWallTimeToUtcMs(ymd, "12:00", tz);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(new Date(ms));
  return wd.slice(0, 3);
}

function dowIndex(ymd: string, tz: string): number {
  const ms = zonedWallTimeToUtcMs(ymd, "12:00", tz);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  })
    .format(new Date(ms))
    .slice(0, 3)
    .toLowerCase();
  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return map[wd] ?? 0;
}

/** True if some slot on this day can start ≥ minAdvanceMinutes from now. */
function dateAllowsMinAdvance(
  ymd: string,
  timeZone: string,
  nowMs: number,
  minAdvanceMinutes: number,
  openHm: string,
  closeHm: string,
  minDurationMin: number,
): boolean {
  const openMin = hhmmToMinutes(openHm);
  const closeMin = hhmmToMinutes(closeHm);
  const minStartMs = nowMs + minAdvanceMinutes * 60_000;
  for (let s = openMin; s < closeMin; s += 30) {
    if (s + minDurationMin > closeMin) continue;
    const hh = String(Math.floor(s / 60)).padStart(2, "0");
    const mm = String(s % 60).padStart(2, "0");
    const slotStartMs = zonedWallTimeToUtcMs(ymd, `${hh}:${mm}`, timeZone);
    if (slotStartMs >= minStartMs) return true;
  }
  return false;
}

export function DateStrip({
  timeZone,
  nowMs,
  maxAdvanceDays,
  minAdvanceMinutes,
  bookableDaysOfWeek,
  bookableOpen,
  bookableClose,
  slotDurationOptions,
  selectedYmd,
  onSelectYmd,
}: DateStripProps): React.JSX.Element {
  const todayYmd = dateYmdInTimeZone(nowMs, timeZone);
  const minDurationMin = Math.min(...slotDurationOptions, 30);

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= maxAdvanceDays; i++) {
      out.push(addCalendarDaysYmd(todayYmd, i, timeZone));
    }
    return out;
  }, [todayYmd, maxAdvanceDays, timeZone]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>When do you want to play?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {days.map((ymd) => {
          const dow = dowIndex(ymd, timeZone);
          const inBookableWeek = bookableDaysOfWeek.includes(dow);
          const advanceOk = dateAllowsMinAdvance(
            ymd,
            timeZone,
            nowMs,
            minAdvanceMinutes,
            bookableOpen,
            bookableClose,
            minDurationMin,
          );
          const disabled = !inBookableWeek || !advanceOk;
          const selected = selectedYmd === ymd;
          const isToday = ymd === todayYmd;
          return (
            <Pressable
              key={ymd}
              disabled={disabled}
              onPress={() => onSelectYmd(ymd)}
              style={({ pressed }) => [
                styles.cell,
                selected && styles.cellSelected,
                disabled && styles.cellDisabled,
                pressed && !disabled && styles.cellPressed,
              ]}
            >
              <Text
                style={[
                  styles.dow,
                  disabled && styles.textDisabled,
                  selected && !disabled && styles.textOnSelected,
                ]}
              >
                {weekdayShort(ymd, timeZone)}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  disabled && styles.textDisabled,
                  selected && !disabled && styles.textOnSelected,
                ]}
              >
                {dayNum(ymd, timeZone)}
              </Text>
              <Text
                style={[
                  styles.month,
                  disabled && styles.textDisabled,
                  selected && !disabled && styles.textOnSelected,
                ]}
              >
                {monthShort(ymd, timeZone)}
              </Text>
              {isToday && !disabled ? (
                <Text
                  style={[
                    styles.today,
                    selected && styles.textOnSelected,
                  ]}
                >
                  Today
                </Text>
              ) : (
                <View style={styles.todaySpacer} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CELL_W = layout.dateStripItemWidth + spacing[6];

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  strip: {
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  cell: {
    width: CELL_W,
    minHeight: layout.dateStripHeight + spacing[8],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: "center",
  },
  cellSelected: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  cellDisabled: {
    opacity: 0.45,
  },
  cellPressed: { opacity: 0.9 },
  dow: { ...typography.labelSmall, color: colors.text.secondary },
  dayNum: {
    ...typography.heading2,
    color: colors.text.primary,
    marginVertical: spacing[1],
  },
  month: { ...typography.labelSmall, color: colors.text.secondary },
  today: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: spacing[1],
  },
  todaySpacer: { height: spacing[3] },
  textDisabled: { color: colors.status.disabled },
  textOnSelected: { color: colors.bg.primary },
});

export default DateStrip;
