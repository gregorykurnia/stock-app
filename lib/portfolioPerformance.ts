import type { LedgerTransaction } from "./portfolioLedger";
import { PORTFOLIO_BUCKETS, isCurrentPortfolioBucket, type PortfolioBucket } from "./portfolioBuckets";

export { PORTFOLIO_BUCKETS, type PortfolioBucket } from "./portfolioBuckets";


export interface SnapshotPosition {
  ticker: string;
  bucket: PortfolioBucket;
  quantity: number;
  priceUsd: number;
  valueUsd: number;
  valueIdr: number;
  entryPriceUsd: number | null;
  costBasisUsd: number | null;
  marketValueUsd?: number;
  marketValueIdr?: number;
  unrealizedGainUsd?: number;
}

export interface SnapshotBucket {
  valueUsd: number;
  valueIdr: number;
  costBasisUsd: number;
  unrealizedUsd: number;
  positionCount: number;
  cashValueUsd?: number;
  cashValueIdr?: number;
  investedValueUsd?: number;
  investedValueIdr?: number;
  totalValueUsd?: number;
  totalValueIdr?: number;
  realizedGainUsd?: number;
  incomeUsd?: number;
  feesUsd?: number;
  externalFlowUsd?: number;
  externalFlowIdr?: number;
}

export interface PortfolioSnapshot {
  sessionDate: string;
  capturedAt: string;
  marketTimeZone: "America/New_York";
  fxRateUsdIdr: number;
  fxCapturedAt: string | null;
  total: SnapshotBucket;
  buckets: Record<PortfolioBucket, SnapshotBucket>;
  positions: SnapshotPosition[];
  missingTickers: string[];
  status: "complete" | "partial";
  source: "scheduled" | "manual" | "preview";
  schemaVersion: 1 | 2;
  baseCurrency?: "USD";
  ledgerAsOf?: string | null;
  ledgerVersion?: number;
}

export interface PerformancePoint extends PortfolioSnapshot {
  inferredFlowUsd: number;
  inferredFlowIdr: number;
  flowSource: "estimated" | "ledger";
  needsRecapture: boolean;
  returnStatus: "baseline" | "valid" | "suppressed";
  dailyReturnPct: number | null;
  dailyValueChangeUsd: number | null;
  dailyValueChangeIdr: number | null;
}

export interface PerformanceBuildOptions {
  /** The last snapshot before a selected range, used only as its opening baseline. */
  openingSnapshot?: PortfolioSnapshot;
  /** Current ledger activity, used to recalculate late/backdated external flows. */
  ledgerTransactions?: readonly LedgerTransaction[];
  /** Restrict ledger flow recalculation to one pocket for bucket-level returns. */
  bucket?: PortfolioBucket;
  /** Suppress returns from this schema-version-2 session onward until snapshots are recaptured. */
  invalidatedFromSessionDate?: string;
}

export interface LedgerSnapshotImpact {
  firstAffectedSessionDate: string | null;
  affectedSnapshotDates: string[];
  transactionIds: string[];
}

export type XirrStatus = "valid" | "insufficient_data" | "partial" | "unsupported_currency" | "no_solution";

export interface XirrResult {
  annualizedPct: number | null;
  status: XirrStatus;
}

