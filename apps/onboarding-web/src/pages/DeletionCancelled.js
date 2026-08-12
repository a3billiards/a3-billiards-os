import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useSearchParams } from "react-router-dom";
export default function DeletionCancelled() {
    const [params] = useSearchParams();
    const success = params.get("success") === "true";
    const error = params.get("error");
    let title = "Account deletion cancelled";
    let body = "Your account deletion request has been cancelled. You can sign in to the app again.";
    if (error === "missing_token") {
        title = "Invalid cancellation link";
        body = "This link is missing a token. Open the full link from your deletion confirmation email.";
    }
    else if (error) {
        title = "Could not cancel deletion";
        body = decodeURIComponent(error).replace(/^[A-Z0-9_]+:\s*/, "");
    }
    else if (!success) {
        title = "Something went wrong";
        body = "We could not confirm your cancellation. Try the link from your email again or contact support.";
    }
    return (_jsx("div", { className: "layout", children: _jsxs("div", { className: "card", children: [_jsx("h1", { children: title }), _jsx("p", { className: "muted", children: body }), _jsx("p", { style: { marginTop: "1.5rem" }, children: _jsx(Link, { to: "/", children: "Return to home" }) })] }) }));
}
