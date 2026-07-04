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
    body = "This link is missing a token. Open the full link from your deletion confirmation email.";
  } else if (error) {
    title = "Could not cancel deletion";
    body = decodeURIComponent(error).replace(/^[A-Z0-9_]+:\s*/, "");
  } else if (!success) {
    title = "Something went wrong";
    body = "We could not confirm your cancellation. Try the link from your email again or contact support.";
  }

  return (
    <div className="layout">
      <div className="card">
        <h1>{title}</h1>
        <p className="muted">{body}</p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link to="/">Return to home</Link>
        </p>
      </div>
    </div>
  );
}
