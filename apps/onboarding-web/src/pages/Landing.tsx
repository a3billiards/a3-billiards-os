import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../convexApi";

type SubscriptionPlanRow = {
  id: "monthly" | "yearly";
  label: string;
  periodMs: number;
  amountPaise: number;
  currency: string;
};

export default function Landing() {
  const plans = useQuery(api.onboardingWeb.listSubscriptionPlans);
  const nav = useNavigate();

  return (
    <div className="card">
      <h1>A3 Billiards OS</h1>
      <p className="muted">
        Launch your club in minutes. Register, choose a subscription, and go live.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Link className="btn btn-primary" to="/register">
          Get Started
        </Link>
        <Link className="btn btn-secondary" to="/login">
          Login
        </Link>
      </div>

      <h2>How it works</h2>
      <div className="steps">
        <span className="step-pill active">1 · Register</span>
        <span className="step-pill active">2 · Pay</span>
        <span className="step-pill active">3 · Go Live</span>
      </div>

      <h2>Subscription plans</h2>
      {plans === undefined ? (
        <p className="muted">Loading plans…</p>
      ) : (
        <div className="plan-grid">
          {(plans as SubscriptionPlanRow[]).map((p) => (
            <div key={p.id} className="plan-card">
              <h3>{p.label}</h3>
              <p className="muted" style={{ marginBottom: 10 }}>
                {(p.amountPaise / 100).toLocaleString("en-IN")} {p.currency} ·{" "}
                {(p.periodMs / 86_400_000).toFixed(0)} days
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => nav(`/register?plan=${p.id}`)}
              >
                Select plan
              </button>
            </div>
          ))}
        </div>
      )}

      <h2>FAQ</h2>
      <details>
        <summary>What happens after payment?</summary>
        <p className="muted">Your club is provisioned immediately after verified payment.</p>
      </details>
      <details>
        <summary>Can I renew before expiry?</summary>
        <p className="muted">Yes. Early renewals preserve unused time.</p>
      </details>
      <details>
        <summary>How do I manage tables and staff?</summary>
        <p className="muted">Those are configured in the Owner App after onboarding.</p>
      </details>

      <p className="muted" style={{ marginTop: 20 }}>
        Need help? Contact support@a3billiards.com
      </p>
    </div>
  );
}

