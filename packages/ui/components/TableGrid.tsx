import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

export type TableGridItem = {
  _id: string;
  label: string;
  tableType: string;
  floor?: string;
  isActive: boolean;
  currentSessionId?: string;
};

export interface TableGridProps {
  tables: TableGridItem[];
  /** Booking badge label from confirmed slots overlapping next 2h */
  bookingTagByTableId?: Record<string, { label: string }>;
  onTablePress: (tableId: string) => void;
}

const GAP = spacing[2];
const MIN_CARD_W = 148;

export function TableGrid({
  tables,
  bookingTagByTableId = {},
  onTablePress,
}: TableGridProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const pad = layout.screenPadding * 2;
  const inner = Math.max(0, width - pad);
  const cols = Math.max(2, Math.floor((inner + GAP) / (MIN_CARD_W + GAP)));
  const cardW = (inner - GAP * (cols - 1)) / cols;

  const handlePress = useCallback(
    (id: string) => {
      onTablePress(id);
    },
    [onTablePress],
  );

  return (
    <View style={styles.wrap}>
      {tables.map((t) => {
        const occupied = t.currentSessionId !== undefined;
        const inactive = !t.isActive;
        const tag = bookingTagByTableId[t._id]?.label;
        const typeLabel =
          t.tableType.length > 0
            ? t.tableType.charAt(0).toUpperCase() + t.tableType.slice(1)
            : "Table";

        return (
          <Pressable
            key={t._id}
            style={({ pressed }) => [
              styles.card,
              { width: cardW },
              inactive && styles.cardInactive,
              occupied ? styles.cardOccupied : styles.cardFree,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handlePress(t._id)}
            disabled={inactive}
            accessibilityRole="button"
            accessibilityLabel={`${t.label}, ${occupied ? "occupied" : "free"}${tag ? `, ${tag}` : ""}`}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {t.label}
            </Text>
            <Text style={styles.cardType} numberOfLines={1}>
              {typeLabel}
            </Text>
            {t.floor ? (
              <Text style={styles.cardFloor} numberOfLines={1}>
                {t.floor}
              </Text>
            ) : null}
            {tag ? (
              <View style={styles.bookingTag}>
                <Text style={styles.bookingTagText}>{tag}</Text>
              </View>
            ) : null}
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusText,
                  inactive
                    ? styles.statusDisabled
                    : occupied
                      ? styles.statusOccupied
                      : styles.statusFree,
                ]}
              >
                {inactive
                  ? "Disabled"
                  : occupied
                    ? "Occupied"
                    : "Free"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    justifyContent: "flex-start",
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing[4],
    minHeight: layout.tableCardHeight + 24,
  },
  cardFree: {
    borderColor: colors.accent.green,
  },
  cardOccupied: {
    borderColor: colors.status.error,
  },
  cardInactive: {
    borderColor: colors.status.disabled,
    opacity: 0.65,
  },
  cardPressed: {
    opacity: 0.88,
  },
  cardTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  cardType: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: "capitalize",
  },
  cardFloor: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing[0.5],
  },
  bookingTag: {
    marginTop: spacing[3],
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,127,23,0.18)",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent.amber,
  },
  bookingTagText: {
    ...typography.labelSmall,
    color: colors.accent.amber,
  },
  statusRow: {
    marginTop: spacing[4],
  },
  statusText: {
    ...typography.labelSmall,
  },
  statusFree: { color: colors.accent.green },
  statusOccupied: { color: colors.status.error },
  statusDisabled: { color: colors.text.secondary },
});

export default TableGrid;
