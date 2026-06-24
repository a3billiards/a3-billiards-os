/**
 * Free-visit billing (PRD §7.11): table charge waived up to cap; snacks always billed.
 */

import { computeBill, type BillBreakdown, type BillInput } from "./billing";

export type FreeVisitBillInput = BillInput & {
  freeVisitMaxMinutes: number;
};

export type FreeVisitBillBreakdown = BillBreakdown & {
  overageMinutes: number;
  coveredMinutes: number;
};

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Applies free-visit cap to table charge only. Discount must be 0 (enforced by caller).
 */
export function computeFreeVisitBill(input: FreeVisitBillInput): FreeVisitBillBreakdown {
  const base = computeBill({ ...input, discount: 0 });
  const coveredMinutes = Math.min(base.billableMinutes, input.freeVisitMaxMinutes);
  const overageMinutes = Math.max(0, base.billableMinutes - input.freeVisitMaxMinutes);
  const overageTableSubtotal = r2(overageMinutes * input.ratePerMin);
  const finalBill = r2(overageTableSubtotal + base.snackTotal);

  return {
    ...base,
    tableSubtotal: overageTableSubtotal,
    discountAmount: 0,
    discountedTable: overageTableSubtotal,
    finalBill,
    overageMinutes,
    coveredMinutes,
  };
}
