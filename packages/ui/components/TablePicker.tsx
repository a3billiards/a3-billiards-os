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

export type BookableTableOption = {
  tableId: string;
  label: string;
  floor?: string;
};

export interface TablePickerProps {
  tableType: string;
  tables: BookableTableOption[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
  /** Override "Which table?" heading */
  headingLabel?: string;
  /** Override empty state message */
  emptyLabel?: string;
}

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function TablePicker({
  tableType,
  tables,
  selectedTableId,
  onSelectTable,
  headingLabel = "Which table?",
  emptyLabel = "No active tables for this type. Ask the club to check table setup in Settings.",
}: TablePickerProps): React.JSX.Element {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{headingLabel}</Text>
      <Text style={styles.subtitle}>
        {capitalizeWords(tableType)} — pick a table number
      </Text>
      {tables.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        <View style={styles.list}>
          {tables.map((t) => {
            const selected = selectedTableId === t.tableId;
            return (
              <Pressable
                key={t.tableId}
                onPress={() => onSelectTable(t.tableId)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle}>{t.label}</Text>
                  {t.floor ? (
                    <Text style={styles.cardSubtitle}>{t.floor}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: "stretch" },
  scrollContent: { paddingBottom: spacing[8] },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  empty: { ...typography.body, color: colors.text.secondary },
  list: { gap: spacing[3] },
  card: {
    minHeight: layout.buttonHeight,
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
  cardInner: { gap: spacing[1] },
  cardTitle: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
});

export default TablePicker;
