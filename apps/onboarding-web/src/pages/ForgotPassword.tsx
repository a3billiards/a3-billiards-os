import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";

export default function ForgotPassword() {
  const requestReset = useAction(api.passwordResetActions.requestReset);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const disabled = busy;
  const canSend = email.trim().length > 0 && !disabled;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setError(null);
    setBusy(true);
    try {
      await requestReset({ email: email.trim().toLowerCase() });
      setDone(true);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [canSend, email, requestReset]);

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

        <h1 className="auth-card-title">Forgot password</h1>
        <p className="auth-card-subtitle">
          Enter your registered email. We will send a reset link.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}
        {done ? (
          <div className="auth-success">
            If an account exists for this email, a reset link has been sent.
          </div>
        ) : null}

        <label className="auth-field">
          <span className="auth-field-label">Email</span>
          <input
            id="resetEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@club.com"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
          />
        </label>

        <button
          type="button"
          className="auth-submit"
          disabled={!canSend}
          onClick={() => void handleSend()}
        >
          <span className="auth-submit-label">
            {busy ? "Sending…" : "Send reset link"}
          </span>
          <span className="auth-submit-fill" aria-hidden="true" />
        </button>

        <p className="auth-footer">
          <Link to="/login" className="auth-footer-strong">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
