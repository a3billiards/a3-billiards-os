import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { initInstrumentation } from "./instrumentation";

initInstrumentation();

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl || convexUrl.length === 0) {
  document.body.innerHTML =
    '<div style="font-family:sans-serif;padding:40px;background:#0d1117;color:#e6edf3;max-width:560px;margin:auto;"><h1>Configuration error</h1><p>Set <code>VITE_CONVEX_URL</code> for this deployment.</p></div>';
  throw new Error("VITE_CONVEX_URL is required");
}

const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  </React.StrictMode>,
);
