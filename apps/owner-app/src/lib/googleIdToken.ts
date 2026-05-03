import { GoogleSignin } from "@react-native-google-signin/google-signin";

/**
 * Obtains a Google ID token for Convex Auth `signIn("googleOwner", { idToken })`.
 */
export async function resolveGoogleIdTokenForConvexAuth(): Promise<string> {
  try {
    const refreshed = await GoogleSignin.getTokens();
    if (refreshed.idToken) return refreshed.idToken;
  } catch {
    // No current session or tokens expired — try silent / interactive flow.
  }

  const silent = await GoogleSignin.signInSilently().catch(() => null);
  if (silent?.data?.idToken) return silent.data.idToken;

  const interactive = await GoogleSignin.signIn();
  const idToken = interactive.data?.idToken;
  if (!idToken) {
    throw new Error(
      "GOOGLE_AUTH_001: Missing Google ID token — complete Google sign-in to continue",
    );
  }
  return idToken;
}
