import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeBill } from "./billing";

describe("billing snack totals", () => {
  it("computes snackTotal from multiple items", () => {
    const result = computeBill({
      startTime: 0,
      endTime: 60 * 60_000,
      ratePerMin: 10,
      minBillMinutes: 30,
      discount: 0,
      snackOrders: [
        { snackId: "a", name: "Coke", qty: 2, priceAtOrder: 50 },
        { snackId: "b", name: "Fries", qty: 1, priceAtOrder: 120 },
        { snackId: "c", name: "Water", qty: 3, priceAtOrder: 20 },
      ],
    });

    assert.equal(result.snackTotal, 280);
  });

  it("does not apply discount to snacks", () => {
    const withSnacks = computeBill({
      startTime: 0,
      endTime: 60 * 60_000,
      ratePerMin: 10,
      minBillMinutes: 30,
      discount: 10,
      snackOrders: [{ snackId: "a", name: "Coke", qty: 2, priceAtOrder: 50 }],
    });
    const withoutSnacks = computeBill({
      startTime: 0,
      endTime: 60 * 60_000,
      ratePerMin: 10,
      minBillMinutes: 30,
      discount: 10,
      snackOrders: [],
    });

    assert.equal(withSnacks.finalBill - withoutSnacks.finalBill, 100);
  });

  it("matches final bill with and without snacks", () => {
    const noSnacks = computeBill({
      startTime: 0,
      endTime: 90 * 60_000,
      ratePerMin: 20,
      minBillMinutes: 30,
      discount: 20,
      snackOrders: [],
    });
    const withSnacks = computeBill({
      startTime: 0,
      endTime: 90 * 60_000,
      ratePerMin: 20,
      minBillMinutes: 30,
      discount: 20,
      snackOrders: [{ snackId: "x", name: "Nachos", qty: 2, priceAtOrder: 150 }],
    });

    assert.equal(noSnacks.finalBill, 1440);
    assert.equal(withSnacks.finalBill, 1740);
  });
});
