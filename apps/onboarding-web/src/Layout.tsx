import { Link, Outlet } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function Layout() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-brand">A3 Billiards OS</div>
        <nav className="nav-links" aria-label="Main">
          <Link to="/">Home</Link>
          <Link to="/register">Register</Link>
          {!isAuthenticated ? <Link to="/login">Login</Link> : null}
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/renew">Renew</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/dpdp">DPDP</Link>
          {isAuthenticated ? (
            <button
              type="button"
              className="nav-logout"
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = "/login";
                });
              }}
            >
              Logout
            </button>
          ) : null}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
