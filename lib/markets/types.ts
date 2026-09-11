// Shared types for the Global Markets dashboard (/markets).
// Wire types for GET /api/markets plus the instrument catalog definition.
// Keep this file free of client/server-only imports so it can be used anywhere
// (API route, client components, tests).

export type MarketCategory =
  | "energy"
  | "precious-metals"
  | "industrial-metals"
  | "agriculture"
  | "rates"
  | "bonds"
  | "volatility"
  | "credit"
  | "us-equities"
  | "global-equities"
  | "currencies";

export type InstrumentType = "future" | "index" | "yield" | "etf" | "currency";

export type TrendState = "rising" | "falling" | "range-bound" | "unavailable";

export type RegimeState =
  | "strong-positive"
  | "positive"
  | "neutral"
  | "negative"
  | "strong-negative"
  | "unavailable";

// Static catalog entry — the single source of truth for which instruments the
// dashboard tracks, their symbols, units, and display precision.
export interface InstrumentDefinition {
  id: string;
  symbol: string;
  name: string;
  shortName: string;
  category: MarketCategory;
  instrumentType: InstrumentType;
  currency: string | null;
  unit: string | null;
  decimals: number;
  // For currency pairs: explicit quote direction, e.g. "Indonesian rupiah per US dollar".
  quoteDirectionNote?: string;
  isFuture?: boolean;
  // CT=F: the Yahoo quote endpoint fails schema validation for this symbol, so the
  // API derives its snapshot values from the chart endpoint instead.
  chartOnly?: boolean;
}

// Per-instrument computed snapshot returned by GET /api/markets.
export interface MarketInstrument {
  id: string;
  symbol: string;
  name: string;
  shortName: string;
  category: MarketCategory;
  instrumentType: InstrumentType;
  currency: string | null;
  unit: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  return1w: number | null;
  return1m: number | null;
  returnYtd: number | null;
  high52w: number | null;
  low52w: number | null;
  position52w: number | null;
  ma20: number | null;
  ma50: number | null;
  trend: TrendState;
  timestamp: string | null;
  sparkline: Array<{ time: string; value: number }>;
  // Honest delay labeling: Yahoo's quoteSourceName per instrument (e.g. "Delayed
  // Quote", "Nasdaq Real Time Price"). Null when sourced from chart-only data.
  quoteSource?: string | null;
  error?: string;
}

export type DetailRange = "1M" | "3M" | "6M" | "1Y" | "5Y";

export interface MarketsSnapshotResponse {
  fetchedAt: string;
  cacheHit: boolean;
  instruments: MarketInstrument[];
}

export interface MarketDetailResponse {
  id: string;
  symbol: string;
  range: DetailRange;
  bars: Array<{ date: string; close: number }>;
  fetchedAt: string;
}
