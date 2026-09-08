import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Navigate, useParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { splitSubscriptionGstInclusive } from "@a3/utils/subscriptionInvoiceGst";
import { api } from "../convexApi";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";
export default function InvoiceDetail() {
    const { id } = useParams();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
    const invoiceConfig = useQuery(api.onboardingWeb.getPlatformInvoiceConfig);
    const payments = useQuery(api.paymentReceipts.getPaymentHistory, user?._id ? { ownerId: user._id } : "skip");
    if (isLoading ||
        (isAuthenticated &&
            (user === undefined || payments === undefined || invoiceConfig === undefined))) {
        return (_jsx("div", { className: "card", children: _jsx("p", { className: "muted", children: "Loading invoice\u2026" }) }));
    }
    if (!isAuthenticated || user == null) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    const receipt = payments.find((p) => p._id === id);
    if (!receipt || !invoiceConfig) {
        return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Invoice not found" }), _jsx("p", { className: "muted", children: "This invoice does not exist or is not accessible." })] }));
    }
    const gst = splitSubscriptionGstInclusive(receipt.amountPaid, invoiceConfig.gstRatePercent, invoiceConfig.gstSplitMode);
    return (_jsxs("div", { className: "card", children: [_jsx("h1", { children: "Tax invoice" }), _jsxs("p", { className: "muted", children: ["Invoice / payment ID: ", receipt.paymentId] }), _jsx("table", { className: "legal-table", children: _jsxs("tbody", { children: [_jsxs("tr", { children: [_jsx("th", { children: "Supplier" }), _jsx("td", { children: invoiceConfig.legalName })] }), invoiceConfig.gstin ? (_jsxs("tr", { children: [_jsx("th", { children: "Supplier GSTIN" }), _jsx("td", { children: invoiceConfig.gstin })] })) : null, _jsxs("tr", { children: [_jsx("th", { children: "Bill to" }), _jsxs("td", { children: [user.name, user.email ? ` · ${user.email}` : ""] })] }), _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("td", { children: new Date(receipt.processedAt).toLocaleString("en-IN", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                    }) })] }), _jsxs("tr", { children: [_jsx("th", { children: "Description" }), _jsxs("td", { children: ["A3 Billiards OS software subscription (SAC ", invoiceConfig.sacCode, ")"] })] })] }) }), _jsx(SubscriptionGstBreakdown, { gst: gst }), _jsxs("div", { style: { display: "flex", gap: 10, marginTop: 12 }, children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => window.print(), children: "Print" }), _jsx(Link, { className: "btn btn-secondary", to: "/dashboard", children: "Back to dashboard" })] })] }));
}
