import React, { useMemo } from "react";
import { View, Text, StyleSheet, I18nManager } from "react-native";
import { colors, typography, spacing } from "@a3/ui/theme";
import { formatCurrency } from "@a3/utils/billing";
import type { TFunction } from "i18next";

export type CheckoutSnackLine = {
  name: string;
  qty: number;
  priceAtOrder: number;
  lineTotal: number;
  fulfillmentType: "counter" | "kitchen";
};

export type CheckoutBillPreview = {
  currency: string;
  billableMinutes: number;
  actualMinutes: number;
  ratePerMin: number;
  tableSubtotal: number;
  discountedTable: number;
  discountAmount: number;
  discountPercent: number;
  snackTotal: number;
  counterSnackTotal: number;
  kitchenSnackTotal: number;
  finalBill: number;
  snackLineItems: CheckoutSnackLine[];
};

type CheckoutBillBreakdownProps = {
  preview: CheckoutBillPreview;
  t: TFunction;
};

function BillRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          bold && styles.rowLabelBold,
          muted && styles.rowLabelMuted,
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          bold && styles.rowValueBold,
          muted && styles.rowValueMuted,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ItemSection({
  title,
  items,
  subtotal,
  currency,
  t,
}: {
  title: string;
  items: CheckoutSnackLine[];
  subtotal: number;
  currency: string;
  t: TFunction;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <BillRow
          key={`${item.name}-${index}`}
          label={t("ownerApp.slots.checkoutItemLine", {
            name: item.name,
            qty: item.qty,
          })}
          value={formatCurrency(item.lineTotal, currency)}
        />
      ))}
      {items.length > 1 ? (
        <BillRow
          label={t("ownerApp.slots.checkoutSectionSubtotal")}
          value={formatCurrency(subtotal, currency)}
          muted
        />
      ) : null}
    </View>
  );
}

export function CheckoutBillBreakdown({
  preview,
  t,
}: CheckoutBillBreakdownProps): React.JSX.Element {
  const { currency } = preview;
  const counterItems = useMemo(
    () => preview.snackLineItems.filter((line) => line.fulfillmentType === "counter"),
    [preview.snackLineItems],
  );
  const kitchenItems = useMemo(
    () => preview.snackLineItems.filter((line) => line.fulfillmentType === "kitchen"),
    [preview.snackLineItems],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.breakdownTitle}>{t("ownerApp.slots.billBreakdown")}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("ownerApp.slots.checkoutTableTime")}</Text>
        <BillRow
          label={t("ownerApp.slots.checkoutTableRate", {
            minutes: preview.billableMinutes,
            rate: formatCurrency(preview.ratePerMin, currency),
          })}
          value={formatCurrency(preview.tableSubtotal, currency)}
        />
        <Text style={styles.sectionHint}>
          {t("ownerApp.slots.minBillable", {
            billable: preview.billableMinutes,
            played: preview.actualMinutes,
          })}
        </Text>
        {preview.discountAmount > 0 ? (
          <BillRow
            label={t("ownerApp.slots.checkoutDiscount", {
              percent: preview.discountPercent,
            })}
            value={`−${formatCurrency(preview.discountAmount, currency)}`}
            muted
          />
        ) : null}
        <BillRow
          label={t("ownerApp.slots.checkoutTableTotal")}
          value={formatCurrency(preview.discountedTable, currency)}
        />
      </View>

      <ItemSection
        title={t("ownerApp.slots.checkoutCounterSnacks")}
        items={counterItems}
        subtotal={preview.counterSnackTotal}
        currency={currency}
        t={t}
      />

      <ItemSection
        title={t("ownerApp.slots.checkoutKitchenItems")}
        items={kitchenItems}
        subtotal={preview.kitchenSnackTotal}
        currency={currency}
        t={t}
      />

      {preview.snackTotal > 0 &&
      counterItems.length === 0 &&
      kitchenItems.length === 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("ownerApp.slots.snacksCharge")}</Text>
          <BillRow
            label={t("ownerApp.slots.checkoutSectionSubtotal")}
            value={formatCurrency(preview.snackTotal, currency)}
          />
        </View>
      ) : null}

      <View style={styles.divider} />
      <BillRow
        label={t("ownerApp.slots.totalDue")}
        value={formatCurrency(preview.finalBill, currency)}
        bold
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  breakdownTitle: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  section: {
    marginBottom: spacing[3],
    gap: spacing[1],
  },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    marginBottom: spacing[0.5],
  },
  sectionHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing[1],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
  },
  rowLabelBold: {
    ...typography.label,
    color: colors.text.primary,
  },
  rowLabelMuted: {
    color: colors.text.secondary,
  },
  rowValue: {
    ...typography.bodySmall,
    color: colors.text.primary,
    textAlign: I18nManager.isRTL ? "left" : "right",
  },
  rowValueBold: {
    ...typography.label,
    color: colors.accent.green,
  },
  rowValueMuted: {
    color: colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginBottom: spacing[2],
  },
});
