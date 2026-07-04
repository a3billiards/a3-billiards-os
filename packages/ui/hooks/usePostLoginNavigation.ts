import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useConvexAuth } from "convex/react";

/**
 * Wait for Convex Auth JWT propagation before navigating after signIn().
 * Avoids post-login-gate seeing !isAuthenticated and bouncing back to /login.
 */
export function usePostLoginNavigation(route = "/post-login-gate") {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const pendingRef = useRef(false);
  const [waiting, setWaiting] = useState(false);

  const schedulePostLogin = useCallback(() => {
    pendingRef.current = true;
    setWaiting(true);
  }, []);

  useEffect(() => {
    if (!pendingRef.current || isLoading || !isAuthenticated) return;
    pendingRef.current = false;
    setWaiting(false);
    router.replace(route as "/post-login-gate");
  }, [isAuthenticated, isLoading, router, route]);

  return {
    schedulePostLogin,
    isWaitingForAuth: waiting && (isLoading || !isAuthenticated),
  };
}
