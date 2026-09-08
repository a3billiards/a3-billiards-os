import { useCallback, useState } from "react";

const DEFAULT_DURATION_MS = 600;

/** Standard pull-to-refresh state for tab screens (Convex live data + brief spinner). */
export function usePullToRefresh(
  onRefreshExtra?: () => void | Promise<void>,
  durationMs = DEFAULT_DURATION_MS,
) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      try {
        await onRefreshExtra?.();
      } finally {
        setTimeout(() => setRefreshing(false), durationMs);
      }
    })();
  }, [onRefreshExtra, durationMs]);

  return { refreshing, onRefresh };
}
