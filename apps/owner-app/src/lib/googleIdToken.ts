import { GoogleSignin } from "@react-native-google-signin/google-signin";

/**
 * Obtains a fresh Google **ID token** (JWT) for Convex Auth
 * `signIn("googleOwner", { idToken })`.
 *
 * - ID tokens are short-lived (~1 hour) but after native Google Sign-In the
 *   session usually remains valid; `getTokens()` returns a usable idToken when
 *   the Play Services / iOS session is still active.
 * - After `completeOwnerGoogleRegistration`, we still need a token whose `sub`
 *   matches the linked account: prefer silent refresh, then interactive.
 * - Audience must match server `GOOGLE_*_CLIENT_ID` env (same Web client ID as login).
 */
export async function resolveGoogleIdTokenForConvexAuth(): Promise<string> {
  const silent = await GoogleSignin.signInSilently().catch(() => null);
  if (silent?.data?.idToken) {
    return silent.data.idToken;
  }

  try {
    const refreshed = await GoogleSignin.getTokens();
    if (refreshed.idToken) return refreshed.idToken;
  } catch {
    // No session yet — fall through to interactive sign-in.
  }

  const interactive = await GoogleSignin.signIn();
  const idToken = interactive.data?.idToken;
  if (!idToken) {
    throw new Error(
      "GOOGLE_AUTH_001: Missing Google ID token — complete Google sign-in to continue",
    );
  }
  return idToken;
}
