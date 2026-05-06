import { useCallback, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { parseConvexError } from "../lib/parseConvexError";

export default function Login() {
  const { signIn } = useAuthActions();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get("returnUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { signingIn } = await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });
      if (!signingIn) {
        setError("Sign-in failed.");
        return;
      }
      nav(returnUrl, { replace: true });
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [email, password, nav, returnUrl, signIn]);

  return (
    <div className="card">
      <h1>Owner login</h1>
      <p className="muted">Sign in to manage your subscription and invoices.</p>
      {error ? <div className="error-banner">{error}</div> : null}
      <label htmlFor="loginEmail">Email</label>
      <input
        id="loginEmail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <label htmlFor="loginPassword">Password</label>
      <input
        id="loginPassword"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
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
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleLogin()}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </div>
  );
}

