import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";
import { adminTabBarTotalInset } from "../theme/adminShell";
import { parseConvexError } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import { getCurrentLanguage, useTranslation } from "@a3/i18n";

type ComplaintType =
  | "violent_behaviour"
  | "theft"
  | "runaway_without_payment"
  | "late_credit_payment";

type StatusTab = "active" | "dismissed" | "all";

type ComplaintRow = {
  _id: string;
  type: ComplaintType;
  typeLabel: string;
  description: string;
  status: "active" | "dismissed";
  createdAt: number;
  removedAt: number | null;
  dismissalReason: string | null;
  customer: {
    _id: string | null;
    name: string;
    phone: string | null;
  };
  club: { _id: string; name: string };
  dismissedBy: { _id: string; name: string; role: string } | null;
  sessionId: string | null;
};

function filedAgo(
  createdAt: number,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const d = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (d <= 0) return tr("adminApp.complaints.timeToday");
  if (d === 1) return tr("adminApp.complaints.timeOneDayAgo");
  if (d < 7) return tr("adminApp.complaints.timeDaysAgo", { count: d });
  const w = Math.floor(d / 7);
  if (w === 1) return tr("adminApp.complaints.timeOneWeekAgo");
  if (w < 5) return tr("adminApp.complaints.timeWeeksAgo", { count: w });
  const m = Math.floor(d / 30);
  return m <= 1
    ? tr("adminApp.complaints.timeAboutOneMonthAgo")
    : tr("adminApp.complaints.timeMonthsAgo", { count: m });
}

function dismissedAgo(
  removedAt: number,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return filedAgo(removedAt, tr);
}

function parseYmdUtcStart(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
}

function parseYmdUtcEnd(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d, 23, 59, 59, 999);
}

function formatRangeLabel(fromMs: number, toMs: number): string {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  const o: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  return `${a.toLocaleDateString(getCurrentLanguage(), o)} – ${b.toLocaleDateString(getCurrentLanguage(), o)}`;
}

function typeBadgeStyle(
  complaintType: ComplaintType,
  tr: (key: string) => string,
): {
  bg: string;
  fg: string;
  short: string;
} {
  switch (complaintType) {
    case "violent_behaviour":
      return {
        bg: colors.status.error,
        fg: colors.text.primary,
        short: tr("adminApp.complaints.typeViolentBehaviour"),
      };
    case "theft":
      return {
        bg: colors.accent.amber,
        fg: colors.text.primary,
        short: tr("adminApp.complaints.typeTheft"),
      };
    case "runaway_without_payment":
      return {
        bg: colors.accent.amberLight,
        fg: "#0D1117",
        short: tr("adminApp.complaints.typeRunaway"),
      };
    case "late_credit_payment":
      return {
        bg: colors.status.info,
        fg: colors.text.primary,
        short: tr("adminApp.complaints.typeLateCredit"),
      };
    default:
      return {
        bg: colors.bg.tertiary,
        fg: colors.text.secondary,
        short: "?",
      };
  }
}

