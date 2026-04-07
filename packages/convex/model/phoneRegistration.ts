import type { Doc } from "../_generated/dataModel";

/** India mobile E.164: +91 plus exactly 10 digits (e.g. +919876543210). */
const INDIA_E164 = /^\+91\d{10}$/;

/**
 * Normalizes whitespace and validates +91XXXXXXXXXX.
 * @throws OTP_005 when empty or not matching E.164.
 */
export function parseIndiaE164OrThrow(raw: string): string {
  const phone = raw.trim();
  if (phone.length === 0) {
    throw new Error("OTP_005: Phone is required");
  }
  if (!INDIA_E164.test(phone)) {
    throw new Error(
      "OTP_005: Invalid E.164 format — use +91 followed by 10 digits",
    );
  }
  return phone;
}

/**
 * Phone duplicate rules for new accounts or changing phone to one held by another user:
 * - Owner → OTP_006
 * - Any account with deletionRequestedAt → OTP_006
 * - Otherwise (active customer / admin / etc.) → OTP_007
 */
export function throwIfPhoneUnavailableForNewAccount(
  existing: Doc<"users"> | null,
): void {
  if (existing === null) return;

  if (existing.role === "owner") {
    throw new Error(
      "OTP_006: This phone number is registered to a club owner account. Please use a different number or contact support.",
    );
  }

  if (existing.deletionRequestedAt !== undefined) {
    throw new Error(
      "OTP_006: This phone is tied to an account pending deletion. Please use a different number or contact support.",
    );
  }

  throw new Error("OTP_007: Phone already registered");
}
