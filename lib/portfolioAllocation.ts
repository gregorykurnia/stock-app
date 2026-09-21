import {
  PORTFOLIO_BUCKET_LABELS,
  PORTFOLIO_BUCKETS,
  type PortfolioBucket,
} from "./portfolioBuckets";
import {
  reducePortfolioLedger,
  type LedgerTransaction,
  type PortfolioLedgerState,
} from "./portfolioLedger";

const EPSILON = 1e-8;

export type PortfolioAllocationStatus = "ready" | "empty" | "incomplete";

export interface PortfolioAllocationHolding {
  ticker: string;
  bucket: PortfolioBucket;
  bucketLabel: string;
  quantity: number;
  costBasisUsd: number;
  percentage: number;
  hasCostBasis: boolean;
}

export interface PortfolioAllocationBucket {
  bucket: PortfolioBucket;
  label: string;
  costBasisUsd: number;
  percentage: number;
}

export interface PortfolioAllocation {
  status: PortfolioAllocationStatus;
  totalEntryValueUsd: number;
  positionCount: number;
  buckets: Record<PortfolioBucket, PortfolioAllocationBucket>;
  holdings: PortfolioAllocationHolding[];
  missingCostBasisTickers: string[];
}

function normalizedCostBasis(value: number) {
  return Number.isFinite(value) && value > EPSILON ? value : 0;
}

/**
 * Calculates the current entry-value allocation from an already reduced ledger.
 * Market values and quotes intentionally do not participate in this calculation.
 */
export function calculatePortfolioAllocation(state: PortfolioLedgerState): PortfolioAllocation {
  const positions = PORTFOLIO_BUCKETS.flatMap((bucket) => (
    Object.values(state.buckets[bucket].positions).map((position) => {
      const costBasisUsd = normalizedCostBasis(position.costBasisUsd);
      return {
        ticker: position.ticker,
        bucket,
        bucketLabel: PORTFOLIO_BUCKET_LABELS[bucket],
        quantity: position.quantity,
        costBasisUsd,
        hasCostBasis: costBasisUsd > EPSILON,
      };
    })
  ));

  const totalEntryValueUsd = positions.reduce((sum, position) => sum + position.costBasisUsd, 0);
  const positionCount = positions.length;
  const missingCostBasisTickers = [...new Set(
    positions.filter((position) => !position.hasCostBasis).map((position) => position.ticker),
  )].sort();

  const holdings = positions
    .map((position) => ({
      ...position,
      percentage: totalEntryValueUsd > EPSILON ? position.costBasisUsd / totalEntryValueUsd * 100 : 0,
    }))
    .sort((left, right) => (
      right.costBasisUsd - left.costBasisUsd
      || left.ticker.localeCompare(right.ticker)
      || left.bucket.localeCompare(right.bucket)
    ));

  const buckets = Object.fromEntries(PORTFOLIO_BUCKETS.map((bucket) => {
    const costBasisUsd = holdings
      .filter((holding) => holding.bucket === bucket)
      .reduce((sum, holding) => sum + holding.costBasisUsd, 0);
    return [bucket, {
      bucket,
      label: PORTFOLIO_BUCKET_LABELS[bucket],
      costBasisUsd,
      percentage: totalEntryValueUsd > EPSILON ? costBasisUsd / totalEntryValueUsd * 100 : 0,
    }];
  })) as Record<PortfolioBucket, PortfolioAllocationBucket>;

  const status: PortfolioAllocationStatus = positionCount === 0
    ? "empty"
    : missingCostBasisTickers.length > 0 || totalEntryValueUsd <= EPSILON
      ? "incomplete"
      : "ready";

  return {
    status,
    totalEntryValueUsd,
    positionCount,
    buckets,
    holdings,
    missingCostBasisTickers,
  };
}

/** Reduces the current ledger before calculating allocation, keeping the data path explicit. */
export function buildPortfolioAllocation(transactions: readonly LedgerTransaction[]): PortfolioAllocation {
  return calculatePortfolioAllocation(reducePortfolioLedger(transactions));
}