export default function ComplaintsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [typeFilter, setTypeFilter] = useState<ComplaintType | "all">("all");
  const [clubId, setClubId] = useState<Id<"clubs"> | undefined>(undefined);
  const [clubLabel, setClubLabel] = useState<string>(() => t("adminApp.complaints.allClubs"));
  const [dateFromMs, setDateFromMs] = useState<number | undefined>(undefined);
  const [dateToMs, setDateToMs] = useState<number | undefined>(undefined);
  const [dateChipLabel, setDateChipLabel] = useState<string>(() => t("adminApp.complaints.anyDate"));

  const [fetchCursor, setFetchCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<ComplaintRow[]>([]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [clubSheetOpen, setClubSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [clubSearch, setClubSearch] = useState("");
  const [dateFromStr, setDateFromStr] = useState("");
  const [dateToStr, setDateToStr] = useState("");

  const [dismissTarget, setDismissTarget] = useState<ComplaintRow | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [dismissLoading, setDismissLoading] = useState(false);

  const clubs = useQuery(api.complaints.listClubs, {});
  const dismissMut = useMutation(api.complaints.adminDismissComplaint);

  const queryArgs = useMemo(
    () => ({
      statusFilter: statusTab === "all" ? undefined : statusTab,
      typeFilter: typeFilter === "all" ? undefined : typeFilter,
      clubFilter: clubId,
      dateFrom: dateFromMs,
      dateTo: dateToMs,
      cursor: fetchCursor,
      limit: 20,
    }),
    [statusTab, typeFilter, clubId, dateFromMs, dateToMs, fetchCursor],
  );

  const page = useQuery(api.complaints.getAdminComplaints, queryArgs);

  useEffect(() => {
    setFetchCursor(undefined);
    setRows([]);
  }, [statusTab, typeFilter, clubId, dateFromMs, dateToMs]);

  useEffect(() => {
    if (page === undefined) return;
    if (fetchCursor === undefined) {
      setRows(page.complaints as ComplaintRow[]);
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((r) => r._id));
        const add = (page.complaints as ComplaintRow[]).filter(
          (r) => !ids.has(r._id),
        );
        return [...prev, ...add];
      });
    }
  }, [page, fetchCursor]);

  const loadMore = useCallback(() => {
    if (!page?.nextCursor || rows.length === 0) return;
    if (fetchCursor !== undefined && page.nextCursor === fetchCursor) return;
    setFetchCursor(page.nextCursor);
  }, [page?.nextCursor, fetchCursor, rows.length]);

  const { refreshing, onRefresh } = usePullToRefresh(
    useCallback(() => {
      setFetchCursor(undefined);
      setRows([]);
    }, []),
  );

  const hasNonDefaultFilters =
    typeFilter !== "all" ||
    clubId !== undefined ||
    dateFromMs !== undefined ||
    statusTab !== "active";

  const summaryParts = useMemo(() => {
    const p: string[] = [];
    if (statusTab !== "active") {
      p.push(
        statusTab === "dismissed"
          ? t("adminApp.complaints.statusDismissed")
          : t("adminApp.complaints.summaryAllStatuses"),
      );
    }
    if (typeFilter !== "all") {
      const map: Record<string, string> = {
        violent_behaviour: t("adminApp.complaints.typeViolentBehaviour"),
        theft: t("adminApp.complaints.typeTheft"),
        runaway_without_payment: t("adminApp.complaints.typeRunaway"),
        late_credit_payment: t("adminApp.complaints.typeLateCredit"),
      };
      p.push(map[typeFilter] ?? typeFilter);
    }
    if (clubId !== undefined) {
      p.push(clubLabel);
    }
    if (dateFromMs !== undefined && dateToMs !== undefined) {
      p.push(dateChipLabel);
    }
    return p;
  }, [statusTab, typeFilter, clubId, clubLabel, dateFromMs, dateToMs, dateChipLabel, t]);

  const clearAllFilters = () => {
    setStatusTab("active");
    setTypeFilter("all");
    setClubId(undefined);
    setClubLabel(t("adminApp.complaints.allClubs"));
    setDateFromMs(undefined);
    setDateToMs(undefined);
    setDateChipLabel(t("adminApp.complaints.anyDate"));
  };

  const applyDateRange = () => {
    const a = parseYmdUtcStart(dateFromStr);
    const b = parseYmdUtcEnd(dateToStr);
    if (a === null || b === null || a > b) {
      Alert.alert(
        t("adminApp.complaints.invalidRangeTitle"),
        t("adminApp.complaints.invalidRangeBody"),
      );
      return;
    }
    setDateFromMs(a);
    setDateToMs(b);
    setDateChipLabel(formatRangeLabel(a, b));
    setDateSheetOpen(false);
  };

  const onConfirmDismiss = async () => {
    if (!dismissTarget) return;
    const r = dismissReason.trim();
    if (!r) return;
    setDismissLoading(true);
    try {
      await dismissMut({
        complaintId: dismissTarget._id as Id<"complaints">,
        dismissalReason: r,
      });
      setDismissTarget(null);
      setDismissReason("");
      Alert.alert(t("adminApp.complaints.dismissedAlert"));
    } catch (e) {
      Alert.alert(t("auth.admin.mfa.errorLabel"), parseConvexError(e as Error).message);
    } finally {
      setDismissLoading(false);
    }
  };

  const emptyContent = useMemo(() => {
    if (page === undefined) return null;
    const src = page.sourceCount ?? 0;
    const total = page.totalCount;
    const anyFilter =
      clubId !== undefined ||
      typeFilter !== "all" ||
      dateFromMs !== undefined ||
      statusTab !== "active";

    if (src === 0) {
      if (anyFilter) {
        return (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t("adminApp.complaints.emptyFiltered")}</Text>
            <Pressable style={styles.clearBtn} onPress={clearAllFilters}>
              <Text style={styles.clearBtnText}>{t("adminApp.complaints.clearFilters")}</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons
            name="inbox"
            size={48}
            color={colors.text.secondary}
          />
          <Text style={styles.emptyTitle}>{t("adminApp.complaints.emptyNone")}</Text>
        </View>
      );
    }

    if (total === 0) {
      if (statusTab === "active" && !anyFilter) {
        return (
          <View style={styles.emptyWrap}>
            <MaterialIcons
              name="check-circle"
              size={48}
              color={colors.accent.green}
            />
            <Text style={styles.emptyTitle}>{t("adminApp.complaints.emptyAllReviewed")}</Text>
          </View>
        );
      }
      if (statusTab === "dismissed") {
        return (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t("adminApp.complaints.emptyDismissed")}</Text>
          </View>
        );
      }
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t("adminApp.complaints.emptyFiltered")}</Text>
          <Pressable style={styles.clearBtn} onPress={clearAllFilters}>
            <Text style={styles.clearBtnText}>{t("adminApp.complaints.clearFilters")}</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  }, [page, statusTab, typeFilter, clubId, dateFromMs, t]);

  const filteredClubs = useMemo(() => {
    if (!clubs) return [];
    const q = clubSearch.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => c.name.toLowerCase().includes(q));
  }, [clubs, clubSearch]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.screenTitle}>{t("adminApp.complaints.title")}</Text>

      <View style={styles.statsRow}>
        <View style={[styles.statPill, styles.statPillTotal]}>
          <Text style={styles.statPillTextTotal}>
            {t("adminApp.complaints.total", { count: page?.totalCount ?? "—" })}
          </Text>
        </View>
        <View style={[styles.statPill, styles.statPillActive]}>
          <Text style={styles.statPillTextOn}>
            {t("adminApp.complaints.active", { count: page?.activeCount ?? "—" })}
          </Text>
        </View>
        <View style={[styles.statPill, styles.statPillDismissed]}>
          <Text style={styles.statPillTextOn}>
            {t("adminApp.complaints.dismissed", { count: page?.dismissedCount ?? "—" })}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <View style={styles.filterGroup}>
          {(
            [
              ["active", t("adminApp.complaints.tabActive")],
              ["dismissed", t("adminApp.complaints.tabDismissed")],
              ["all", t("adminApp.complaints.tabAll")],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setStatusTab(k)}
              style={[
                styles.chip,
                statusTab === k && styles.chipOn,
              ]}
            >
              <Text
                style={[
                  styles.chipTxt,
                  statusTab === k && styles.chipTxtOn,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filterGroup}>
          {(
            [
              ["all", t("adminApp.complaints.allTypes")],
              ["violent_behaviour", t("adminApp.complaints.typeViolentBehaviour")],
              ["theft", t("adminApp.complaints.typeTheft")],
              ["runaway_without_payment", t("adminApp.complaints.typeRunaway")],
              ["late_credit_payment", t("adminApp.complaints.typeLateCredit")],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setTypeFilter(k)}
              style={[
                styles.chip,
                typeFilter === k && styles.chipOn,
              ]}
            >
              <Text
                style={[
                  styles.chipTxt,
                  typeFilter === k && styles.chipTxtOn,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.chip, clubId !== undefined && styles.chipOn]}
          onPress={() => {
            setClubSearch("");
            setClubSheetOpen(true);
          }}
        >
          <Text
            style={[
              styles.chipTxt,
              clubId !== undefined && styles.chipTxtOn,
            ]}
            numberOfLines={1}
          >
            {clubLabel}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.chip,
            dateFromMs !== undefined && styles.chipOn,
          ]}
          onPress={() => {
            setDateFromStr("");
            setDateToStr("");
            setDateSheetOpen(true);
          }}
        >
          <Text
            style={[
              styles.chipTxt,
              dateFromMs !== undefined && styles.chipTxtOn,
            ]}
          >
            {dateChipLabel}
          </Text>
        </Pressable>
      </ScrollView>

      {hasNonDefaultFilters ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText} numberOfLines={2}>
            {t("adminApp.complaints.showing", { summary: summaryParts.join(" · ") })}
          </Text>
          <Pressable onPress={clearAllFilters} style={styles.clearLinkWrap}>
            <Text style={styles.clearLink}>{t("adminApp.complaints.clearAll")}</Text>
          </Pressable>
        </View>
      ) : null}

      {page === undefined && rows.length === 0 ? (
        <View style={styles.skelWrap}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.skelCard,
                i < 3 ? { marginBottom: spacing[2] } : null,
              ]}
            />
          ))}
        </View>
      ) : emptyContent ? (
        emptyContent
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listPad,
            { paddingBottom: adminTabBarTotalInset(insets.bottom) },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            page?.nextCursor ? (
              <ActivityIndicator
                color={colors.accent.green}
                style={{ marginVertical: spacing[4] }}
              />
            ) : null
          }
          renderItem={({ item }) => {
            const tb = typeBadgeStyle(item.type, t);
            const isOpen = expanded[item._id];
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.typePill, { backgroundColor: tb.bg }]}>
                    <Text style={[styles.typePillTxt, { color: tb.fg }]}>
                      {tb.short}
                    </Text>
                  </View>
                  <View style={styles.statusRight}>
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            item.status === "active"
                              ? colors.accent.green
                              : colors.status.disabled,
                          marginRight: 6,
                        },
                      ]}
                    />
                    <Text style={styles.statusTxt}>
                      {item.status === "active"
                        ? t("adminApp.complaints.statusActive")
                        : t("adminApp.complaints.statusDismissed")}
                    </Text>
                  </View>
                </View>

                <View style={styles.customerRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>
                      {item.customer.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {item.customer._id ? (
                      <Pressable
                        onPress={() =>
                          router.push(`/user/${item.customer._id}`)
                        }
                      >
                        <Text style={styles.custName}>{item.customer.name}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.custName}>{item.customer.name}</Text>
                    )}
                    {item.customer.phone ? (
                      <Text style={styles.custPhone}>{item.customer.phone}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.clubRow}>
                  <MaterialIcons
                    name="business"
                    size={18}
                    color={colors.text.secondary}
                  />
                  <Text style={styles.clubTxt}>{item.club.name}</Text>
                </View>

                <Text
                  style={styles.desc}
                  numberOfLines={isOpen ? undefined : 2}
                >
                  {item.description}
                </Text>
                {item.description.length > 120 || isOpen ? (
                  <Pressable
                    onPress={() =>
                      setExpanded((e) => ({
                        ...e,
                        [item._id]: !e[item._id],
                      }))
                    }
                  >
                    <Text style={styles.showMore}>
                      {isOpen ? t("adminApp.complaints.showLess") : t("adminApp.complaints.showMore")}
                    </Text>
                  </Pressable>
                ) : null}

                <Text style={styles.filed}>
                  {t("adminApp.complaints.filed", { time: filedAgo(item.createdAt, t) })}
                </Text>

                {item.status === "dismissed" && item.removedAt != null ? (
                  <View style={styles.dismissedFoot}>
                    <Text style={styles.dismissedMeta}>
                      {item.dismissedBy
                        ? t("adminApp.complaints.dismissedMeta", {
                            time: dismissedAgo(item.removedAt, t),
                            name: item.dismissedBy.name,
                            role:
                              item.dismissedBy.role === "owner"
                                ? t("adminApp.roles.owner")
                                : t("adminApp.roles.admin"),
                          })
                        : `${t("adminApp.complaints.statusDismissed")} ${dismissedAgo(item.removedAt, t)}`}
                    </Text>
                    {item.dismissalReason ? (
                      <Text style={styles.dismissedReason} numberOfLines={2}>
                        &ldquo;{item.dismissalReason}&rdquo;
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {item.status === "active" ? (
                  <Pressable
                    style={styles.dismissBtn}
                    onPress={() => {
                      setDismissReason("");
                      setDismissTarget(item);
                    }}
                  >
                    <Text style={styles.dismissBtnTxt}>{t("adminApp.complaints.dismiss")}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal visible={clubSheetOpen} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("adminApp.complaints.selectClub")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("adminApp.complaints.searchClubs")}
              placeholderTextColor={colors.text.secondary}
              value={clubSearch}
              onChangeText={setClubSearch}
            />
            <FlatList
              data={filteredClubs}
              keyExtractor={(c) => c._id}
              style={{ maxHeight: 360 }}
              ListHeaderComponent={
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => {
                    setClubId(undefined);
                    setClubLabel(t("adminApp.complaints.allClubs"));
                    setClubSheetOpen(false);
                  }}
                >
                  <Text style={styles.sheetRowTxt}>{t("adminApp.complaints.allClubs")}</Text>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => {
                    setClubId(item._id as Id<"clubs">);
                    setClubLabel(item.name);
                    setClubSheetOpen(false);
                  }}
                >
                  <Text style={styles.sheetRowTxt}>{item.name}</Text>
                </Pressable>
              )}
            />
            <Pressable
              style={styles.sheetCancel}
              onPress={() => setClubSheetOpen(false)}
            >
              <Text style={styles.sheetCancelTxt}>{t("adminApp.complaints.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={dateSheetOpen} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("adminApp.complaints.dateRangeTitle")}</Text>
            <Text style={styles.sheetHint}>{t("adminApp.complaints.dateFormatHint")}</Text>
            <Text style={styles.inputLabel}>{t("adminApp.complaints.from")}</Text>
            <TextInput
              style={styles.input}
              value={dateFromStr}
              onChangeText={setDateFromStr}
              placeholder={t("adminApp.complaints.dateFormatHint")}
              placeholderTextColor={colors.text.secondary}
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>{t("adminApp.complaints.to")}</Text>
            <TextInput
              style={styles.input}
              value={dateToStr}
              onChangeText={setDateToStr}
              placeholder={t("adminApp.complaints.dateFormatHint")}
              placeholderTextColor={colors.text.secondary}
              autoCapitalize="none"
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setDateSheetOpen(false)}>
                <Text style={styles.sheetCancelTxt}>{t("adminApp.complaints.cancel")}</Text>
              </Pressable>
              <Pressable onPress={applyDateRange}>
                <Text style={styles.applyTxt}>{t("adminApp.complaints.apply")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dismissTarget !== null} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("adminApp.complaints.dismissTitle")}</Text>
            <Text style={styles.sheetSub}>{t("adminApp.complaints.dismissSubtitle")}</Text>
            {dismissTarget ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryType}>{dismissTarget.typeLabel}</Text>
                <Text style={styles.summaryLine}>{dismissTarget.customer.name}</Text>
                <Text style={styles.summaryLine}>{dismissTarget.club.name}</Text>
                <Text style={styles.summaryLine}>
                  {t("adminApp.complaints.filed", {
                    time: new Date(dismissTarget.createdAt).toLocaleDateString(getCurrentLanguage()),
                  })}
                </Text>
              </View>
            ) : null}
            <Text style={styles.inputLabel}>{t("adminApp.complaints.reasonLabel")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={dismissReason}
              onChangeText={setDismissReason}
              placeholder={t("adminApp.complaints.reasonPlaceholder")}
              placeholderTextColor={colors.text.secondary}
              maxLength={500}
            />
            <Text style={styles.counter}>
              {dismissReason.trim().length}/500
            </Text>
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  setDismissTarget(null);
                  setDismissReason("");
                }}
              >
                <Text style={styles.sheetCancelTxt}>{t("adminApp.complaints.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmDismiss}
                disabled={
                  dismissReason.trim().length === 0 || dismissLoading
                }
              >
                {dismissLoading ? (
                  <ActivityIndicator color={colors.status.error} />
                ) : (
                  <Text
                    style={[
                      styles.confirmDismiss,
                      dismissReason.trim().length === 0 && { opacity: 0.4 },
                    ]}
                  >
                    {t("adminApp.complaints.confirmDismiss")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  screenTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing[2],
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing[3],
  },
  statPill: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: 999,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statPillTotal: { backgroundColor: colors.text.secondary },
  statPillActive: { backgroundColor: colors.status.error },
  statPillDismissed: { backgroundColor: colors.status.disabled },
  statPillTextTotal: {
    ...typography.caption,
    color: colors.bg.primary,
    fontWeight: "700",
  },
  statPillTextOn: { ...typography.caption, color: colors.text.primary, fontWeight: "700" },
  filterScroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  filterGroup: { flexDirection: "row", marginRight: spacing[2] },
  chip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    marginRight: spacing[1],
    borderRadius: radius.sm,
    backgroundColor: colors.bg.secondary,
    maxWidth: 160,
  },
  chipOn: { backgroundColor: colors.accent.green },
  chipTxt: { ...typography.caption, color: colors.text.secondary },
  chipTxtOn: { color: colors.text.primary, fontWeight: "600" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing[2],
  },
  summaryText: { flex: 1, ...typography.caption, color: colors.text.secondary },
  clearLinkWrap: { marginLeft: spacing[2] },
  clearLink: { color: colors.accent.green, fontWeight: "600" },
  listPad: {
    paddingHorizontal: layout.screenPadding,
  },
  skelWrap: { paddingHorizontal: layout.screenPadding },
  skelCard: {
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  emptyWrap: { padding: spacing[8], alignItems: "center" },
  emptyTitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[3],
  },
  clearBtn: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: colors.bg.secondary,
  },
  clearBtnText: { color: colors.accent.green, fontWeight: "600" },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[3],
  },
  typePill: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm },
  typePillTxt: { fontSize: 11, fontWeight: "700" },
  statusRight: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { ...typography.caption, color: colors.text.secondary },
  customerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing[2] },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
  },
  avatarTxt: { fontWeight: "700", color: colors.text.primary },
  custName: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  custPhone: { ...typography.caption, color: colors.text.secondary },
  clubRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing[2] },
  clubTxt: { ...typography.bodySmall, color: colors.text.secondary, marginLeft: 6 },
  desc: { ...typography.bodySmall, color: colors.text.primary, marginBottom: 4 },
  showMore: { ...typography.caption, color: colors.accent.green, marginBottom: spacing[2] },
  filed: { ...typography.caption, color: colors.text.secondary },
  dismissedFoot: { marginTop: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.bg.tertiary },
  dismissedMeta: { ...typography.caption, color: colors.text.secondary },
  dismissedReason: {
    fontStyle: "italic",
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  dismissBtn: {
    marginTop: spacing[3],
    alignSelf: "flex-start",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.status.error,
    backgroundColor: "transparent",
  },
  dismissBtnTxt: { color: colors.status.error, fontWeight: "700" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing[4],
    maxHeight: "85%",
  },
  sheetTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[2] },
  sheetSub: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[3] },
  sheetHint: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[2] },
  inputLabel: { ...typography.caption, color: colors.text.secondary, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    padding: spacing[3],
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  counter: { ...typography.caption, color: colors.text.secondary, alignSelf: "flex-end" },
  sheetRow: { paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bg.tertiary },
  sheetRowTxt: { color: colors.text.primary },
  sheetCancel: { marginTop: spacing[3], alignItems: "center" },
  sheetCancelTxt: { color: colors.text.secondary },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing[3],
  },
  applyTxt: { color: colors.accent.green, fontWeight: "700" },
  summaryCard: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[3],
  },
  summaryType: { fontWeight: "700", color: colors.text.primary },
  summaryLine: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  confirmDismiss: { color: colors.status.error, fontWeight: "700" },
});
