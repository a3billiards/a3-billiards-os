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

export interface DataExportProps {
  /** Secure download URL when export is hosted; omit when body explains attachment. */
  exportUrl?: string;
  /** When true, copy explains JSON is attached instead of download link. */
  attached?: boolean;
}

export function DataExport({ exportUrl, attached }: DataExportProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: bg, fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Heading style={{ color: fg, fontSize: 22, margin: "0 0 16px" }}>
            Your Data Export is Ready
          </Heading>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
            As requested, your A3 Billiards OS personal data export has been prepared. The export includes: name, phone, email, age, session history summary, booking history, and complaint count.
          </Text>
          {attached ? (
            <Text style={{ color: fg, fontSize: 15, lineHeight: 1.6 }}>
              The export is attached to this email as a JSON file.
            </Text>
          ) : exportUrl ? (
            <>
              <Button
                href={exportUrl}
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
                Download Export
              </Button>
              <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 16 }}>Link: {exportUrl}</Text>
            </>
          ) : (
            <Text style={{ color: fg, fontSize: 14 }}>Check the message from your administrator for download instructions.</Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export default DataExport;
