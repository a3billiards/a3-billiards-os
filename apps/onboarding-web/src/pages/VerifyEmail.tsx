import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";

export default function VerifyEmail() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialEmail = params.get("email") ?? "";

  const sendVerificationCode = useAction(
    api.ownerEmailVerificationActions.sendOwnerEmailVerificationCode,
  );
  const verifyEmailCode = useAction(api.ownerEmailVerificationActions.verifyOwnerEmailCode);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const autoSent = useRef(false);

  const handleSendCode = useCallback(async () => {
    if (busy) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter your email address.");
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await sendVerificationCode({ email: normalized });
      setCodeSent(true);
      setInfo("If an account exists for this email, a 6-digit code was sent.");
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [email, sendVerificationCode]);

  // Auto-send when opened from login with ?email=
  useEffect(() => {
    if (autoSent.current) return;
    if (!initialEmail.trim()) return;
    autoSent.current = true;
    void handleSendCode();
  }, [initialEmail, handleSendCode]);

  const handleVerify = useCallback(async () => {
    if (busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await verifyEmailCode({
        email: email.trim().toLowerCase(),
        code,
      });
      nav(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
        replace: true,
      });
    } catch (e) {
      setError(parseConvexError(e as Error).message);
      setBusy(false);
    }
  }, [email, code, verifyEmailCode, nav]);

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

        <h1 className="auth-card-title">Verify email</h1>
        <p className="auth-card-subtitle">
          Owners must verify email before signing in. Enter the 6-digit code from
          your inbox.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}
        {info ? <div className="auth-success">{info}</div> : null}

        <label className="auth-field">
          <span className="auth-field-label">Email</span>
          <input
            id="verifyEmail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@club.com"
            disabled={busy}
          />
        </label>

        {!codeSent ? (
          <button
            type="button"
            className="auth-submit"
            disabled={busy || email.trim().length === 0}
            onClick={() => void handleSendCode()}
          >
            <span className="auth-submit-label">
              {busy ? "Sending…" : "Send code"}
            </span>
            <span className="auth-submit-fill" aria-hidden="true" />
          </button>
        ) : (
          <>
            <label className="auth-field">
              <span className="auth-field-label">Verification code</span>
              <input
                id="verifyCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-digit code"
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) void handleVerify();
                }}
              />
            </label>

            <div className="auth-inline-actions">
              <button
                type="button"
                className="auth-submit"
                disabled={busy || code.length !== 6}
                onClick={() => void handleVerify()}
              >
                <span className="auth-submit-label">
                  {busy ? "Verifying…" : "Verify"}
                </span>
                <span className="auth-submit-fill" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="auth-ghost-btn"
                disabled={busy}
                onClick={() => void handleSendCode()}
              >
                Resend
              </button>
            </div>
          </>
        )}

        <p className="auth-footer">
          <Link to="/login" className="auth-footer-strong">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
