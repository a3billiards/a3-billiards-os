/** 6-digit OTP client-side helpers. TDD §OTP / Phone verification */
 
export const OTP_LENGTH       = 6;
export const OTP_COOLDOWN_MS  = 60_000;  // 60 seconds between resend attempts
 
/** Returns true if exactly 6 numeric digits */
export function isValidOtpFormat(value: string): boolean {
  return /^\d{6}$/.test(value);
}
 
/** Strip non-numeric chars, cap at 6 digits — call on every keystroke */
export function sanitizeOtpInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}
 
/** Remaining cooldown in seconds. Returns 0 when done. */
export function otpCooldownRemaining(sentAt: number): number {
  const remaining = OTP_COOLDOWN_MS - (Date.now() - sentAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
 
/** Format E.164 phone for display: "+919876543210" → "+91 98765 43210" */
export function formatPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }
  return e164;
}
 
/** Validate Indian mobile number (10 digits, starts 6–9, or +91 prefix) */
export function isValidIndianPhone(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length === 10) return /^[6-9]\d{9}$/.test(d);
  if (d.length === 12 && d.startsWith("91")) return /^[6-9]\d{9}$/.test(d.slice(2));
  return false;
}
 
/** Convert local Indian number to E.164: "9876543210" → "+919876543210" */
export function toE164India(local: string): string {
  const d = local.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  throw new Error("DATA_002: Invalid Indian phone number");
}