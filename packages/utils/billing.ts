/**
 * Billing formula (TDD §Sessions schema):
 *   actualMinutes   = ceil((endTime − startTime) / 60_000)
 *   billableMinutes = max(actualMinutes, minBillMinutes)
 *   tableSubtotal   = billableMinutes × ratePerMin
 *   discountedTable = tableSubtotal × (1 − discount% / 100)
 *   snackTotal      = Σ(priceAtOrder × qty)  [never discounted]
 *   FINAL_BILL      = discountedTable + snackTotal
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
    finalBill: number;
  }
   
  export function computeBill(input: BillInput): BillBreakdown {
    const { startTime, endTime, ratePerMin, minBillMinutes, snackOrders, discount = 0 } = input;
    if (endTime <= startTime) throw new Error("SESSION_006: endTime must be after startTime");
    if (discount < 0 || discount > 100) throw new Error("DATA_002: discount must be 0–100");
   
    const actualMinutes   = Math.ceil((endTime - startTime) / 60_000);
    const billableMinutes = Math.max(actualMinutes, minBillMinutes);
    const tableSubtotal   = billableMinutes * ratePerMin;
    const discountAmount  = tableSubtotal * (discount / 100);
    const discountedTable = tableSubtotal - discountAmount;
    const snackTotal      = snackOrders.reduce((sum, i) => sum + i.priceAtOrder * i.qty, 0);
    const finalBill       = discountedTable + snackTotal;
   
    return {
      actualMinutes, billableMinutes,
      tableSubtotal:   r2(tableSubtotal),
      discountAmount:  r2(discountAmount),
      discountedTable: r2(discountedTable),
      snackTotal:      r2(snackTotal),
      finalBill:       r2(finalBill),
    };
  }
   
  function r2(n: number): number { return Math.round(n * 100) / 100; }
   
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