export interface ReturnStatistics {
  averageDailyPct: number | null;
  averageWeeklyPct: number | null;
  averageMonthlyPct: number | null;
  periodReturnPct: number | null;
  maxDrawdownPct: number | null;
  quality: "complete" | "partial";
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function positionKey(position: SnapshotPosition) {
  return `${position.bucket}:${position.ticker}`;
}

const NEW_YORK_DATE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const FLOW_EPSILON = 1e-8;

function newYorkSessionDate(timestamp: string) {
  const parts = Object.fromEntries(NEW_YORK_DATE_PARTS.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Finds ledger activity entered after a ledger-backed snapshot was captured but
 * effective on or before that snapshot, as well as snapshots whose stored
 * ledger version no longer matches the current ledger after a correction.
 * Legacy v1 history is intentionally excluded.
 */
export function findLedgerSnapshotImpact(
  snapshots: readonly PortfolioSnapshot[],
  transactions: readonly LedgerTransaction[],
): LedgerSnapshotImpact {
  const ledgerSnapshots = snapshots
    .filter((snapshot) => snapshot.schemaVersion === 2)
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
  let firstAffectedSessionDate: string | null = null;
  const transactionIds = new Set<string>();

  for (const transaction of transactions) {
    const occurredAt = Date.parse(transaction.occurredAt);
    const recordedAt = Date.parse(transaction.recordedAt);
    if (Number.isNaN(occurredAt) || Number.isNaN(recordedAt)) continue;
    const occurredSessionDate = newYorkSessionDate(transaction.occurredAt);
    const firstMissingSnapshot = ledgerSnapshots.find((snapshot) => (
      occurredSessionDate <= snapshot.sessionDate
      && recordedAt > Date.parse(snapshot.capturedAt)
    ));
    if (!firstMissingSnapshot) continue;
    transactionIds.add(transaction.transactionId);
    if (firstAffectedSessionDate == null || firstMissingSnapshot.sessionDate < firstAffectedSessionDate) {
      firstAffectedSessionDate = firstMissingSnapshot.sessionDate;
    }
  }

  for (const snapshot of ledgerSnapshots) {
    if (snapshot.ledgerVersion == null) continue;
    const expectedLedgerVersion = transactions.filter((transaction) => (
      newYorkSessionDate(transaction.occurredAt) <= snapshot.sessionDate
    )).length;
    if (snapshot.ledgerVersion !== expectedLedgerVersion) {
      if (firstAffectedSessionDate == null || snapshot.sessionDate < firstAffectedSessionDate) {
        firstAffectedSessionDate = snapshot.sessionDate;
      }
    }
  }

  const affectedSnapshotDates = firstAffectedSessionDate == null
    ? []
    : ledgerSnapshots
      .filter((snapshot) => snapshot.sessionDate >= firstAffectedSessionDate)
      .map((snapshot) => snapshot.sessionDate);

  return {
    firstAffectedSessionDate,
    affectedSnapshotDates,
    transactionIds: [...transactionIds].sort(),
  };
}

interface XirrCashFlow {
  amount: number;
  timestamp: number;
}

function xnpv(rate: number, cashFlows: readonly XirrCashFlow[], startTimestamp: number) {
  if (rate <= -1) return Number.NaN;
  return cashFlows.reduce((total, cashFlow) => {
    const years = (cashFlow.timestamp - startTimestamp) / (365 * 24 * 60 * 60 * 1000);
    return total + cashFlow.amount / (1 + rate) ** years;
  }, 0);
}

function solveXirr(cashFlows: readonly XirrCashFlow[]): number | null {
  const startTimestamp = cashFlows[0]?.timestamp;
  if (startTimestamp == null) return null;
  const valueAtLowerBound = xnpv(-0.999999, cashFlows, startTimestamp);
  if (!Number.isFinite(valueAtLowerBound)) return null;

  let lowerRate = -0.999999;
  let lowerValue = valueAtLowerBound;
  let upperRate = 0;
  let upperValue = xnpv(upperRate, cashFlows, startTimestamp);
  if (!Number.isFinite(upperValue)) return null;

  if (Math.abs(upperValue) > 1e-10 && Math.sign(lowerValue) === Math.sign(upperValue)) {
    upperRate = 1;
    upperValue = xnpv(upperRate, cashFlows, startTimestamp);
    while (
      Number.isFinite(upperValue)
      && Math.sign(lowerValue) === Math.sign(upperValue)
      && upperRate < 1_000_000
    ) {
      upperRate = upperRate * 2 + 1;
      upperValue = xnpv(upperRate, cashFlows, startTimestamp);
    }
  }

  if (!Number.isFinite(upperValue) || Math.sign(lowerValue) === Math.sign(upperValue)) return null;
  for (let iteration = 0; iteration < 120; iteration += 1) {
    const midpoint = (lowerRate + upperRate) / 2;
    const midpointValue = xnpv(midpoint, cashFlows, startTimestamp);
    if (!Number.isFinite(midpointValue)) return null;
    if (Math.abs(midpointValue) < 1e-10) return midpoint;
    if (Math.sign(lowerValue) === Math.sign(midpointValue)) {
      lowerRate = midpoint;
      lowerValue = midpointValue;
    } else {
      upperRate = midpoint;
      upperValue = midpointValue;
    }
  }
  return (lowerRate + upperRate) / 2;
}

/**
 * Calculates the investor's annualized cash-timing return for the accurate
 * ledger-backed history. Deposits are investor cash outflows; withdrawals and
 * the terminal portfolio value are investor cash inflows.
 */
export function calculateXirr(
  snapshots: readonly PortfolioSnapshot[],
  transactions: readonly LedgerTransaction[],
): XirrResult {
  const ledgerSnapshots = snapshots
    .filter((snapshot) => snapshot.schemaVersion === 2)
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
  if (ledgerSnapshots.length < 2) return { annualizedPct: null, status: "insufficient_data" };
  if (ledgerSnapshots.some((snapshot) => snapshot.status !== "complete")) {
    return { annualizedPct: null, status: "partial" };
  }

  const opening = ledgerSnapshots[0];
  const terminal = ledgerSnapshots.at(-1) as PortfolioSnapshot;
  const openingValue = snapshotTotalValueUsd(opening);
  const terminalValue = snapshotTotalValueUsd(terminal);
  const openingTimestamp = Date.parse(opening.capturedAt);
  const terminalTimestamp = Date.parse(terminal.capturedAt);
  if (
    !Number.isFinite(openingValue)
    || !Number.isFinite(terminalValue)
    || openingValue <= 0
    || terminalValue < 0
    || Number.isNaN(openingTimestamp)
    || Number.isNaN(terminalTimestamp)
    || terminalTimestamp <= openingTimestamp
  ) {
    return { annualizedPct: null, status: "insufficient_data" };
  }

  const cashFlows: XirrCashFlow[] = [{ amount: -openingValue, timestamp: openingTimestamp }];
  for (const transaction of transactions) {
    let externalFlow: number | undefined;
    if (transaction.type === "deposit" || transaction.type === "withdrawal") {
      if (!isCurrentPortfolioBucket(transaction.bucket)) continue;
      externalFlow = transaction.externalFlow;
    } else if (
      transaction.type === "transfer"
      && isCurrentPortfolioBucket(transaction.bucket)
      && (transaction.fromBucket === "swing" || transaction.toBucket === "swing")
      && Math.abs(transaction.cashDelta ?? 0) > FLOW_EPSILON
    ) {
      externalFlow = transaction.cashDelta;
    } else continue;
    const sessionDate = newYorkSessionDate(transaction.occurredAt);
    if (sessionDate <= opening.sessionDate || sessionDate > terminal.sessionDate) continue;
    if (transaction.currency !== "USD") {
      return { annualizedPct: null, status: "unsupported_currency" };
    }
    const timestamp = Date.parse(transaction.occurredAt);
    if (Number.isNaN(timestamp) || typeof externalFlow !== "number" || !Number.isFinite(externalFlow)) {
      return { annualizedPct: null, status: "no_solution" };
    }
    cashFlows.push({ amount: -externalFlow, timestamp });
  }
  cashFlows.push({ amount: terminalValue, timestamp: terminalTimestamp });
  cashFlows.sort((left, right) => left.timestamp - right.timestamp);

  const hasPositive = cashFlows.some((cashFlow) => cashFlow.amount > 0);
  const hasNegative = cashFlows.some((cashFlow) => cashFlow.amount < 0);
  if (!hasPositive || !hasNegative) return { annualizedPct: null, status: "no_solution" };

  const annualizedRate = solveXirr(cashFlows);
  return annualizedRate == null
    ? { annualizedPct: null, status: "no_solution" }
    : { annualizedPct: round(annualizedRate * 100, 6), status: "valid" };
}

function snapshotPosition(snapshot: PortfolioSnapshot, bucket: PortfolioBucket, ticker: string) {
  return snapshot.positions.find((position) => position.bucket === bucket && position.ticker === ticker);
}

function ledgerFlowBetweenSnapshots(
  transactions: readonly LedgerTransaction[],
  previous: PortfolioSnapshot,
  current: PortfolioSnapshot,
  bucket: PortfolioBucket | undefined,
) {
  return transactions.reduce((flow, transaction) => {
    const sessionDate = newYorkSessionDate(transaction.occurredAt);
    if (sessionDate <= previous.sessionDate || sessionDate > current.sessionDate) return flow;

    if (transaction.type === "deposit" || transaction.type === "withdrawal") {
      if (!isCurrentPortfolioBucket(transaction.bucket)) return flow;
      if (bucket && transaction.bucket !== bucket) return flow;
      if (transaction.currency === "USD") flow.usd += transaction.externalFlow ?? 0;
      else flow.idr += transaction.externalFlow ?? 0;
      return flow;
    }

    // Transfers are internal at the total-portfolio level, but they are real
    // cash/security flows for the source and destination pocket return series.
    if (transaction.type !== "transfer") return flow;
    const retiredBoundaryTransfer = transaction.fromBucket === "swing" || transaction.toBucket === "swing";
    if (bucket) {
      if (transaction.bucket !== bucket) return flow;
    } else if (!retiredBoundaryTransfer || !isCurrentPortfolioBucket(transaction.bucket)) return flow;
    const flowBucket = bucket ?? (isCurrentPortfolioBucket(transaction.bucket) ? transaction.bucket : undefined);
    if (!flowBucket) return flow;
    if (Math.abs(transaction.cashDelta ?? 0) > FLOW_EPSILON) {
      if (transaction.currency === "USD") flow.usd += transaction.cashDelta ?? 0;
      else flow.idr += transaction.cashDelta ?? 0;
      return flow;
    }
    if (transaction.ticker && Math.abs(transaction.quantity ?? 0) > FLOW_EPSILON) {
      const price = snapshotPosition(current, flowBucket, transaction.ticker)?.priceUsd
        ?? snapshotPosition(previous, flowBucket, transaction.ticker)?.priceUsd
        ?? 0;
      flow.usd += (transaction.quantity ?? 0) * price;
    }
    return flow;
  }, { usd: 0, idr: 0 });
}

export function snapshotTotalValueUsd(snapshot: PortfolioSnapshot): number {
  return snapshotBucketValueUsd(snapshot.total);
}

export function snapshotTotalValueIdr(snapshot: PortfolioSnapshot): number {
  return snapshotBucketValueIdr(snapshot.total);
}

export function snapshotBucketValueUsd(bucket: SnapshotBucket): number {
  return bucket.totalValueUsd ?? bucket.valueUsd;
}

export function snapshotBucketValueIdr(bucket: SnapshotBucket): number {
  return bucket.totalValueIdr ?? bucket.valueIdr;
}

export function emptySnapshotBucket(): SnapshotBucket {
  return {
    valueUsd: 0,
    valueIdr: 0,
    costBasisUsd: 0,
    unrealizedUsd: 0,
    positionCount: 0,
  };
}

/**
 * Adds newly introduced empty buckets to snapshots written before that bucket
 * existed. Stored snapshots are immutable, so this keeps historical data
 * readable without rewriting every old document.
 */
export function normalizePortfolioSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  const storedBuckets = (snapshot.buckets ?? {}) as Partial<Record<PortfolioBucket, SnapshotBucket>> & Record<string, SnapshotBucket | undefined>;
  const hasRemovedBucketData = Object.keys(storedBuckets).some((bucket) => !PORTFOLIO_BUCKETS.includes(bucket as PortfolioBucket))
    || (snapshot.positions ?? []).some((position) => !PORTFOLIO_BUCKETS.includes(position.bucket));
  const buckets = Object.fromEntries(PORTFOLIO_BUCKETS.map((bucket) => [
    bucket,
    { ...emptySnapshotBucket(), ...(storedBuckets[bucket] ?? {}) },
  ])) as Record<PortfolioBucket, SnapshotBucket>;
  const positions = (snapshot.positions ?? []).filter((position) => PORTFOLIO_BUCKETS.includes(position.bucket));

  if (hasRemovedBucketData) {
    const sum = (field: keyof SnapshotBucket) => {
      const values = Object.values(buckets)
        .map((bucket) => bucket[field])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return values.length > 0 ? values.reduce((total, value) => total + value, 0) : undefined;
    };
    const total: SnapshotBucket = {
      valueUsd: sum("valueUsd") ?? 0,
      valueIdr: sum("valueIdr") ?? 0,
      costBasisUsd: sum("costBasisUsd") ?? 0,
      unrealizedUsd: sum("unrealizedUsd") ?? 0,
      positionCount: sum("positionCount") ?? 0,
    };
    for (const field of [
      "cashValueUsd", "cashValueIdr", "investedValueUsd", "investedValueIdr", "totalValueUsd", "totalValueIdr",
      "realizedGainUsd", "incomeUsd", "feesUsd", "externalFlowUsd", "externalFlowIdr",
    ] as const) {
      const value = sum(field);
      if (value != null) total[field] = value;
    }
    return { ...snapshot, total, buckets, positions };
  }

  return { ...snapshot, buckets, positions };
}

/**
 * Estimate capital moved into/out of the tracked invested portfolio between snapshots.
 * Quantity changes are valued at the ending snapshot price so buys/sells do not masquerade
 * as market performance. This remains an estimate until a transaction ledger exists.
 */
export function inferPositionFlowUsd(previous: PortfolioSnapshot, current: PortfolioSnapshot): number {
  const previousPositions = new Map(previous.positions.map((position) => [positionKey(position), position]));
  const currentPositions = new Map(current.positions.map((position) => [positionKey(position), position]));
  const keys = new Set([...previousPositions.keys(), ...currentPositions.keys()]);
  let flow = 0;

  for (const key of keys) {
    const before = previousPositions.get(key);
    const after = currentPositions.get(key);
    const quantityChange = (after?.quantity ?? 0) - (before?.quantity ?? 0);
    const price = after?.priceUsd ?? before?.priceUsd ?? 0;
    flow += quantityChange * price;
  }

  return round(flow);
}

export function buildPerformancePoints(
  snapshots: PortfolioSnapshot[],
  currency: "usd" | "idr" = "usd",
  options: PerformanceBuildOptions = {},
): PerformancePoint[] {
  const sorted = snapshots.map(normalizePortfolioSnapshot).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const normalizedOpeningSnapshot = options.openingSnapshot ? normalizePortfolioSnapshot(options.openingSnapshot) : undefined;
  const openingSnapshot = normalizedOpeningSnapshot && (sorted.length === 0 || normalizedOpeningSnapshot.sessionDate < sorted[0].sessionDate)
    ? normalizedOpeningSnapshot
    : undefined;
  const input = openingSnapshot ? [openingSnapshot, ...sorted] : sorted;
  const points: PerformancePoint[] = input.map((snapshot, index) => {
    const previous = input[index - 1];
    const needsRecapture = Boolean(
      options.invalidatedFromSessionDate
      && snapshot.schemaVersion === 2
      && snapshot.sessionDate >= options.invalidatedFromSessionDate,
    );
    if (!previous) {
      return {
        ...snapshot,
        inferredFlowUsd: 0,
        inferredFlowIdr: 0,
        flowSource: snapshot.schemaVersion === 2 ? "ledger" : "estimated",
        needsRecapture,
        returnStatus: !needsRecapture && snapshot.status === "complete" ? "baseline" : "suppressed",
        dailyReturnPct: null,
        dailyValueChangeUsd: null,
        dailyValueChangeIdr: null,
      };
    }

    const snapshotLedgerFlowAvailable = previous.schemaVersion === 2
      && snapshot.schemaVersion === 2
      && previous.total.externalFlowUsd != null
      && snapshot.total.externalFlowUsd != null
      && previous.total.externalFlowIdr != null
      && snapshot.total.externalFlowIdr != null;
    const ledgerTransactionsAvailable = options.ledgerTransactions !== undefined
      && previous.schemaVersion === 2
      && snapshot.schemaVersion === 2;
    const ledgerFlow = ledgerTransactionsAvailable
      ? ledgerFlowBetweenSnapshots(options.ledgerTransactions!, previous, snapshot, options.bucket)
      : null;
    const inferredFlowUsd = ledgerTransactionsAvailable
      ? ledgerFlow!.usd + ledgerFlow!.idr / snapshot.fxRateUsdIdr
      : snapshotLedgerFlowAvailable
        ? snapshot.total.externalFlowUsd! - previous.total.externalFlowUsd!
      : inferPositionFlowUsd(previous, snapshot);
    const inferredFlowIdr = ledgerTransactionsAvailable
      ? ledgerFlow!.idr + ledgerFlow!.usd * snapshot.fxRateUsdIdr
      : snapshotLedgerFlowAvailable
        ? snapshot.total.externalFlowIdr! - previous.total.externalFlowIdr!
      : inferredFlowUsd * snapshot.fxRateUsdIdr;
    const previousValue = currency === "idr" ? snapshotTotalValueIdr(previous) : snapshotTotalValueUsd(previous);
    const currentValue = currency === "idr" ? snapshotTotalValueIdr(snapshot) : snapshotTotalValueUsd(snapshot);
    const flow = currency === "idr" ? inferredFlowIdr : inferredFlowUsd;
    const returnStatus = !needsRecapture && previous.status === "complete" && snapshot.status === "complete" ? "valid" : "suppressed";
    const dailyReturnPct = returnStatus === "valid" && previousValue > 0
      ? ((currentValue - flow) / previousValue - 1) * 100
      : null;

    return {
      ...snapshot,
      inferredFlowUsd,
      inferredFlowIdr: round(inferredFlowIdr, 2),
      flowSource: ledgerTransactionsAvailable || snapshotLedgerFlowAvailable ? "ledger" : "estimated",
      needsRecapture,
      returnStatus,
      dailyReturnPct: dailyReturnPct == null ? null : round(dailyReturnPct, 6),
      dailyValueChangeUsd: round(snapshotTotalValueUsd(snapshot) - snapshotTotalValueUsd(previous), 2),
      dailyValueChangeIdr: round(snapshotTotalValueIdr(snapshot) - snapshotTotalValueIdr(previous), 2),
    };
  });

  return openingSnapshot ? points.slice(1) : points;
}

function geometricAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const growth = values.reduce((product, value) => product * (1 + value / 100), 1);
  return growth >= 0 ? (growth ** (1 / values.length) - 1) * 100 : null;
}

function periodKey(date: string, cadence: "week" | "month") {
  if (cadence === "month") return date.slice(0, 7);
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function compoundedPeriodReturns(points: PerformancePoint[], cadence: "week" | "month") {
  const groups = new Map<string, number[]>();
  for (const point of points) {
    if (point.dailyReturnPct == null) continue;
    const key = periodKey(point.sessionDate, cadence);
    groups.set(key, [...(groups.get(key) ?? []), point.dailyReturnPct]);
  }
  return [...groups.values()].map((returns) => (
    (returns.reduce((growth, value) => growth * (1 + value / 100), 1) - 1) * 100
  ));
}

export function calculateReturnStatistics(points: PerformancePoint[]): ReturnStatistics {
  const quality = points.some((point) => point.returnStatus === "suppressed") ? "partial" : "complete";
  if (quality === "partial") {
    return {
      averageDailyPct: null,
      averageWeeklyPct: null,
      averageMonthlyPct: null,
      periodReturnPct: null,
      maxDrawdownPct: null,
      quality,
    };
  }
  const daily = points.flatMap((point) => point.dailyReturnPct == null ? [] : [point.dailyReturnPct]);
  const weekly = compoundedPeriodReturns(points, "week");
  const monthly = compoundedPeriodReturns(points, "month");
  const periodReturnPct = daily.length === 0
    ? null
    : (daily.reduce((growth, value) => growth * (1 + value / 100), 1) - 1) * 100;

  let growth = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of daily) {
    growth *= 1 + value / 100;
    peak = Math.max(peak, growth);
    maxDrawdown = Math.min(maxDrawdown, ((growth / peak) - 1) * 100);
  }

  return {
    averageDailyPct: geometricAverage(daily),
    averageWeeklyPct: geometricAverage(weekly),
    averageMonthlyPct: geometricAverage(monthly),
    periodReturnPct,
    maxDrawdownPct: daily.length === 0 ? null : maxDrawdown,
    quality,
  };
}

export function emptySnapshotBuckets(): Record<PortfolioBucket, SnapshotBucket> {
  return Object.fromEntries(PORTFOLIO_BUCKETS.map((bucket) => [bucket, emptySnapshotBucket()])) as Record<PortfolioBucket, SnapshotBucket>;
}
