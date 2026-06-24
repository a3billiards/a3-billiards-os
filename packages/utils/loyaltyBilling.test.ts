import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeFreeVisitBill } from "./loyaltyBilling";
import { computeBill } from "./billing";

describe("free-visit billing", () => {
  const base = {
    startTime: 0,
    endTime: 90 * 60_000,
    ratePerMin: 10,
    minBillMinutes: 30,
    snackOrders: [{ snackId: "a", name: "Coke", qty: 1, priceAtOrder: 50 }],
  };

  it("waives table charge within cap and still bills snacks", () => {
    const result = computeFreeVisitBill({
      ...base,
      freeVisitMaxMinutes: 120,
    });
    assert.equal(result.billableMinutes, 90);
    assert.equal(result.coveredMinutes, 90);
    assert.equal(result.overageMinutes, 0);
    assert.equal(result.discountedTable, 0);
    assert.equal(result.snackTotal, 50);
    assert.equal(result.finalBill, 50);
  });

  it("bills overage minutes at normal rate", () => {
    const result = computeFreeVisitBill({
      ...base,
      endTime: 150 * 60_000,
      freeVisitMaxMinutes: 60,
    });
    assert.equal(result.billableMinutes, 150);
    assert.equal(result.overageMinutes, 90);
    assert.equal(result.discountedTable, 900);
    assert.equal(result.finalBill, 950);
  });

  it("matches normal billing when not free visit (regression)", () => {
    const normal = computeBill({ ...base, discount: 0 });
    const free = computeFreeVisitBill({
      ...base,
      freeVisitMaxMinutes: 0,
    });
    assert.equal(free.finalBill, normal.finalBill);
    assert.equal(free.overageMinutes, normal.billableMinutes);
  });
});
