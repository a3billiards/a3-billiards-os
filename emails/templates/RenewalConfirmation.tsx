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

const ownerLink = "https://links.a3billiards.com/owner/home";

export interface RenewalConfirmationProps {
  clubName: string;
  newExpiryDate: string;
}

export function RenewalConfirmation({
  clubName,
  newExpiryDate,
}: RenewalConfirmationProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>Subscription Renewed!</Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Your A3 Billiards OS subscription for <strong>{clubName}</strong> has been renewed successfully. Your new subscription period runs until <strong>{newExpiryDate}</strong>.
          </Text>
          <Button
            href={ownerLink}
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
            Open the Owner App
          </Button>
          <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 20 }}>Link: {ownerLink}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default RenewalConfirmation;
