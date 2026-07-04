import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import {
  getStrongPasswordError,
  getPasswordStrength,
  STRONG_PASSWORD_HINT,
} from "../lib/passwordPolicy";

const STRENGTH_LABEL: Record<string, string> = {
  weak: "Weak",
  good: "Good",
  strong: "Strong",
};
const STRENGTH_COLOR: Record<string, string> = {
  weak: "#e53935",
  good: "#fb8c00",
  strong: "#43a047",
};
function PasswordStrengthBar({ password }: { password: string }) {
  const s = getPasswordStrength(password);
  if (s === "none") return null;
  const segs = s === "weak" ? 1 : s === "good" ? 2 : 3;
  const color = STRENGTH_COLOR[s] ?? "#ccc";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }}>
      <div style={{ flex: 1, display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < segs ? color : "#333" }}
          />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 40, textAlign: "right" }}>
        {STRENGTH_LABEL[s]}
      </span>
    </div>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const nav = useNavigate();
  const verifyResetToken = useAction(api.passwordResetActions.verifyResetToken);
  const resetPassword = useAction(api.passwordResetActions.resetPassword);

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [completionToken, setCompletionToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token.trim()) {
      setChecking(false);
      setValid(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await verifyResetToken({ token: token.trim() });
        if (cancelled) return;
        if (result.valid && result.completionToken) {
          setValid(true);
          setCompletionToken(result.completionToken);
        } else {
          setValid(false);
        }
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, verifyResetToken]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const pwdError = getStrongPasswordError(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (password !== confirm) {
      setError("Password and confirm password must match.");
      return;
    }
    if (!completionToken) {
      setError("Reset link is invalid or expired.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ completionToken, newPassword: password });
      setDone(true);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [password, confirm, completionToken, resetPassword]);

  if (checking) {
    return (
      <div className="card">
        <p className="muted">Checking reset link…</p>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="card">
        <h1>Reset link invalid</h1>
        <p className="muted">
          This password reset link is invalid, expired, or already used.
        </p>
        <Link to="/forgot-password" className="btn btn-primary" style={{ display: "inline-block", marginTop: 12 }}>
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card">
        <div className="success-banner">Your password has been updated.</div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => nav("/login", { replace: true })}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Set a new password</h1>
      <p className="muted">{STRONG_PASSWORD_HINT}</p>
      {error ? <div className="error-banner">{error}</div> : null}
      <label htmlFor="newPassword">New password</label>
      <input
        id="newPassword"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordStrengthBar password={password} />
      <label htmlFor="confirmPassword">Confirm password</label>
      <input
        id="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void handleSubmit()}
      >
        {busy ? "Saving…" : "Update password"}
      </button>
    </div>
  );
}
