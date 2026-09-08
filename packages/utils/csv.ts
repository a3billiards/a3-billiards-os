/** Escape one CSV cell (RFC 4180). */
export function csvEscape(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Join rows into a CSV string with UTF-8 BOM for Excel. */
export function rowsToCsv(
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return `\uFEFF${body}`;
}
