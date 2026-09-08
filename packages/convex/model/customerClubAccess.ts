/**
 * Owner ↔ customer relationship checks (IDOR prevention).
 *
 * Desk walk-in and complaint filing intentionally allow platform-wide customer
 * lookup by phone/name/QR (authenticated owner only). After lookup, detailed
 * profile reads use `ownerCanViewCustomer` or complaint redaction rules.
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * True when the customer has prior business with this club (session, booking,
 * or complaint filed by this club). Used to gate full PII on `users.getUser`.
 */
export async function ownerCanViewCustomer(
  ctx: AuthCtx,
  clubId: Id<"clubs">,
  targetUserId: Id<"users">,
): Promise<boolean> {
  const sessionLink = await ctx.db
    .query("sessionLogs")
    .withIndex("by_customer_club", (q) =>
      q.eq("customerId", targetUserId).eq("clubId", clubId),
    )
    .first();
  if (sessionLink) return true;

  const booking = await ctx.db
    .query("bookingLogs")
    .withIndex("by_customer", (q) => q.eq("customerId", targetUserId))
    .filter((q) => q.eq(q.field("clubId"), clubId))
    .first();
  if (booking) return true;

  const complaint = await ctx.db
    .query("complaints")
    .withIndex("by_reportedByClubId", (q) =>
      q.eq("reportedByClubId", clubId),
    )
    .filter((q) => q.eq(q.field("userId"), targetUserId))
    .first();
  return complaint !== null;
}

/** Throws PERM_001 when owner has no club relationship to the customer. */
export async function assertOwnerCanViewCustomer(
  ctx: AuthCtx,
  clubId: Id<"clubs">,
  targetUserId: Id<"users">,
): Promise<void> {
  const ok = await ownerCanViewCustomer(ctx, clubId, targetUserId);
  if (!ok) {
    throw new Error("PERM_001: Cannot access this customer's data");
  }
}
