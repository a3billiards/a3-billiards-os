/** SAC for IT / software subscription services (India GST). */
export const SUBSCRIPTION_SAC_CODE = "998314";

export type GstSplitMode = "igst" | "cgst_sgst";

export type SubscriptionGstBreakdown = {
  totalPaise: number;
  taxablePaise: number;
  gstPaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  splitMode: GstSplitMode;
};

/** Compute GST on a taxable (ex-GST) subscription amount; total is what Razorpay charges. */
export function subscriptionGstFromTaxable(
  taxablePaise: number,
  gstRatePercent = 18,
  splitMode: GstSplitMode = "cgst_sgst",
): SubscriptionGstBreakdown {
  if (taxablePaise <= 0) {
    return {
      totalPaise: 0,
      taxablePaise: 0,
      gstPaise: 0,
      gstRatePercent,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      splitMode,
    };
  }
  const gstPaise = Math.round((taxablePaise * gstRatePercent) / 100);
  const totalPaise = taxablePaise + gstPaise;
  if (splitMode === "igst") {
    return {
      totalPaise,
      taxablePaise,
      gstPaise,
      gstRatePercent,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: gstPaise,
      splitMode,
    };
  }
  const cgstPaise = Math.round(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  return {
    totalPaise,
    taxablePaise,
    gstPaise,
    gstRatePercent,
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    splitMode,
  };
}

/** Split a GST-inclusive amount (Razorpay total) into taxable + tax lines. */
export function splitSubscriptionGstInclusive(
  totalPaise: number,
  gstRatePercent = 18,
  splitMode: GstSplitMode = "cgst_sgst",
): SubscriptionGstBreakdown {
  if (totalPaise <= 0) {
    return {
      totalPaise,
      taxablePaise: 0,
      gstPaise: 0,
      gstRatePercent,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      splitMode,
    };
  }
  const taxablePaise = Math.round((totalPaise * 100) / (100 + gstRatePercent));
  const gstPaise = totalPaise - taxablePaise;
  if (splitMode === "igst") {
    return {
      totalPaise,
      taxablePaise,
      gstPaise,
      gstRatePercent,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: gstPaise,
      splitMode,
    };
  }
  const cgstPaise = Math.round(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  return {
    totalPaise,
    taxablePaise,
    gstPaise,
    gstRatePercent,
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    splitMode,
  };
}

export function formatInrFromPaise(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
