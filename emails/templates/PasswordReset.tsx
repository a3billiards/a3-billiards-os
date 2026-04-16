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

export interface PasswordResetProps {
  resetLink: string;
}

export function PasswordReset({ resetLink }: PasswordResetProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Reset Your Password
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Click the button below to set a new password. This link expires in 1 hour and can only be used once.
          </Text>
          <Button
            href={resetLink}
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
            Reset Password
          </Button>
          <Hr style={{ borderColor: "#30363d", margin: "24px 0" }} />
          <Text style={{ color: "#8b949e", fontSize: 13, lineHeight: 1.5 }}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
          <Text style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
            Plain link: {resetLink}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordReset;
