/**
 * Server-side secret access (Convex actions / Node only).
 *
 * OWASP secret-management rules enforced here:
 * - Secrets live in Convex env (`npx convex env set`) or local `.env.local` (gitignored).
 * - Never hard-code API keys, passwords, or private keys in source.
 * - Never return server secrets from queries/mutations/actions to clients.
 * - Log provider errors with redaction — never log raw bodies that may echo tokens.
 *
 * Client-safe values (may use EXPO_PUBLIC_ / VITE_ prefix in mobile/web builds):
 * - EXPO_PUBLIC_CONVEX_URL / VITE_CONVEX_URL — deployment URL (public)
 * - EXPO_PUBLIC_GOOGLE_*_CLIENT_ID — OAuth client IDs (public by Google design)
 * - EXPO_PUBLIC_POSTHOG_API_KEY / VITE_POSTHOG_API_KEY — analytics project key (client SDK)
 * - EXPO_PUBLIC_SENTRY_DSN — error reporting DSN (client SDK)
 * - RAZORPAY_KEY_ID — returned to open Razorpay Checkout (public key id, not the secret)
 *
 * Server-only (must NEVER ship in app bundles or HTTP responses):
 * - RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 * - WHATSAPP_API_TOKEN, RESEND_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON
 * - AWS_IVS_SECRET_ACCESS_KEY, AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY
 * - GOOGLE_MAPS_API_KEY (server geocoding), AWS_EVENTBRIDGE_WEBHOOK_SECRET
 */

/** Read a required server secret; throws DATA_001 if unset (safe to surface in server logs). */
export function requireServerEnv(name: string): string {
  const val = process.env[name]?.trim();
  if (!val) {
    throw new Error(`DATA_001: Missing server environment variable ${name}`);
  }
  return val;
}

/** Read an optional server config value. */
export function optionalServerEnv(name: string): string | undefined {
  const val = process.env[name]?.trim();
  return val && val.length > 0 ? val : undefined;
}

/** Razorpay public key id — safe to pass to Checkout / client WebView. */
export function razorpayKeyId(): string {
  return requireServerEnv("RAZORPAY_KEY_ID");
}

/** Razorpay Basic auth header — server-side payment API calls only. */
export function razorpayBasicAuthHeader(): string {
  const keyId = razorpayKeyId();
  const keySecret = requireServerEnv("RAZORPAY_KEY_SECRET");
  const credentials = `${keyId}:${keySecret}`;
  const bytes = new TextEncoder().encode(credentials);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

/**
 * Redact common secret patterns before writing provider errors to logs or Error messages.
 * Does not guarantee full coverage — prefer logging status codes + short summaries.
 */
export function redactSecretsInString(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(
      /("?(?:api[_-]?key|secret|token|password|private_key|authorization)"?\s*[:=]\s*)"[^"]{8,}"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/rzp_(live|test)_[A-Za-z0-9]+/g, "rzp_[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "AIza[REDACTED]")
    .replace(/phc_[A-Za-z0-9]{10,}/g, "phc_[REDACTED]")
    .replace(
      /-----BEGIN[A-Z ]+-----[\s\S]*?-----END[A-Z ]+-----/g,
      "[REDACTED_PRIVATE_KEY]",
    );
}

/** Safe one-line provider error for console.error (truncated + redacted). */
export function summarizeProviderHttpError(
  raw: string,
  provider: string,
  maxLen = 240,
): string {
  const snippet = redactSecretsInString(raw.trim().slice(0, maxLen));
  return `${provider} error: ${snippet}`;
}
