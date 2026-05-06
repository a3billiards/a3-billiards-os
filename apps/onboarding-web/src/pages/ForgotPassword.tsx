import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";

export default function ForgotPassword() {
  const requestReset = useAction(api.passwordResetActions.requestReset);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="card">
      <h1>Forgot password</h1>
      <p className="muted">Enter your registered email. We will send a reset link.</p>
      {error ? <div className="error-banner">{error}</div> : null}
      {done ? (
        <div className="success-banner">
          If an account exists for this email, a reset link has been sent.
        </div>
      ) : null}
      <label htmlFor="resetEmail">Email</label>
      <input
        id="resetEmail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || email.trim().length === 0}
        onClick={() => {
          void (async () => {
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
          })();
        }}
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </div>
  );
}

