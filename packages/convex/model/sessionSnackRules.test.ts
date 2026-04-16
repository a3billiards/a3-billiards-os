import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAddSnacksToSession } from "./sessionSnackRules";

function makeSession(
  overrides: Partial<{
    status: "active" | "completed" | "cancelled";
    paymentStatus: "pending" | "paid" | "credit";
    creditResolvedAt?: number;
  }>,
) {
  return {
    status: "active" as const,
    paymentStatus: "pending" as const,
    creditResolvedAt: undefined,
    ...overrides,
  } as any;
}

describe("session snack cutoff rules", () => {
  it("blocks cancelled sessions", () => {
    assert.equal(
      canAddSnacksToSession(makeSession({ status: "cancelled" })),
      false,
    );
  });

  it("blocks completed paid sessions", () => {
    assert.equal(
      canAddSnacksToSession(
        makeSession({ status: "completed", paymentStatus: "paid" }),
      ),
      false,
    );
  });

  it("allows completed credit sessions while unresolved", () => {
    assert.equal(
      canAddSnacksToSession(
        makeSession({
          status: "completed",
          paymentStatus: "credit",
          creditResolvedAt: undefined,
        }),
      ),
      true,
    );
  });

  it("allows active pending sessions", () => {
    assert.equal(canAddSnacksToSession(makeSession({})), true);
  });
});
