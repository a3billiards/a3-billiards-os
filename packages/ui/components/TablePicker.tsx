import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useTranslation } from "@a3/i18n";
import { tableTypeI18nKey, tableTypeLabel } from "@a3/utils/tableTypes";
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
  /** Override heading (defaults to sharedUi.tablePicker.title) */
  headingLabel?: string;
  /** Override empty state (defaults to sharedUi.tablePicker.empty) */
  emptyLabel?: string;
}

function displayTypeName(
  raw: string,
  t: (key: string) => string,
): string {
  const key = raw.trim().toLowerCase();
  const i18nKey = tableTypeI18nKey(key);
  return i18nKey ? t(i18nKey) : tableTypeLabel(key);
}

export function TablePicker({
  tableType,
  tables,
  selectedTableId,
  onSelectTable,
  headingLabel,
  emptyLabel,
}: TablePickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const title = headingLabel ?? t("sharedUi.tablePicker.title");
  const empty = emptyLabel ?? t("sharedUi.tablePicker.empty");
  const typeLabel = displayTypeName(tableType, t);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {t("sharedUi.tablePicker.pickTableSubtitle", { type: typeLabel })}
      </Text>
      {tables.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        <View style={styles.list}>
          {tables.map((tbl) => {
            const selected = selectedTableId === tbl.tableId;
            return (
              <Pressable
                key={tbl.tableId}
                onPress={() => onSelectTable(tbl.tableId)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle}>{tbl.label}</Text>
                  {tbl.floor ? (
                    <Text style={styles.cardSubtitle}>{tbl.floor}</Text>
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
