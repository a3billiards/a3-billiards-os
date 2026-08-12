import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
export default function Landing() {
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Owner onboarding" }), _jsx("p", { className: "muted", children: "Register your club, verify your email, choose a subscription, and start using the Owner App." }), _jsxs("div", { className: "hero-actions", children: [_jsx(Link, { className: "btn btn-primary", to: "/register", children: "Get started" }), _jsx(Link, { className: "btn btn-secondary", to: "/login", children: "Login" })] }), _jsxs("div", { className: "steps", children: [_jsx("span", { className: "step-pill active", children: "1 \u00B7 Account" }), _jsx("span", { className: "step-pill active", children: "2 \u00B7 Club" }), _jsx("span", { className: "step-pill active", children: "3 \u00B7 Subscribe" }), _jsx("span", { className: "step-pill active", children: "4 \u00B7 Go live" })] })] }));
}
