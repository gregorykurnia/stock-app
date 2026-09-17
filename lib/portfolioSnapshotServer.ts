import "server-only";

import { getPortfolioDivisionStocks, getPortfolioLedgerTransactions } from "@/lib/firestore";
import { fetchSnapshotQuotes } from "@/lib/yahooServer";
import { newYorkMarketContext } from "@/lib/portfolioSchedule";
import {
  emptySnapshotBuckets,
  type SnapshotBucket,
  type PortfolioBucket,
  type PortfolioSnapshot,
  type SnapshotPosition,
} from "@/lib/portfolioPerformance";
import {
  reducePortfolioLedger,
  type LedgerBucketState,
  type LedgerCurrency,
  type LedgerTransaction,
} from "@/lib/portfolioLedger";

const BUCKETS: PortfolioBucket[] = ["longterm", "index", "swing"];

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function currencyToUsd(values: Record<LedgerCurrency, number>, fxRateUsdIdr: number) {
  return values.USD + values.IDR / fxRateUsdIdr;
}

function buildLedgerBucketSummary(
  ledgerBucket: LedgerBucketState,
  valuedPositions: SnapshotPosition[],
  fxRateUsdIdr: number,
): SnapshotBucket {
  const cashValueUsd = currencyToUsd(ledgerBucket.cash, fxRateUsdIdr);
  const investedValueUsd = valuedPositions.reduce((sum, position) => sum + position.valueUsd, 0);
  const costBasisUsd = Object.values(ledgerBucket.positions).reduce((sum, position) => sum + position.costBasisUsd, 0);
  const unrealizedUsd = valuedPositions.reduce((sum, position) => sum + (position.unrealizedGainUsd ?? 0), 0);
  const totalValueUsd = cashValueUsd + investedValueUsd;
  const externalFlowUsd = currencyToUsd(ledgerBucket.externalFlow, fxRateUsdIdr);

  return {
    valueUsd: round(totalValueUsd),
    valueIdr: round(totalValueUsd * fxRateUsdIdr),
    costBasisUsd: round(costBasisUsd),
    unrealizedUsd: round(unrealizedUsd),
    positionCount: Object.keys(ledgerBucket.positions).length,
    cashValueUsd: round(cashValueUsd),
    cashValueIdr: round(cashValueUsd * fxRateUsdIdr),
    investedValueUsd: round(investedValueUsd),
    investedValueIdr: round(investedValueUsd * fxRateUsdIdr),
    totalValueUsd: round(totalValueUsd),
    totalValueIdr: round(totalValueUsd * fxRateUsdIdr),
    realizedGainUsd: round(ledgerBucket.realizedGainUsd),
    incomeUsd: round(currencyToUsd(ledgerBucket.income, fxRateUsdIdr)),
    feesUsd: round(currencyToUsd(ledgerBucket.fees, fxRateUsdIdr)),
    externalFlowUsd: round(externalFlowUsd),
    externalFlowIdr: round(externalFlowUsd * fxRateUsdIdr),
  };
}

function sumLedgerSnapshotBuckets(buckets: Record<PortfolioBucket, SnapshotBucket>): SnapshotBucket {
  return BUCKETS.reduce((total, bucket) => {
    const current = buckets[bucket];
    return {
      valueUsd: total.valueUsd + current.valueUsd,
      valueIdr: total.valueIdr + current.valueIdr,
      costBasisUsd: total.costBasisUsd + current.costBasisUsd,
      unrealizedUsd: total.unrealizedUsd + current.unrealizedUsd,
      positionCount: total.positionCount + current.positionCount,
      cashValueUsd: (total.cashValueUsd ?? 0) + (current.cashValueUsd ?? 0),
      cashValueIdr: (total.cashValueIdr ?? 0) + (current.cashValueIdr ?? 0),
      investedValueUsd: (total.investedValueUsd ?? 0) + (current.investedValueUsd ?? 0),
      investedValueIdr: (total.investedValueIdr ?? 0) + (current.investedValueIdr ?? 0),
      totalValueUsd: (total.totalValueUsd ?? 0) + (current.totalValueUsd ?? 0),
      totalValueIdr: (total.totalValueIdr ?? 0) + (current.totalValueIdr ?? 0),
      realizedGainUsd: (total.realizedGainUsd ?? 0) + (current.realizedGainUsd ?? 0),
      incomeUsd: (total.incomeUsd ?? 0) + (current.incomeUsd ?? 0),
      feesUsd: (total.feesUsd ?? 0) + (current.feesUsd ?? 0),
      externalFlowUsd: (total.externalFlowUsd ?? 0) + (current.externalFlowUsd ?? 0),
      externalFlowIdr: (total.externalFlowIdr ?? 0) + (current.externalFlowIdr ?? 0),
    };
  }, {
    valueUsd: 0,
    valueIdr: 0,
    costBasisUsd: 0,
    unrealizedUsd: 0,
    positionCount: 0,
  } as SnapshotBucket);
}

