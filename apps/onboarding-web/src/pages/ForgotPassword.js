import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../convexApi";
import { parseConvexError } from "../lib/parseConvexError";
export default function ForgotPassword() {
    const requestReset = useAction(api.passwordResetActions.requestReset);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Forgot password" }), _jsx("p", { className: "muted", children: "Enter your registered email. We will send a reset link." }), error ? _jsx("div", { className: "error-banner", children: error }) : null, done ? (_jsx("div", { className: "success-banner", children: "If an account exists for this email, a reset link has been sent." })) : null, _jsx("label", { htmlFor: "resetEmail", children: "Email" }), _jsx("input", { id: "resetEmail", type: "email", value: email, onChange: (e) => setEmail(e.target.value), autoComplete: "email" }), _jsx("button", { type: "button", className: "btn btn-primary", disabled: busy || email.trim().length === 0, onClick: () => {
                    void (async () => {
                        setError(null);
                        setBusy(true);
                        try {
                            await requestReset({ email: email.trim().toLowerCase() });
                            setDone(true);
                        }
                        catch (e) {
                            setError(parseConvexError(e).message);
                        }
                        finally {
                            setBusy(false);
                        }
                    })();
                }, children: busy ? "Sending…" : "Send reset link" }), _jsx("p", { className: "muted", style: { marginTop: 12 }, children: _jsx(Link, { to: "/login", children: "Back to sign in" }) })] }));
}
