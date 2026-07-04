import { useEffect, useState } from "react";

const DEFAULT_GRACE_MS = 2500;

/**
 * When authenticated but getCurrentUser is still null (JWT propagation race),
 * wait before treating the user as logged out.
 */
export function useAuthUserSettled(
  isAuthenticated: boolean,
  user: unknown | null | undefined,
  graceMs = DEFAULT_GRACE_MS,
): boolean {
  const [nullExpired, setNullExpired] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setNullExpired(false);
      return;
    }
    if (user === undefined) {
      setNullExpired(false);
      return;
    }
    if (user !== null) {
      setNullExpired(false);
      return;
    }
    const timer = setTimeout(() => setNullExpired(true), graceMs);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, graceMs]);

  return nullExpired;
}
