import * as React from "react";
// TODO Phase 9: import { Html, Head, Body, Container, Text, Button, Hr, Link } from "@react-email/components";
// MFA one-time code for Admin login
 
export interface AdminMfaProps {
  // TODO Phase 9: define props
}
 
export function AdminMfa(_props: AdminMfaProps): React.JSX.Element {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h2>AdminMfa</h2>
      <p>MFA one-time code for Admin login — implement in Phase 9.</p>
    </div>
  );
}
 
export default AdminMfa;
