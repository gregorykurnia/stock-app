import type { ProductClass } from "./etfRanking";

// Reads data/etf-ranking-inputs.csv rows into the fund metadata that a stored run keeps. Pure: callers pass the text.

// Ticker of the cash proxy used as the risk-free series for Sortino (plan Section 4).
export const CASH_TICKER = "BIL";

// RFC 4180 subset: quoted fields may contain commas and doubled quotes.
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}

// Phase 1 records leveraged and ETN status only in its reason text, so it is read back from there.
export function productClassOf(row: Record<string, string>): ProductClass {
  if (row.structure === "operating-company-stock" || row.structure === "closed-end-fund") return "excluded";
  if (row.structure === "ETN") return "etn";
  if (row.eligibility_reason.startsWith("leveraged/inverse")) return "leveraged_inverse";
  return "standard";
}

export interface StoredFundInputMeta {
  ticker: string;
  structure: string;
  productClass: ProductClass;
  legalFormVerified: boolean;
  netExpenseRatioPct: number | null;
  aumUsd: number | null;
  aumAsOf: string | null;
  feeAsOf: string | null;
}

export function fundInputMetaFromCsv(rows: Array<Record<string, string>>): StoredFundInputMeta[] {
  return rows.map((row) => ({
    ticker: row.ticker,
    structure: row.structure,
    productClass: productClassOf(row),
    legalFormVerified: row.legal_form_verified === "yes",
    netExpenseRatioPct: row.net_expense_ratio_pct === "" ? null : Number(row.net_expense_ratio_pct),
    aumUsd: row.aum_usd === "" ? null : Number(row.aum_usd),
    aumAsOf: row.aum_as_of === "" ? null : row.aum_as_of,
    feeAsOf: row.fee_as_of === "" ? null : row.fee_as_of,
  }));
}
