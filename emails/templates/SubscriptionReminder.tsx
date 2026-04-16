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

const renew = "https://register.a3billiards.com/renew";

export interface SubscriptionReminderProps {
  clubName: string;
  expiryDate: string;
  /** 7 or 1 — shown in copy when set */
  daysUntil?: number;
}

export function SubscriptionReminder({
  clubName,
  expiryDate,
  daysUntil,
}: SubscriptionReminderProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Subscription Renewing Soon
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Your A3 Billiards OS subscription for <strong>{clubName}</strong> expires on <strong>{expiryDate}</strong>
            {daysUntil !== undefined ? (
              <>
                {" "}
                (in <strong>{daysUntil}</strong> {daysUntil === 1 ? "day" : "days"})
              </>
            ) : null}
            . Renew now to avoid interruption.
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
              marginTop: 8,
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

export default SubscriptionReminder;
