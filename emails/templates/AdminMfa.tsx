// @ts-nocheck — @react-email vs React 19: duplicate ReactNode types under pnpm
import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Text,
} from "@react-email/components";

const bg = "#0D1117";
const fg = "#F0F6FC";

export interface AdminMfaProps {
  code: string;
}

export function AdminMfa({ code }: AdminMfaProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Your Verification Code
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            Enter this code to complete your login:
          </Text>
          <Text
            style={{
              color: fg,
              fontFamily: "ui-monospace, monospace",
              fontSize: 32,
              letterSpacing: 4,
              margin: "16px 0",
            }}
          >
            {code}
          </Text>
          <Text style={{ color: fg, fontSize: 14, lineHeight: 1.6 }}>
            This code expires in 10 minutes and is single-use.
          </Text>
          <Text style={{ color: "#8b949e", fontSize: 13, marginTop: 24, lineHeight: 1.5 }}>
            If you didn&apos;t attempt to log in, contact platform support immediately.
          </Text>
          <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 12 }}>
            Plain text: {code}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AdminMfa;
