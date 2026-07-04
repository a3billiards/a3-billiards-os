/**
 * Base URL for Convex HTTP routes (reset password, cancel deletion, webhooks).
 * CONVEX_SITE_URL is injected on some deployments but not listed in the dashboard;
 * derive it from AUTH_URL when missing.
 */
export function convexSiteOrigin(): string {
  const direct = process.env.CONVEX_SITE_URL?.replace(/\/$/, "");
  if (direct) return direct;

  for (const key of ["AUTH_URL", "AUTH_REDIRECT_PROXY_URL"] as const) {
    const raw = process.env[key]?.replace(/\/$/, "");
    if (raw?.endsWith("/api/auth")) {
      return raw.slice(0, -"/api/auth".length);
    }
  }

  return (
    process.env.ONBOARDING_WEB_URL?.replace(/\/$/, "") ??
    "https://a3billiards.com"
  );
}
