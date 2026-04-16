// @ts-nocheck — @react-email vs React 19: duplicate ReactNode types under pnpm
import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Text,
} from "@react-email/components";

const bg = "#0D1117";
const fg = "#F0F6FC";
const accent = "#43A047";
const danger = "#f85149";

const renew = "https://register.a3billiards.com/renew";

export interface SubscriptionGracePeriodProps {
  clubName: string;
  /** When the grace period ends (freeze time), human-readable in club timezone */
  freezeTime: string;
}

export function SubscriptionGracePeriod({
  clubName,
  freezeTime,
}: SubscriptionGracePeriodProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Action Required: Subscription Expired
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Your subscription for <strong>{clubName}</strong> has expired. You have a 24-hour grace period before your account is frozen. Renew now to maintain access.
          </Text>
          <Text style={{ color: danger, fontSize: 14, fontWeight: 600, marginTop: 12 }}>
            Full access ends after <strong>{freezeTime}</strong> if not renewed.
          </Text>
          <Button
            href={renew}
            style={{
              backgroundColor: accent,
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
              marginTop: 16,
            }}
          >
            Renew Now
          </Button>
          <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 20 }}>Link: {renew}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default SubscriptionGracePeriod;
