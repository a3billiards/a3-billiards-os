import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent, CSSProperties, KeyboardEvent } from "react";
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

type RegistrationPhase = "account" | "verify-email" | "email-verified";

const OTP_LENGTH = 6;

function maskEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return trimmed;
  const user = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

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

function RegisterSecurityNote({ boxed = false }: { boxed?: boolean }) {
  return (
    <div className={`register-hero-security${boxed ? " is-boxed" : ""}`}>
      <span className="register-hero-security-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <path
            d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect
            x="9.2"
            y="10.2"
            width="5.6"
            height="4.4"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M12 10.2V9a1.4 1.4 0 0 1 2.8 0v1.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <div className="register-hero-security-copy">
        <p className="register-hero-security-title">Your data is secure with us.</p>
        <p className="register-hero-security-sub">We never share your information.</p>
      </div>
    </div>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  const [otpFocusIndex, setOtpFocusIndex] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpAutoSubmitRef = useRef<string | null>(null);
  const otpBoxesRef = useRef<HTMLDivElement | null>(null);
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

    // After OTP verify + sign-in: show success UI; wait for Continue.
    if (postSignInPending || registrationPhase === "verify-email") {
      setPostSignInPending(false);
      setRegistrationPhase("email-verified");
      setStep(1);
      return;
    }

    if (registrationPhase === "email-verified") {
      return;
    }

    setRegistrationPhase("account");
    setStep(2);
  }, [
    authLoading,
    isAuthenticated,
    status,
    postSignInPending,
    registrationPhase,
  ]);

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
      otpAutoSubmitRef.current = null;
      const message =
        e instanceof Error
          ? parseConvexError(e).message
          : "Invalid verification code. Please try again.";
      setError(message || "Invalid verification code. Please try again.");
      setVerificationCode("");
      setOtpFocusIndex(0);
      queueMicrotask(() => otpRefs.current[0]?.focus());
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    postSignInPending,
    verificationCode,
    email,
    password,
    verifyEmailCode,
    signIn,
  ]);

  useEffect(() => {
    if (registrationPhase !== "verify-email") return;
    const id = window.setTimeout(() => {
      const idx = Math.min(verificationCode.length, OTP_LENGTH - 1);
      otpRefs.current[idx]?.focus();
      setOtpFocusIndex(idx);
    }, 40);
    return () => window.clearTimeout(id);
    // Only when entering the OTP phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationPhase]);

  const setOtpDigit = useCallback((index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setVerificationCode((prev) => {
      const before = prev.slice(0, index);
      const after = prev.slice(index + 1);
      return `${before}${digit}${after}`.replace(/\D/g, "").slice(0, OTP_LENGTH);
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
      setOtpFocusIndex(index + 1);
    }
  }, []);

  const handleOtpKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        setVerificationCode((prev) => {
          const chars = prev.split("");
          if (chars[index]) {
            chars[index] = "";
            return chars.join("");
          }
          if (index > 0) {
            chars[index - 1] = "";
            queueMicrotask(() => {
              otpRefs.current[index - 1]?.focus();
              setOtpFocusIndex(index - 1);
            });
            return chars.join("");
          }
          return prev;
        });
        return;
      }
      if (e.key === "ArrowLeft" && index > 0) {
        otpRefs.current[index - 1]?.focus();
        setOtpFocusIndex(index - 1);
      }
      if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
        otpRefs.current[index + 1]?.focus();
        setOtpFocusIndex(index + 1);
      }
    },
    [],
  );

  const handleOtpPaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, OTP_LENGTH);
      if (!pasted) return;
      setVerificationCode(pasted);
      const focusAt = Math.min(pasted.length, OTP_LENGTH - 1);
      otpRefs.current[focusAt]?.focus();
      setOtpFocusIndex(focusAt);
    },
    [],
  );

  const continueAfterEmailVerified = useCallback(() => {
    setError(null);
    setRegistrationPhase("account");
    setStep(2);
  }, []);

  // Keep the glowing active box aligned with the next empty digit.
  const otpActiveIndex =
    verificationCode.length >= OTP_LENGTH
      ? OTP_LENGTH - 1
      : Math.max(0, Math.min(otpFocusIndex, verificationCode.length));

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
      if (
        !Number.isFinite(result.lat) ||
        !Number.isFinite(result.lng)
      ) {
        setError("Could not locate that address on the map. Try a fuller address.");
        return;
      }
      setLat(result.lat);
      setLng(result.lng);
      setMapFocusLat(result.lat);
      setMapFocusLng(result.lng);
      setMapFocusToken((token) => token + 1);
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
      <div className="auth-page auth-page-register">
        <div className="auth-stage" aria-hidden="true">
          <img
            className="auth-stage-art"
            src="/images/auth-hero.png"
            alt=""
            draggable={false}
          />
          <div className="auth-stage-shade" />
        </div>
        <div className="auth-register-scroll">
          <div className="auth-card auth-card-wide">
            <p className="muted" style={{ margin: 0 }}>
              Loading…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page-register">
      <div className="auth-stage" aria-hidden="true">
        <img
          className="auth-stage-art"
          src="/images/auth-hero.png"
          alt=""
          draggable={false}
        />
        <div className="auth-stage-shade" />
      </div>
      <div className="auth-register-scroll">
      <div className="auth-card auth-card-wide">
      {registrationPhase !== "verify-email" &&
      registrationPhase !== "email-verified" &&
      step !== 2 &&
      step !== 3 ? (
        <header className="register-hero">
          <div className="register-hero-copy">
            <Link to="/" className="register-hero-brand">
              <img
                className="register-hero-mark"
                src="/images/small-logo.png"
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="register-hero-brand-text">A3 BILLIARDS OS</span>
            </Link>
            <h1 className="register-hero-title">Create account</h1>
            <p className="register-hero-subtitle">
              Owner account, club details, then subscription — same flow as before.
            </p>

            <nav className="register-stepper" aria-label="Onboarding progress">
              {(
                [
                  { n: 1 as Step, label: "Account" },
                  { n: 2 as Step, label: "Club" },
                  { n: 3 as Step, label: "Pay" },
                  { n: 4 as Step, label: "Done" },
                ] as const
              ).map(({ n, label }, index, list) => {
                const completed = step > n;
                const current = step === n;
                return (
                  <div key={n} className="register-stepper-item">
                    {index > 0 ? (
                      <span
                        className={`register-stepper-line ${step >= n ? "is-filled" : ""}`}
                        aria-hidden="true"
                      />
                    ) : null}
                    <button
                      type="button"
                      className={[
                        "register-stepper-btn",
                        current ? "is-current" : "",
                        completed ? "is-completed" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!completed}
                      onClick={() => goToEarlierStep(n)}
                      aria-current={current ? "step" : undefined}
                      aria-label={`${label} (step ${n} of ${list.length})`}
                    >
                      <span className="register-stepper-circle">{n}</span>
                      <span className="register-stepper-label">{label}</span>
                    </button>
                  </div>
                );
              })}
            </nav>

            <RegisterSecurityNote />
          </div>

          <div className="register-hero-art" aria-hidden="true">
            <video
              className="register-hero-video"
              src="/videos/eightball-smoke.mp4"
              poster="/images/auth-hero.png"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="register-hero-art-fade" />
          </div>
        </header>
      ) : registrationPhase === "verify-email" ||
        registrationPhase === "email-verified" ? (
        <Link to="/" className="auth-card-brand">
          <span className="auth-card-brand-a3">A3</span>
          <span className="auth-card-brand-rest">BILLIARDS OS</span>
        </Link>
      ) : null}

      {step === 1 && registrationPhase === "verify-email" && (
        <div className="otp-panel otp-panel-enter">
          <p className="otp-kicker">OTP Verification</p>
          <p className="otp-subtitle">
            Enter the {OTP_LENGTH}-digit code we sent to{" "}
            <strong>{maskEmail(email)}</strong>.
          </p>

          {error ? <div className="auth-error">{error}</div> : null}

          <div
            className="otp-boxes"
            ref={otpBoxesRef}
            role="group"
            aria-label="Email verification code"
          >
            <span
              className={[
                "otp-traveling-glow",
                verificationCode.length === OTP_LENGTH ? "is-complete" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
              style={
                {
                  "--otp-i": otpActiveIndex,
                } as CSSProperties
              }
            />
            {Array.from({ length: OTP_LENGTH }, (_, index) => {
              const value = verificationCode[index] ?? "";
              const active = otpActiveIndex === index && !busy && !postSignInPending;
              return (
                <div
                  key={index}
                  className={[
                    "otp-box",
                    active ? "is-active" : "",
                    value ? "is-filled" : "",
                    verificationCode.length === OTP_LENGTH ? "is-complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    className="otp-box-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={value}
                    disabled={busy || postSignInPending}
                    aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                    onFocus={() => setOtpFocusIndex(index)}
                    onChange={(e) => setOtpDigit(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                  />
                  {value ? (
                    <span className="otp-digit" aria-hidden="true">
                      {value}
                    </span>
                  ) : active ? (
                    <span className="otp-caret" aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-primary otp-continue"
            disabled={
              busy || postSignInPending || verificationCode.length !== OTP_LENGTH
            }
            onClick={() => void handleVerifyEmail()}
          >
            <span className="auth-submit-fill" aria-hidden="true" />
            <span className="auth-fill-label">
              {busy || postSignInPending ? "Verifying…" : "Continue"}
            </span>
          </button>

          <div className="otp-actions">
            <button
              type="button"
              className="btn btn-secondary otp-action-btn otp-resend-btn"
              disabled={busy || resendCooldown > 0 || postSignInPending}
              onClick={() => void handleResendVerification()}
            >
              <span>Resend code</span>
              {resendCooldown > 0 ? (
                <span className="otp-resend-timer" aria-live="polite">
                  {resendCooldown}s
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="btn btn-secondary otp-action-btn"
              disabled={busy || postSignInPending}
              onClick={() => {
                setError(null);
                setVerificationCode("");
                otpAutoSubmitRef.current = null;
                setRegistrationPhase("account");
              }}
            >
              Back to account details
            </button>
          </div>
        </div>
      )}

      {step === 1 && registrationPhase === "email-verified" && (
        <div className="otp-panel otp-panel-success otp-panel-enter">
          <p className="otp-kicker">OTP Verification</p>
          <h2 className="otp-title">Email verified</h2>
          <p className="otp-subtitle">You&apos;re signed in on this device.</p>

          <div className="otp-success-mark" aria-hidden="true">
            <span className="otp-success-glow" />
            <span className="otp-success-box">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path
                  d="M9 18.5 15.2 24.5 27 11.5"
                  stroke="#22c55e"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary otp-continue"
            onClick={continueAfterEmailVerified}
          >
            <span className="auth-submit-fill" aria-hidden="true" />
            <span className="auth-fill-label">Continue</span>
          </button>
        </div>
      )}

      {step === 1 && registrationPhase === "account" && (
        <>
          {error ? <div className="auth-error">{error}</div> : null}
          <h2>Owner account</h2>
          <div className="row">
            <label className="auth-field" htmlFor="email">
              <span className="auth-field-label">Email</span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@club.com"
              />
            </label>
            <label className="auth-field" htmlFor="name">
              <span className="auth-field-label">Full name</span>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          </div>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem" }}>
            {STRONG_PASSWORD_HINT}
          </p>
          <div className="row">
            <label className="auth-field" htmlFor="password">
              <span className="auth-field-label">Password</span>
              <span className="auth-field-row">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            <label className="auth-field" htmlFor="confirmPassword">
              <span className="auth-field-label">Confirm password</span>
              <span className="auth-field-row">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
          </div>
          <PasswordStrengthBar password={password} />
          <div className="row">
            <label className="auth-field" htmlFor="age">
              <span className="auth-field-label">Age</span>
              <input
                id="age"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>
            <label className="auth-field" htmlFor="phone">
              <span className="auth-field-label">Mobile (optional)</span>
              <input
                id="phone"
                value={phoneLocal}
                inputMode="numeric"
                placeholder="+91 mobile number"
                onChange={(e) => setPhoneLocal(e.target.value)}
              />
            </label>
          </div>
          <div className="consent-row">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent">
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void handleStep1()}
          >
            <span className="auth-submit-fill" aria-hidden="true" />
            <span className="auth-fill-label">
              {busy ? "Please wait…" : "Continue"}
            </span>
          </button>
          <p className="auth-footer">
            Already registered?{" "}
            <Link to="/login" className="auth-footer-strong">
              Sign in
            </Link>
            {" · "}
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </>
      )}

      {step === 2 && (
        <div className="club-shell">
          <div className="club-main">
            <header className="register-hero is-club">
              <div className="register-hero-copy">
                <Link to="/" className="register-hero-brand">
                  <img
                    className="register-hero-mark"
                    src="/images/small-logo.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                  <span className="register-hero-brand-text">A3 BILLIARDS OS</span>
                </Link>
                <h1 className="register-hero-title">Create account</h1>
                <p className="register-hero-subtitle">
                  Owner account, club details, then subscription — same flow as before.
                </p>

                <nav className="register-stepper" aria-label="Onboarding progress">
                  {(
                    [
                      { n: 1 as Step, label: "Account" },
                      { n: 2 as Step, label: "Club" },
                      { n: 3 as Step, label: "Pay" },
                      { n: 4 as Step, label: "Done" },
                    ] as const
                  ).map(({ n, label }, index, list) => {
                    const completed = step > n;
                    const current = step === n;
                    return (
                      <div key={n} className="register-stepper-item">
                        {index > 0 ? (
                          <span
                            className={`register-stepper-line ${step >= n ? "is-filled" : ""}`}
                            aria-hidden="true"
                          />
                        ) : null}
                        <button
                          type="button"
                          className={[
                            "register-stepper-btn",
                            current ? "is-current" : "",
                            completed ? "is-completed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={!completed}
                          onClick={() => goToEarlierStep(n)}
                          aria-current={current ? "step" : undefined}
                          aria-label={`${label} (step ${n} of ${list.length})`}
                        >
                          <span className="register-stepper-circle">{n}</span>
                          <span className="register-stepper-label">{label}</span>
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </header>

            <div className="club-form">
              <RegisterSecurityNote boxed />
              <h2>Club details</h2>
              {error ? <div className="auth-error">{error}</div> : null}

              <label className="auth-field" htmlFor="clubName">
                <span className="auth-field-label">Club name</span>
                <input
                  id="clubName"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                />
              </label>
              <label className="auth-field" htmlFor="address">
                <span className="auth-field-label">Street address</span>
                <textarea
                  id="address"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Building, street, area, city, state, PIN"
                />
              </label>
              <span className="auth-field-label">Club location on map</span>
              <button
                type="button"
                className="btn btn-secondary club-find-btn"
                disabled={busy || geocoding || !address.trim()}
                onClick={() => void handleFindOnMap()}
              >
                <span>{geocoding ? "Finding address on map…" : "Find address on map"}</span>
                <span aria-hidden="true">›</span>
              </button>
              <p className="muted club-map-hint">
                Drag the map to move around, click to drop the pin, or use your current location.
                Use +/− to zoom.
              </p>
            </div>
          </div>

          <div className="club-side">
            <ClubLocationPinPicker
              lat={lat}
              lng={lng}
              onChange={handlePinChange}
              disabled={busy || geocoding}
              focusLat={mapFocusLat}
              focusLng={mapFocusLng}
              focusToken={mapFocusToken}
              hideHint
            />
            <div className="row club-meta-row">
              <label className="auth-field" htmlFor="currency">
                <span className="auth-field-label">Currency</span>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label className="auth-field" htmlFor="timezone">
                <span className="auth-field-label">Timezone (IANA)</span>
                <input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
            </div>
            <div className="row club-meta-row">
              <label className="auth-field" htmlFor="baseRate">
                <span className="auth-field-label">Base rate / minute</span>
                <input
                  id="baseRate"
                  inputMode="decimal"
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                />
              </label>
              <label className="auth-field" htmlFor="minBill">
                <span className="auth-field-label">Minimum bill (minutes)</span>
                <input
                  id="minBill"
                  inputMode="numeric"
                  value={minBill}
                  onChange={(e) => setMinBill(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="club-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !canUseProtectedOnboarding}
              onClick={() => void handleStep2()}
            >
              <span className="auth-submit-fill" aria-hidden="true" />
              <span className="auth-fill-label club-continue-label">
                <span>{busy ? "Please wait…" : "Continue to payment"}</span>
                <span aria-hidden="true">→</span>
              </span>
            </button>
            {!canUseProtectedOnboarding ? (
              <p className="muted" style={{ marginTop: 10 }}>
                Sign in required…
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary club-back-btn"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              <span aria-hidden="true">←</span>
              Back to account
            </button>
          </div>
        </div>
      )}

      {step === 3 && plans === undefined && (
        <p className="muted">Loading plans…</p>
      )}

      {step === 3 && plans && (
        <div className="pay-shell">
          <div className="pay-main">
            <header className="register-hero is-pay">
              <div className="register-hero-copy">
                <Link to="/" className="register-hero-brand">
                  <img
                    className="register-hero-mark"
                    src="/images/small-logo.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                  <span className="register-hero-brand-text">A3 BILLIARDS OS</span>
                </Link>
                <h1 className="register-hero-title">Create account</h1>
                <p className="register-hero-subtitle">
                  Owner account, club details, then subscription — same flow as before.
                </p>

                <nav className="register-stepper" aria-label="Onboarding progress">
                  {(
                    [
                      { n: 1 as Step, label: "Account" },
                      { n: 2 as Step, label: "Club" },
                      { n: 3 as Step, label: "Pay" },
                      { n: 4 as Step, label: "Done" },
                    ] as const
                  ).map(({ n, label }, index, list) => {
                    const completed = step > n;
                    const current = step === n;
                    return (
                      <div key={n} className="register-stepper-item">
                        {index > 0 ? (
                          <span
                            className={`register-stepper-line ${step >= n ? "is-filled" : ""}`}
                            aria-hidden="true"
                          />
                        ) : null}
                        <button
                          type="button"
                          className={[
                            "register-stepper-btn",
                            current ? "is-current" : "",
                            completed ? "is-completed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={!completed}
                          onClick={() => goToEarlierStep(n)}
                          aria-current={current ? "step" : undefined}
                          aria-label={`${label} (step ${n} of ${list.length})`}
                        >
                          <span className="register-stepper-circle">{n}</span>
                          <span className="register-stepper-label">{label}</span>
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </header>

            <div className="pay-copy">
              <RegisterSecurityNote boxed />
              <h2>Choose plan</h2>
              {error ? <div className="auth-error">{error}</div> : null}
              <div className="pay-plan-grid" role="radiogroup" aria-label="Subscription plan">
                {(plans as SubscriptionPlanRow[]).map((p) => {
                  const selected = planId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`pay-plan-card ${selected ? "selected" : ""}`}
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
                      <span className={`pay-plan-radio ${selected ? "is-on" : ""}`} aria-hidden="true" />
                      <div className="pay-plan-meta">
                        <h3>{p.label}</h3>
                        <p>
                          {p.id === "monthly" ? (
                            <>
                              ₹0 first month, then {(p.amountPaise / 100).toLocaleString("en-IN")}{" "}
                              {p.currency}/mo excl. GST
                              {" · "}
                              {(p.periodMs / 86_400_000).toFixed(0)} days access
                            </>
                          ) : (
                            <>
                              {(p.amountPaise / 100).toLocaleString("en-IN")} {p.currency} excl. GST
                              {" · "}
                              {(p.periodMs / 86_400_000).toFixed(0)} days access
                            </>
                          )}
                        </p>
                      </div>
                      {p.id === "monthly" ? (
                        <span className="pay-plan-badge">Most popular ★</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const selected = (plans as SubscriptionPlanRow[]).find((p) => p.id === planId);
                if (!selected) return null;
                return (
                  <div className="pay-gst">
                    <p className="pay-gst-sac">
                      SAC: {selected.invoiceConfig.sacCode}
                      {selected.invoiceConfig.gstin
                        ? ` · Supplier GSTIN: ${selected.invoiceConfig.gstin}`
                        : null}
                    </p>
                    <SubscriptionGstBreakdown gst={selected.gst} currency={selected.currency} compact />
                    <p className="pay-confirm-note">
                      <span className="pay-confirm-lock" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                          <rect
                            x="6"
                            y="11"
                            width="12"
                            height="9"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      Payment confirms in the background. This page advances when your club is created.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="pay-aside">
            <div className="pay-aside-art" aria-hidden="true">
              <video
                className="register-hero-video"
                src="/videos/eightball-smoke.mp4"
                poster="/images/auth-hero.png"
                autoPlay
                muted
                loop
                playsInline
              />
              <div className="register-hero-art-fade" />
            </div>
            <button
              type="button"
              className="btn btn-primary pay-razorpay-btn"
              disabled={busy || paymentPending || !canUseProtectedOnboarding}
              onClick={() => void handlePay()}
            >
              <span className="auth-submit-fill" aria-hidden="true" />
              <span className="auth-fill-label pay-razorpay-label">
                <svg className="pay-razorpay-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M7.2 3.2h6.4c2.6 0 4.2 1.8 4.2 4.1 0 2.6-1.9 4.2-4.6 4.2H9.6L8 20.8H4.2L7.2 3.2zm3.1 5.8h2.3c1.1 0 1.8-.6 1.8-1.5s-.6-1.4-1.7-1.4H11L10.3 9z"
                    fill="currentColor"
                  />
                </svg>
                <span>{busy || paymentPending ? "Please wait…" : "Pay with Razorpay"}</span>
                <span className="pay-razorpay-arrow" aria-hidden="true">
                  →
                </span>
              </span>
            </button>
            {paymentPending && !status?.hasClub ? (
              <p className="muted pay-waiting">Waiting for confirmation…</p>
            ) : null}
            {!canUseProtectedOnboarding ? (
              <p className="muted pay-waiting">Sign in required…</p>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary pay-back-btn"
              disabled={busy || paymentPending}
              onClick={() => setStep(2)}
            >
              <span aria-hidden="true">←</span>
              Back to club details
            </button>
          </div>
        </div>
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
      </div>
    </div>
  );
}
