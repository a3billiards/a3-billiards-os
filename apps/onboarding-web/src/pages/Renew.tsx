import { useCallback, useEffect, useState } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { captureEvent } from "../instrumentation";

type SubscriptionPlanRow = {
  id: "monthly" | "yearly";
  label: string;
  periodMs: number;
  amountPaise: number;
  currency: string;
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

export default function Renew() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const createOrder = useAction(api.onboardingWebActions.createRazorpayOrder);
  const applyCoupon = useAction(api.onboardingWebActions.applyCouponFreeAccess);
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
  const [couponCode, setCouponCode] = useState("");

  const handleLogin = useCallback(async () => {
    setError(null);
    setLoginBusy(true);
    try {
      const { signingIn } = await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });
      if (!signingIn) setError("Sign-in failed.");
      else captureEvent("renew_login");
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setLoginBusy(false);
    }
  }, [email, password, signIn]);

  const handlePay = useCallback(async () => {
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
      const RazorpayCtor = (window as unknown as { Razorpay: new (opts: object) => { open: () => void } }).Razorpay;
      const rzp = new RazorpayCtor({
        key: order.keyId,
        order_id: order.orderId,
        currency: order.currency,
        name: "A3 Billiards OS",
        description: `Renew — ${planId}`,
        handler: () => {
          captureEvent("renew_razorpay_success", { planId });
        },
        prefill: { email: email.trim().toLowerCase() },
        theme: { color: "#f5a623" },
        modal: {
          ondismiss: () => {
            setPayBusy(false);
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
  }, [createOrder, planId, email, status]);

  const handleCoupon = useCallback(async () => {
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
      await applyCoupon({
        flow: "renewal",
        planId,
        couponCode,
      });
      captureEvent("renew_coupon_applied", { planId });
    } catch (e) {
      setError(parseConvexError(e as Error).message);
      setPaymentPending(false);
      setExpiryBeforePay(null);
    } finally {
      setPayBusy(false);
    }
  }, [applyCoupon, couponCode, planId, status]);

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
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated || !status.loggedIn) {
    return (
      <div className="card">
        <h1>Renew subscription</h1>
        <p className="muted">Sign in with the email and password you used during onboarding.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <label htmlFor="re-email">Email</label>
        <input
          id="re-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="re-password">Password</label>
        <input
          id="re-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={loginBusy}
          onClick={() => void handleLogin()}
        >
          {loginBusy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    );
  }

  if (!status.hasClub) {
    return (
      <div className="card">
        <h1>Renew subscription</h1>
        <p className="muted">No club is linked to this account yet. Complete registration first.</p>
        <a className="btn btn-primary" href="/register" style={{ textDecoration: "none", display: "inline-flex" }}>
          Go to registration
        </a>
      </div>
    );
  }

  const subLabel =
    status.subscriptionStatus === "frozen"
      ? "Frozen — renew to restore access"
      : status.subscriptionStatus === "grace"
        ? "Grace period — renew soon"
        : "Active";

  const expiryDate =
    status.subscriptionExpiresAt !== null && status.subscriptionExpiresAt !== undefined
      ? new Date(status.subscriptionExpiresAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <div className="card">
      <h1>Renew subscription</h1>
      <p className="muted">
        Status: <strong>{subLabel}</strong>
        <br />
        Current expiry: <strong>{expiryDate}</strong>
      </p>
      {renewSuccess ? (
        <div className="success-banner">
          Payment received — your subscription end date has been updated. If the date above does not refresh within a few
          seconds, reload the page.
        </div>
      ) : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {plans && (
        <>
          <h2>Select period</h2>
          <div className="plan-grid">
            {(plans as SubscriptionPlanRow[]).map((p) => (
              <div
                key={p.id}
                className={`plan-card ${planId === p.id ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setPlanId(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setPlanId(p.id);
                }}
              >
                <h3>{p.label}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {(p.amountPaise / 100).toLocaleString("en-IN")} {p.currency}
                </p>
              </div>
            ))}
          </div>
          <p className="muted">
            Early renewal preserves unused paid time: your new expiry is the later of your current expiry or today, plus
            the period you buy.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={payBusy || paymentPending}
            onClick={() => void handlePay()}
          >
            Pay with Razorpay
          </button>
          <div style={{ marginTop: 16 }}>
            <label htmlFor="renewCouponCode">Coupon code (testing)</label>
            <div className="row" style={{ gridTemplateColumns: "1fr auto" }}>
              <input
                id="renewCouponCode"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon (e.g. A3A3A3)"
                disabled={payBusy || paymentPending}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={payBusy || paymentPending || couponCode.trim().length === 0}
                onClick={() => void handleCoupon()}
              >
                Apply coupon
              </button>
            </div>
          </div>
          {paymentPending ? (
            <p className="muted" style={{ marginTop: 16 }}>
              Waiting for payment confirmation… keep this tab open.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
