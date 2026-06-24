import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeGstReport, prorateMonthlyAmount } from "./gstReport";

describe("gstReport", () => {
  it("returns zero GST when not registered", () => {
    const r = computeGstReport(
      { taxableTableRevenue: 1000, taxableSnackRevenue: 200, sessionCount: 5 },
      {
        gstRegistered: false,
        supplyType: "intrastate",
        tableTimeGstPercent: 18,
        snacksGstPercent: 5,
      },
      30,
    );
    assert.equal(r.totalOutputGst, 0);
    assert.equal(r.netGstPayableEstimate, 0);
  });

  it("splits intrastate output GST into CGST and SGST", () => {
    const r = computeGstReport(
      { taxableTableRevenue: 1000, taxableSnackRevenue: 0, sessionCount: 1 },
      {
        gstRegistered: true,
        supplyType: "intrastate",
        tableTimeGstPercent: 18,
        snacksGstPercent: 5,
      },
      30,
    );
    assert.equal(r.outputGstOnTable, 180);
    assert.equal(r.cgst, 90);
    assert.equal(r.sgst, 90);
    assert.equal(r.igst, 0);
  });

  it("applies IGST for interstate supply", () => {
    const r = computeGstReport(
      { taxableTableRevenue: 500, taxableSnackRevenue: 100, sessionCount: 2 },
      {
        gstRegistered: true,
        supplyType: "interstate",
        tableTimeGstPercent: 18,
        snacksGstPercent: 5,
      },
      30,
    );
    assert.equal(r.outputGstOnTable, 90);
    assert.equal(r.outputGstOnSnacks, 5);
    assert.equal(r.igst, 95);
    assert.equal(r.cgst, 0);
  });

  it("prorates monthly ITC over period days", () => {
    assert.equal(prorateMonthlyAmount(3000, 15), 1500);
    const r = computeGstReport(
      { taxableTableRevenue: 1000, taxableSnackRevenue: 0, sessionCount: 1 },
      {
        gstRegistered: true,
        supplyType: "intrastate",
        tableTimeGstPercent: 18,
        snacksGstPercent: 5,
        monthlyInputTaxCredit: 3000,
      },
      15,
    );
    assert.equal(r.inputTaxCreditEstimate, 1500);
    assert.equal(r.netGstPayableEstimate, 0);
  });
});
