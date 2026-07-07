import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useTranslation, getCurrentLanguage } from "@a3/i18n";
import { tableTypeI18nKey, tableTypeLabel } from "@a3/utils/tableTypes";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

export interface TableTypePickerProps {
  bookableTypes: string[];
  activeCountByType: Record<string, number>;
  currencyCode: string;
  baseRatePerMin: number;
  selectedType: string | null;
  onSelectType: (tableType: string) => void;
}

function formatRateForPicker(
  currencyCode: string,
  rate: number,
  locale: string,
): string {
  try {
    const sym = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: rate % 1 === 0 ? 0 : 1,
    })
      .formatToParts(rate)
      .find((p) => p.type === "currency")?.value;
    const num = new Intl.NumberFormat(locale, {
      maximumFractionDigits: rate % 1 === 0 ? 0 : 1,
    }).format(rate);
    return `${sym ?? currencyCode}${num}`;
  } catch {
    return `${currencyCode} ${rate}`;
  }
}

function displayTypeName(
  raw: string,
  t: (key: string) => string,
): string {
  const key = raw.trim().toLowerCase();
  const i18nKey = tableTypeI18nKey(key);
  return i18nKey ? t(i18nKey) : tableTypeLabel(key);
}

export function TableTypePicker({
  bookableTypes,
  activeCountByType,
  currencyCode,
  baseRatePerMin,
  selectedType,
  onSelectType,
}: TableTypePickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const locale = getCurrentLanguage();
  const rateFormatted = formatRateForPicker(currencyCode, baseRatePerMin, locale);
  const rateLabel = t("sharedUi.tableTypePicker.ratePerMin", { rate: rateFormatted });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t("sharedUi.tableTypePicker.heading")}</Text>
      <View style={styles.list}>
        {bookableTypes.map((raw) => {
          const key = raw.trim().toLowerCase();
          const count = activeCountByType[key] ?? 0;
          const selected = selectedType === key;
          return (
            <Pressable
              key={key}
              onPress={() => onSelectType(key)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>{displayTypeName(raw, t)}</Text>
                  <Text style={styles.cardSubtitle}>
                    {count === 1
                      ? t("sharedUi.tableTypePicker.oneTable")
                      : t("sharedUi.tableTypePicker.tablesAvailable", { count })}
                  </Text>
                </View>
                <Text style={styles.rate}>{rateLabel}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: "stretch" },
  scrollContent: {
    paddingBottom: spacing[8],
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  list: { gap: spacing[3] },
  card: {
    minHeight: layout.buttonHeight + spacing[6],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  cardSelected: {
    borderColor: colors.accent.green,
    borderWidth: 2,
  },
  cardPressed: { opacity: 0.92 },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: { flex: 1, paddingRight: spacing[3] },
  cardTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  cardSubtitle: { ...typography.body, color: colors.text.secondary },
  rate: { ...typography.body, color: colors.text.secondary },
});

export default TableTypePicker;
