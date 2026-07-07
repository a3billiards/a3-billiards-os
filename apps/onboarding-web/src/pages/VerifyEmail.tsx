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
    } finally {
      setBusy(false);
    }
  }, [email, code, verifyEmailCode, nav]);

  return (
    <div className="card">
      <h1>Verify email</h1>
      <p className="muted">
        Owners must verify email before signing in. Enter the 6-digit code from your inbox.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {info ? <div className="success-banner">{info}</div> : null}
      <label htmlFor="verifyEmail">Email</label>
      <input
        id="verifyEmail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
      />
      {!codeSent ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || email.trim().length === 0}
          onClick={() => void handleSendCode()}
        >
          {busy ? "Sending…" : "Send code"}
        </button>
      ) : (
        <>
          <label htmlFor="verifyCode">Verification code</label>
          <input
            id="verifyCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6) void handleVerify();
            }}
          />
          <div className="inline-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || code.length !== 6}
              onClick={() => void handleVerify()}
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void handleSendCode()}
            >
              Resend
            </button>
          </div>
        </>
      )}
      <p className="muted" style={{ marginTop: 12 }}>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
