import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, typography, radius, spacing } from "@a3/ui/theme";
import {
  LOCALE_OPTIONS,
  type AppLocale,
  type LocaleOption,
} from "./config";
import { useAppLocaleOptional } from "./I18nProvider";

export interface LanguagePickerProps {
  /** Compact row for settings screens */
  variant?: "row" | "inline";
}

function LocaleRow({
  option,
  selected,
  onSelect,
}: {
  option: LocaleOption;
  selected: boolean;
  onSelect: (code: AppLocale) => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
      ]}
      onPress={() => onSelect(option.code)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {option.nativeName}
      </Text>
      {selected ? (
        <MaterialIcons name="check" size={22} color={colors.accent.green} />
      ) : null}
    </Pressable>
  );
}

export function LanguagePicker({
  variant = "row",
}: LanguagePickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const ctx = useAppLocaleOptional();
  const [open, setOpen] = useState(false);

  const locale = ctx?.locale ?? "en";
  const setLocale = ctx?.setLocale;
  const current =
    LOCALE_OPTIONS.find((o) => o.code === locale) ?? LOCALE_OPTIONS[0];

  const onSelect = (code: AppLocale) => {
    void setLocale?.(code).then(() => setOpen(false));
  };

  if (variant === "inline") {
    return (
      <View style={styles.inlineWrap}>
        <Text style={styles.label}>{t("settings.language")}</Text>
        <ScrollView style={styles.inlineList} nestedScrollEnabled>
          {LOCALE_OPTIONS.map((option) => (
            <LocaleRow
              key={option.code}
              option={option}
              selected={option.code === locale}
              onSelect={onSelect}
            />
          ))}
        </ScrollView>
        <Text style={styles.hint}>{t("settings.languageHint")}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("settings.selectLanguage")}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="language"
            size={22}
            color={colors.text.secondary}
          />
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t("settings.language")}</Text>
            <Text style={styles.rowValue}>{current.nativeName}</Text>
          </View>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={colors.text.tertiary}
        />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t("settings.selectLanguage")}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={12}
                accessibilityLabel={t("common.close")}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetList}>
              {LOCALE_OPTIONS.map((option) => (
                <LocaleRow
                  key={option.code}
                  option={option}
                  selected={option.code === locale}
                  onSelect={onSelect}
                />
              ))}
            </ScrollView>
            <Text style={styles.sheetHint}>{t("settings.languageHint")}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: spacing[2],
  },
  rowPressed: { opacity: 0.85 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  rowTextWrap: { gap: 2 },
  rowTitle: { ...typography.body, color: colors.text.primary },
  rowValue: { ...typography.caption, color: colors.text.secondary },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "78%",
    paddingBottom: spacing[6],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  sheetTitle: { ...typography.heading3, color: colors.text.primary },
  sheetList: { paddingHorizontal: spacing[4] },
  sheetHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  optionSelected: { backgroundColor: "rgba(76, 175, 80, 0.08)" },
  optionPressed: { opacity: 0.8 },
  optionText: { ...typography.body, color: colors.text.primary },
  optionTextSelected: { fontWeight: "600", color: colors.accent.amberLight },
  inlineWrap: { gap: spacing[2] },
  inlineList: { maxHeight: 320 },
  label: { ...typography.label, color: colors.text.secondary },
  hint: { ...typography.caption, color: colors.text.tertiary },
});
