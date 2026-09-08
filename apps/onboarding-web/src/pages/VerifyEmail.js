import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
export default function VerifyEmail() {
    const nav = useNavigate();
    const [params] = useSearchParams();
    const initialEmail = params.get("email") ?? "";
    const sendVerificationCode = useAction(api.ownerEmailVerificationActions.sendOwnerEmailVerificationCode);
    const verifyEmailCode = useAction(api.ownerEmailVerificationActions.verifyOwnerEmailCode);
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);
    const [codeSent, setCodeSent] = useState(false);
    const autoSent = useRef(false);
    const handleSendCode = useCallback(async () => {
        if (busy)
            return;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
            setBusy(false);
        }
    }, [email, sendVerificationCode]);
    // Auto-send when opened from login with ?email=
    useEffect(() => {
        if (autoSent.current)
            return;
        if (!initialEmail.trim())
            return;
        autoSent.current = true;
        void handleSendCode();
    }, [initialEmail, handleSendCode]);
    const handleVerify = useCallback(async () => {
        if (busy)
            return;
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
        }
        catch (e) {
            setError(parseConvexError(e).message);
            setBusy(false);
        }
    }, [email, code, verifyEmailCode, nav]);
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Verify email" }), _jsx("p", { className: "muted", children: "Owners must verify email before signing in. Enter the 6-digit code from your inbox." }), error ? _jsx("div", { className: "error-banner", children: error }) : null, info ? _jsx("div", { className: "success-banner", children: info }) : null, _jsx("label", { htmlFor: "verifyEmail", children: "Email" }), _jsx("input", { id: "verifyEmail", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), disabled: busy }), !codeSent ? (_jsx("button", { type: "button", className: "btn btn-primary", disabled: busy || email.trim().length === 0, onClick: () => void handleSendCode(), children: busy ? "Sending…" : "Send code" })) : (_jsxs(_Fragment, { children: [_jsx("label", { htmlFor: "verifyCode", children: "Verification code" }), _jsx("input", { id: "verifyCode", inputMode: "numeric", autoComplete: "one-time-code", maxLength: 6, value: code, onChange: (e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), disabled: busy, onKeyDown: (e) => {
                            if (e.key === "Enter" && code.length === 6)
                                void handleVerify();
                        } }), _jsxs("div", { className: "inline-actions", children: [_jsx("button", { type: "button", className: "btn btn-primary", disabled: busy || code.length !== 6, onClick: () => void handleVerify(), children: busy ? "Verifying…" : "Verify" }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: busy, onClick: () => void handleSendCode(), children: "Resend" })] })] })), _jsx("p", { className: "muted", style: { marginTop: 12 }, children: _jsx(Link, { to: "/login", children: "Back to login" }) })] }));
}
