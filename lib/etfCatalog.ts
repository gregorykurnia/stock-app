import rawResearchUniverse from "@/docs/research/pluang-etf-2026-10-06/research-universe.json";

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
  topTenWeight: "Top-ten holdings weight",
  overlap: "Holdings overlap",
} as const;

export type ETFMetricKey = keyof typeof ETF_METRIC_LABELS;

export type ETFKind = "etf" | "etn" | "excluded";
export type ETFStrategy = "core" | "income" | "leveraged" | "trust" | "commodity" | "digital" | "allocation" | "etn";

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
