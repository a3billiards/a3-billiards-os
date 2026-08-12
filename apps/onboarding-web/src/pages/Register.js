import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { captureEvent } from "../instrumentation";
import { ClubLocationPinPicker } from "../components/ClubLocationPinPicker";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";
import { getStrongPasswordError, getPasswordStrength, STRONG_PASSWORD_HINT, } from "../lib/passwordPolicy";
const STRENGTH_LABEL = {
    weak: "Weak",
    good: "Good",
    strong: "Strong",
};
const STRENGTH_COLOR = {
    weak: "#e53935",
    good: "#fb8c00",
    strong: "#43a047",
};
function PasswordStrengthBar({ password }) {
    const s = getPasswordStrength(password);
    if (s === "none")
        return null;
    const segs = s === "weak" ? 1 : s === "good" ? 2 : 3;
    const color = STRENGTH_COLOR[s] ?? "#ccc";
    return (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }, children: [_jsx("div", { style: { flex: 1, display: "flex", gap: 4 }, children: [0, 1, 2].map((i) => (_jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, backgroundColor: i < segs ? color : "#333" } }, i))) }), _jsx("span", { style: { fontSize: 12, fontWeight: 600, color, minWidth: 40, textAlign: "right" }, children: STRENGTH_LABEL[s] })] }));
}
const PRIVACY = "/privacy";
const TERMS = "/terms";
const DPDP = "/dpdp";
const RESEND_COOLDOWN_SEC = 60;
function loadRazorpayScript() {
    if (typeof window === "undefined")
        return Promise.resolve();
    const w = window;
    if (w.Razorpay)
        return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load payment SDK"));
        document.body.appendChild(s);
    });
}
const PHONE_COUNTRY_CODE = "+91";
export default function Register() {
    const [searchParams] = useSearchParams();
    const nav = useNavigate();
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const { signIn } = useAuthActions();
    const registerOwner = useAction(api.onboardingWebActions.registerOwnerAccount);
    const geocodeClubAddress = useAction(api.onboardingWebActions.geocodeClubAddress);
    const sendVerificationCode = useAction(api.ownerEmailVerificationActions.sendOwnerEmailVerificationCode);
    const verifyEmailCode = useAction(api.ownerEmailVerificationActions.verifyOwnerEmailCode);
    const createOrder = useAction(api.onboardingWebActions.createRazorpayOrder);
    const saveDraft = useMutation(api.onboardingWeb.saveClubDraft);
    const status = useQuery(api.onboardingWeb.getMyOnboardingStatus);
    const plans = useQuery(api.onboardingWeb.listSubscriptionPlans);
    const [step, setStep] = useState(1);
    const [registrationPhase, setRegistrationPhase] = useState("account");
    const [verificationCode, setVerificationCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
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
    const [lat, setLat] = useState(null);
    const [lng, setLng] = useState(null);
    const [currency, setCurrency] = useState("INR");
    const [baseRate, setBaseRate] = useState("5");
    const [minBill, setMinBill] = useState("30");
    const [timezone, setTimezone] = useState("Asia/Kolkata");
    const [planId, setPlanId] = useState("monthly");
    const [paymentPending, setPaymentPending] = useState(false);
    const [postSignInPending, setPostSignInPending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [mapFocusLat, setMapFocusLat] = useState(null);
    const [mapFocusLng, setMapFocusLng] = useState(null);
    const [geocoding, setGeocoding] = useState(false);
    const canUseProtectedOnboarding = !authLoading &&
        isAuthenticated &&
        status?.loggedIn === true &&
        status.emailVerified === true;
    useEffect(() => {
        if (authLoading || !isAuthenticated || !status?.loggedIn)
            return;
        if (status.hasClub) {
            setStep(4);
            return;
        }
        if (!status.emailVerified) {
            setStep(1);
            setRegistrationPhase("verify-email");
            if (status.email)
                setEmail(status.email);
            return;
        }
        if (postSignInPending)
            setPostSignInPending(false);
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
        if (resendCooldown <= 0)
            return;
        const timer = setInterval(() => {
            setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);
    useEffect(() => {
        if (step !== 4 || !status?.hasClub)
            return;
        const timer = setTimeout(() => {
            nav("/dashboard", { replace: true });
        }, 2500);
        return () => clearTimeout(timer);
    }, [step, status?.hasClub, nav]);
    const goToEarlierStep = useCallback((target) => {
        if (target >= step)
            return;
        setError(null);
        if (target === 1) {
            setStep(1);
            if (status?.emailVerified) {
                setRegistrationPhase("account");
            }
            return;
        }
        setStep(target);
    }, [step, status?.emailVerified]);
    const handleStep1 = useCallback(async () => {
        if (busy)
            return;
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
        const fullPhone = phoneDigits.length > 0 ? `${phoneCountryCode}${phoneDigits}` : undefined;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
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
        if (busy || postSignInPending)
            return;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
            setBusy(false);
        }
    }, [verificationCode, email, password, verifyEmailCode, signIn]);
    const handleResendVerification = useCallback(async () => {
        if (resendCooldown > 0 || busy)
            return;
        setError(null);
        setBusy(true);
        try {
            await sendVerificationCode({ email: email.trim().toLowerCase() });
            captureEvent("onboarding_owner_verification_resent");
            setResendCooldown(RESEND_COOLDOWN_SEC);
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
            setBusy(false);
        }
    }, [email, resendCooldown, sendVerificationCode]);
    const handlePinChange = useCallback((newLat, newLng) => {
        setLat(newLat);
        setLng(newLng);
    }, []);
    const handleFindOnMap = useCallback(async () => {
        if (geocoding || busy)
            return;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
            setGeocoding(false);
        }
    }, [address, geocodeClubAddress]);
    const handleStep2 = useCallback(async () => {
        if (busy)
            return;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
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
        if (busy || paymentPending)
            return;
        setError(null);
        if (!canUseProtectedOnboarding) {
            return;
        }
        setBusy(true);
        setPaymentPending(true);
        try {
            await loadRazorpayScript();
            const order = await createOrder({ flow: "onboarding", planId });
            const selectedPlan = plans.find((p) => p.id === planId);
            const gstNote = selectedPlan
                ? ` (incl. GST ${selectedPlan.gst.gstRatePercent}%)`
                : "";
            const RazorpayCtor = window.Razorpay;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
            setBusy(false);
            setPaymentPending(false);
        }
    }, [canUseProtectedOnboarding, createOrder, planId, email, name, plans]);
    useEffect(() => {
        if (!paymentPending || !status?.loggedIn)
            return;
        if (status.hasClub) {
            setPaymentPending(false);
            setStep(4);
            captureEvent("onboarding_club_created");
        }
    }, [paymentPending, status]);
    if (authLoading || status === undefined) {
        return (_jsx("div", { className: "card", children: _jsx("p", { className: "muted", children: "Loading\u2026" }) }));
    }
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Club onboarding" }), _jsx("p", { className: "muted", children: "Create your owner account, add your club, then complete subscription payment." }), _jsx("div", { className: "steps", "aria-label": "Onboarding progress", children: [
                    { n: 1, label: "1 · Account" },
                    { n: 2, label: "2 · Club" },
                    { n: 3, label: "3 · Pay" },
                    { n: 4, label: "4 · Done" },
                ].map(({ n, label }) => {
                    const completed = step > n;
                    const active = step >= n;
                    return (_jsx("button", { type: "button", className: `step-pill step-pill-button ${active ? "active" : ""}`, disabled: !completed, onClick: () => goToEarlierStep(n), "aria-current": step === n ? "step" : undefined, children: label }, n));
                }) }), error ? _jsx("div", { className: "error-banner", children: error }) : null, step === 1 && registrationPhase === "account" && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Owner account" }), _jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("label", { htmlFor: "password", children: "Password" }), _jsx("p", { className: "muted", style: { margin: "0 0 8px", fontSize: "0.85rem" }, children: STRONG_PASSWORD_HINT }), _jsx("input", { id: "password", type: "password", autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value) }), _jsx(PasswordStrengthBar, { password: password }), _jsx("label", { htmlFor: "confirmPassword", children: "Confirm password" }), _jsx("input", { id: "confirmPassword", type: "password", autoComplete: "new-password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value) }), _jsx("label", { htmlFor: "name", children: "Full name" }), _jsx("input", { id: "name", value: name, onChange: (e) => setName(e.target.value) }), _jsxs("div", { className: "row", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "age", children: "Age" }), _jsx("input", { id: "age", inputMode: "numeric", value: age, onChange: (e) => setAge(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "phone", children: "Mobile (optional)" }), _jsx("input", { id: "phone", value: phoneLocal, inputMode: "numeric", placeholder: "+91 mobile number", onChange: (e) => setPhoneLocal(e.target.value) })] })] }), _jsxs("div", { className: "consent-row", children: [_jsx("input", { id: "consent", type: "checkbox", checked: consent, onChange: (e) => setConsent(e.target.checked) }), _jsxs("label", { htmlFor: "consent", style: { margin: 0, color: "var(--text)" }, children: ["I agree to the", " ", _jsx("a", { href: PRIVACY, target: "_blank", rel: "noreferrer", children: "Privacy Policy" }), ",", " ", _jsx("a", { href: TERMS, target: "_blank", rel: "noreferrer", children: "Terms of Service" }), ", and the", " ", _jsx("a", { href: DPDP, target: "_blank", rel: "noreferrer", children: "DPDP processing notice" }), "."] })] }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: busy, onClick: () => void handleStep1(), children: busy ? "Please wait…" : "Continue" }), _jsxs("p", { className: "muted", style: { marginTop: 12 }, children: ["Already registered? ", _jsx(Link, { to: "/login", children: "Sign in" }), " · ", _jsx(Link, { to: "/forgot-password", children: "Forgot password?" })] })] })), step === 1 && registrationPhase === "verify-email" && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Verify your email" }), _jsxs("p", { className: "muted", children: ["We sent a 6-digit code to ", _jsx("strong", { children: email.trim().toLowerCase() }), ". Enter it below to continue."] }), _jsx("label", { htmlFor: "verificationCode", children: "Verification code" }), _jsx("input", { id: "verificationCode", inputMode: "numeric", autoComplete: "one-time-code", maxLength: 6, value: verificationCode, onChange: (e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6)) }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: busy || verificationCode.length !== 6, onClick: () => void handleVerifyEmail(), children: busy || postSignInPending ? "Please wait…" : "Verify and continue" }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: busy || resendCooldown > 0, onClick: () => void handleResendVerification(), style: { marginLeft: 10 }, children: resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code" }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: busy || postSignInPending, onClick: () => {
                            setError(null);
                            setRegistrationPhase("account");
                        }, style: { marginTop: 10 }, children: "Back to account details" }), postSignInPending ? (_jsx("p", { className: "muted", style: { marginTop: 10 }, children: "Signing you in\u2026" })) : null] })), step === 2 && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Club details" }), _jsx("label", { htmlFor: "clubName", children: "Club name" }), _jsx("input", { id: "clubName", value: clubName, onChange: (e) => setClubName(e.target.value) }), _jsx("label", { htmlFor: "address", children: "Street address" }), _jsx("textarea", { id: "address", rows: 3, value: address, onChange: (e) => setAddress(e.target.value), placeholder: "Building, street, area, city, state, PIN" }), _jsx("label", { children: "Club location on map" }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: busy || geocoding || !address.trim(), onClick: () => void handleFindOnMap(), style: { marginBottom: 8 }, children: geocoding ? "Finding address on map…" : "Find address on map" }), _jsx(ClubLocationPinPicker, { lat: lat, lng: lng, onChange: handlePinChange, disabled: busy || geocoding, focusLat: mapFocusLat, focusLng: mapFocusLng }), _jsxs("div", { className: "row", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "currency", children: "Currency" }), _jsxs("select", { id: "currency", value: currency, onChange: (e) => setCurrency(e.target.value), children: [_jsx("option", { value: "INR", children: "INR" }), _jsx("option", { value: "USD", children: "USD" }), _jsx("option", { value: "EUR", children: "EUR" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "timezone", children: "Timezone (IANA)" }), _jsx("input", { id: "timezone", value: timezone, onChange: (e) => setTimezone(e.target.value) })] })] }), _jsxs("div", { className: "row", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "baseRate", children: "Base rate / minute" }), _jsx("input", { id: "baseRate", inputMode: "decimal", value: baseRate, onChange: (e) => setBaseRate(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "minBill", children: "Minimum bill (minutes)" }), _jsx("input", { id: "minBill", inputMode: "numeric", value: minBill, onChange: (e) => setMinBill(e.target.value) })] })] }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: busy || !canUseProtectedOnboarding, onClick: () => void handleStep2(), children: "Continue to payment" }), !canUseProtectedOnboarding ? (_jsx("p", { className: "muted", style: { marginTop: 10 }, children: "Sign in required\u2026" })) : null, _jsx("button", { type: "button", className: "btn btn-secondary", disabled: busy, onClick: () => setStep(1), style: { marginLeft: 10 }, children: "Back to account" })] })), step === 3 && plans === undefined && (_jsx("p", { className: "muted", children: "Loading plans\u2026" })), step === 3 && plans && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Choose plan" }), _jsx("div", { className: "plan-grid", children: plans.map((p) => (_jsxs("div", { className: `plan-card ${planId === p.id ? "selected" : ""}`, role: "button", tabIndex: 0, onClick: () => setPlanId(p.id), onKeyDown: (e) => {
                                if (e.key === "Enter" || e.key === " ")
                                    setPlanId(p.id);
                            }, children: [_jsx("h3", { children: p.label }), _jsxs("p", { className: "muted", style: { margin: 0 }, children: [(p.amountPaise / 100).toLocaleString("en-IN"), " ", p.currency, " excl. GST", " · ", (p.periodMs / 86400000).toFixed(0), " days access"] })] }, p.id))) }), (() => {
                        const selected = plans.find((p) => p.id === planId);
                        if (!selected)
                            return null;
                        return (_jsxs(_Fragment, { children: [_jsxs("p", { className: "muted", style: { marginTop: 12 }, children: ["SAC: ", selected.invoiceConfig.sacCode, selected.invoiceConfig.gstin
                                            ? ` · Supplier GSTIN: ${selected.invoiceConfig.gstin}`
                                            : null] }), _jsx(SubscriptionGstBreakdown, { gst: selected.gst, currency: selected.currency, compact: true })] }));
                    })(), _jsx("p", { className: "muted", children: "Payment confirms in the background. This page advances when your club is created." }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: busy || paymentPending || !canUseProtectedOnboarding, onClick: () => void handlePay(), children: "Pay with Razorpay" }), paymentPending && !status?.hasClub ? (_jsx("p", { className: "muted", style: { marginTop: 16 }, children: "Waiting for confirmation\u2026" })) : null, _jsx("button", { type: "button", className: "btn btn-secondary", disabled: busy || paymentPending, onClick: () => setStep(2), style: { marginTop: 12 }, children: "Back to club details" })] })), step === 4 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "success-banner", children: "Your club is live. Redirecting you to your dashboard\u2026" }), _jsx("button", { type: "button", className: "btn btn-primary", style: { marginTop: 16 }, onClick: () => nav("/dashboard", { replace: true }), children: "Go to dashboard now" }), _jsx("p", { className: "muted", style: { marginTop: 12 }, children: "Sign in to the Owner App with the same email and password." })] }))] }));
}
