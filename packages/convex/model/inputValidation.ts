/**
 * Centralized server-side input validation & sanitization (OWASP input validation).
 *
 * Convex `v.object()` args already reject unexpected fields at the transport layer.
 * These helpers add whitelist format checks, type/range checks, length limits, and
 * stripping of dangerous control characters before values are stored or echoed.
 */

/** Strip ASCII control chars (except tab/newline which we normalize away first). */
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

export const MAX_NAME_LEN = 100;
export const MAX_GUEST_NAME_LEN = 80;
export const MAX_DESCRIPTION_LEN = 500;
export const MAX_ADDRESS_LEN = 500;
export const MAX_SNACK_NAME_LEN = 80;
export const MAX_ROLE_NAME_LEN = 60;
export const MAX_BOOKING_NOTES_LEN = 200;
export const MAX_SEARCH_LEN = 100;
export const MAX_SUPPORT_SUBJECT_LEN = 120;
export const MAX_SUPPORT_MESSAGE_LEN = 2000;
export const MAX_BROADCAST_TITLE_LEN = 100;
export const MAX_BROADCAST_BODY_LEN = 500;
export const MAX_TABLE_TYPE_LEN = 40;
export const MAX_FCM_TOKEN_LEN = 512;
export const MIN_FCM_TOKEN_LEN = 10;
export const MAX_LOCK_TOKEN_LEN = 128;
export const MIN_LOCK_TOKEN_LEN = 8;

export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

/** Collapse internal whitespace and trim ends (display names, labels, search). */
export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function assertNoControlChars(label: string, value: string): void {
  if (CONTROL_CHARS.test(value)) {
    throw new Error(`DATA_002: ${label} contains invalid characters`);
  }
}

/**
 * Trim (and optionally collapse whitespace), reject control chars, enforce length.
 * Returns the sanitized string for persistence.
 */
export function assertTrimmedLength(
  label: string,
  value: string,
  min: number,
  max: number,
  opts?: { normalizeWs?: boolean },
): string {
  const t = opts?.normalizeWs ? normalizeWhitespace(value) : value.trim();
  assertNoControlChars(label, t);
  if (t.length < min || t.length > max) {
    throw new Error(`DATA_002: ${label} must be ${min}–${max} characters`);
  }
  return t;
}

/** Optional free-text: empty/whitespace → undefined; otherwise trim + max length. */
export function assertOptionalTrimmedLength(
  value: string | undefined,
  max: number,
  label = "Field",
): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  if (t.length === 0) return undefined;
  assertNoControlChars(label, t);
  if (t.length > max) {
    throw new Error(`DATA_002: ${label} must be at most ${max} characters`);
  }
  return t;
}

/** RFC-style sanity check (not full RFC 5322 parser). Max 254 chars per common practice. */
export function assertEmailNormalized(email: string): string {
  const normalized = email.trim().toLowerCase();
  assertNoControlChars("Email", normalized);
  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error("DATA_001: Invalid email address");
  }
  return normalized;
}

export function assertAgeYears(
  age: number,
  min = 18,
  max = 120,
): number {
  if (!Number.isInteger(age) || age < min || age > max) {
    throw new Error(`AUTH_007: Age must be between ${min} and ${max}`);
  }
  return age;
}

export function assertFiniteInRange(
  label: string,
  value: number,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    !Number.isFinite(value) ||
    (integer && !Number.isInteger(value)) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `DATA_002: ${label} must be${integer ? " an integer" : ""} between ${min} and ${max}`,
    );
  }
  return value;
}

/** Calendar date in club timezone (YYYY-MM-DD). */
export function assertIsoDateYmd(date: string, label = "Date"): string {
  const t = date.trim();
  assertNoControlChars(label, t);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    throw new Error(`DATA_002: ${label} must be YYYY-MM-DD`);
  }
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`DATA_002: ${label} is not a valid calendar date`);
  }
  return t;
}

/** Wall-clock time HH:MM (24h). */
export function assertHhmmTime(time: string, label = "Time"): string {
  const t = time.trim();
  assertNoControlChars(label, t);
  if (!/^\d{2}:\d{2}$/.test(t)) {
    throw new Error(`DATA_002: ${label} must be HH:MM`);
  }
  const [h, m] = t.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`DATA_002: ${label} is out of range`);
  }
  return t;
}

export function assertIsoCurrency(code: string): string {
  const cur = code.trim().toUpperCase();
  assertNoControlChars("Currency", cur);
  if (!/^[A-Z]{3}$/.test(cur)) {
    throw new Error("DATA_001: Currency must be a 3-letter ISO code");
  }
  return cur;
}

export function assertSearchText(
  text: string | undefined,
  max = MAX_SEARCH_LEN,
): string | undefined {
  if (text === undefined) return undefined;
  const t = normalizeWhitespace(text);
  if (t.length === 0) return undefined;
  assertNoControlChars("Search", t);
  if (t.length > max) {
    throw new Error(`DATA_002: Search must be at most ${max} characters`);
  }
  return t;
}

/** FCM / Expo push token — length + no control chars (format varies by provider). */
export function assertDevicePushToken(token: string): string {
  const t = token.trim();
  assertNoControlChars("Device token", t);
  if (t.length < MIN_FCM_TOKEN_LEN || t.length > MAX_FCM_TOKEN_LEN) {
    throw new Error("DATA_002: Invalid device token");
  }
  return t;
}

/** Table type label from booking UI (lowercased for matching). */
export function assertTableTypeLabel(raw: string): string {
  const t = raw.trim().toLowerCase();
  assertNoControlChars("Table type", t);
  if (t.length < 1 || t.length > MAX_TABLE_TYPE_LEN) {
    throw new Error("DATA_002: Invalid table type");
  }
  return t;
}

export function assertGuestDisplayName(name: string | undefined): string {
  const trimmed = assertTrimmedLength(
    "Guest name",
    name ?? "Walk-in",
    1,
    MAX_GUEST_NAME_LEN,
    { normalizeWs: true },
  );
  return trimmed || "Walk-in";
}

/** Server-issued table lock token echoed back by the owner app. */
export function assertLockToken(token: string): string {
  const t = token.trim();
  assertNoControlChars("Lock token", t);
  if (t.length < MIN_LOCK_TOKEN_LEN || t.length > MAX_LOCK_TOKEN_LEN) {
    throw new Error("DATA_002: Invalid table lock token");
  }
  return t;
}

export function assertPlayerDisplayName(name: string): string {
  return assertTrimmedLength("Player name", name, 1, MAX_NAME_LEN, {
    normalizeWs: true,
  });
}

export function assertPlayerKey(key: string): string {
  return assertTrimmedLength("Player key", key, 1, 64);
}
