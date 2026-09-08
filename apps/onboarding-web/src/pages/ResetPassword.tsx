import { type ReactNode, useCallback, useEffect, useState } from "react";
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
    <div className="auth-strength">
      <div className="auth-strength-bars">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="auth-strength-bar"
            style={{ backgroundColor: i < segs ? color : "rgba(255,255,255,0.12)" }}
          />
        ))}
      </div>
      <span className="auth-strength-label" style={{ color }}>
        {STRENGTH_LABEL[s]}
      </span>
    </div>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page auth-page-login auth-page-forgot">
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
        <h1 className="auth-card-title">{title}</h1>
        {subtitle ? <p className="auth-card-subtitle">{subtitle}</p> : null}
        {children}
      </div>
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
      <AuthShell title="Reset password" subtitle="Checking reset link…">
        <p className="auth-card-subtitle">Please wait a moment.</p>
      </AuthShell>
    );
  }

  if (!valid) {
    return (
      <AuthShell
        title="Reset link invalid"
        subtitle="This password reset link is invalid, expired, or already used."
      >
        <Link to="/forgot-password" className="auth-submit auth-submit-link">
          <span className="auth-submit-label">Request a new link</span>
          <span className="auth-submit-fill" aria-hidden="true" />
        </Link>
        <p className="auth-footer">
          <Link to="/login" className="auth-footer-strong">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Your password has been updated.">
        <div className="auth-success">You can sign in with your new password.</div>
        <button
          type="button"
          className="auth-submit"
          onClick={() => nav("/login", { replace: true })}
        >
          <span className="auth-submit-label">Sign in</span>
          <span className="auth-submit-fill" aria-hidden="true" />
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle={STRONG_PASSWORD_HINT}>
      {error ? <div className="auth-error">{error}</div> : null}

      <label className="auth-field">
        <span className="auth-field-label">New password</span>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </label>
      <PasswordStrengthBar password={password} />

      <label className="auth-field">
        <span className="auth-field-label">Confirm password</span>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
          }}
        />
      </label>

      <button
        type="button"
        className="auth-submit"
        disabled={busy}
        onClick={() => void handleSubmit()}
      >
        <span className="auth-submit-label">
          {busy ? "Saving…" : "Update password"}
        </span>
        <span className="auth-submit-fill" aria-hidden="true" />
      </button>

      <p className="auth-footer">
        <Link to="/login" className="auth-footer-strong">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
