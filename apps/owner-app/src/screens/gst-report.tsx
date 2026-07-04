import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { TabErrorBoundary } from "@a3/ui/errors";
import { usePullToRefresh } from "@a3/ui/hooks";
import {
  addCalendarDaysYmd,
  normalizeIanaTimeZone,
  timeZoneAbbreviation,
} from "@a3/utils/timezone";
import { formatCurrency } from "@a3/utils/billing";
import { useTranslation } from "@a3/i18n";
import { useStaffRole, staffRoleQueryId, useStaffTabQueriesEnabled } from "../lib/StaffRoleContext";
import { TabAccessDenied } from "../components/TabAccessDenied";
import { OwnerNoClubPlaceholder } from "../components/OwnerNoClubPlaceholder";
import {
  FinancialDateRangeBar,
  useFinancialDateRangeInvalid,
} from "../components/FinancialDateRangeBar";
import { ownerTabBarTotalInset } from "../theme/ownerShell";

function formatMoney(amount: number, currency: string): string {
  try {
    return formatCurrency(amount, currency);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function GstReportContent(): React.JSX.Element {
  const { t } = useTranslation();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;
  const clubTimezone = normalizeIanaTimeZone(dashboard?.timezone);
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);

  const { roleId, canAccessTab } = useStaffRole();
  const queryRoleId = roleId !== undefined ? staffRoleQueryId(roleId) : undefined;
  const financialsEnabled = useStaffTabQueriesEnabled("financials");

  const access = useQuery(
    api.financials.getFinancialTabAccess,
    clubId && financialsEnabled ? { clubId, roleId: queryRoleId } : "skip",
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const datesInit = useRef(false);

  useEffect(() => {
    if (!dashboard?.todayYmd || datesInit.current) return;
    datesInit.current = true;
    const to = dashboard.todayYmd;
    const from = addCalendarDaysYmd(to, -29, clubTimezone);
    setDateFrom(from);
    setDateTo(to);
  }, [dashboard?.todayYmd, clubTimezone]);

  const rangeInvalid = useFinancialDateRangeInvalid(dateFrom, dateTo);

  const reportArgs =
    clubId && dateFrom && dateTo && !rangeInvalid && financialsEnabled
      ? { clubId, dateFrom, dateTo, roleId: queryRoleId }
      : "skip";
  const report = useQuery(api.gstReport.getGstReport, reportArgs);
  const settings = useQuery(
    api.gstReport.getGstSettings,
    clubId && financialsEnabled ? { clubId } : "skip",
  );

  const tzAbbr = timeZoneAbbreviation(clubTimezone, Date.now());

  if (dashboard === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (dashboard === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <OwnerNoClubPlaceholder />
      </SafeAreaView>
    );
  }

  if (roleId !== undefined && !canAccessTab("financials")) {
    return <TabAccessDenied tabLabel={t("common.tabs.owner.financials")} />;
  }

  if (access === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (!clubId || access.canViewFinancials === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/financials")
          }
          style={styles.backRow}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
          <Text style={styles.backText}>{t("ownerApp.financials.back")}</Text>
        </Pressable>
        <View style={styles.deniedBox}>
          <MaterialIcons name="lock" size={48} color={colors.text.secondary} />
          <Text style={styles.deniedTitle}>
            {t("ownerApp.financials.noPermission")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currency =
    (report && !("invalidRange" in report && report.invalidRange)
      ? report.currency
      : null) ??
    dashboard.currency ??
    "INR";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/financials")
          }
          style={styles.backRow}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
          <Text style={styles.backText}>{t("ownerApp.financials.title")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("ownerApp.financials.gstReport")}</Text>
        <Text style={styles.sub}>{t("ownerApp.financials.gstReportSub")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.disclaimerBox} accessibilityRole="text">
          <MaterialIcons
            name="info-outline"
            size={20}
            color={colors.accent.amber}
            style={styles.disclaimerIcon}
          />
          <View style={styles.disclaimerTextWrap}>
            <Text style={styles.disclaimerTitle}>{t("ownerApp.financials.gstDisclaimerTitle")}</Text>
            <Text style={styles.disclaimerBody}>{t("ownerApp.financials.gstDisclaimerBody")}</Text>
          </View>
        </View>

        <FinancialDateRangeBar
          clubTimezone={clubTimezone}
          todayYmd={dashboard.todayYmd}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          tzAbbr={tzAbbr}
        />

        {settings && !settings.configured ? (
          <Pressable
            style={styles.settingsHint}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <MaterialIcons name="settings" size={20} color={colors.accent.green} />
            <Text style={styles.settingsHintText}>
              {t("ownerApp.financials.gstConfigureHint")}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.text.secondary} />
          </Pressable>
        ) : null}

        {report === undefined ? (
          <ActivityIndicator color={colors.accent.green} style={styles.loader} />
        ) : report.invalidRange ? (
          <Text style={styles.errText}>{t("ownerApp.financials.gstInvalidRange")}</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t("ownerApp.financials.gstPeriodSummary")}</Text>
            <View style={styles.card}>
              <Row
                label={t("ownerApp.financials.gstPeriod")}
                value={`${report.dateFrom} → ${report.dateTo}`}
              />
              <Row label={t("ownerApp.financials.gstSessionsRealised")} value={String(report.sessionCount)} />
              {report.gstin ? <Row label={t("ownerApp.financials.gstin")} value={report.gstin} /> : null}
            </View>

            {!report.gstRegistered ? (
              <View style={styles.card}>
                <Text style={styles.mutedNote}>
                  {t("ownerApp.financials.gstNotRegisteredNote")}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>{t("ownerApp.financials.gstTaxableRevenue")}</Text>
                <View style={styles.card}>
                  <Row
                    label={t("ownerApp.financials.gstTableTimeAfterDiscounts")}
                    value={formatMoney(report.taxableTableRevenue, currency)}
                  />
                  <Row
                    label={t("ownerApp.financials.snacks")}
                    value={formatMoney(report.taxableSnackRevenue, currency)}
                  />
                  <Row
                    label={t("ownerApp.financials.gstTotalTaxable")}
                    value={formatMoney(
                      report.taxableTableRevenue + report.taxableSnackRevenue,
                      currency,
                    )}
                    bold
                  />
                </View>

                <Text style={styles.sectionTitle}>{t("ownerApp.financials.gstOutputEstimate")}</Text>
                <View style={styles.card}>
                  <Row
                    label={t("ownerApp.financials.gstOnTableTime")}
                    value={formatMoney(report.outputGstOnTable, currency)}
                  />
                  <Row
                    label={t("ownerApp.financials.gstOnSnacks")}
                    value={formatMoney(report.outputGstOnSnacks, currency)}
                  />
                  <Row
                    label={t("ownerApp.financials.gstTotalOutput")}
                    value={formatMoney(report.totalOutputGst, currency)}
                    bold
                  />
                  {report.cgst > 0 ? (
                    <Row label={t("ownerApp.financials.cgst")} value={formatMoney(report.cgst, currency)} />
                  ) : null}
                  {report.sgst > 0 ? (
                    <Row label={t("ownerApp.financials.sgst")} value={formatMoney(report.sgst, currency)} />
                  ) : null}
                  {report.igst > 0 ? (
                    <Row label={t("ownerApp.financials.igst")} value={formatMoney(report.igst, currency)} />
                  ) : null}
                </View>

                <Text style={styles.sectionTitle}>{t("ownerApp.financials.gstNetPayableEstimate")}</Text>
                <View style={styles.card}>
                  <Row
                    label={t("ownerApp.financials.gstInputTaxCredit", { days: report.periodDays })}
                    value={formatMoney(report.inputTaxCreditEstimate, currency)}
                  />
                  <Row
                    label={t("ownerApp.financials.gstNetPayable")}
                    value={formatMoney(report.netGstPayableEstimate, currency)}
                    bold
                    accent
                  />
                </View>
              </>
            )}

            <Text style={styles.footnote}>
              {t("ownerApp.financials.gstFootnote")}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          bold && styles.rowBold,
          accent && { color: colors.accent.green },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function GstReportScreen(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("ownerApp.financials.gstReport")}>
      <GstReportContent />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing[6], paddingBottom: spacing[2] },
  backRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[2] },
  backText: { ...typography.label, color: colors.text.primary },
  title: { ...typography.heading3, color: colors.text.primary },
  sub: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 4 },
  scroll: { paddingHorizontal: spacing[6], paddingBottom: spacing[16] },
  disclaimerBox: {
    flexDirection: "row",
    backgroundColor: "rgba(245, 127, 23, 0.12)",
    borderWidth: 1,
    borderColor: colors.accent.amber,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  disclaimerIcon: { marginRight: spacing[2], marginTop: 2 },
  disclaimerTextWrap: { flex: 1 },
  disclaimerTitle: {
    ...typography.label,
    color: colors.accent.amberLight,
    fontWeight: "700",
    marginBottom: spacing[1],
  },
  disclaimerBody: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  settingsHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    marginBottom: spacing[4],
  },
  settingsHintText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
  },
  loader: { marginTop: spacing[6] },
  errText: { color: colors.status.error },
  sectionTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[3],
    marginTop: spacing[2],
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    gap: spacing[3],
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  rowLabel: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
  rowValue: { ...typography.label, color: colors.text.primary },
  rowBold: { fontWeight: "700", color: colors.text.primary },
  mutedNote: { ...typography.bodySmall, color: colors.text.secondary, lineHeight: 20 },
  footnote: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing[2],
    lineHeight: 18,
  },
  deniedBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6] },
  deniedTitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[4],
  },
});
