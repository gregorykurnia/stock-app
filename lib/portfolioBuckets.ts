export const PORTFOLIO_BUCKETS = ["longterm", "index", "treasury"] as const;

export type PortfolioBucket = (typeof PORTFOLIO_BUCKETS)[number];

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
