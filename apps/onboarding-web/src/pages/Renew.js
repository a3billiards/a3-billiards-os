import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
import { captureEvent } from "../instrumentation";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";
function loadRazorpayScript() {
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
export default function Renew() {
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const { signIn } = useAuthActions();
    const createOrder = useAction(api.onboardingWebActions.createRazorpayOrder);
    const status = useQuery(api.onboardingWeb.getMyOnboardingStatus);
    const plans = useQuery(api.onboardingWeb.listSubscriptionPlans);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginBusy, setLoginBusy] = useState(false);
    const [error, setError] = useState(null);
    const [planId, setPlanId] = useState("monthly");
    const [payBusy, setPayBusy] = useState(false);
    const [paymentPending, setPaymentPending] = useState(false);
    const [expiryBeforePay, setExpiryBeforePay] = useState(null);
    const [renewSuccess, setRenewSuccess] = useState(false);
    const handleLogin = useCallback(async () => {
        if (loginBusy)
            return;
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
            if (!signingIn)
                setError("Sign-in failed. Check your email and password.");
            else
                captureEvent("renew_login");
        }
        catch (e) {
            const parsed = parseConvexError(e);
            if (parsed.code === "AUTH_009") {
                setError("Verify your email first.");
                window.location.assign(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
                return;
            }
            if (parsed.code === "AUTH_001") {
                setError("Invalid email or password.");
                return;
            }
            setError(parsed.message);
        }
        finally {
            setLoginBusy(false);
        }
    }, [email, password, signIn]);
    const handlePay = useCallback(async () => {
        if (payBusy || paymentPending)
            return;
        setError(null);
        setRenewSuccess(false);
        setPayBusy(true);
        const baseline = status?.loggedIn && status.subscriptionExpiresAt != null
            ? status.subscriptionExpiresAt
            : 0;
        setExpiryBeforePay(baseline);
        setPaymentPending(true);
        try {
            await loadRazorpayScript();
            const order = await createOrder({ flow: "renewal", planId });
            const selectedPlan = plans?.find((p) => p.id === planId);
            const gstNote = selectedPlan
                ? ` (incl. GST ${selectedPlan.gst.gstRatePercent}%)`
                : "";
            const RazorpayCtor = window.Razorpay;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
            setPayBusy(false);
            setPaymentPending(false);
            setExpiryBeforePay(null);
        }
    }, [createOrder, planId, email, status, plans]);
    useEffect(() => {
        if (!paymentPending || expiryBeforePay === null || !status?.loggedIn)
            return;
        const current = status.subscriptionExpiresAt;
        if (current != null && current > expiryBeforePay) {
            setPaymentPending(false);
            setExpiryBeforePay(null);
            setRenewSuccess(true);
            captureEvent("renew_subscription_extended", { planId });
        }
    }, [paymentPending, expiryBeforePay, status, planId]);
    if (authLoading || status === undefined) {
        return (_jsx("div", { className: "card", children: _jsx("p", { className: "muted", children: "Loading\u2026" }) }));
    }
    if (!isAuthenticated || !status.loggedIn) {
        return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Renew subscription" }), _jsx("p", { className: "muted", children: "Sign in with the email and password you used during onboarding." }), error ? _jsx("div", { className: "error-banner", children: error }) : null, _jsx("label", { htmlFor: "re-email", children: "Email" }), _jsx("input", { id: "re-email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("label", { htmlFor: "re-password", children: "Password" }), _jsx("input", { id: "re-password", type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value) }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: loginBusy, onClick: () => void handleLogin(), children: loginBusy ? "Signing in…" : "Sign in" })] }));
    }
    if (!status.hasClub) {
        return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Renew subscription" }), _jsx("p", { className: "muted", children: "No club is linked to this account yet. Complete registration first." }), _jsx("a", { className: "btn btn-primary", href: "/register", style: { textDecoration: "none", display: "inline-flex" }, children: "Go to registration" })] }));
    }
    const subLabel = status.subscriptionStatus === "frozen"
        ? "Frozen — renew to restore access"
        : status.subscriptionStatus === "grace"
            ? "Grace period — renew soon"
            : "Active";
    const expiryDate = status.subscriptionExpiresAt !== null && status.subscriptionExpiresAt !== undefined
        ? new Date(status.subscriptionExpiresAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        })
        : "—";
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Renew subscription" }), _jsxs("p", { className: "muted", children: ["Status: ", _jsx("strong", { children: subLabel }), _jsx("br", {}), "Current expiry: ", _jsx("strong", { children: expiryDate })] }), renewSuccess ? (_jsx("div", { className: "success-banner", children: "Payment received \u2014 your subscription end date has been updated. If the date above does not refresh within a few seconds, reload the page." })) : null, error ? _jsx("div", { className: "error-banner", children: error }) : null, plans === undefined ? (_jsx("p", { className: "muted", children: "Loading plans\u2026" })) : plans ? (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Select period" }), _jsx("div", { className: "plan-grid", children: plans.map((p) => (_jsxs("div", { className: `plan-card ${planId === p.id ? "selected" : ""}`, role: "button", tabIndex: 0, onClick: () => setPlanId(p.id), onKeyDown: (e) => {
                                if (e.key === "Enter" || e.key === " ")
                                    setPlanId(p.id);
                            }, children: [_jsx("h3", { children: p.label }), _jsxs("p", { className: "muted", style: { margin: 0 }, children: [(p.amountPaise / 100).toLocaleString("en-IN"), " ", p.currency, " excl. GST"] })] }, p.id))) }), (() => {
                        const selected = plans.find((p) => p.id === planId);
                        if (!selected)
                            return null;
                        return (_jsxs(_Fragment, { children: [_jsxs("p", { className: "muted", style: { marginTop: 12 }, children: ["SAC: ", selected.invoiceConfig.sacCode, selected.invoiceConfig.gstin
                                            ? ` · Supplier GSTIN: ${selected.invoiceConfig.gstin}`
                                            : null] }), _jsx(SubscriptionGstBreakdown, { gst: selected.gst, currency: selected.currency, compact: true })] }));
                    })(), _jsx("p", { className: "muted", children: "Early renewal preserves unused paid time: your new expiry is the later of your current expiry or today, plus the period you buy." }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: payBusy || paymentPending, onClick: () => void handlePay(), children: "Pay with Razorpay" }), paymentPending ? (_jsx("p", { className: "muted", style: { marginTop: 16 }, children: "Waiting for confirmation\u2026" })) : null] })) : (_jsx("p", { className: "muted", children: "Plans are unavailable right now. Please refresh the page." }))] }));
}