async function buildLedgerPortfolioSnapshot(
  source: PortfolioSnapshot["source"],
  transactions: readonly LedgerTransaction[],
): Promise<PortfolioSnapshot> {
  const ledgerState = reducePortfolioLedger(transactions);
  const tickers = BUCKETS.flatMap((bucket) => Object.keys(ledgerState.buckets[bucket].positions));
  const quotes = await fetchSnapshotQuotes([...new Set([...tickers, "IDR=X"]) ]);
  const fxQuote = quotes["IDR=X"];
  if (fxQuote?.price == null || fxQuote.price <= 0) throw new Error("USD/IDR quote is unavailable");

  const marketDates = tickers.flatMap((ticker) => quotes[ticker]?.marketDate ? [quotes[ticker].marketDate as string] : []);
  const sessionDate = marketDates.sort().at(-1) ?? newYorkMarketContext().sessionDate;
  const buckets = emptySnapshotBuckets();
  const positions: SnapshotPosition[] = [];
  const missingTickers = new Set<string>();

  for (const bucket of BUCKETS) {
    const ledgerBucket = ledgerState.buckets[bucket];
    for (const ledgerPosition of Object.values(ledgerBucket.positions)) {
      const quote = quotes[ledgerPosition.ticker];
      if (quote?.price == null || quote.marketDate !== sessionDate) {
        missingTickers.add(ledgerPosition.ticker);
        continue;
      }
      const valueUsd = ledgerPosition.quantity * quote.price;
      const position: SnapshotPosition = {
        ticker: ledgerPosition.ticker,
        bucket,
        quantity: ledgerPosition.quantity,
        priceUsd: round(quote.price, 6),
        valueUsd: round(valueUsd),
        valueIdr: round(valueUsd * fxQuote.price),
        entryPriceUsd: round(ledgerPosition.averageCostUsd, 6),
        costBasisUsd: round(ledgerPosition.costBasisUsd),
        marketValueUsd: round(valueUsd),
        marketValueIdr: round(valueUsd * fxQuote.price),
        unrealizedGainUsd: round(valueUsd - ledgerPosition.costBasisUsd),
      };
      positions.push(position);
    }
    buckets[bucket] = buildLedgerBucketSummary(
      ledgerBucket,
      positions.filter((position) => position.bucket === bucket),
      fxQuote.price,
    );
  }

  const total = sumLedgerSnapshotBuckets(buckets);
  for (const key of ["valueUsd", "valueIdr", "costBasisUsd", "unrealizedUsd", "cashValueUsd", "cashValueIdr", "investedValueUsd", "investedValueIdr", "totalValueUsd", "totalValueIdr", "realizedGainUsd", "incomeUsd", "feesUsd", "externalFlowUsd", "externalFlowIdr"] as const) {
    if (total[key] != null) total[key] = round(total[key] as number);
  }

  return {
    sessionDate,
    capturedAt: new Date().toISOString(),
    marketTimeZone: "America/New_York",
    fxRateUsdIdr: round(fxQuote.price, 4),
    fxCapturedAt: fxQuote.marketTime,
    baseCurrency: "USD",
    ledgerAsOf: ledgerState.asOf,
    ledgerVersion: ledgerState.ledgerVersion,
    total,
    buckets,
    positions: positions.sort((a, b) => a.bucket.localeCompare(b.bucket) || a.ticker.localeCompare(b.ticker)),
    missingTickers: [...missingTickers].sort(),
    status: missingTickers.size === 0 ? "complete" : "partial",
    source,
    schemaVersion: 2,
  };
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
    ? buildLedgerPortfolioSnapshot(source, transactions)
    : buildLegacyPortfolioSnapshot(source);
}
