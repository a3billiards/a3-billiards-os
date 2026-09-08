import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convexApi";
export default function Dashboard() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
    const status = useQuery(api.onboardingWeb.getMyOnboardingStatus, isAuthenticated ? {} : "skip");
    const payments = useQuery(api.paymentReceipts.getPaymentHistory, user?._id ? { ownerId: user._id } : "skip");
    if (isLoading || (isAuthenticated && (user === undefined || status === undefined))) {
        return (_jsx("div", { className: "card", children: _jsx("p", { className: "muted", children: "Loading dashboard\u2026" }) }));
    }
    if (!isAuthenticated || !status?.loggedIn) {
        return _jsx(Navigate, { to: "/login?returnUrl=/dashboard", replace: true });
    }
    const statusText = status.subscriptionStatus === "frozen"
        ? "Frozen"
        : status.subscriptionStatus === "grace"
            ? "Grace period"
            : "Active";
    const expiryText = status.subscriptionExpiresAt == null
        ? "—"
        : new Date(status.subscriptionExpiresAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Owner dashboard" }), _jsx("h2", { children: "Subscription" }), _jsxs("div", { className: "plan-card", children: [_jsxs("p", { style: { margin: 0 }, children: ["Status: ", _jsx("strong", { children: statusText })] }), _jsxs("p", { style: { margin: "8px 0 0" }, children: ["Expires at: ", _jsx("strong", { children: expiryText })] })] }), _jsx("div", { style: { marginTop: 14 }, children: _jsx(Link, { className: "btn btn-primary", to: "/renew", children: "Renew now" }) }), _jsx("h2", { style: { marginTop: 22 }, children: "Invoice history" }), payments === undefined ? (_jsx("p", { className: "muted", children: "Loading invoices\u2026" })) : payments.length === 0 ? (_jsx("p", { className: "muted", children: "No invoices yet." })) : (_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "legal-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Status" }), _jsx("th", {})] }) }), _jsx("tbody", { children: payments.map((p) => (_jsxs("tr", { children: [_jsx("td", { children: new Date(p.processedAt).toLocaleString("en-IN", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        }) }), _jsxs("td", { children: [(p.amountPaid / 100).toLocaleString("en-IN"), " INR"] }), _jsx("td", { children: "Paid" }), _jsx("td", { children: _jsx(Link, { to: `/dashboard/invoice/${p._id}`, children: "View" }) })] }, p._id))) })] }) }))] }));
}
