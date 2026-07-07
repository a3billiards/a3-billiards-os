import { Link, Navigate, useParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { splitSubscriptionGstInclusive } from "@a3/utils/subscriptionInvoiceGst";
import { api } from "../convexApi";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";

type PaymentRow = {
  _id: string;
  paymentId: string;
  amountPaid: number;
  processedAt: number;
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const invoiceConfig = useQuery(api.onboardingWeb.getPlatformInvoiceConfig);
  const payments = useQuery(
    api.paymentReceipts.getPaymentHistory,
    user?._id ? { ownerId: user._id } : "skip",
  );

  if (
    isLoading ||
    (isAuthenticated &&
      (user === undefined || payments === undefined || invoiceConfig === undefined))
  ) {
    return (
      <div className="card">
        <p className="muted">Loading invoice…</p>
      </div>
    );
  }

  if (!isAuthenticated || user == null) {
    return <Navigate to="/login" replace />;
  }

  const receipt = (payments as PaymentRow[]).find((p) => p._id === id);
  if (!receipt || !invoiceConfig) {
    return (
      <div className="card">
        <h1>Invoice not found</h1>
        <p className="muted">This invoice does not exist or is not accessible.</p>
      </div>
    );
  }

  const gst = splitSubscriptionGstInclusive(
    receipt.amountPaid,
    invoiceConfig.gstRatePercent,
    invoiceConfig.gstSplitMode,
  );

  return (
    <div className="card">
      <h1>Tax invoice</h1>
      <p className="muted">Invoice / payment ID: {receipt.paymentId}</p>
      <table className="legal-table">
        <tbody>
          <tr>
            <th>Supplier</th>
            <td>{invoiceConfig.legalName}</td>
          </tr>
          {invoiceConfig.gstin ? (
            <tr>
              <th>Supplier GSTIN</th>
              <td>{invoiceConfig.gstin}</td>
            </tr>
          ) : null}
          <tr>
            <th>Bill to</th>
            <td>
              {user.name}
              {user.email ? ` · ${user.email}` : ""}
            </td>
          </tr>
          <tr>
            <th>Date</th>
            <td>
              {new Date(receipt.processedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </td>
          </tr>
          <tr>
            <th>Description</th>
            <td>A3 Billiards OS software subscription (SAC {invoiceConfig.sacCode})</td>
          </tr>
        </tbody>
      </table>
      <SubscriptionGstBreakdown gst={gst} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Print
        </button>
        <Link className="btn btn-secondary" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
