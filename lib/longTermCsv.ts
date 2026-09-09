export function csvEscape(value: unknown, missing = "N/A"): string {
  if (value == null || value === "") return missing;
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createCsv(headers: string[], rows: unknown[][]): string {
  return "\uFEFF" + [headers, ...rows].map(row => row.map(value => csvEscape(value)).join(",")).join("\r\n");
}
