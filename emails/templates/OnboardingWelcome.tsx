import * as React from "react";
// TODO Phase 9: import { Html, Head, Body, Container, Text, Button, Hr, Link } from "@react-email/components";
// Welcome email after club registration
 
export interface OnboardingWelcomeProps {
  // TODO Phase 9: define props
}
 
export function OnboardingWelcome(_props: OnboardingWelcomeProps): React.JSX.Element {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h2>OnboardingWelcome</h2>
      <p>Welcome email after club registration — implement in Phase 9.</p>
    </div>
  );
}
 
export default OnboardingWelcome;
