// S&P 500 constituent metadata for the heatmap. This is intentionally static,
// committed data — NOT a runtime scrape. The index composition changes a handful
// of times per year, so the snapshot carries an explicit `asOf` date which the
// UI surfaces ("Constituents as of …"). Market values are never stored here.
//
// Source: S&P 500 constituent list with GICS sector + sub-industry, captured
// 2026-09-11. Share-class tickers are normalized to Yahoo's hyphen form
// (BRK.B -> BRK-B, BF.B -> BF-B); `spTicker` keeps the index's dotted form.

import rawJson from "./sp500-constituents.json";

interface RawConstituent {
  /** Yahoo Finance symbol (hyphen share-class form). */
  t: string;
  /** Original index ticker when it differs (dotted share-class form). */
  sp?: string;
  n: string; // company name
  s: string; // GICS sector
  i: string; // GICS sub-industry
}

interface RawFile {
  asOf: string;
  source: string;
  count: number;
  constituents: RawConstituent[];
}

const raw = rawJson as RawFile;

export const SP500_AS_OF: string = raw.asOf;

export interface HeatmapConstituent {
  /** Yahoo Finance symbol — the key used for all market-data calls. */
  symbol: string;
  /** Index ticker as published (dotted share-class form) when it differs. */
  indexTicker?: string;
  companyName: string;
  sector: string;
  industry: string;
}

// Yahoo Finance uses hyphens for share classes while index publications use
// dots. Normalizing before any provider call keeps BRK.B/BF.B-style tickers
// queryable; letters are upper-cased defensively.
export function toYahooSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

export const SP500_CONSTITUENTS: HeatmapConstituent[] = raw.constituents.map((entry) => ({
  symbol: toYahooSymbol(entry.t),
  indexTicker: entry.sp,
  companyName: entry.n,
  sector: entry.s,
  industry: entry.i,
}));

// Canonical GICS sector order — fixed so the treemap layout is stable day to day.
export const GICS_SECTORS: string[] = [
  "Energy",
  "Materials",
  "Industrials",
  "Utilities",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Information Technology",
  "Communication Services",
  "Real Estate",
];

// Compact labels for tight sector header strips in the treemap.
export const SECTOR_SHORT_LABELS: Record<string, string> = {
  "Information Technology": "Info Tech",
  "Communication Services": "Comm Services",
  "Consumer Discretionary": "Cons. Disc.",
  "Consumer Staples": "Cons. Staples",
  "Health Care": "Health Care",
  "Real Estate": "Real Estate",
  Energy: "Energy",
  Materials: "Materials",
  Industrials: "Industrials",
  Utilities: "Utilities",
  Financials: "Financials",
};

export function sectorShortLabel(sector: string): string {
  return SECTOR_SHORT_LABELS[sector] ?? sector;
}

// Sectors present in the data but missing from the canonical list (a snapshot
// drift or GICS revision) sort after the known ones, alphabetically.
export function sortSectors(sectors: Iterable<string>): string[] {
  const seen = new Set(sectors);
  const known = GICS_SECTORS.filter((sector) => seen.has(sector));
  const unknown = [...seen].filter((sector) => !GICS_SECTORS.includes(sector)).sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}
