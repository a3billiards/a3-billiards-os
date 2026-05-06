import { Link, Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convexApi";

type PaymentRow = {
  _id: string;
  paymentId: string;
  amountPaid: number;
  processedAt: number;
};

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const status = useQuery(
    api.onboardingWeb.getMyOnboardingStatus,
    isAuthenticated ? {} : "skip",
  );
  const payments = useQuery(
    api.paymentReceipts.getPaymentHistory,
    user?._id ? { ownerId: user._id } : "skip",
  );

  if (isLoading || (isAuthenticated && (user === undefined || status === undefined))) {
    return (
      <div className="card">
        <p className="muted">Loading dashboard…</p>
      </div>
    );
  }

  if (!isAuthenticated || !status?.loggedIn) {
    return <Navigate to="/login?returnUrl=/dashboard" replace />;
  }

  const statusText =
    status.subscriptionStatus === "frozen"
      ? "Frozen"
      : status.subscriptionStatus === "grace"
        ? "Grace period"
        : "Active";

  const expiryText =
    status.subscriptionExpiresAt == null
      ? "—"
      : new Date(status.subscriptionExpiresAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        });

  return (
    <div className="card">
      <h1>Owner dashboard</h1>
      <p className="muted">Subscription visibility and renewal.</p>

      <h2>Subscription status</h2>
      <div className="plan-card">
        <p style={{ margin: 0 }}>
          Status: <strong>{statusText}</strong>
        </p>
        <p style={{ margin: "8px 0 0" }}>
          Expires at: <strong>{expiryText}</strong>
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <Link className="btn btn-primary" to="/renew">
          Renew now
        </Link>
      </div>

      <h2 style={{ marginTop: 22 }}>Invoice history</h2>
      {payments === undefined ? (
        <p className="muted">Loading invoices…</p>
      ) : payments.length === 0 ? (
        <p className="muted">No invoices yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(payments as PaymentRow[]).map((p) => (
                <tr key={p._id}>
                  <td>
                    {new Date(p.processedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>{(p.amountPaid / 100).toLocaleString("en-IN")} INR</td>
                  <td>Paid</td>
                  <td>
                    <Link to={`/dashboard/invoice/${p._id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

