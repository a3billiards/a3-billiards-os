import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-brand">A3 Billiards OS</div>
        <nav className="nav-links" aria-label="Main">
          <Link to="/register">Register</Link>
          <Link to="/renew">Renew</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/dpdp">DPDP</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
