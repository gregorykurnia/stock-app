import rawResearchUniverse from "../docs/research/pluang-etf-2026-10-06/research-universe.json";

export const ETF_SNAPSHOT_DATE = "2026-10-06";

export const ETF_METRIC_LABELS = {
  totalReturn1Y: "1Y total return",
  cagr3Y: "3Y annualized return",
  cagr5Y: "5Y annualized return",
  cagr10Y: "10Y annualized return",
  calendarYearReturns: "Calendar-year returns",
  trailingDistributionYield: "Trailing distribution yield",
  averageCashYield5Y: "5Y average cash yield",
  maxDrawdown5Y: "5Y maximum drawdown",
  volatility5Y: "5Y annualized volatility",
  recoveryTime: "Maximum drawdown recovery",
  underwaterObservationRate: "5Y daily observations below prior peak",
  sharpe5Y: "5Y Sharpe ratio",
  sortino5Y: "5Y Sortino ratio",
  calmar5Y: "5Y Calmar ratio",
  rolling5YMedianCagr: "Rolling 5Y median CAGR",
  rolling5YP10Cagr: "Rolling 5Y P10 CAGR",
  rolling5YWorstCagr: "Worst rolling 5Y CAGR",
  rolling5YBestCagr: "Best rolling 5Y CAGR",
  rolling5YPositiveRate: "Positive rolling 5Y windows",
  rolling5YBenchmarkWinRate: "Rolling 5Y benchmark win rate",
  benchmarkExcessCagr5Y: "5Y comparison benchmark excess CAGR",
  trackingDifference5Y: "5Y index tracking difference",
  trackingError5Y: "5Y index tracking error",
  medianSpread30D: "30-day median bid/ask spread",
  premiumDiscount: "Premium / discount to NAV",
  overallScore: "Legacy peer score",
  fundQualityScore: "Legacy peer quality field",
  historicalPerformanceScore: "Legacy peer performance field",
  scoreCoverage: "Legacy peer input coverage",
  topTenWeight: "Top-ten holdings weight",
  effectiveHoldingsCount: "Effective holdings count",
  largestHoldingWeight: "Largest holding weight",
  largestSectorWeight: "Largest sector weight",
  overlap: "Top-ten overlap (minimum)",
  expenseRatio: "Reported expense ratio",
  netAssets: "Fund net assets",
  inceptionDate: "Fund inception date",
} as const;

export type ETFMetricKey = keyof typeof ETF_METRIC_LABELS;

export const ETF_METRIC_HELP: Partial<Record<ETFMetricKey, string>> = {
  cagr5Y: "Annualized total return across the last 60 complete monthly returns. Uses actual elapsed days and the last completed month-end; it does not fall back to a shorter history.",
  cagr10Y: "Annualized total return across the last 120 complete monthly returns. Uses actual elapsed days and the last completed month-end.",
  volatility5Y: "Sample standard deviation of 60 complete monthly adjusted-price returns, multiplied by the square root of 12.",
  sharpe5Y: "Annualized mean monthly return above matched monthly risk-free holding returns, divided by sample deviation. Unavailable until a verified risk-free return series is configured.",
  sortino5Y: "Annualized mean monthly return above the risk-free minimum acceptable return, divided by downside deviation across all months. Unavailable until matched risk-free returns are available.",
  calmar5Y: "Five-year CAGR divided by the absolute five-year maximum drawdown. Undefined when maximum drawdown is zero.",
  maxDrawdown5Y: "Largest peak-to-trough decline in daily adjusted prices over the five-year window, including its starting level.",
  recoveryTime: "Trading observations from the worst drawdown peak until that peak is regained. An open drawdown remains unrecovered.",
  rolling5YMedianCagr: "Median CAGR across complete five-year monthly windows in the available rolling evaluation span. At least 12 windows are required.",
  rolling5YP10Cagr: "10th percentile of complete five-year rolling CAGRs using linear interpolation. At least 12 windows are required.",
  rolling5YWorstCagr: "Lowest complete five-year rolling CAGR in the available evaluation span. At least 12 windows are required for the summary.",
  rolling5YBestCagr: "Highest complete five-year rolling CAGR in the available evaluation span. At least 12 windows are required for the summary.",
  rolling5YPositiveRate: "Share of complete five-year rolling windows with a CAGR above zero. Overlapping windows are correlated and this is not a probability of future success.",
  rolling5YBenchmarkWinRate: "Share of paired rolling five-year windows where this fund's CAGR strictly exceeds an explicitly selected comparison reference. No default reference is assigned.",
  benchmarkExcessCagr5Y: "Fund CAGR minus a user-selected comparison fund's CAGR over identical dates. This is a return gap, not regression alpha or official index tracking.",
  trackingDifference5Y: "NAV total-return CAGR minus official benchmark total-return CAGR on identical dates. Requires verified NAV and official index inputs.",
  trackingError5Y: "Annualized sample deviation of monthly NAV returns minus official benchmark returns. Requires verified NAV and official index inputs.",
  medianSpread30D: "Provider-reported median bid/ask spread over 30 days, in basis points. A live quote is not a substitute.",
  premiumDiscount: "Market price divided by NAV minus one, at matched valuation dates and conventions.",
  effectiveHoldingsCount: "Inverse Herfindahl concentration, 1 divided by the sum of squared normalized portfolio weights. Requires verified full holdings.",
  largestHoldingWeight: "Weight of the largest security in the complete, dated portfolio holdings set.",
  largestSectorWeight: "Weight of the largest sector using a dated, common sector classification.",
  underwaterObservationRate: "Share of daily observations below the running adjusted-price peak over the same five-year window.",
  overallScore: "Retired peer-relative score placeholder. Current role-specific ETF scorecards are shown in the Score column and Score assessment details.",
  fundQualityScore: "Retired peer-relative quality placeholder. It is not used by the independent Full Grand Score methodology.",
  historicalPerformanceScore: "Retired peer-relative performance placeholder. It is not used by current role-specific scorecards.",
  scoreCoverage: "Retired peer-input coverage placeholder. Current ranked score coverage appears above the ETF table.",
};

