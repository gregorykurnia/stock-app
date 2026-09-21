export const PORTFOLIO_BUCKETS = ["longterm", "index", "swing", "treasury"] as const;

export type PortfolioBucket = (typeof PORTFOLIO_BUCKETS)[number];

export const PORTFOLIO_BUCKET_LABELS = {
  longterm: "Long Term",
  index: "Index",
  swing: "Swing",
  treasury: "Treasury",
} satisfies Record<PortfolioBucket, string>;

export const PORTFOLIO_BUCKET_DEFINITIONS = PORTFOLIO_BUCKETS.map((id) => ({
  id,
  label: PORTFOLIO_BUCKET_LABELS[id],
}));
