import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
} from "react-native";
import { colors } from "../theme/colors";
import { layout, radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export type InboxNotificationRow = {
  _id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: number;
  /** When set, shown instead of `fromAdminLabel` in the meta line. */
  sourceLabel?: string;
};

export type InboxNotificationsPanelProps = {
  rows: InboxNotificationRow[] | undefined;
  loadingMore?: boolean;
  hasMore?: boolean;
  onOpen: (id: string) => void;
  onMarkAllRead?: () => void;
  onLoadMore?: () => void;
  emptyLabel: string;
  markAllReadLabel: string;
  fromAdminLabel: string;
  loadMoreLabel: string;
  formatWhen: (createdAt: number) => string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

export function InboxNotificationsPanel({
  rows,
  loadingMore,
  hasMore,
  onOpen,
  onMarkAllRead,
  onLoadMore,
  emptyLabel,
  markAllReadLabel,
  fromAdminLabel,
  loadMoreLabel,
  formatWhen,
  refreshControl,
}: InboxNotificationsPanelProps): React.JSX.Element {
  if (rows === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }

  const hasUnread = rows.some((row) => !row.isRead);

  return (
    <View style={styles.wrap}>
      {hasUnread && onMarkAllRead ? (
        <Pressable
          onPress={onMarkAllRead}
          style={({ pressed }) => [styles.markAllBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.markAllText}>{markAllReadLabel}</Text>
        </Pressable>
      ) : null}
      {rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{emptyLabel}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {rows.map((row) => (
            <Pressable
              key={row._id}
              onPress={() => onOpen(row._id)}
              style={({ pressed }) => [
                styles.card,
                !row.isRead && styles.cardUnread,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {row.title}
                </Text>
                {!row.isRead ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.cardMeta}>
                {row.sourceLabel ?? fromAdminLabel} · {formatWhen(row.createdAt)}
              </Text>
              <Text style={styles.cardBody}>{row.body}</Text>
            </Pressable>
          ))}
          {hasMore && onLoadMore ? (
            <Pressable
              onPress={onLoadMore}
              disabled={loadingMore}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && styles.pressed,
                loadingMore && styles.disabled,
              ]}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.accent.green} />
              ) : (
                <Text style={styles.loadMoreText}>{loadMoreLabel}</Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  empty: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  markAllBtn: {
    alignSelf: "flex-end",
    marginBottom: spacing[3],
    minHeight: layout.touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing[2],
  },
  markAllText: {
    ...typography.labelSmall,
    color: colors.accent.green,
  },
  list: {
    gap: spacing[2],
    paddingBottom: spacing[6],
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
  },
  cardUnread: {
    borderColor: colors.accent.green,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  cardTitle: {
    ...typography.label,
    color: colors.text.primary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.green,
    marginTop: 6,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  loadMoreBtn: {
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  loadMoreText: {
    ...typography.labelSmall,
    color: colors.accent.green,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
