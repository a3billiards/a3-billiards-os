import {
  getStrongPasswordError,
  STRONG_PASSWORD_HINT,
} from "@a3/utils/passwordPolicy";

export { STRONG_PASSWORD_HINT };

export function assertStrongPasswordOrThrow(password: string): void {
  const message = getStrongPasswordError(password);
  if (message) {
    throw new Error(`DATA_002: ${message}`);
  }
}
