/**
 * Billing (PRD + TDD):
 *   ratePerMin is LOCKED at session start (sessions.ratePerMin). Never re-read from club.
 *   minBillAmount = minBillMinutes × ratePerMin
 *   tablePreDiscount = max(actualMinutes × ratePerMin, minBillAmount)
 *   discountAmount = tablePreDiscount × (discount% / 100)  [table only; snacks never discounted]
 *   tableAfterDiscount = tablePreDiscount − discountAmount
 *   snackTotal = Σ(priceAtOrder × qty)
 *   subtotalBeforeTax = tableAfterDiscount + snackTotal
 *   taxAmount = subtotalBeforeTax × (taxPercent / 100)  if taxPercent > 0
 *   FINAL_BILL = subtotalBeforeTax + taxAmount
 *
 * Legacy helper `computeBill` matches TDD schema comment (no tax field on club yet → taxPercent 0).
 */
 
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
   
  /** Format currency for display: formatCurrency(150.5, "INR") → "₹150.50" */
  export function formatCurrency(amount: number, currency = "INR"): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
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