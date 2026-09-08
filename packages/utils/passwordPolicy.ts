export const STRONG_PASSWORD_MIN_LENGTH = 8;

export const STRONG_PASSWORD_HINT =
  "At least 8 characters with uppercase, lowercase, a number, and a special character.";

/** Returns a user-facing error message, or null if the password is strong enough. */
export function getStrongPasswordError(password: string): string | null {
  if (password.length < STRONG_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${STRONG_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }
  return null;
}

export function isStrongPassword(password: string): boolean {
  return getStrongPasswordError(password) === null;
}

export type PasswordStrength = "none" | "weak" | "good" | "strong";

function countCriteria(password: string): number {
  let count = 0;
  if (password.length >= STRONG_PASSWORD_MIN_LENGTH) count++;
  if (/[A-Z]/.test(password)) count++;
  if (/[a-z]/.test(password)) count++;
  if (/[0-9]/.test(password)) count++;
  if (/[^A-Za-z0-9]/.test(password)) count++;
  return count;
}

/**
 * Returns a strength label for a password.
 * "none"   — empty
 * "weak"   — 1-2 criteria met
 * "good"   — 3-4 criteria met
 * "strong" — all 5 criteria met
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "none";
  const count = countCriteria(password);
  if (count <= 2) return "weak";
  if (count <= 4) return "good";
  return "strong";
}
