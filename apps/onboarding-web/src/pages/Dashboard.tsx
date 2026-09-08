import { Link, Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convexApi";

type PaymentRow = {
  _id: string;
  paymentId: string;
  amountPaid: number;
  processedAt: number;
};

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
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
      <div className="dash-page">
        <div className="dash-stage" aria-hidden="true">
          <img className="dash-stage-art" src="/images/auth-hero.png" alt="" draggable={false} />
          <div className="dash-stage-shade" />
        </div>
        <div className="dash-scroll">
          <div className="dash-card">
            <p className="muted" style={{ margin: 0 }}>
              Loading dashboard…
            </p>
          </div>
        </div>
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
    <div className="dash-page">
      <div className="dash-stage" aria-hidden="true">
        <img className="dash-stage-art" src="/images/auth-hero.png" alt="" draggable={false} />
        <div className="dash-stage-shade" />
      </div>

      <div className="dash-scroll">
        <header className="dash-topnav">
          <Link to="/" className="dash-brand">
            A3 BILLIARDS OS
          </Link>
          <nav className="dash-nav" aria-label="Main">
            <Link to="/dashboard" className="is-active" aria-current="page">
              Dashboard
            </Link>
            <Link to="/renew">Renew</Link>
            <button
              type="button"
              className="dash-logout"
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = "/login";
                });
              }}
            >
              Logout
            </button>
          </nav>
        </header>

        <div className="dash-card">
          <div className="dash-body">
            <div className="dash-copy">
              <h1 className="dash-title">Owner dashboard</h1>

              <h2 className="dash-section-title">Subscription</h2>
              <div className="dash-status-card">
                <span className="dash-status-icon" aria-hidden="true">
                  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
                    <path
                      d="M20 4l12 5v9c0 8-5.2 13.5-12 16-6.8-2.5-12-8-12-16V9l12-5z"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                    <circle cx="20" cy="18" r="7" fill="#111" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                    <circle cx="20" cy="18" r="3.2" fill="#fff" />
                    <text
                      x="20"
                      y="19.2"
                      textAnchor="middle"
                      fontSize="5.5"
                      fontWeight="800"
                      fill="#111"
                    >
                      8
                    </text>
                  </svg>
                </span>
                <div className="dash-status-copy">
                  <p>
                    Status: <strong>{statusText}</strong>
                  </p>
                  <p>
                    Expires at: <strong>{expiryText}</strong>
                  </p>
                </div>
              </div>

              <Link className="dash-renew-btn" to="/renew">
                Renew now
                <span aria-hidden="true">→</span>
              </Link>

              <div className="dash-divider" aria-hidden="true" />

              <h2 className="dash-section-title">Invoice history</h2>
              {payments === undefined ? (
                <p className="muted">Loading invoices…</p>
              ) : payments.length === 0 ? (
                <p className="muted">No invoices yet.</p>
              ) : (
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
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
                          <td>
                            <span className="dash-paid">
                              <span className="dash-paid-dot" aria-hidden="true" />
                              Paid
                            </span>
                          </td>
                          <td>
                            <Link className="dash-view" to={`/dashboard/invoice/${p._id}`}>
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dash-hero" aria-hidden="true">
              <video
                className="dash-hero-video"
                src="/videos/eightball-smoke.mp4"
                poster="/images/auth-hero.png"
                autoPlay
                muted
                loop
                playsInline
              />
              <div className="dash-hero-fade" />
            </div>
          </div>

          <footer className="dash-footer">
            <nav aria-label="Legal">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/dpdp">DPDP</Link>
            </nav>
            <a className="dash-support" href="mailto:support@a3billiards.com">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4M4 12v5a2 2 0 0 0 2 2h2v-6H4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 19v1a2.5 2.5 0 0 0 2.5 2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              support@a3billiards.com
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
