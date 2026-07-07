import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { captureEvent } from "../instrumentation";
import { ClubLocationPinPicker } from "../components/ClubLocationPinPicker";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";
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

const PRIVACY = "/privacy";
const TERMS = "/terms";
const DPDP = "/dpdp";
const RESEND_COOLDOWN_SEC = 60;

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

type RegistrationPhase = "account" | "verify-email";

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

const PHONE_COUNTRY_CODE = "+91";

export default function Register() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const registerOwner = useAction(api.onboardingWebActions.registerOwnerAccount);
  const geocodeClubAddress = useAction(api.onboardingWebActions.geocodeClubAddress);
  const sendVerificationCode = useAction(
    api.ownerEmailVerificationActions.sendOwnerEmailVerificationCode,
  );
  const verifyEmailCode = useAction(api.ownerEmailVerificationActions.verifyOwnerEmailCode);
  const createOrder = useAction(api.onboardingWebActions.createRazorpayOrder);
  const saveDraft = useMutation(api.onboardingWeb.saveClubDraft);
  const status = useQuery(api.onboardingWeb.getMyOnboardingStatus);
  const plans = useQuery(api.onboardingWeb.listSubscriptionPlans);

  const [step, setStep] = useState<Step>(1);
  const [registrationPhase, setRegistrationPhase] =
    useState<RegistrationPhase>("account");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phoneCountryCode] = useState(PHONE_COUNTRY_CODE);
  const [phoneLocal, setPhoneLocal] = useState("");
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
  const [postSignInPending, setPostSignInPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mapFocusLat, setMapFocusLat] = useState<number | null>(null);
  const [mapFocusLng, setMapFocusLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const canUseProtectedOnboarding =
    !authLoading &&
    isAuthenticated &&
    status?.loggedIn === true &&
    status.emailVerified === true;

  useEffect(() => {
    if (authLoading || !isAuthenticated || !status?.loggedIn) return;

    if (status.hasClub) {
      setStep(4);
      return;
    }

    if (!status.emailVerified) {
      setStep(1);
      setRegistrationPhase("verify-email");
      if (status.email) setEmail(status.email);
      return;
    }

    if (postSignInPending) setPostSignInPending(false);
    setRegistrationPhase("account");
    setStep(2);
  }, [authLoading, isAuthenticated, status, postSignInPending]);

  useEffect(() => {
    const plan = searchParams.get("plan");
    if (plan === "monthly" || plan === "yearly") {
      setPlanId(plan);
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step !== 4 || !status?.hasClub) return;
    const timer = setTimeout(() => {
      nav("/dashboard", { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [step, status?.hasClub, nav]);

  const goToEarlierStep = useCallback(
    (target: Step) => {
      if (target >= step) return;
      setError(null);
      if (target === 1) {
        setStep(1);
        if (status?.emailVerified) {
          setRegistrationPhase("account");
        }
        return;
      }
      setStep(target);
    },
    [step, status?.emailVerified],
  );

  const handleStep1 = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (!consent) {
      setError("Please accept the Privacy Policy and Terms of Service.");
      return;
    }
    const ageN = Number(age);
    if (!email.trim() || !confirmPassword || !name.trim()) {
      setError("Email, password, and name are required.");
      return;
    }
    const pwdError = getStrongPasswordError(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }
    if (!Number.isFinite(ageN) || ageN < 18) {
      setError("Age must be 18 or older.");
      return;
    }
    const phoneDigits = phoneLocal.replace(/\D/g, "");
    const fullPhone =
      phoneDigits.length > 0 ? `${phoneCountryCode}${phoneDigits}` : undefined;
    setBusy(true);
    try {
      await registerOwner({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        age: ageN,
        phone: fullPhone,
        consentGiven: true,
      });
      captureEvent("onboarding_owner_registered");
      setRegistrationPhase("verify-email");
      setVerificationCode("");
      setResendCooldown(RESEND_COOLDOWN_SEC);
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
    confirmPassword,
    name,
    phoneCountryCode,
    phoneLocal,
    registerOwner,
  ]);

  const handleVerifyEmail = useCallback(async () => {
    if (busy || postSignInPending) return;
    setError(null);
    const normalizedCode = verificationCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      await verifyEmailCode({
        email: email.trim().toLowerCase(),
        code: normalizedCode,
      });
      const { signingIn } = await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });
      if (!signingIn) {
        setError("Email verified but sign-in failed. Try logging in.");
        return;
      }
      captureEvent("onboarding_owner_email_verified");
      setPostSignInPending(true);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [verificationCode, email, password, verifyEmailCode, signIn]);

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await sendVerificationCode({ email: email.trim().toLowerCase() });
      captureEvent("onboarding_owner_verification_resent");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [email, resendCooldown, sendVerificationCode]);

  const handlePinChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  }, []);

  const handleFindOnMap = useCallback(async () => {
    if (geocoding || busy) return;
    if (!address.trim()) {
      setError("Enter your street address first.");
      return;
    }
    setError(null);
    setGeocoding(true);
    try {
      const result = await geocodeClubAddress({ address: address.trim() });
      setLat(result.lat);
      setLng(result.lng);
      setMapFocusLat(result.lat);
      setMapFocusLng(result.lng);
    } catch (e) {
      setError(parseConvexError(e as Error).message);
    } finally {
      setGeocoding(false);
    }
  }, [address, geocodeClubAddress]);

  const handleStep2 = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (!canUseProtectedOnboarding) {
      return;
    }
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
    if (lat === null || lng === null || (lat === 0 && lng === 0)) {
      setError("Pin your club location on the map before continuing.");
      return;
    }
    setBusy(true);
    try {
      await saveDraft({
        clubName: clubName.trim(),
        address: address.trim(),
        location: { lat, lng },
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
    canUseProtectedOnboarding,
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
    if (busy || paymentPending) return;
    setError(null);
    if (!canUseProtectedOnboarding) {
      return;
    }
    setBusy(true);
    setPaymentPending(true);
    try {
      await loadRazorpayScript();
      const order = await createOrder({ flow: "onboarding", planId });
      const selectedPlan = (plans as SubscriptionPlanRow[]).find((p) => p.id === planId);
      const gstNote = selectedPlan
        ? ` (incl. GST ${selectedPlan.gst.gstRatePercent}%)`
        : "";
      const RazorpayCtor = (window as unknown as { Razorpay: new (opts: object) => { open: () => void } }).Razorpay;
      const rzp = new RazorpayCtor({
        key: order.keyId,
        order_id: order.orderId,
        currency: order.currency,
        name: "A3 Billiards OS",
        description: `Subscription — ${planId}${gstNote}`,
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
  }, [canUseProtectedOnboarding, createOrder, planId, email, name, plans]);

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

      <div className="steps" aria-label="Onboarding progress">
        {(
          [
            { n: 1 as Step, label: "1 · Account" },
            { n: 2 as Step, label: "2 · Club" },
            { n: 3 as Step, label: "3 · Pay" },
            { n: 4 as Step, label: "4 · Done" },
          ] as const
        ).map(({ n, label }) => {
          const completed = step > n;
          const active = step >= n;
          return (
            <button
              key={n}
              type="button"
              className={`step-pill step-pill-button ${active ? "active" : ""}`}
              disabled={!completed}
              onClick={() => goToEarlierStep(n)}
              aria-current={step === n ? "step" : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {step === 1 && registrationPhase === "account" && (
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
          <label htmlFor="password">Password</label>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
            {STRONG_PASSWORD_HINT}
          </p>
          <input
            id="password"
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
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
              <label htmlFor="phone">Mobile (optional)</label>
              <input
                id="phone"
                value={phoneLocal}
                inputMode="numeric"
                placeholder="+91 mobile number"
                onChange={(e) => setPhoneLocal(e.target.value)}
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
          <p className="muted" style={{ marginTop: 12 }}>
            Already registered? <Link to="/login">Sign in</Link>
            {" · "}
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </>
      )}

      {step === 1 && registrationPhase === "verify-email" && (
        <>
          <h2>Verify your email</h2>
          <p className="muted">
            We sent a 6-digit code to <strong>{email.trim().toLowerCase()}</strong>. Enter it below
            to continue.
          </p>
          <label htmlFor="verificationCode">Verification code</label>
          <input
            id="verificationCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || verificationCode.length !== 6}
            onClick={() => void handleVerifyEmail()}
          >
            {busy || postSignInPending ? "Please wait…" : "Verify and continue"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || resendCooldown > 0}
            onClick={() => void handleResendVerification()}
            style={{ marginLeft: 10 }}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || postSignInPending}
            onClick={() => {
              setError(null);
              setRegistrationPhase("account");
            }}
            style={{ marginTop: 10 }}
          >
            Back to account details
          </button>
          {postSignInPending ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Signing you in…
            </p>
          ) : null}
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
            placeholder="Building, street, area, city, state, PIN"
          />
          <label>Club location on map</label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || geocoding || !address.trim()}
            onClick={() => void handleFindOnMap()}
            style={{ marginBottom: 8 }}
          >
            {geocoding ? "Finding address on map…" : "Find address on map"}
          </button>
          <ClubLocationPinPicker
            lat={lat}
            lng={lng}
            onChange={handlePinChange}
            disabled={busy || geocoding}
            focusLat={mapFocusLat}
            focusLng={mapFocusLng}
          />
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !canUseProtectedOnboarding}
            onClick={() => void handleStep2()}
          >
            Continue to payment
          </button>
          {!canUseProtectedOnboarding ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Sign in required…
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setStep(1)}
            style={{ marginLeft: 10 }}
          >
            Back to account
          </button>
        </>
      )}

      {step === 3 && plans === undefined && (
        <p className="muted">Loading plans…</p>
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
                  {(p.amountPaise / 100).toLocaleString("en-IN")} {p.currency} excl. GST
                  {" · "}
                  {(p.periodMs / 86_400_000).toFixed(0)} days access
                </p>
              </div>
            ))}
          </div>
          {(() => {
            const selected = (plans as SubscriptionPlanRow[]).find((p) => p.id === planId);
            if (!selected) return null;
            return (
              <>
                <p className="muted" style={{ marginTop: 12 }}>
                  SAC: {selected.invoiceConfig.sacCode}
                  {selected.invoiceConfig.gstin
                    ? ` · Supplier GSTIN: ${selected.invoiceConfig.gstin}`
                    : null}
                </p>
                <SubscriptionGstBreakdown gst={selected.gst} currency={selected.currency} compact />
              </>
            );
          })()}
          <p className="muted">
            Payment confirms in the background. This page advances when your club is created.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || paymentPending || !canUseProtectedOnboarding}
            onClick={() => void handlePay()}
          >
            Pay with Razorpay
          </button>
          {paymentPending && !status?.hasClub ? (
            <p className="muted" style={{ marginTop: 16 }}>
              Waiting for confirmation…
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || paymentPending}
            onClick={() => setStep(2)}
            style={{ marginTop: 12 }}
          >
            Back to club details
          </button>
        </>
      )}

      {step === 4 && (
        <>
          <div className="success-banner">
            Your club is live. Redirecting you to your dashboard…
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => nav("/dashboard", { replace: true })}
          >
            Go to dashboard now
          </button>
          <p className="muted" style={{ marginTop: 12 }}>
            Sign in to the Owner App with the same email and password.
          </p>
        </>
      )}
    </div>
  );
}
