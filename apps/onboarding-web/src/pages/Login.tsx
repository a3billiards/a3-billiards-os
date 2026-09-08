import { useCallback, useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { requestGoogleIdToken } from "../lib/googleIdTokenWeb";

const REMEMBER_EMAIL_KEY = "a3.onboarding.rememberEmail";

function GoogleMark() {
  return (
    <svg
      className="auth-google-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function Login() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const resolveOwnerGoogle = useAction(
    api.googleAuthActions.resolveOwnerGoogleSignIn,
  );
  const status = useQuery(
    api.onboardingWeb.getMyOnboardingStatus,
    isAuthenticated ? {} : "skip",
  );
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get("returnUrl") || "/dashboard";
  const emailFromQuery = params.get("email") ?? "";

  const [email, setEmail] = useState(() => {
    if (emailFromQuery) return emailFromQuery;
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY));
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [postSignInPending, setPostSignInPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** idle → enter (door + walk) → success (green tick) */
  const [signAnim, setSignAnim] = useState<"idle" | "enter" | "success">(
    "idle",
  );

  // Wait until Convex auth + owner status are ready (avoids bounce back to login).
  useEffect(() => {
    if (!postSignInPending) return;
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (status === undefined) return;
    if (!status.loggedIn) {
      setPostSignInPending(false);
      setSignAnim("idle");
      setError(
        "This account is not an owner account. Use the Owner app registration.",
      );
      return;
    }
    if (!status.emailVerified) {
      setPostSignInPending(false);
      setSignAnim("idle");
      nav(
        `/verify-email?email=${encodeURIComponent(status.email ?? email.trim().toLowerCase())}`,
        { replace: true },
      );
      return;
    }
    setSignAnim("success");
    setPostSignInPending(false);
    nav(returnUrl, { replace: true });
  }, [
    postSignInPending,
    authLoading,
    isAuthenticated,
    status,
    nav,
    returnUrl,
    email,
  ]);

  const handleLogin = useCallback(async () => {
    if (busy || postSignInPending || googleBusy) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setSignAnim("enter");
    setBusy(true);
    try {
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        /* ignore storage failures */
      }

      const { signingIn } = await signIn("password", {
        email: normalizedEmail,
        password,
        flow: "signIn",
      });
      if (!signingIn) {
        setSignAnim("idle");
        setError("Sign-in failed. Check your email and password.");
        return;
      }
      // Login proceeds immediately; walk-in finishes into the green tick.
      setPostSignInPending(true);
      window.setTimeout(() => {
        setSignAnim((prev) => (prev === "enter" ? "success" : prev));
      }, 900);
    } catch (e) {
      setSignAnim("idle");
      const parsed = parseConvexError(e as Error);
      if (parsed.code === "AUTH_009") {
        setError(
          "Verify your email before signing in. We can send a code to your inbox.",
        );
        nav(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`, {
          replace: true,
        });
        return;
      }
      if (parsed.code === "AUTH_001") {
        setError("Invalid email or password.");
        return;
      }
      if (parsed.code === "AUTH_002") {
        setError("This account is frozen. Contact support.");
        return;
      }
      if (parsed.code === "AUTH_006") {
        setError("This account is pending deletion.");
        return;
      }
      setError(parsed.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    googleBusy,
    postSignInPending,
    email,
    password,
    rememberMe,
    nav,
    signIn,
  ]);

  const handleGoogleLogin = useCallback(async () => {
    if (busy || googleBusy || postSignInPending) return;
    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
    if (!clientId) {
      setError(
        "Google Sign-In is not configured. Set VITE_GOOGLE_WEB_CLIENT_ID.",
      );
      return;
    }

    setError(null);
    setGoogleBusy(true);
    try {
      const idToken = await requestGoogleIdToken(clientId);
      const probe = await resolveOwnerGoogle({ idToken });
      if (probe.isNewUser) {
        setError(
          "No owner account is linked to this Google account yet. Create an account to get started.",
        );
        return;
      }

      const { signingIn } = await signIn("googleOwner", { idToken });
      if (!signingIn) {
        setError("Google sign-in failed. Try again.");
        return;
      }
      setPostSignInPending(true);
    } catch (e) {
      const parsed = parseConvexError(e as Error);
      if (parsed.code === "AUTH_002") {
        setError("This account is frozen. Contact support.");
      } else if (parsed.code === "AUTH_006") {
        setError("This account is pending deletion.");
      } else if (parsed.code === "OWNER_001") {
        setError(
          "This Google account is not registered as an owner account.",
        );
      } else if (parsed.code === "DATA_002") {
        setError(
          "This Google account conflicts with an existing login. Contact support.",
        );
      } else if (parsed.code === "GOOGLE_AUTH_001") {
        setError("Google token validation failed. Try again.");
      } else if (
        e instanceof Error &&
        /cancelled|timed out|not configured|failed to load/i.test(e.message)
      ) {
        setError(e.message);
      } else if (parsed.code !== "UNKNOWN") {
        setError(parsed.message);
      } else {
        setError(
          e instanceof Error ? e.message : "Google sign-in failed. Try again.",
        );
      }
    } finally {
      setGoogleBusy(false);
    }
  }, [busy, googleBusy, postSignInPending, resolveOwnerGoogle, signIn]);

  const waitingForSession = postSignInPending;
  const disabled = busy || waitingForSession || googleBusy;

  return (
    <div className="auth-page auth-page-login">
      <div className="auth-stage" aria-hidden="true">
        <img
          className="auth-stage-art"
          src="/images/auth-hero.png"
          alt=""
          draggable={false}
        />
        <div className="auth-stage-shade" />
      </div>

      <div className="auth-card">
        <Link to="/" className="auth-card-brand">
          <span className="auth-card-brand-a3">A3</span>
          <span className="auth-card-brand-rest">BILLIARDS OS</span>
        </Link>

        <h1 className="auth-card-title">Welcome back</h1>
        <p className="auth-card-subtitle">
          Sign in to continue to A3 Billiards OS
        </p>

        {error ? <div className="auth-error">{error}</div> : null}

        <label className="auth-field">
          <span className="auth-field-label">Email</span>
          <input
            id="loginEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@club.com"
            disabled={disabled}
          />
        </label>

        <label className="auth-field">
          <span className="auth-field-label">Password</span>
          <span className="auth-field-row">
            <input
              id="loginPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogin();
              }}
            />
            <button
              type="button"
              className="auth-eye"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              disabled={disabled}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        <div className="auth-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={disabled}
            />
            <span>Remember me</span>
          </label>
          <Link className="auth-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <button
          type="button"
          className={[
            "auth-submit",
            signAnim === "enter" ? "is-entering" : "",
            signAnim === "success" ? "is-success" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={disabled}
          onClick={() => void handleLogin()}
          aria-label={
            signAnim === "success"
              ? "Signed in"
              : busy || waitingForSession
                ? "Signing in"
                : "Sign In"
          }
        >
          <span className="auth-submit-label">
            {signAnim === "success"
              ? "Welcome"
              : busy || waitingForSession
                ? "Signing in…"
                : "Sign In"}
          </span>
          <span className="auth-submit-scene" aria-hidden="true">
            <span className="auth-submit-person">
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                <circle cx="8" cy="3" r="2.5" fill="currentColor" />
                <path
                  d="M8 6.2v5.4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  className="auth-submit-arm-l"
                  d="M8 8.2 3.6 10.4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  className="auth-submit-arm-r"
                  d="M8 8.2 12.4 10.4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  className="auth-submit-leg-l"
                  d="M8 11.6 4.2 18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  className="auth-submit-leg-r"
                  d="M8 11.6 11.8 18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="auth-submit-door">
              <span className="auth-submit-door-frame" />
              <span className="auth-submit-door-panel">
                <span className="auth-submit-door-knob" />
              </span>
            </span>
            <span className="auth-submit-check">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="8" fill="#22c55e" />
                <path
                  d="M5.2 9.2 7.6 11.6 12.8 6.4"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          <span className="auth-submit-fill" aria-hidden="true" />
        </button>

        <div className="auth-divider" role="separator">
          <span>or continue with</span>
        </div>

        <div className="auth-social">
          <button
            type="button"
            className="auth-social-btn"
            disabled={disabled}
            onClick={() => void handleGoogleLogin()}
          >
            <GoogleMark />
            <span>{googleBusy ? "Connecting…" : "Google"}</span>
          </button>
          {/* Apple login deferred — not in product yet */}
        </div>

        <p className="auth-footer">
          New to A3?{" "}
          <Link to="/register" className="auth-footer-strong">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