export type ETFMetricUnit = "percent" | "percentagePoints" | "ratio" | "basisPoints" | "tradingDays" | "score" | "count" | "currency" | "date";
export type ETFMetricStatus = "available" | "insufficientHistory" | "unavailable" | "notApplicable" | "stale" | "invalidInput" | "unrecovered" | "undefined" | "provisional";

export interface ETFMetricResult {
  value: number | null;
  unit: ETFMetricUnit;
  status: ETFMetricStatus;
  reason?: string;
  startDate: string | null;
  endDate: string | null;
  observations: number;
  sourceIds: string[];
  benchmarkId?: string;
  riskFreeSeriesId?: string;
  methodologyId: string;
}

export type ETFKind = "etf" | "etn" | "excluded";
export type ETFStrategy = "core" | "income" | "leveraged" | "trust" | "commodity" | "digital" | "allocation" | "etn";
export type ETFScorecardKind = "core" | "full" | "cost-only" | "tactical" | "etn-execution";
export type ETFScoreStatus =
  | "available"
  | "notApplicable"
  | "identityUnresolved"
  | "mandatePending"
  | "insufficientHistory"
  | "missingSource"
  | "staleInput"
  | "invalidInput"
  | "methodologyPending";

export interface ETFScoreComponent {
  points: number | null;
  weight: number;
  inputValue?: number | null;
  inputUnit?: "percent" | "percentagePoints" | "basisPoints" | "ratio" | "score";
}

/** Versioned per-fund result; no peer membership or current table order affects the score. */
export interface ETFScoreAssessment {
  scorecardId: string;
  kind: ETFScorecardKind;
  family: string;
  horizon: "1Y" | "3Y" | "5Y" | "60-session" | "252-session";
  methodologyVersion: string;
  methodologyState: "candidate" | "frozen";
  comparisonGroupId: string | null;
  comparisonGroupEvidence: string[];
  cutoff: string | null;
  runId: string;
  status: ETFScoreStatus;
  score: number | null;
  rankedEligible: boolean;
  reason: string;
  components?: Record<string, ETFScoreComponent>;
  sourceIds?: string[];
  sourceUrls?: string[];
  inputDates?: Record<string, string | null>;
  observations?: Record<string, number>;
  inputHash?: string;
}

export interface ETFRecord {
  id: string;
  assetId: number;
  ticker: string;
  name: string;
  issuer: string;
  issuerDomain: string;
  category: string;
  exposure: string;
  availabilityStatus: string;
  researchStatus: string;
  structure: string;
  kind: ETFKind;
  strategy: ETFStrategy;
  cataloguePage: number | null;
  sourceTitle: string;
  sourceUrl: string;
  candidateMetrics: Record<string, string>;
  metricStates: Record<ETFMetricKey, string>;
  observedAt: string;
  pluangUrl: string;
  badges: string[];
  identityWarning: string | null;
  leverageTarget: string | null;
  resetInterval: "daily" | "weekly" | null;
  metricSnapshot?: ETFMetricSnapshot;
}

