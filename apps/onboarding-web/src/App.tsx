import * as Sentry from "@sentry/react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Register from "./pages/Register";
import Renew from "./pages/Renew";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DPDP from "./pages/DPDP";

function ErrorFallback() {
  return (
    <div className="layout">
      <div className="card">
        <h1>Something went wrong</h1>
        <p className="muted">Please refresh the page or try again later.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/renew" element={<Renew />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/dpdp" element={<DPDP />} />
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Route>
      </Routes>
    </Sentry.ErrorBoundary>
  );
}
