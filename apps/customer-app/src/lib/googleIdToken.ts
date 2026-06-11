async function getGoogleSignin() {
  const mod = await import("@react-native-google-signin/google-signin");
  return mod.GoogleSignin;
}

/**
 * Obtains a Google ID token for Convex Auth `signIn("google", { idToken })`.
 * Uses a lazy dynamic import so this module never crashes in Expo Go.
 */
export async function resolveGoogleIdTokenForConvexAuth(): Promise<string> {
  let GoogleSignin: Awaited<ReturnType<typeof getGoogleSignin>>;
  try {
    GoogleSignin = await getGoogleSignin();
  } catch {
    throw new Error(
      "GOOGLE_AUTH_001: Google Sign-In is not available in Expo Go. Use email login or run a development build.",
    );
  }

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
