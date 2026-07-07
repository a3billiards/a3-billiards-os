import React from "react";
import { formatInrFromPaise } from "@a3/utils/subscriptionInvoiceGst";

export type GstBreakdownRow = {
  totalPaise: number;
  taxablePaise: number;
  gstPaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  splitMode: "igst" | "cgst_sgst";
};

type Props = {
  gst: GstBreakdownRow;
  currency?: string;
  compact?: boolean;
};

export function SubscriptionGstBreakdown({
  gst,
  currency = "INR",
  compact = false,
}: Props): React.JSX.Element {
  const halfRate = gst.gstRatePercent / 2;
  return (
    <table className="legal-table" style={{ marginTop: compact ? 8 : 12 }}>
      <tbody>
        <tr>
          <th>Taxable value</th>
          <td>
            {formatInrFromPaise(gst.taxablePaise)} {currency}
          </td>
        </tr>
        {gst.splitMode === "cgst_sgst" ? (
          <>
            <tr>
              <th>CGST @ {halfRate}%</th>
              <td>
                {formatInrFromPaise(gst.cgstPaise)} {currency}
              </td>
            </tr>
            <tr>
              <th>SGST @ {halfRate}%</th>
              <td>
                {formatInrFromPaise(gst.sgstPaise)} {currency}
              </td>
            </tr>
          </>
        ) : (
          <tr>
            <th>IGST @ {gst.gstRatePercent}%</th>
            <td>
              {formatInrFromPaise(gst.igstPaise)} {currency}
            </td>
          </tr>
        )}
        <tr>
          <th>Total (incl. GST)</th>
          <td>
            <strong>
              {formatInrFromPaise(gst.totalPaise)} {currency}
            </strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
