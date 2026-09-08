/**
 * GST report estimates (PRD v27 / v31) — bookkeeping convenience only, not statutory filing.
 * Applies configured GST rates to taxable line items derived from session billing (TDD §4.5).
 */

export type GstSupplyType = "intrastate" | "interstate";

export type GstSettingsInput = {
  gstRegistered: boolean;
  supplyType: GstSupplyType;
  tableTimeGstPercent: number;
  snacksGstPercent: number;
  /** Owner-entered monthly eligible ITC estimate; prorated by report period length. */
  monthlyInputTaxCredit?: number;
};

export type GstRevenueAggregate = {
  taxableTableRevenue: number;
  taxableSnackRevenue: number;
  sessionCount: number;
};

export type GstReportBreakdown = GstRevenueAggregate & {
  gstRegistered: boolean;
  outputGstOnTable: number;
  outputGstOnSnacks: number;
  totalOutputGst: number;
  cgst: number;
  sgst: number;
  igst: number;
  inputTaxCreditEstimate: number;
  netGstPayableEstimate: number;
};

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Prorate a monthly amount across `periodDays` (30-day month basis). */
export function prorateMonthlyAmount(monthly: number, periodDays: number): number {
  if (periodDays <= 0 || monthly <= 0) return 0;
  return r2(monthly * (periodDays / 30));
}

export function computeGstReport(
  aggregate: GstRevenueAggregate,
  settings: GstSettingsInput,
  periodDays: number,
): GstReportBreakdown {
  const base = {
    ...aggregate,
    gstRegistered: settings.gstRegistered,
    outputGstOnTable: 0,
    outputGstOnSnacks: 0,
    totalOutputGst: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    inputTaxCreditEstimate: 0,
    netGstPayableEstimate: 0,
  };

  if (!settings.gstRegistered) {
    return base;
  }

  const tableRate = clampPercent(settings.tableTimeGstPercent);
  const snackRate = clampPercent(settings.snacksGstPercent);

  const outputGstOnTable = r2(
    aggregate.taxableTableRevenue * (tableRate / 100),
  );
  const outputGstOnSnacks = r2(
    aggregate.taxableSnackRevenue * (snackRate / 100),
  );
  const totalOutputGst = r2(outputGstOnTable + outputGstOnSnacks);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (settings.supplyType === "intrastate") {
    cgst = r2(totalOutputGst / 2);
    sgst = r2(totalOutputGst - cgst);
  } else {
    igst = totalOutputGst;
  }

  const inputTaxCreditEstimate = prorateMonthlyAmount(
    settings.monthlyInputTaxCredit ?? 0,
    periodDays,
  );
  const netGstPayableEstimate = r2(
    Math.max(0, totalOutputGst - inputTaxCreditEstimate),
  );

  return {
    ...base,
    outputGstOnTable,
    outputGstOnSnacks,
    totalOutputGst,
    cgst,
    sgst,
    igst,
    inputTaxCreditEstimate,
    netGstPayableEstimate,
  };
}
