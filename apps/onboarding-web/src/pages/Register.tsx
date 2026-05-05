import { useCallback, useEffect, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { captureEvent } from "../instrumentation";

const PRIVACY = "/privacy";
const TERMS = "/terms";
const DPDP = "/dpdp";

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
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

type Step = 1 | 2 | 3 | 4;

type SubscriptionPlanRow = {
  id: "monthly" | "yearly";
  label: string;
  periodMs: number;
  amountPaise: number;
  currency: string;
};

export default function Register() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const registerOwner = useAction(api.onboardingWebActions.registerOwnerAccount);
  const geocode = useAction(api.onboardingWebActions.geocodeClubAddress);
  const createOrder = useAction(api.onboardingWebActions.createRazorpayOrder);
  const applyCoupon = useAction(api.onboardingWebActions.applyCouponFreeAccess);
  const saveDraft = useMutation(api.onboardingWeb.saveClubDraft);
  const status = useQuery(api.onboardingWeb.getMyOnboardingStatus);
  const plans = useQuery(api.onboardingWeb.listSubscriptionPlans);

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const [clubName, setClubName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [baseRate, setBaseRate] = useState("5");
  const [minBill, setMinBill] = useState("30");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const [planId, setPlanId] = useState<"monthly" | "yearly">("monthly");
  const [paymentPending, setPaymentPending] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated && status?.loggedIn && status.hasClub) {
      setStep(4);
    }
  }, [authLoading, isAuthenticated, status]);

  const handleStep1 = useCallback(async () => {
    setError(null);
    if (!consent) {
      setError("Please accept the Privacy Policy and Terms of Service.");
      return;
    }
    const ageN = Number(age);
    if (!email.trim() || password.length < 8 || !name.trim()) {
      setError("Email, password (8+ characters), and name are required.");
      return;
    }
    if (!Number.isFinite(ageN) || ageN < 18) {
      setError("Age must be 18 or older.");
      return;
    }
    setBusy(true);
    try {
      await registerOwner({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        age: ageN,
        phone: phone.trim() || undefined,
        consentGiven: true,
      });
      const { signingIn } = await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });
      if (!signingIn) {
        setError("Account created but sign-in failed. Try logging in from Renew.");
        setBusy(false);
        return;
      }
      captureEvent("onboarding_owner_registered");
      setStep(2);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [
    consent,
    age,
    email,
    password,
    name,
    phone,
    registerOwner,
    signIn,
  ]);

  const handleGeocode = useCallback(async () => {
    setError(null);
    if (!address.trim()) {
      setError("Enter the club address first.");
      return;
    }
    setBusy(true);
    try {
      const loc = await geocode({ address: address.trim() });
      setLat(loc.lat);
      setLng(loc.lng);
    } catch (e) {
      setError(parseConvexError(e as Error).message + " — you can skip geocoding and continue.");
    } finally {
      setBusy(false);
    }
  }, [address, geocode]);

  const handleStep2 = useCallback(async () => {
    setError(null);
    const rate = Number(baseRate);
    const minM = Number(minBill);
    if (!clubName.trim() || !address.trim()) {
      setError("Club name and address are required.");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("Base rate per minute must be a positive number.");
      return;
    }
    if (!Number.isFinite(minM) || minM < 1) {
      setError("Minimum bill minutes must be at least 1.");
      return;
    }
    setBusy(true);
    try {
      await saveDraft({
        clubName: clubName.trim(),
        address: address.trim(),
        location: { lat: lat ?? 0, lng: lng ?? 0 },
        currency: currency.trim().toUpperCase(),
        baseRatePerMin: rate,
        minBillMinutes: Math.floor(minM),
        timezone: timezone.trim(),
      });
      captureEvent("onboarding_club_draft_saved");
      setStep(3);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [
    lat,
    lng,
    clubName,
    address,
    currency,
    baseRate,
    minBill,
    timezone,
    saveDraft,
  ]);

  const handlePay = useCallback(async () => {
    setError(null);
    setBusy(true);
    setPaymentPending(true);
    try {
      await loadRazorpayScript();
      const order = await createOrder({ flow: "onboarding", planId });
      const RazorpayCtor = (window as unknown as { Razorpay: new (opts: object) => { open: () => void } }).Razorpay;
      const rzp = new RazorpayCtor({
        key: order.keyId,
        order_id: order.orderId,
        currency: order.currency,
        name: "A3 Billiards OS",
        description: `Subscription — ${planId}`,
        handler: () => {
          captureEvent("onboarding_razorpay_success", { planId });
        },
        prefill: { email: email.trim().toLowerCase(), name: name.trim() },
        theme: { color: "#f5a623" },
        modal: {
          ondismiss: () => {
            setPaymentPending(false);
            setBusy(false);
          },
        },
      });
      rzp.open();
      setBusy(false);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
      setBusy(false);
      setPaymentPending(false);
    }
  }, [createOrder, planId, email, name]);

  const handleCoupon = useCallback(async () => {
    setError(null);
    setBusy(true);
    setPaymentPending(true);
    try {
      await applyCoupon({
        flow: "onboarding",
        planId,
        couponCode,
      });
      captureEvent("onboarding_coupon_applied", { planId });
    } catch (e) {
      setError(parseConvexError(e as Error).message);
      setPaymentPending(false);
    } finally {
      setBusy(false);
    }
  }, [applyCoupon, couponCode, planId]);

  useEffect(() => {
    if (!paymentPending || !status?.loggedIn) return;
    if (status.hasClub) {
      setPaymentPending(false);
      setStep(4);
      captureEvent("onboarding_club_created");
    }
  }, [paymentPending, status]);

  if (authLoading || status === undefined) {
    return (
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Club onboarding</h1>
      <p className="muted">
        Create your owner account, add your club, then complete subscription payment.
      </p>

      <div className="steps" aria-hidden>
        <span className={`step-pill ${step >= 1 ? "active" : ""}`}>1 · Account</span>
        <span className={`step-pill ${step >= 2 ? "active" : ""}`}>2 · Club</span>
        <span className={`step-pill ${step >= 3 ? "active" : ""}`}>3 · Pay</span>
        <span className={`step-pill ${step >= 4 ? "active" : ""}`}>4 · Done</span>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {step === 1 && (
        <>
          <h2>Owner account</h2>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password (min 8 characters)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="row">
            <div>
              <label htmlFor="age">Age</label>
              <input
                id="age"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="phone">Mobile (optional, +91…)</label>
              <input
                id="phone"
                value={phone}
                placeholder="+91xxxxxxxxxx"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="consent-row">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent" style={{ margin: 0, color: "var(--text)" }}>
              I agree to the{" "}
              <a href={PRIVACY} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              ,{" "}
              <a href={TERMS} target="_blank" rel="noreferrer">
                Terms of Service
              </a>
              , and the{" "}
              <a href={DPDP} target="_blank" rel="noreferrer">
                DPDP processing notice
              </a>
              .
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleStep1()}>
            {busy ? "Please wait…" : "Continue"}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Club details</h2>
          <label htmlFor="clubName">Club name</label>
          <input
            id="clubName"
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
          />
          <label htmlFor="address">Street address</label>
          <textarea
            id="address"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void handleGeocode()}>
              {busy ? "Geocoding…" : "Geocode address"}
            </button>
            {lat === null && (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Optional — or just continue without it
              </span>
            )}
          </div>
          {lat !== null && lng !== null ? (
            <p className="muted" style={{ marginTop: 8 }}>
              ✓ Location pinned: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>
              Geocoding pins your club on the map for discovery. You can skip this and continue.
            </p>
          )}
          <div className="row">
            <div>
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label htmlFor="timezone">Timezone (IANA)</label>
              <input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label htmlFor="baseRate">Base rate / minute</label>
              <input
                id="baseRate"
                inputMode="decimal"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="minBill">Minimum bill (minutes)</label>
              <input
                id="minBill"
                inputMode="numeric"
                value={minBill}
                onChange={(e) => setMinBill(e.target.value)}
              />
            </div>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleStep2()}>
            Continue to payment
          </button>
        </>
      )}

      {step === 3 && plans && (
        <>
          <h2>Choose plan</h2>
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
                  {(p.amountPaise / 100).toLocaleString("en-IN")} {p.currency}{" "}
                  · {(p.periodMs / 86_400_000).toFixed(0)} days access
                </p>
              </div>
            ))}
          </div>
          <p className="muted">
            After payment, Razorpay confirms in the background (usually within seconds). This page will advance
            automatically when your club is created.
          </p>
          <button type="button" className="btn btn-primary" disabled={busy || paymentPending} onClick={() => void handlePay()}>
            Pay with Razorpay
          </button>
          <div style={{ marginTop: 16 }}>
            <label htmlFor="couponCode">Coupon code (testing)</label>
            <div className="row" style={{ gridTemplateColumns: "1fr auto" }}>
              <input
                id="couponCode"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon (e.g. A3A3A3)"
                disabled={busy || paymentPending}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || paymentPending || couponCode.trim().length === 0}
                onClick={() => void handleCoupon()}
              >
                Apply coupon
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              For testing only: coupon <strong>A3A3A3</strong> grants selected plan without Razorpay.
            </p>
          </div>
          {paymentPending && !status?.hasClub ? (
            <p className="muted" style={{ marginTop: 16 }}>
              Waiting for payment confirmation… You can keep this tab open.
            </p>
          ) : null}
        </>
      )}

      {step === 4 && (
        <>
          <div className="success-banner">
            Your club is live on A3 Billiards OS. Open the Owner App and sign in with the same email and password.
          </div>
          <p className="muted">
            Download links: use your internal distribution / app store listing for &quot;A3 Owner&quot;.
          </p>
        </>
      )}
    </div>
  );
}