export interface ETFMetricSnapshot {
  ticker: string;
  values: Partial<Record<ETFMetricKey, number | string>>;
  states: Partial<Record<ETFMetricKey, string>>;
  metricResults?: Partial<Record<ETFMetricKey, ETFMetricResult>>;
  schemaVersion?: number;
  calculationVersion?: string;
  runId?: string;
  historyRunId?: string;
  historyStartDate?: string | null;
  historyEndDate?: string | null;
  historyObservations?: number;
  officialBenchmarkId?: string | null;
  comparisonBenchmarkId?: string | null;
  scoreAssessments?: ETFScoreAssessment[];
  scoreObservedAt?: string | null;
  scoreStale?: boolean;
  scoreHistoryHash?: string | null;
  metadataProvenance?: {
    sourceId: string;
    status: "fetchedUnverified" | "issuerVerified";
    retrievedAt: string;
    expenseRatioLabel?: string | null;
    holdingsCoverage: "partialTopHoldings" | "full" | "unavailable";
  };
  drawdownDetails?: {
    peakDate: string | null;
    troughDate: string | null;
    recoveryDate: string | null;
    underwaterObservationRate: number | null;
    elapsedUnderwaterTradingDays: number | null;
  };
  sinceInceptionReturn?: {
    value: number;
    periodYears: number;
    startDate: string;
    endDate: string;
    annualized: boolean;
  };
  holdings: Array<{ symbol: string; weightPct: number }>;
  source: string;
  currency: string | null;
  observedAt: string | null;
  lastAttemptAt: string | null;
  lastError?: string | null;
  stale?: boolean;
}

export interface ETFCategoryMeta {
  key: string;
  description: string;
}

export const ETF_CATEGORY_META: ETFCategoryMeta[] = [
  { key: "US broad market and styles", description: "Large, mid, and small-cap US equity benchmarks and styles." },
  { key: "International and global equities", description: "Developed, emerging, and global equity exposure." },
  { key: "Fixed income and preferred securities", description: "Treasuries, credit, cash-like bonds, and preferred shares." },
  { key: "Sector and thematic equities", description: "Industry sectors, themes, countries, and focused equity baskets." },
  { key: "Dividend equities", description: "Equity portfolios selected for dividends or dividend growth." },
  { key: "Real estate and infrastructure equities", description: "REITs and listed real-asset or infrastructure companies." },
  { key: "Physical precious metals", description: "Trusts backed by physical gold, silver, platinum, or palladium." },
  { key: "Spot digital asset trusts", description: "Spot digital-asset exposure through exchange-traded trusts." },
  { key: "Commodity futures", description: "Futures, commodity pools, and related resource exposure." },
  { key: "Digital asset futures", description: "Digital-asset exposure through futures-based products." },
  { key: "Options income and distribution strategies", description: "Covered-call, option-income, and distribution-focused mandates." },
  { key: "Leveraged and inverse ETFs", description: "Daily leveraged or inverse exposure with path-dependent results." },
  { key: "Multi-asset allocation", description: "One fund combining multiple asset classes or sleeves." },
];

const IDENTITY_WARNINGS: Record<string, string> = {
  FLOT: "Identity unresolved: confirm whether this is the Australian VanEck FLOT or the US iShares FLOT before joining any history.",
  FNGU: "ETN continuity unresolved: confirm the current note series, CUSIP, and corporate actions before joining any history.",
};

interface RawResearchRecord {
  id: string;
  assetId: number;
  name: string;
  displaySymbol: string;
  issuer?: string;
  issuerDomain?: string;
  primaryResearchGroup: string;
  exposure: string;
  availabilityStatus: string;
  cataloguePage?: number;
  usCataloguePage?: number;
  researchStatus: string;
  structure: string;
  issuerResearch?: {
    selectedSource?: { title?: string; url?: string };
    candidateMetrics?: Record<string, string>;
    observedAt?: string;
  };
  metricStates?: Record<string, string>;
}

const rawRecords = rawResearchUniverse as RawResearchRecord[];

function recordKind(group: string): ETFKind {
  if (group === "ETNs — separate from ETFs") return "etn";
  if (group === "Exclusions") return "excluded";
  return "etf";
}

function recordStrategy(group: string, structure: string): ETFStrategy {
  if (group === "ETNs — separate from ETFs") return "etn";
  if (group === "Options income and distribution strategies" || group === "Dividend equities") return "income";
  if (group === "Leveraged and inverse ETFs") return "leveraged";
  if (group === "Physical precious metals" || group === "Spot digital asset trusts" || structure.includes("trust")) return "trust";
  if (group === "Commodity futures") return "commodity";
  if (group === "Digital asset futures") return "digital";
  if (group === "Multi-asset allocation") return "allocation";
  return "core";
}

function addBadge(badges: string[], value: string) {
  if (!badges.includes(value)) badges.push(value);
}

