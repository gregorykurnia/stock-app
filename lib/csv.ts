export function csvEscape(value: unknown, missing = "N/A"): string {
  const raw = value == null ? missing : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function buildCsv(headers: string[], rows: unknown[][], missing = "N/A") {
  return "\uFEFF" + [headers, ...rows].map((row) => row.map((v) => csvEscape(v, missing)).join(",")).join("\r\n");
}
