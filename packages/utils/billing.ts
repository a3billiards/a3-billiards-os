/**
 * Billing (PRD + TDD §4.5) — v1 customer breakdown has **no tax** (no `taxPercent` on schema).
 *
 * Table time:
 *   actualMinutes   = ceil((endTime - startTime) / 60000)
 *   billableMinutes = max(actualMinutes, minBillMinutes)  [or locked `session.billableMinutes` when set at checkout]
 *   tableSubtotal   = billableMinutes × ratePerMin
 *   discountAmount  = tableSubtotal × (discount% / 100)  (table only)
 *   discountedTable = tableSubtotal − discountAmount
 * Snacks: never discounted — snackTotal = Σ(priceAtOrder × qty)
 * FINAL_BILL = discountedTable + snackTotal
 *
 * `computeBill` / `computeBillExtended` retain optional tax for future schema; customer UI uses `computeBillBreakdown`.
 */

import {
  dayOfWeekInTimeZone,
  hhmmToMinutes,
  minutesFromMidnightInTimeZone,
} from "./timezone";
 
export interface SnackOrder {
    snackId: string; name: string; qty: number; priceAtOrder: number;
  }
   
  export interface BillInput {
    startTime: number;       // Unix ms
    endTime: number;         // Unix ms
    ratePerMin: number;      // locked at session start
    minBillMinutes: number;  // locked at session start
    snackOrders: SnackOrder[];
    discount?: number;       // 0–100 percent, table only
  }
   
  export interface BillBreakdown {
    actualMinutes: number;
    billableMinutes: number;
    tableSubtotal: number;
    discountAmount: number;
    discountedTable: number;
    snackTotal: number;
    taxAmount: number;
    finalBill: number;
  }

  export interface BillInputExtended extends BillInput {
    /** If > 0, applied to (discounted table + snacks). */
    taxPercent?: number;
  }

  /** Full PRD formula including optional tax (pass taxPercent from club when schema adds it). */
  export function computeBillExtended(input: BillInputExtended): BillBreakdown {
    const {
      startTime,
      endTime,
      ratePerMin,
      minBillMinutes,
      snackOrders,
      discount = 0,
      taxPercent = 0,
    } = input;
    if (endTime <= startTime) {
      throw new Error("SESSION_006: endTime must be after startTime");
    }
    if (discount < 0 || discount > 100) {
      throw new Error("DATA_002: discount must be 0–100");
    }
    if (taxPercent < 0 || taxPercent > 100) {
      throw new Error("DATA_002: taxPercent must be 0–100");
    }

    const actualMinutes = Math.ceil((endTime - startTime) / 60_000);
    const billableMinutes = Math.max(actualMinutes, minBillMinutes);
    const minBillAmount = minBillMinutes * ratePerMin;
    const rawTable = actualMinutes * ratePerMin;
    const tablePreDiscount = Math.max(rawTable, minBillAmount);
    const discountAmount = tablePreDiscount * (discount / 100);
    const discountedTable = tablePreDiscount - discountAmount;
    const snackTotal = snackOrders.reduce(
      (sum, i) => sum + i.priceAtOrder * i.qty,
      0,
    );
    const subtotalBeforeTax = discountedTable + snackTotal;
    const taxAmount =
      taxPercent > 0 ? subtotalBeforeTax * (taxPercent / 100) : 0;
    const finalBill = subtotalBeforeTax + taxAmount;

    return {
      actualMinutes,
      billableMinutes,
      tableSubtotal: r2(tablePreDiscount),
      discountAmount: r2(discountAmount),
      discountedTable: r2(discountedTable),
      snackTotal: r2(snackTotal),
      taxAmount: r2(taxAmount),
      finalBill: r2(finalBill),
    };
  }

  export function computeBill(input: BillInput): BillBreakdown {
    return computeBillExtended({ ...input, taxPercent: 0 });
  }
   
  function r2(n: number): number { return Math.round(n * 100) / 100; }

  /**
   * Staff discount cap (PRD): owner unrestricted → no cap (null max).
   * Returns clamped 0–100 percent for checkout mutations.
   */
  export function clampDiscountPercent(
    requestedPercent: number,
    canApplyDiscount: boolean,
    maxDiscountPercent: number | null,
  ): number {
    if (!canApplyDiscount) return 0;
    const r = Math.max(0, Math.min(100, requestedPercent));
    if (maxDiscountPercent === null) return r;
    return Math.min(maxDiscountPercent, r);
  }
   
  /** v1 bill breakdown line items (no tax). */
  export type BillBreakdownV1 = {
    actualMinutes: number;
    billableMinutes: number;
    tableSubtotal: number;
    discountAmount: number;
    discountedTable: number;
    snackTotal: number;
    finalBill: number;
  };

  function snackOrderTotal(
    snackOrders: { qty: number; priceAtOrder: number }[],
  ): number {
    return snackOrders.reduce((sum, i) => sum + i.priceAtOrder * i.qty, 0);
  }

  /**
   * Itemised bill for session history / receipts (TDD §4.5, no tax).
   * When `billableMinutes` and `endTime` are set on a completed session, uses stored billable minutes
   * so line items align with checkout.
   */
  export function computeBillBreakdown(session: {
    startTime: number;
    endTime: number | null;
    /** Active-session estimate: defaults to `Date.now()` when endTime is null. */
    estimateEndMs?: number;
    billableMinutes?: number | null;
    ratePerMin: number;
    minBillMinutes: number;
    discount?: number | null;
    snackOrders: { qty: number; priceAtOrder: number }[];
  }): BillBreakdownV1 {
    const end = session.endTime ?? session.estimateEndMs ?? Date.now();
    const discountPct = session.discount ?? 0;
    if (discountPct < 0 || discountPct > 100) {
      throw new Error("DATA_002: discount must be 0–100");
    }

    if (end <= session.startTime) {
      const billableMinutes = session.minBillMinutes;
      const tableSubtotal = r2(billableMinutes * session.ratePerMin);
      const discountAmount = r2(tableSubtotal * (discountPct / 100));
      const discountedTable = r2(tableSubtotal - discountAmount);
      const snackTotal = r2(snackOrderTotal(session.snackOrders));
      return {
        actualMinutes: 0,
        billableMinutes,
        tableSubtotal,
        discountAmount,
        discountedTable,
        snackTotal,
        finalBill: r2(discountedTable + snackTotal),
      };
    }

    const actualMinutes = Math.ceil((end - session.startTime) / 60_000);
    const computedBillable = Math.max(actualMinutes, session.minBillMinutes);
    const billableMinutes =
      session.billableMinutes != null && session.endTime != null
        ? session.billableMinutes
        : computedBillable;

    const tableSubtotal = r2(billableMinutes * session.ratePerMin);
    const discountAmount = r2(tableSubtotal * (discountPct / 100));
    const discountedTable = r2(tableSubtotal - discountAmount);
    const snackTotal = r2(snackOrderTotal(session.snackOrders));
    const finalBill = r2(discountedTable + snackTotal);

    return {
      actualMinutes,
      billableMinutes,
      tableSubtotal,
      discountAmount,
      discountedTable,
      snackTotal,
      finalBill,
    };
  }

  /** Human-readable duration from elapsed ms, e.g. `5400000` → `"1h 30m"`. */
  export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    const totalMin = Math.max(1, Math.round(ms / 60_000));
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /**
   * Currency display. Known ISO codes via `Intl`; unknown → `"AED 12.50"`.
   * When `currency` is null/empty, shows fixed decimals only (legacy sessionLogs).
   */
  export function formatCurrency(amount: number, currency?: string | null): string {
    const code = (currency ?? "").trim().toUpperCase();
    if (!code) {
      return amount.toFixed(2);
    }
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${code} ${amount.toFixed(2)}`;
    }
  }
   
  /** Format elapsed ms for the session timer: "01:23" or "01:23:45" */
  export function formatElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${String(h).padStart(2,"0")}:${mm}:${ss}` : `${mm}:${ss}`;
  }

function inRateWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

export type RateRule = {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  ratePerMin: number;
};

/** Resolve effective per-minute rate by day + time window (special overrides base). */
export function getApplicableRate(
  nowUtcMs: number,
  specialRates: RateRule[],
  baseRatePerMin: number,
  timeZone: string,
): number {
  const dow = dayOfWeekInTimeZone(nowUtcMs, timeZone);
  const nowMin = minutesFromMidnightInTimeZone(nowUtcMs, timeZone);
  for (const rule of specialRates) {
    if (!rule.daysOfWeek.includes(dow)) continue;
    const startMin = hhmmToMinutes(rule.startTime);
    const endMin = hhmmToMinutes(rule.endTime);
    if (inRateWindow(nowMin, startMin, endMin)) {
      return rule.ratePerMin;
    }
  }
  return baseRatePerMin;
}