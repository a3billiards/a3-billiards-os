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

export interface PasscodeResetProps {
  resetLink: string;
}

export function PasscodeReset({ resetLink }: PasscodeResetProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Reset Your Settings PIN
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Click the button below to reset your Settings PIN. After clicking, you will be asked to create a new PIN on your next login. This link expires in 1 hour.
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
            Reset PIN
          </Button>
          <Hr style={{ borderColor: "#30363d", margin: "24px 0" }} />
          <Text style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>Plain link: {resetLink}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasscodeReset;
