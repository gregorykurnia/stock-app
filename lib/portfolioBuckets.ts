export const PORTFOLIO_BUCKETS = ["longterm", "index", "treasury"] as const;

export type PortfolioBucket = (typeof PORTFOLIO_BUCKETS)[number];

// Historical ledger records may still reference retired sleeves. Keep those
// records replayable without exposing the retired sleeve as a current bucket.
export const RETIRED_PORTFOLIO_BUCKETS = ["swing"] as const;

export type RetiredPortfolioBucket = (typeof RETIRED_PORTFOLIO_BUCKETS)[number];
export type LedgerBucket = PortfolioBucket | RetiredPortfolioBucket;

export function isCurrentPortfolioBucket(value: unknown): value is PortfolioBucket {
  return typeof value === "string" && (PORTFOLIO_BUCKETS as readonly string[]).includes(value);
}

export function isRetiredPortfolioBucket(value: unknown): value is RetiredPortfolioBucket {
  return typeof value === "string" && (RETIRED_PORTFOLIO_BUCKETS as readonly string[]).includes(value);
}

export function isLedgerBucket(value: unknown): value is LedgerBucket {
  return isCurrentPortfolioBucket(value) || isRetiredPortfolioBucket(value);
}

export const PORTFOLIO_BUCKET_LABELS = {
  longterm: "Long Term",
  index: "Index",
  treasury: "Treasury",
} satisfies Record<PortfolioBucket, string>;

export const PORTFOLIO_BUCKET_COLORS = {
  longterm: "#0ea5e9",
  index: "#8b5cf6",
  treasury: "#10b981",
} satisfies Record<PortfolioBucket, string>;

export const PORTFOLIO_BUCKET_DEFINITIONS = PORTFOLIO_BUCKETS.map((id) => ({
  id,
  label: PORTFOLIO_BUCKET_LABELS[id],
}));
