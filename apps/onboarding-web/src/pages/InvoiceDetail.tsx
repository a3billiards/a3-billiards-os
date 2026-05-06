import { Link, Navigate, useParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convexApi";

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
  const payments = useQuery(
    api.paymentReceipts.getPaymentHistory,
    user?._id ? { ownerId: user._id } : "skip",
  );

  if (isLoading || (isAuthenticated && (user === undefined || payments === undefined))) {
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
  if (!receipt) {
    return (
      <div className="card">
        <h1>Invoice not found</h1>
        <p className="muted">This invoice does not exist or is not accessible.</p>
      </div>
    );
  }

  const subtotal = receipt.amountPaid / 100;
  const gst = 0;
  const total = subtotal + gst;

  return (
    <div className="card">
      <h1>Invoice</h1>
      <p className="muted">Invoice ID: {receipt.paymentId}</p>
      <table className="legal-table">
        <tbody>
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
            <th>Subtotal</th>
            <td>{subtotal.toLocaleString("en-IN")} INR</td>
          </tr>
          <tr>
            <th>GST</th>
            <td>{gst.toLocaleString("en-IN")} INR</td>
          </tr>
          <tr>
            <th>Total paid</th>
            <td>
              <strong>{total.toLocaleString("en-IN")} INR</strong>
            </td>
          </tr>
        </tbody>
      </table>
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

