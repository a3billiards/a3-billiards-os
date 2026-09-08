import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Sentry from "@sentry/react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Renew from "./pages/Renew";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import InvoiceDetail from "./pages/InvoiceDetail";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DPDP from "./pages/DPDP";
import DeletionCancelled from "./pages/DeletionCancelled";
import VerifyEmail from "./pages/VerifyEmail";
function ErrorFallback() {
    return (_jsx("div", { className: "layout", children: _jsxs("div", { className: "card", children: [_jsx("h1", { children: "Something went wrong" }), _jsx("p", { className: "muted", children: "Please refresh the page or try again later." })] }) }));
}
export default function App() {
    return (_jsx(Sentry.ErrorBoundary, { fallback: _jsx(ErrorFallback, {}), showDialog: false, children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Landing, {}) }), _jsx(Route, { path: "/register", element: _jsx(Register, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPassword, {}) }), _jsx(Route, { path: "/reset-password", element: _jsx(ResetPassword, {}) }), _jsx(Route, { path: "/deletion-cancelled", element: _jsx(DeletionCancelled, {}) }), _jsx(Route, { path: "/verify-email", element: _jsx(VerifyEmail, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/dashboard/invoice/:id", element: _jsx(InvoiceDetail, {}) }), _jsx(Route, { path: "/renew", element: _jsx(Renew, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(Privacy, {}) }), _jsx(Route, { path: "/terms", element: _jsx(Terms, {}) }), _jsx(Route, { path: "/dpdp", element: _jsx(DPDP, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }));
}
