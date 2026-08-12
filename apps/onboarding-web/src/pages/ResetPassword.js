import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
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
export default function ResetPassword() {
    const [params] = useSearchParams();
    const token = params.get("token") ?? "";
    const nav = useNavigate();
    const verifyResetToken = useAction(api.passwordResetActions.verifyResetToken);
    const resetPassword = useAction(api.passwordResetActions.resetPassword);
    const [checking, setChecking] = useState(true);
    const [valid, setValid] = useState(false);
    const [completionToken, setCompletionToken] = useState(null);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (!token.trim()) {
            setChecking(false);
            setValid(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const result = await verifyResetToken({ token: token.trim() });
                if (cancelled)
                    return;
                if (result.valid && result.completionToken) {
                    setValid(true);
                    setCompletionToken(result.completionToken);
                }
                else {
                    setValid(false);
                }
            }
            catch {
                if (!cancelled)
                    setValid(false);
            }
            finally {
                if (!cancelled)
                    setChecking(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token, verifyResetToken]);
    const handleSubmit = useCallback(async () => {
        setError(null);
        const pwdError = getStrongPasswordError(password);
        if (pwdError) {
            setError(pwdError);
            return;
        }
        if (password !== confirm) {
            setError("Password and confirm password must match.");
            return;
        }
        if (!completionToken) {
            setError("Reset link is invalid or expired.");
            return;
        }
        setBusy(true);
        try {
            await resetPassword({ completionToken, newPassword: password });
            setDone(true);
        }
        catch (e) {
            setError(parseConvexError(e).message);
        }
        finally {
            setBusy(false);
        }
    }, [password, confirm, completionToken, resetPassword]);
    if (checking) {
        return (_jsx("div", { className: "card", children: _jsx("p", { className: "muted", children: "Checking reset link\u2026" }) }));
    }
    if (!valid) {
        return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Reset link invalid" }), _jsx("p", { className: "muted", children: "This password reset link is invalid, expired, or already used." }), _jsx(Link, { to: "/forgot-password", className: "btn btn-primary", style: { display: "inline-block", marginTop: 12 }, children: "Request a new link" })] }));
    }
    if (done) {
        return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "success-banner", children: "Your password has been updated." }), _jsx("button", { type: "button", className: "btn btn-primary", style: { marginTop: 16 }, onClick: () => nav("/login", { replace: true }), children: "Sign in" })] }));
    }
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Set a new password" }), _jsx("p", { className: "muted", children: STRONG_PASSWORD_HINT }), error ? _jsx("div", { className: "error-banner", children: error }) : null, _jsx("label", { htmlFor: "newPassword", children: "New password" }), _jsx("input", { id: "newPassword", type: "password", autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value) }), _jsx(PasswordStrengthBar, { password: password }), _jsx("label", { htmlFor: "confirmPassword", children: "Confirm password" }), _jsx("input", { id: "confirmPassword", type: "password", autoComplete: "new-password", value: confirm, onChange: (e) => setConfirm(e.target.value) }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: busy, onClick: () => void handleSubmit(), children: busy ? "Saving…" : "Update password" })] }));
}
