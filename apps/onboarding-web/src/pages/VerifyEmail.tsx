import { useCallback, useState } from "react";
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
  const [codeSent, setCodeSent] = useState(initialEmail.length > 0);

  const handleSendCode = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await sendVerificationCode({ email: email.trim().toLowerCase() });
      setCodeSent(true);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [email, sendVerificationCode]);

  const handleVerify = useCallback(async () => {
    setError(null);
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
      <p className="muted">Enter the 6-digit code we sent to your email.</p>
      {error ? <div className="error-banner">{error}</div> : null}
      <label htmlFor="verifyEmail">Email</label>
      <input
        id="verifyEmail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
