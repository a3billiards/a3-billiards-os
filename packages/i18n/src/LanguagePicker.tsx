import React, { useCallback, useState } from "react";
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
import { colors, typography, radius, spacing, glass } from "@a3/ui/theme";
import {
  LOCALE_OPTIONS,
  isAppLocale,
  type AppLocale,
  type LocaleOption,
} from "./config";
import { useAppLocaleOptional } from "./I18nProvider";
import { applyAppLocale } from "./applyAppLocale";

export interface LanguagePickerProps {
  /** row = settings row; inline = full list; icon = header globe button */
  variant?: "row" | "inline" | "icon";
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

function LanguagePickerSheet({
  open,
  locale,
  onClose,
  onSelect,
}: {
  open: boolean;
  locale: AppLocale;
  onClose: () => void;
  onSelect: (code: AppLocale) => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("common.language.selectLanguage")}</Text>
            <Pressable
              onPress={onClose}
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
          <Text style={styles.sheetHint}>{t("common.language.languageHint")}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function LanguagePicker({
  variant = "row",
}: LanguagePickerProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const ctx = useAppLocaleOptional();
  const [open, setOpen] = useState(false);

  const locale: AppLocale =
    ctx?.locale ??
    (isAppLocale(i18n.language) ? i18n.language : "en");
  const current =
    LOCALE_OPTIONS.find((o) => o.code === locale) ?? LOCALE_OPTIONS[0];

  const onSelect = useCallback(
    (code: AppLocale) => {
      void (async () => {
        if (ctx?.setLocale) {
          await ctx.setLocale(code);
        } else {
          await applyAppLocale(code, i18n);
        }
        setOpen(false);
      })();
    },
    [ctx, i18n],
  );

  if (variant === "inline") {
    return (
      <View style={styles.inlineWrap}>
        <Text style={styles.label}>{t("common.language.language")}</Text>
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
        <Text style={styles.hint}>{t("common.language.languageHint")}</Text>
      </View>
    );
  }

  if (variant === "icon") {
    return (
      <>
        <Pressable
          hitSlop={10}
          style={styles.iconBtn}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("common.language.selectLanguage")}
        >
          <MaterialIcons name="language" size={20} color={glass.textMuted} />
        </Pressable>
        <LanguagePickerSheet
          open={open}
          locale={locale}
          onClose={() => setOpen(false)}
          onSelect={onSelect}
        />
      </>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("common.language.selectLanguage")}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="language"
            size={22}
            color={colors.text.secondary}
          />
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t("common.language.language")}</Text>
            <Text style={styles.rowValue}>{current.nativeName}</Text>
          </View>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={colors.text.tertiary}
        />
      </Pressable>

      <LanguagePickerSheet
        open={open}
        locale={locale}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
      />
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
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
