import {
  SUBSCRIPTION_SAC_CODE,
  subscriptionGstFromTaxable,
  type GstSplitMode,
  type SubscriptionGstBreakdown,
} from "@a3/utils/subscriptionInvoiceGst";

export function platformGstRatePercent(): number {
  const raw = Number(process.env.A3_SUBSCRIPTION_GST_RATE ?? "18");
  return Number.isFinite(raw) && raw > 0 ? raw : 18;
}

export function platformGstSplitMode(): GstSplitMode {
  const raw = (process.env.A3_PLATFORM_GST_SPLIT ?? "cgst_sgst").toLowerCase();
  return raw === "igst" ? "igst" : "cgst_sgst";
}

export function platformGstin(): string | null {
  const value = process.env.A3_PLATFORM_GSTIN?.trim();
  return value && value.length > 0 ? value.toUpperCase() : null;
}

export function platformLegalName(): string {
  return process.env.A3_PLATFORM_LEGAL_NAME?.trim() || "A3 Billiards OS";
}

export function getPlatformInvoiceConfig() {
  return {
    legalName: platformLegalName(),
    gstin: platformGstin(),
    gstRatePercent: platformGstRatePercent(),
    gstSplitMode: platformGstSplitMode(),
    sacCode: SUBSCRIPTION_SAC_CODE,
  };
}

/** Plan list prices are taxable (ex-GST); returns breakdown with total payable. */
export function gstBreakdownForTaxableAmount(
  taxablePaise: number,
): SubscriptionGstBreakdown {
  return subscriptionGstFromTaxable(
    taxablePaise,
    platformGstRatePercent(),
    platformGstSplitMode(),
  );
}
