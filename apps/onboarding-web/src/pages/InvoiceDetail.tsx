import { Link, Navigate, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { splitSubscriptionGstInclusive } from "@a3/utils/subscriptionInvoiceGst";
import { api } from "../convexApi";
import { SubscriptionGstBreakdown } from "../components/SubscriptionGstBreakdown";

type PaymentRow = {
  _id: string;
  paymentId: string;
  amountPaid: number;
  processedAt: number;
};

function InvoiceShell({
  children,
  activeNav = "dashboard",
}: {
  children: ReactNode;
  activeNav?: "dashboard" | "none";
}) {
  const { signOut } = useAuthActions();

  return (
    <div className="dash-page inv-page">
      <div className="dash-stage" aria-hidden="true">
        <img className="dash-stage-art" src="/images/auth-hero.png" alt="" draggable={false} />
        <div className="dash-stage-shade" />
      </div>

      <div className="dash-scroll">
        <header className="dash-topnav">
          <Link to="/" className="dash-brand">
            <img
              className="dash-brand-mark"
              src="/images/small-logo.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            A3 BILLIARDS OS
          </Link>
          <nav className="dash-nav" aria-label="Main">
            <Link
              to="/dashboard"
              className={activeNav === "dashboard" ? "is-active" : undefined}
              aria-current={activeNav === "dashboard" ? "page" : undefined}
            >
              Dashboard
            </Link>
            <Link to="/renew">Renew</Link>
            <button
              type="button"
              className="dash-logout is-outlined"
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

        {children}
      </div>
    </div>
  );
}

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
      <InvoiceShell>
        <div className="dash-card inv-card">
          <p className="muted" style={{ margin: 0 }}>
            Loading invoice…
          </p>
        </div>
      </InvoiceShell>
    );
  }

  if (!isAuthenticated || user == null) {
    return <Navigate to="/login?returnUrl=/dashboard" replace />;
  }

  const receipt = (payments as PaymentRow[]).find((p) => p._id === id);
  if (!receipt || !invoiceConfig) {
    return (
      <InvoiceShell>
        <div className="dash-card inv-card">
          <h1 className="inv-title">Invoice not found</h1>
          <p className="muted">This invoice does not exist or is not accessible.</p>
          <Link className="inv-back-btn" to="/dashboard">
            ← Back to dashboard
          </Link>
        </div>
      </InvoiceShell>
    );
  }

  const gst = splitSubscriptionGstInclusive(
    receipt.amountPaid,
    invoiceConfig.gstRatePercent,
    invoiceConfig.gstSplitMode,
  );

  return (
    <InvoiceShell>
      <div className="dash-card inv-card">
        <div className="inv-body">
          <div className="inv-copy">
            <h1 className="inv-title">Tax invoice</h1>
            <p className="inv-id">Invoice / payment ID: {receipt.paymentId}</p>

            <table className="inv-meta-table">
              <tbody>
                <tr>
                  <th>
                    <span className="inv-row-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <path
                          d="M4 19V9l8-5 8 5v10H4z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        <path d="M9 19v-6h6v6" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </span>
                    Supplier
                  </th>
                  <td>{invoiceConfig.legalName}</td>
                </tr>
                {invoiceConfig.gstin ? (
                  <tr>
                    <th>
                      <span className="inv-row-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                          <rect
                            x="4"
                            y="6"
                            width="16"
                            height="12"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </span>
                      Supplier GSTIN
                    </th>
                    <td>{invoiceConfig.gstin}</td>
                  </tr>
                ) : null}
                <tr>
                  <th>
                    <span className="inv-row-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M5 19c1.6-3.2 4-4.8 7-4.8S17.4 15.8 19 19"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    Bill to
                  </th>
                  <td>
                    {user.name}
                    {user.email ? ` · ${user.email}` : ""}
                  </td>
                </tr>
                <tr>
                  <th>
                    <span className="inv-row-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <rect
                          x="4"
                          y="5"
                          width="16"
                          height="15"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    Date
                  </th>
                  <td>
                    {new Date(receipt.processedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
                <tr>
                  <th>
                    <span className="inv-row-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <path
                          d="M7 3h7l5 5v13H7V3z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        <path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    Description
                  </th>
                  <td>
                    A3 Billiards OS software subscription (SAC {invoiceConfig.sacCode})
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="inv-gst">
              <SubscriptionGstBreakdown gst={gst} />
            </div>

            <div className="inv-actions">
              <button type="button" className="inv-print-btn" onClick={() => window.print()}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path
                    d="M7 9V4h10v5M7 15H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <rect x="7" y="13" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Print
              </button>
              <Link className="inv-back-btn" to="/dashboard">
                ← Back to dashboard
              </Link>
            </div>
          </div>

          <div className="inv-hero" aria-hidden="true">
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
    </InvoiceShell>
  );
}
