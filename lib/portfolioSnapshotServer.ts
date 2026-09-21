import "server-only";

import {
  getPortfolioDivisionStocks,
  getPortfolioLedgerTransactions,
  getPortfolioPerformanceSnapshots,
  savePortfolioPerformanceSnapshot,
} from "@/lib/firestore";
import { fetchHistoricalSnapshotQuotes, fetchSnapshotQuotes } from "@/lib/yahooServer";
import { newYorkMarketContext } from "@/lib/portfolioSchedule";
import { buildLedgerPortfolioSnapshot } from "@/lib/portfolioSnapshot";
import {
  emptySnapshotBuckets,
  findLedgerSnapshotImpact,
  type PortfolioBucket,
  type PortfolioSnapshot,
  type SnapshotPosition,
} from "@/lib/portfolioPerformance";
import { PORTFOLIO_BUCKETS } from "@/lib/portfolioBuckets";

const BUCKETS: PortfolioBucket[] = [...PORTFOLIO_BUCKETS];

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

async function buildLegacyPortfolioSnapshot(source: PortfolioSnapshot["source"]): Promise<PortfolioSnapshot> {
  const divisionData = await Promise.all(BUCKETS.map(async (bucket) => ({
    bucket,
    data: await getPortfolioDivisionStocks(bucket),
  })));

  const holdings = divisionData.flatMap(({ bucket, data }) => Object.entries(data).flatMap(([ticker, value]) => {
    const record = value as { entry_price?: number | null; entry_quantity?: number | null };
    if (record.entry_quantity == null || !Number.isFinite(record.entry_quantity) || record.entry_quantity <= 0) return [];
    return [{
      bucket,
      ticker,
      quantity: record.entry_quantity,
      entryPriceUsd: record.entry_price != null && Number.isFinite(record.entry_price) ? record.entry_price : null,
    }];
  }));

  const tickers = [...new Set(holdings.map((holding) => holding.ticker))];
  const quotes = await fetchSnapshotQuotes([...tickers, "IDR=X"]);
  const fxQuote = quotes["IDR=X"];
  if (fxQuote?.price == null || fxQuote.price <= 0) throw new Error("USD/IDR quote is unavailable");

  const marketDates = tickers.flatMap((ticker) => quotes[ticker]?.marketDate ? [quotes[ticker].marketDate as string] : []);
  const sessionDate = marketDates.sort().at(-1) ?? newYorkMarketContext().sessionDate;
  const buckets = emptySnapshotBuckets();
  const positions: SnapshotPosition[] = [];
  const missingTickers = new Set<string>();

  for (const holding of holdings) {
    const quote = quotes[holding.ticker];
    if (quote?.price == null || quote.marketDate !== sessionDate) {
      missingTickers.add(holding.ticker);
      continue;
    }
    const valueUsd = holding.quantity * quote.price;
    const costBasisUsd = holding.entryPriceUsd == null ? null : holding.quantity * holding.entryPriceUsd;
    const position: SnapshotPosition = {
      ticker: holding.ticker,
      bucket: holding.bucket,
      quantity: holding.quantity,
      priceUsd: round(quote.price, 6),
      valueUsd: round(valueUsd),
      valueIdr: round(valueUsd * fxQuote.price),
      entryPriceUsd: holding.entryPriceUsd,
      costBasisUsd: costBasisUsd == null ? null : round(costBasisUsd),
    };
    positions.push(position);
    const summary = buckets[holding.bucket];
    summary.valueUsd += position.valueUsd;
    summary.valueIdr += position.valueIdr;
    summary.costBasisUsd += position.costBasisUsd ?? 0;
    summary.unrealizedUsd += position.costBasisUsd == null ? 0 : position.valueUsd - position.costBasisUsd;
    summary.positionCount += 1;
  }

  for (const bucket of BUCKETS) {
    for (const key of ["valueUsd", "valueIdr", "costBasisUsd", "unrealizedUsd"] as const) {
      buckets[bucket][key] = round(buckets[bucket][key]);
    }
  }

  const total = BUCKETS.reduce((result, bucket) => ({
    valueUsd: result.valueUsd + buckets[bucket].valueUsd,
    valueIdr: result.valueIdr + buckets[bucket].valueIdr,
    costBasisUsd: result.costBasisUsd + buckets[bucket].costBasisUsd,
    unrealizedUsd: result.unrealizedUsd + buckets[bucket].unrealizedUsd,
    positionCount: result.positionCount + buckets[bucket].positionCount,
  }), { valueUsd: 0, valueIdr: 0, costBasisUsd: 0, unrealizedUsd: 0, positionCount: 0 });
  for (const key of ["valueUsd", "valueIdr", "costBasisUsd", "unrealizedUsd"] as const) {
    total[key] = round(total[key]);
  }

  return {
    sessionDate,
    capturedAt: new Date().toISOString(),
    marketTimeZone: "America/New_York",
    fxRateUsdIdr: round(fxQuote.price, 4),
    fxCapturedAt: fxQuote.marketTime,
    total,
    buckets,
    positions: positions.sort((a, b) => a.bucket.localeCompare(b.bucket) || a.ticker.localeCompare(b.ticker)),
    missingTickers: [...missingTickers].sort(),
    status: missingTickers.size === 0 ? "complete" : "partial",
    source,
    schemaVersion: 1,
  };
}

export async function buildPortfolioSnapshot(source: PortfolioSnapshot["source"]): Promise<PortfolioSnapshot> {
  const transactions = await getPortfolioLedgerTransactions();
  return transactions.length > 0
    ? buildLedgerPortfolioSnapshot(source, transactions, fetchSnapshotQuotes)
    : buildLegacyPortfolioSnapshot(source);
}

export interface PortfolioSnapshotRecaptureResult {
  firstAffectedSessionDate: string | null;
  transactionIds: string[];
  recaptured: { sessionDate: string; status: PortfolioSnapshot["status"] }[];
}

/**
 * Rebuilds only affected schema-version-2 snapshots from historical daily closes.
 * Legacy snapshots are never selected, and missing historical data remains partial.
 */
export async function recaptureAffectedPortfolioSnapshots(): Promise<PortfolioSnapshotRecaptureResult> {
  const [transactions, snapshots] = await Promise.all([
    getPortfolioLedgerTransactions(),
    getPortfolioPerformanceSnapshots(),
  ]);
  const impact = findLedgerSnapshotImpact(snapshots, transactions);
  if (!impact.firstAffectedSessionDate) {
    return { firstAffectedSessionDate: null, transactionIds: [], recaptured: [] };
  }

  const affected = snapshots
    .filter((snapshot) => impact.affectedSnapshotDates.includes(snapshot.sessionDate))
    .filter((snapshot) => snapshot.schemaVersion === 2)
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
  const capturedAt = new Date().toISOString();
  const rebuilt = await Promise.all(affected.map(async (snapshot) => buildLedgerPortfolioSnapshot(
    snapshot.source,
    transactions,
    (tickers) => fetchHistoricalSnapshotQuotes(tickers, snapshot.sessionDate),
    {
      asOf: `${snapshot.sessionDate}T23:59:59.999Z`,
      sessionDate: snapshot.sessionDate,
      capturedAt,
    },
  )));

  for (const snapshot of rebuilt) await savePortfolioPerformanceSnapshot(snapshot);

  return {
    firstAffectedSessionDate: impact.firstAffectedSessionDate,
    transactionIds: impact.transactionIds,
    recaptured: rebuilt.map((snapshot) => ({ sessionDate: snapshot.sessionDate, status: snapshot.status })),
  };
}
