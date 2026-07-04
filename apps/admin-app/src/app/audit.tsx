import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius, glass } from "@a3/ui/theme";
import { GlassPageBackground, LiquidGlassCard } from "@a3/ui/components";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";
import { usePullToRefresh } from "@a3/ui/hooks";
import { adminTabBarTotalInset } from "../theme/adminShell";

type AuditEntry = {
  _id: Id<"adminAuditLog">;
  action: string;
  actionLabel: string;
  adminId: Id<"users">;
  adminName: string;
  targetUserId: Id<"users"> | null;
  targetUserName: string | null;
  previousValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: number;
};

function formatWhen(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(getCurrentLanguage(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionIcon(action: string): keyof typeof MaterialIcons.glyphMap {
  switch (action) {
    case "user_freeze":
    case "user_unfreeze":
      return "person";
    case "password_reset":
    case "passcode_reset":
      return "lock-reset";
    case "complaint_dismiss":
      return "flag";
    case "session_force_end":
      return "stop-circle";
    case "phone_update":
    case "admin_profile_edit":
      return "edit";
    case "role_change":
      return "swap-horiz";
    default:
      return "history";
  }
}

export default function AuditLogScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useQuery(api.users.getCurrentUser, {});
  const canQuery =
    user?.role === "admin" && user.adminMfaVerifiedAt !== undefined;

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const page = useQuery(
    api.admin.getAdminAuditLog,
    canQuery ? { cursor, limit: 30 } : "skip",
  );

  useEffect(() => {
    if (!page) return;
    if (cursor === undefined) {
      setRows(page.entries as AuditEntry[]);
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((r) => r._id));
        const merged = [...prev];
        for (const e of page.entries as AuditEntry[]) {
          if (!ids.has(e._id)) merged.push(e);
        }
        return merged;
      });
    }
    setNextCursor(page.nextCursor);
    setLoadingMore(false);
  }, [page, cursor]);

  const { refreshing, onRefresh } = usePullToRefresh(
    useCallback(() => {
      setCursor(undefined);
      setRows([]);
      setNextCursor(null);
    }, []),
  );

  const onEndReached = useCallback(() => {
    if (!nextCursor || loadingMore || !canQuery) return;
    setLoadingMore(true);
    setCursor(nextCursor);
  }, [nextCursor, loadingMore, canQuery]);

  const bottomPad = adminTabBarTotalInset(insets.bottom);

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={[styles.header, { paddingHorizontal: spacing[4] }]}>
          <Text style={styles.title}>{t("adminApp.audit.title")}</Text>
          <Text style={styles.subtitle}>{t("adminApp.audit.subtitle")}</Text>
          <Pressable
            onPress={onRefresh}
            hitSlop={12}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t("adminApp.audit.refreshAccessibility")}
          >
            <MaterialIcons name="refresh" size={20} color={glass.accentBlue} />
          </Pressable>
        </View>

        {!canQuery || page === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent.green} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="history" size={40} color={glass.textMuted} />
            <Text style={styles.emptyTitle}>{t("adminApp.audit.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("adminApp.audit.emptyBody")}</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: spacing[4] }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  style={{ marginVertical: spacing[4] }}
                  color={colors.accent.green}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <LiquidGlassCard style={styles.card} padding={16}>
                <View style={styles.rowTop}>
                  <View style={styles.iconTile}>
                    <MaterialIcons
                      name={actionIcon(item.action)}
                      size={18}
                      color={glass.accentBlue}
                    />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.actionLabel}>{item.actionLabel}</Text>
                    <Text style={styles.meta}>
                      {item.adminName}
                      {item.targetUserName ? ` → ${item.targetUserName}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
                </View>
                {(item.previousValue || item.newValue) && (
                  <View style={styles.changeRow}>
                    {item.previousValue ? (
                      <Text style={styles.changeText} numberOfLines={2}>
                        {t("adminApp.audit.from", { value: item.previousValue })}
                      </Text>
                    ) : null}
                    {item.newValue ? (
                      <Text style={styles.changeText} numberOfLines={2}>
                        {t("adminApp.audit.to", { value: item.newValue })}
                      </Text>
                    ) : null}
                  </View>
                )}
                {item.notes ? (
                  <Text style={styles.notes} numberOfLines={3}>
                    {item.notes}
                  </Text>
                ) : null}
              </LiquidGlassCard>
            )}
          />
        )}
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    gap: 4,
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: glass.textMuted,
    marginBottom: spacing[1],
  },
  refreshBtn: {
    alignSelf: "flex-start",
    padding: spacing[2],
    borderRadius: radius.md,
    backgroundColor: glass.iconTileBg,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  emptyTitle: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  emptyBody: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  card: {
    marginBottom: spacing[3],
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: glass.iconTileBg,
    borderWidth: 1,
    borderColor: glass.iconTileBorder,
  },
  rowMain: { flex: 1, gap: 2 },
  actionLabel: {
    ...typography.label,
    color: colors.text.primary,
  },
  meta: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  when: {
    fontSize: 11,
    color: glass.textMuted,
    maxWidth: 88,
    textAlign: "right",
  },
  changeRow: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: glass.cardBorder,
    gap: 2,
  },
  changeText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  notes: {
    marginTop: spacing[2],
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
});
