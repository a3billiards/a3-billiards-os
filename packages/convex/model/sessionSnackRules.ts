/**
 * Snack cutoff (PRD / TDD):
 * - Cannot add after session paid or cancelled.
 * - Credit sessions: editable until credit is resolved (creditResolvedAt set).
 */

import type { Doc } from "../_generated/dataModel";

export function canAddSnacksToSession(session: Doc<"sessions">): boolean {
  if (session.status === "cancelled") return false;
  if (session.status === "active") {
    if (session.paymentStatus === "paid") return false;
    if (
      session.paymentStatus === "credit" &&
      session.creditResolvedAt !== undefined
    ) {
      return false;
    }
    return true;
  }
  if (session.status === "completed") {
    if (
      session.paymentStatus === "credit" &&
      session.creditResolvedAt === undefined
    ) {
      return true;
    }
    return false;
  }
  return false;
}
