import { Link, useSearchParams } from "react-router-dom";

export default function DeletionCancelled() {
  const [params] = useSearchParams();
  const success = params.get("success") === "true";
  const error = params.get("error");

  let title = "Account deletion cancelled";
  let body =
    "Your account deletion request has been cancelled. You can sign in to the app again.";

  if (error === "missing_token") {
    title = "Invalid cancellation link";
    body =
      "This link is missing a token. Open the full link from your deletion confirmation email.";
  } else if (error) {
    title = "Could not cancel deletion";
    body = decodeURIComponent(error).replace(/^[A-Z0-9_]+:\s*/, "");
  } else if (!success) {
    title = "Something went wrong";
    body =
      "We could not confirm your cancellation. Try the link from your email again or contact support.";
  }

  return (
    <div className="auth-page auth-page-login auth-page-forgot">
      <div className="auth-stage" aria-hidden="true">
        <img
          className="auth-stage-art"
          src="/images/auth-hero.png"
          alt=""
          draggable={false}
        />
        <div className="auth-stage-shade" />
      </div>

      <div className="auth-card">
        <Link to="/" className="auth-card-brand">
          <span className="auth-card-brand-a3">A3</span>
          <span className="auth-card-brand-rest">BILLIARDS OS</span>
        </Link>

        <h1 className="auth-card-title">{title}</h1>
        <p className="auth-card-subtitle">{body}</p>

        <div className="auth-inline-actions">
          <Link to="/login" className="auth-submit auth-submit-link">
            <span className="auth-submit-label">Sign in</span>
            <span className="auth-submit-fill" aria-hidden="true" />
          </Link>
          <Link to="/" className="auth-ghost-btn">
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
