import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Outlet } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
export default function Layout() {
    const { isAuthenticated } = useConvexAuth();
    const { signOut } = useAuthActions();
    return (_jsxs("div", { className: "layout", children: [_jsxs("header", { className: "site-header", children: [_jsx(Link, { to: "/", className: "site-brand", children: "A3 Billiards OS" }), _jsxs("nav", { className: "nav-links", "aria-label": "Main", children: [_jsx(Link, { to: "/register", children: "Register" }), !isAuthenticated ? _jsx(Link, { to: "/login", children: "Login" }) : null, isAuthenticated ? (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/dashboard", children: "Dashboard" }), _jsx(Link, { to: "/renew", children: "Renew" }), _jsx("button", { type: "button", className: "nav-logout", onClick: () => {
                                            void signOut().then(() => {
                                                window.location.href = "/login";
                                            });
                                        }, children: "Logout" })] })) : null] })] }), _jsx("main", { children: _jsx(Outlet, {}) }), _jsxs("footer", { className: "site-footer", children: [_jsxs("nav", { "aria-label": "Legal", children: [_jsx(Link, { to: "/privacy", children: "Privacy" }), _jsx(Link, { to: "/terms", children: "Terms" }), _jsx(Link, { to: "/dpdp", children: "DPDP" })] }), _jsx("p", { className: "muted", children: "support@a3billiards.com" })] })] }));
}
