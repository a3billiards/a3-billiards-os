import * as React from "react";
// TODO Phase 9: import { Html, Head, Body, Container, Text, Button, Hr, Link } from "@react-email/components";
// Password reset link
 
export interface PasswordResetProps {
  // TODO Phase 9: define props
}
 
export function PasswordReset(_props: PasswordResetProps): React.JSX.Element {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h2>PasswordReset</h2>
      <p>Password reset link — implement in Phase 9.</p>
    </div>
  );
}
 
export default PasswordReset;