function recordBadges(raw: RawResearchRecord, kind: ETFKind): string[] {
  const badges: string[] = [];
  const lower = `${raw.name} ${raw.exposure}`.toLowerCase();

  if (kind === "etn") addBadge(badges, "ETN");
  if (raw.structure === "physical-metal-trust") addBadge(badges, "Physical metal");
  if (raw.structure === "spot-bitcoin-trust") addBadge(badges, "Spot bitcoin");
  if (raw.structure.startsWith("commodity-pool")) addBadge(badges, "Commodity pool");
  if (raw.primaryResearchGroup === "Options income and distribution strategies") addBadge(badges, "Options income");
  if (raw.primaryResearchGroup === "Leveraged and inverse ETFs") {
    addBadge(badges, lower.includes("inverse") || lower.includes("ultrashort") || lower.includes("bear") ? "Inverse" : "Leveraged");
    addBadge(badges, "Daily reset");
  }
  if (lower.includes("single-stock") || /(?:linked|target) (?:option|exposure)/.test(lower) || /\b(?:amd|amzn|coin|mstr|nvda|tsla)\b/.test(lower) && raw.primaryResearchGroup === "Options income and distribution strategies") {
    addBadge(badges, "Single-stock");
  }
  if (lower.includes("0dte")) addBadge(badges, "0DTE");
  if (raw.displaySymbol === "NVDW") {
    addBadge(badges, "Weekly reset");
    addBadge(badges, "1.2× target");
  }
  if (raw.primaryResearchGroup === "Digital asset futures") addBadge(badges, "Futures");
  if (!badges.length) addBadge(badges, "Core exposure");

  return badges;
}

function leverageTarget(exposure: string): string | null {
  const match = exposure.match(/[+−-]?\d+(?:\.\d+)?×/);
  return match?.[0] ?? null;
}

function resetInterval(raw: RawResearchRecord): "daily" | "weekly" | null {
  if (raw.primaryResearchGroup === "Leveraged and inverse ETFs") return "daily";
  if (raw.displaySymbol === "NVDW") return "weekly";
  return null;
}

function metricStates(raw: RawResearchRecord): Record<ETFMetricKey, string> {
  return Object.fromEntries(
    Object.keys(ETF_METRIC_LABELS).map((key) => [key, raw.metricStates?.[key] ?? "not collected/validated"]),
  ) as Record<ETFMetricKey, string>;
}

function toRecord(raw: RawResearchRecord): ETFRecord {
  const kind = recordKind(raw.primaryResearchGroup);
  const source = raw.issuerResearch?.selectedSource ?? {};
  return {
    id: raw.id,
    assetId: raw.assetId,
    ticker: raw.displaySymbol,
    name: raw.name,
    issuer: raw.issuer ?? "Issuer not recorded",
    issuerDomain: raw.issuerDomain ?? "",
    category: raw.primaryResearchGroup,
    exposure: raw.exposure,
    availabilityStatus: raw.availabilityStatus,
    researchStatus: raw.researchStatus,
    structure: raw.structure,
    kind,
    strategy: recordStrategy(raw.primaryResearchGroup, raw.structure),
    cataloguePage: raw.cataloguePage ?? raw.usCataloguePage ?? null,
    sourceTitle: source.title ?? "Issuer source not recorded",
    sourceUrl: source.url ?? "",
    candidateMetrics: raw.issuerResearch?.candidateMetrics ?? {},
    metricStates: metricStates(raw),
    observedAt: raw.issuerResearch?.observedAt ?? ETF_SNAPSHOT_DATE,
    pluangUrl: `https://pluang.com/asset/usstock/${raw.displaySymbol}/${raw.assetId}`,
    badges: recordBadges(raw, kind),
    identityWarning: IDENTITY_WARNINGS[raw.displaySymbol] ?? null,
    leverageTarget: leverageTarget(raw.exposure),
    resetInterval: resetInterval(raw),
  };
}

const allRecords = rawRecords.map(toRecord);

export const ETF_CATALOG = allRecords.filter((record) => record.kind === "etf").sort((a, b) => a.ticker.localeCompare(b.ticker));
export const ETF_ETNS = allRecords.filter((record) => record.kind === "etn").sort((a, b) => a.ticker.localeCompare(b.ticker));
export const ETF_EXCLUSIONS = allRecords.filter((record) => record.kind === "excluded").sort((a, b) => a.ticker.localeCompare(b.ticker));

export const ETF_CATALOG_COUNTS = {
  etfLike: ETF_CATALOG.length,
  etns: ETF_ETNS.length,
  exclusions: ETF_EXCLUSIONS.length,
  categories: ETF_CATEGORY_META.length,
  tradabilityConfirmed: 0,
};
