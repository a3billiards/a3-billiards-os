import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { captureEvent } from "../instrumentation";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";

type SubscriptionPlanRow = {
  id: "monthly" | "yearly";
  label: string;
  periodMs: number;
  amountPaise: number;
  currency: string;
  gst: {
    totalPaise: number;
    taxablePaise: number;
    gstPaise: number;
    gstRatePercent: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    splitMode: "igst" | "cgst_sgst";
  };
  invoiceConfig: {
    legalName: string;
    gstin: string | null;
    gstRatePercent: number;
    gstSplitMode: "igst" | "cgst_sgst";
    sacCode: string;
  };
};

function loadRazorpayScript(): Promise<void> {
  const w = window as unknown as { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load payment SDK"));
    document.body.appendChild(s);
  });
}

function RenewFooter() {
  return (
    <footer className="dash-footer">
      <nav aria-label="Legal">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/dpdp">DPDP</Link>
      </nav>
      <a className="dash-support" href="mailto:support@a3billiards.com">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
          <path
            d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4M4 12v5a2 2 0 0 0 2 2h2v-6H4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 19v1a2.5 2.5 0 0 0 2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        support@a3billiards.com
      </a>
    </footer>
  );
}

function RenewShell({
  children,
  signedIn,
}: {
  children: ReactNode;
  signedIn: boolean;
}) {
  const { signOut } = useAuthActions();

  return (
    <div className="dash-page renew-page">
      <div className="dash-stage" aria-hidden="true">
        <img className="dash-stage-art" src="/images/auth-hero.png" alt="" draggable={false} />
        <div className="dash-stage-shade" />
      </div>

      <div className="dash-scroll">
        <header className="dash-topnav">
          <Link to="/" className="dash-brand">
            <img
              className="dash-brand-mark"
              src="/images/small-logo.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            A3 BILLIARDS OS
          </Link>
          <nav className="dash-nav" aria-label="Main">
            {signedIn ? null : <Link to="/register">Register</Link>}
            {signedIn ? (
              <>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/renew" className="is-renew-active" aria-current="page">
                  Renew
                </Link>
                <button
                  type="button"
                  className="dash-logout is-outlined"
                  onClick={() => {
                    void signOut().then(() => {
                      window.location.href = "/login";
                    });
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function Renew() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const createOrder = useAction(api.onboardingWebActions.createRazorpayOrder);
  const status = useQuery(api.onboardingWeb.getMyOnboardingStatus);
  const plans = useQuery(api.onboardingWeb.listSubscriptionPlans);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<"monthly" | "yearly">("monthly");
  const [payBusy, setPayBusy] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [expiryBeforePay, setExpiryBeforePay] = useState<number | null>(null);
  const [renewSuccess, setRenewSuccess] = useState(false);

  const handleLogin = useCallback(async () => {
    if (loginBusy) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setLoginBusy(true);
    try {
      const { signingIn } = await signIn("password", {
        email: normalizedEmail,
        password,
        flow: "signIn",
      });
      if (!signingIn) setError("Sign-in failed. Check your email and password.");
      else captureEvent("renew_login");
    } catch (e) {
      const parsed = parseConvexError(e as Error);
      if (parsed.code === "AUTH_009") {
        setError("Verify your email first.");
        window.location.assign(
          `/verify-email?email=${encodeURIComponent(normalizedEmail)}`,
        );
        return;
      }
      if (parsed.code === "AUTH_001") {
        setError("Invalid email or password.");
        return;
      }
      setError(parsed.message);
    } finally {
      setLoginBusy(false);
    }
  }, [email, password, signIn, loginBusy]);

  const handlePay = useCallback(async () => {
    if (payBusy || paymentPending) return;
    setError(null);
    setRenewSuccess(false);
    setPayBusy(true);
    const baseline =
      status?.loggedIn && status.subscriptionExpiresAt != null
        ? status.subscriptionExpiresAt
        : 0;
    setExpiryBeforePay(baseline);
    setPaymentPending(true);
    try {
      await loadRazorpayScript();
      const order = await createOrder({ flow: "renewal", planId });
      const selectedPlan = (plans as SubscriptionPlanRow[] | undefined)?.find(
        (p) => p.id === planId,
      );
      const gstNote = selectedPlan
        ? ` (incl. GST ${selectedPlan.gst.gstRatePercent}%)`
        : "";
      const RazorpayCtor = (window as unknown as { Razorpay: new (opts: object) => { open: () => void } }).Razorpay;
      const rzp = new RazorpayCtor({
        key: order.keyId,
        order_id: order.orderId,
        currency: order.currency,
        name: "A3 Billiards OS",
        description: `Renew — ${planId}${gstNote}`,
        handler: () => {
          captureEvent("renew_razorpay_success", { planId });
        },
        prefill: { email: email.trim().toLowerCase() },
        theme: { color: "#f5a623" },
        modal: {
          ondismiss: () => {
            setPayBusy(false);
            setPaymentPending(false);
            setExpiryBeforePay(null);
          },
        },
      });
      rzp.open();
      setPayBusy(false);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
      setPayBusy(false);
      setPaymentPending(false);
      setExpiryBeforePay(null);
    }
  }, [createOrder, planId, email, status, plans, payBusy, paymentPending]);

  useEffect(() => {
    if (!paymentPending || expiryBeforePay === null || !status?.loggedIn) return;
    const current = status.subscriptionExpiresAt;
    if (current != null && current > expiryBeforePay) {
      setPaymentPending(false);
      setExpiryBeforePay(null);
      setRenewSuccess(true);
      captureEvent("renew_subscription_extended", { planId });
    }
  }, [paymentPending, expiryBeforePay, status, planId]);

  if (authLoading || status === undefined) {
    return (
      <RenewShell signedIn={false}>
        <div className="dash-card">
          <p className="muted" style={{ margin: 24 }}>
            Loading…
          </p>
        </div>
      </RenewShell>
    );
  }

  if (!isAuthenticated || !status.loggedIn) {
    return (
      <RenewShell signedIn={false}>
        <div className="dash-card renew-card">
          <div className="renew-simple">
            <h1 className="renew-title">Renew subscription</h1>
            <p className="muted">
              Sign in with the email and password you used during onboarding.
            </p>
            {error ? <div className="auth-error">{error}</div> : null}
            <label className="auth-field" htmlFor="re-email">
              <span className="auth-field-label">Email</span>
              <input
                id="re-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="auth-field" htmlFor="re-password">
              <span className="auth-field-label">Password</span>
              <input
                id="re-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loginBusy}
              onClick={() => void handleLogin()}
            >
              {loginBusy ? "Signing in…" : "Sign in"}
            </button>
          </div>
          <RenewFooter />
        </div>
      </RenewShell>
    );
  }

  if (!status.hasClub) {
    return (
      <RenewShell signedIn>
        <div className="dash-card renew-card">
          <div className="renew-simple">
            <h1 className="renew-title">Renew subscription</h1>
            <p className="muted">No club is linked to this account yet. Complete registration first.</p>
            <Link className="dash-renew-btn" to="/register">
              Go to registration
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <RenewFooter />
        </div>
      </RenewShell>
    );
  }

  const subLabel =
    status.subscriptionStatus === "frozen"
      ? "Frozen — renew to restore access"
      : status.subscriptionStatus === "grace"
        ? "Grace period — renew soon"
        : "Active";
  const statusKind =
    status.subscriptionStatus === "frozen"
      ? "frozen"
      : status.subscriptionStatus === "grace"
        ? "grace"
        : "active";

  const expiryDate =
    status.subscriptionExpiresAt !== null && status.subscriptionExpiresAt !== undefined
      ? new Date(status.subscriptionExpiresAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <RenewShell signedIn>
      <div className="dash-card renew-card">
        <div className="renew-hero-row">
          <div className="renew-hero-copy">
            <span className="renew-refresh-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M20 12a8 8 0 1 1-2.2-5.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M20 4v4.5h-4.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h1 className="renew-title">Renew subscription</h1>
            <p className="renew-status">
              Status:{" "}
              <strong className={`renew-status-value is-${statusKind}`}>
                <span className="renew-status-dot" aria-hidden="true" />
                {subLabel}
              </strong>
            </p>
            <p className="renew-expiry">
              Current expiry: <strong>{expiryDate}</strong>
            </p>
          </div>
          <div className="renew-hero-art" aria-hidden="true">
            <video
              className="dash-hero-video"
              src="/videos/eightball-smoke.mp4"
              poster="/images/auth-hero.png"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="dash-hero-fade" />
          </div>
        </div>

        <div className="renew-body">
          {renewSuccess ? (
            <div className="success-banner">
              Payment received — your subscription end date has been updated. If the date above
              does not refresh within a few seconds, reload the page.
            </div>
          ) : null}
          {error ? <div className="auth-error">{error}</div> : null}

          {plans === undefined ? (
            <p className="muted">Loading plans…</p>
          ) : plans ? (
            <>
              <h2 className="dash-section-title">Select period</h2>
              <div className="renew-plan-grid" role="radiogroup" aria-label="Subscription period">
                {(plans as SubscriptionPlanRow[]).map((p) => {
                  const selected = planId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`renew-plan-card ${selected ? "selected" : ""}`}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => setPlanId(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPlanId(p.id);
                        }
                      }}
                    >
                      <span className={`renew-plan-radio ${selected ? "is-on" : ""}`} aria-hidden="true" />
                      <div className="renew-plan-meta">
                        <h3>{p.label}</h3>
                        <p>
                          {(p.amountPaise / 100).toLocaleString("en-IN")} {p.currency} excl. GST
                        </p>
                      </div>
                      {p.id === "monthly" ? (
                        <span className="renew-plan-badge">Recommended ★</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {(() => {
                const selected = (plans as SubscriptionPlanRow[]).find((p) => p.id === planId);
                if (!selected) return null;
                return (
                  <div className="renew-gst">
                    <p className="renew-gst-sac">
                      SAC: {selected.invoiceConfig.sacCode}
                      {selected.invoiceConfig.gstin
                        ? ` · Supplier GSTIN: ${selected.invoiceConfig.gstin}`
                        : null}
                    </p>
                    <SubscriptionGstBreakdown gst={selected.gst} currency={selected.currency} compact />
                  </div>
                );
              })()}

              <p className="renew-info">
                <span className="renew-info-icon" aria-hidden="true">
                  i
                </span>
                Early renewal preserves unused paid time: your new expiry is the later of your
                current expiry or today, plus the period you buy.
              </p>

              <button
                type="button"
                className="renew-pay-btn"
                disabled={payBusy || paymentPending}
                onClick={() => void handlePay()}
              >
                <svg className="pay-razorpay-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M7.2 3.2h6.4c2.6 0 4.2 1.8 4.2 4.1 0 2.6-1.9 4.2-4.6 4.2H9.6L8 20.8H4.2L7.2 3.2zm3.1 5.8h2.3c1.1 0 1.8-.6 1.8-1.5s-.6-1.4-1.7-1.4H11L10.3 9z"
                    fill="currentColor"
                  />
                </svg>
                <span>{payBusy || paymentPending ? "Please wait…" : "Pay with Razorpay"}</span>
                <span aria-hidden="true">→</span>
              </button>
              {paymentPending ? (
                <p className="muted" style={{ marginTop: 12 }}>
                  Waiting for confirmation…
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted">Plans are unavailable right now. Please refresh the page.</p>
          )}
        </div>
        <RenewFooter />
      </div>
    </RenewShell>
  );
}
