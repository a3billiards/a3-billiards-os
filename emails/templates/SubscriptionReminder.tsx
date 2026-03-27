import * as React from "react";
// TODO Phase 9: import { Html, Head, Body, Container, Text, Button, Hr, Link } from "@react-email/components";
// Sent 7 days before subscription expiry
 
export interface SubscriptionReminderProps {
  // TODO Phase 9: define props
}
 
export function SubscriptionReminder(_props: SubscriptionReminderProps): React.JSX.Element {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h2>SubscriptionReminder</h2>
      <p>Sent 7 days before subscription expiry — implement in Phase 9.</p>
    </div>
  );
}
 
export default SubscriptionReminder;
