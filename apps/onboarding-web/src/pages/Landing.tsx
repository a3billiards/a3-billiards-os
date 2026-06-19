import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="card">
      <h1>Owner onboarding</h1>
      <p className="muted">
        Register your club, verify your email, choose a subscription, and start using the Owner App.
      </p>

      <div className="hero-actions">
        <Link className="btn btn-primary" to="/register">
          Get started
        </Link>
        <Link className="btn btn-secondary" to="/login">
          Login
        </Link>
      </div>

      <div className="steps">
        <span className="step-pill active">1 · Account</span>
        <span className="step-pill active">2 · Club</span>
        <span className="step-pill active">3 · Subscribe</span>
        <span className="step-pill active">4 · Go live</span>
      </div>
    </div>
  );
}
