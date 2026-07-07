import { useCallback, useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";

export default function Login() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const status = useQuery(
    api.onboardingWeb.getMyOnboardingStatus,
    isAuthenticated ? {} : "skip",
  );
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get("returnUrl") || "/dashboard";
  const emailFromQuery = params.get("email") ?? "";

  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [postSignInPending, setPostSignInPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait until Convex auth + owner status are ready (avoids bounce back to login).
  useEffect(() => {
    if (!postSignInPending) return;
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (status === undefined) return;
    if (!status.loggedIn) {
      setPostSignInPending(false);
      setError("This account is not an owner account. Use the Owner app registration.");
      return;
    }
    if (!status.emailVerified) {
      setPostSignInPending(false);
      nav(
        `/verify-email?email=${encodeURIComponent(status.email ?? email.trim().toLowerCase())}`,
        { replace: true },
      );
      return;
    }
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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { signingIn } = await signIn("password", {
        email: normalizedEmail,
        password,
        flow: "signIn",
      });
      if (!signingIn) {
        setError("Sign-in failed. Check your email and password.");
        return;
      }
      setPostSignInPending(true);
    } catch (e) {
      const parsed = parseConvexError(e as Error);
      if (parsed.code === "AUTH_009") {
        setError("Verify your email before signing in. We can send a code to your inbox.");
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
  }, [email, password, nav, signIn]);

  const waitingForSession = postSignInPending;

  return (
    <div className="card">
      <h1>Owner login</h1>
      <p className="muted">Sign in to manage your subscription.</p>
      {error ? <div className="error-banner">{error}</div> : null}
      <label htmlFor="loginEmail">Email</label>
      <input
        id="loginEmail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        disabled={busy || waitingForSession}
      />
      <label htmlFor="loginPassword">Password</label>
      <input
        id="loginPassword"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        disabled={busy || waitingForSession}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleLogin();
        }}
      />
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          style={{ width: "auto", margin: 0 }}
        />
        Show password
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || waitingForSession}
        onClick={() => void handleLogin()}
      >
        {busy || waitingForSession ? "Signing in…" : "Sign in"}
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        <Link to="/forgot-password">Forgot password?</Link>
        {" · "}
        <Link
          to={`/verify-email${email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ""}`}
        >
          Verify email
        </Link>
        {" · "}
        <Link to="/register">Create account</Link>
      </p>
    </div>
  );
}
