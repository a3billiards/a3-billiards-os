import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

export function initInstrumentation(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (
    typeof sentryDsn === "string" &&
    sentryDsn.length > 0 &&
    sentryDsn.startsWith("https://")
  ) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
    });
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const posthogHost =
    import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (typeof posthogKey === "string" && posthogKey.length > 0) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      persistence: "localStorage",
    });
  }
}

export function captureEvent(event: string, props?: Record<string, unknown>): void {
  try {
    posthog.capture(event, props);
  } catch {
    /* optional analytics */
  }
}

/** Report to Sentry when DSN is configured (no-op otherwise). */
export function captureException(error: unknown, extras?: Record<string, unknown>): void {
  try {
    Sentry.captureException(error, extras ? { extra: extras } : undefined);
  } catch {
    /* optional */
  }
}
