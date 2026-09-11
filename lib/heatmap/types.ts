// Shared types for the US Market Heatmap (/heatmap).
// Wire types for GET /api/heatmap plus the client-side view-state config.
// Keep this file free of client/server-only imports so it can be used anywhere
// (API route, client components, tests) — same convention as lib/markets/types.ts.

// Selected return period. 1D is price vs previous close; every other period is
// a close-to-close return against the nearest prior trading day (see calculations.ts).
export type HeatmapPeriod = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y";

// What the tile color encodes. "performance" is the raw selected-period return,
// "relative" is that return minus the S&P 500's return for the same period.
export type HeatmapColorMetric =
  | "performance"
  | "relative"
  | "relVolume"
  | "dist52wHigh"
  | "distMa20"
  | "distMa50"
  | "distMa200";

export type HeatmapSizeMetric = "marketCap" | "equal" | "dollarVolume";

export type HeatmapGrouping = "sector" | "sectorIndustry";

export type HeatmapMoversFilter = "all" | "gainers" | "losers";

export type HeatmapPalette = "classic" | "colorblindSafe";

export type HeatmapViewMode = "map" | "list";

export interface HeatmapReturns {
  oneDay: number | null;
  oneWeek: number | null;
  oneMonth: number | null;
  threeMonths: number | null;
  ytd: number | null;
  oneYear: number | null;
}

// One constituent of the heatmap universe. Metadata (name/sector/industry) comes
// from the committed static list; every market field is per-symbol from Yahoo.
// A symbol that failed to load still appears here with null metrics and `error`
// set, so the map can render an explicit "unavailable" tile.
export interface HeatmapStock {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  price: number | null;
  previousClose: number | null;
  returns: HeatmapReturns;
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  dollarVolume: number | null;
  high52Week: number | null;
  low52Week: number | null;
  position52Week: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  timestamp: string | null;
  quoteSource: string | null;
  error?: string;
}

export interface HeatmapBenchmark {
  symbol: string;
  label: string;
  price: number | null;
  previousClose: number | null;
  returns: HeatmapReturns;
}

export type MarketSessionState = "pre" | "regular" | "post" | "closed";

// Honest data-status label, derived server-side per response:
//   recent  — fresh snapshot, quotes from the current/previous session
//   delayed — fresh snapshot but the provider marks quotes as delayed
//   partial — snapshot fresh but some constituents failed to load
//   stale   — serving an older snapshot (cache expired / refresh failed)
export type HeatmapDataStatus = "recent" | "delayed" | "stale" | "partial";

export interface HeatmapResponse {
  fetchedAt: string;
  // True when this response came from the in-memory snapshot cache rather than a
  // fresh provider fetch. A stale-while-revalidate hit also sets `stale`.
  cacheHit: boolean;
  stale: boolean;
  // Set only when a forced refresh (?refresh=1) failed and the last usable
  // snapshot was served instead. Carries the provider error message.
  refreshFailed?: string;
  session: MarketSessionState;
  status: HeatmapDataStatus;
  constituentsAsOf: string;
  benchmark: HeatmapBenchmark;
  stocks: HeatmapStock[];
  errors: Array<{ symbol: string; message: string }>;
  delayedQuoteCount: number;
}

// GET /api/heatmap?history=SYMBOL — daily closes for the drawer sparkline.
export interface HeatmapHistoryResponse {
  symbol: string;
  bars: Array<{ date: string; close: number }>;
  fetchedAt: string;
}

// Client-side view state, round-tripped through /heatmap query params so a
// heatmap configuration can be bookmarked and shared. Zoom is
// "SECTOR" or "SECTOR|Industry" ("|" keeps it safe in a single param).
export interface HeatmapViewState {
  period: HeatmapPeriod;
  colorMetric: HeatmapColorMetric;
  sizeMetric: HeatmapSizeMetric;
  grouping: HeatmapGrouping;
  search: string;
  sectorFilter: string; // "" = all sectors
  movers: HeatmapMoversFilter;
  watchlistOnly: boolean;
  viewMode: HeatmapViewMode;
  palette: HeatmapPalette;
  zoomSector: string; // "" = whole market
  zoomIndustry: string; // "" = sector level
}
