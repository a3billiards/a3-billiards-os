import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  I18nManager,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@a3/ui/theme";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";

const PRESET_TIMES = [
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
] as const;

function hhmmFromDate(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dateFromHhmm(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function normalizeHhmmInput(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  const h = Math.min(23, Math.max(0, parseInt(match[1]!, 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2]!, 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatHhmm12hLocale(hhmm: string, locale: string): string {
  const normalized = normalizeHhmmInput(hhmm);
  if (!/^\d{2}:\d{2}$/.test(normalized)) return hhmm;
  const [h, m] = normalized.split(":").map((x) => Number(x));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

type Props = {
  label?: string;
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
};

export function HhMmTimeField({ label, value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const locale = getCurrentLanguage();
  const [showPicker, setShowPicker] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const display = useMemo(() => {
    const normalized = normalizeHhmmInput(value);
    if (/^\d{2}:\d{2}$/.test(normalized)) {
      return formatHhmm12hLocale(normalized, locale);
    }
    return value || t("sharedUi.timeField.pickTime");
  }, [value, locale, t]);

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "dismissed" || !date) return;
    }
    if (!date) return;
    onChange(hhmmFromDate(date));
  };

  const openPicker = () => {
    if (disabled) return;
    if (Platform.OS === "web") {
      setShowPresets(true);
      return;
    }
    setShowPicker(true);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={openPicker}
        disabled={disabled}
      >
        <MaterialIcons name="schedule" size={20} color={colors.text.secondary} />
        <Text
          style={[
            styles.value,
            { textAlign: I18nManager.isRTL ? "right" : "left" },
          ]}
        >
          {display}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={24} color={colors.text.secondary} />
      </Pressable>

      {showPicker && Platform.OS !== "web" ? (
        <DateTimePicker
          value={dateFromHhmm(normalizeHhmmInput(value) || "10:00")}
          mode="time"
          is24Hour={false}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerChange}
        />
      ) : null}

      {Platform.OS === "ios" && showPicker ? (
        <Pressable style={styles.doneBtn} onPress={() => setShowPicker(false)}>
          <Text style={styles.doneBtnText}>{t("sharedUi.timeField.done")}</Text>
        </Pressable>
      ) : null}

      <Modal visible={showPresets} transparent animationType="fade" onRequestClose={() => setShowPresets(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPresets(false)}>
          <View style={styles.presetCard}>
            <Text style={styles.presetTitle}>{t("sharedUi.timeField.pickATime")}</Text>
            <View style={styles.presetGrid}>
              {PRESET_TIMES.map((preset) => (
                <Pressable
                  key={preset}
                  style={[styles.presetChip, value === preset && styles.presetChipOn]}
                  onPress={() => {
                    onChange(preset);
                    setShowPresets(false);
                  }}
                >
                  <Text style={[styles.presetChipText, value === preset && styles.presetChipTextOn]}>
                    {formatHhmm12hLocale(preset, locale)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing[1] },
  label: { ...typography.caption, color: colors.text.secondary },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minHeight: 44,
    backgroundColor: colors.bg.secondary,
  },
  fieldDisabled: { opacity: 0.5 },
  value: { ...typography.body, color: colors.text.primary, flex: 1 },
  doneBtn: { alignSelf: "flex-end", paddingVertical: spacing[2] },
  doneBtnText: { ...typography.label, color: colors.accent.green },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing[5],
  },
  presetCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    maxHeight: "80%",
  },
  presetTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[3] },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  presetChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  presetChipOn: { borderColor: colors.accent.green, backgroundColor: "rgba(67, 160, 71, 0.12)" },
  presetChipText: { ...typography.caption, color: colors.text.secondary },
  presetChipTextOn: { color: colors.accent.green, fontWeight: "700" },
});
