import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export interface TableTypePickerProps {
  bookableTypes: string[];
  activeCountByType: Record<string, number>;
  currencyCode: string;
  baseRatePerMin: number;
  selectedType: string | null;
  onSelectType: (tableType: string) => void;
}

function formatRateLabel(currencyCode: string, rate: number): string {
  try {
    const sym = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: rate % 1 === 0 ? 0 : 1,
    })
      .formatToParts(rate)
      .find((p) => p.type === "currency")?.value;
    const num = new Intl.NumberFormat("en", {
      maximumFractionDigits: rate % 1 === 0 ? 0 : 1,
    }).format(rate);
    return `${sym ?? currencyCode}${num}/min`;
  } catch {
    return `${currencyCode} ${rate}/min`;
  }
}

export function TableTypePicker({
  bookableTypes,
  activeCountByType,
  currencyCode,
  baseRatePerMin,
  selectedType,
  onSelectType,
}: TableTypePickerProps): React.JSX.Element {
  const rateLabel = formatRateLabel(currencyCode, baseRatePerMin);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>What type of table?</Text>
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
                  <Text style={styles.cardTitle}>
                    {capitalizeWords(key)}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {count === 1 ? "1 table available" : `${count} tables available`}
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
