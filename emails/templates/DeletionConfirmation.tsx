// @ts-nocheck — @react-email vs React 19: duplicate ReactNode types under pnpm
import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Text,
} from "@react-email/components";

const bg = "#0D1117";
const fg = "#F0F6FC";
const accent = "#43A047";

export interface DeletionConfirmationProps {
  cancelLink: string;
  role: "owner" | "customer" | string;
}

export function DeletionConfirmation({
  cancelLink,
  role,
}: DeletionConfirmationProps): React.JSX.Element {
  const isOwner = role === "owner";
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Account Deletion Scheduled
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Your A3 Billiards OS account is scheduled for permanent deletion in 30 days. If you change your mind, click the button below to cancel the deletion request.
          </Text>
          <Button
            href={cancelLink}
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
            Cancel Deletion
          </Button>
          <Hr style={{ borderColor: "#30363d", margin: "24px 0" }} />
          <Text style={{ color: "#8b949e", fontSize: 13, lineHeight: 1.5 }}>
            If you do not cancel, your account and all associated data will be permanently deleted after 30 days.
          </Text>
          {isOwner ? (
            <Text style={{ color: fg, fontSize: 14, marginTop: 12 }}>
              Note: Your club data will also be deleted.
            </Text>
          ) : null}
          <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 16 }}>Plain link: {cancelLink}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DeletionConfirmation;
