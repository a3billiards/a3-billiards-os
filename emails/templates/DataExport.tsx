import * as React from "react";
// TODO Phase 9: import { Html, Head, Body, Container, Text, Button, Hr, Link } from "@react-email/components";
// DPDP data export download link
 
export interface DataExportProps {
  // TODO Phase 9: define props
}
 
export function DataExport(_props: DataExportProps): React.JSX.Element {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h2>DataExport</h2>
      <p>DPDP data export download link — implement in Phase 9.</p>
    </div>
  );
}
 
export default DataExport;
