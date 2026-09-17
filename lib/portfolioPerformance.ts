export type PortfolioBucket = "longterm" | "index" | "swing";

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
  returnStatus: "baseline" | "valid" | "suppressed";
  dailyReturnPct: number | null;
  dailyValueChangeUsd: number | null;
  dailyValueChangeIdr: number | null;
}

export interface PerformanceBuildOptions {
  /** The last snapshot before a selected range, used only as its opening baseline. */
  openingSnapshot?: PortfolioSnapshot;
}

export interface ReturnStatistics {
  averageDailyPct: number | null;
  averageWeeklyPct: number | null;
  averageMonthlyPct: number | null;
  periodReturnPct: number | null;
  maxDrawdownPct: number | null;
  quality: "complete" | "partial";
}

const BUCKETS: PortfolioBucket[] = ["longterm", "index", "swing"];

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function positionKey(position: SnapshotPosition) {
  return `${position.bucket}:${position.ticker}`;
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
  const sorted = [...snapshots].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const openingSnapshot = options.openingSnapshot && (sorted.length === 0 || options.openingSnapshot.sessionDate < sorted[0].sessionDate)
    ? options.openingSnapshot
    : undefined;
  const input = openingSnapshot ? [openingSnapshot, ...sorted] : sorted;
  const points: PerformancePoint[] = input.map((snapshot, index) => {
    const previous = input[index - 1];
    if (!previous) {
      return {
        ...snapshot,
        inferredFlowUsd: 0,
        inferredFlowIdr: 0,
        flowSource: snapshot.schemaVersion === 2 ? "ledger" : "estimated",
        returnStatus: snapshot.status === "complete" ? "baseline" : "suppressed",
        dailyReturnPct: null,
        dailyValueChangeUsd: null,
        dailyValueChangeIdr: null,
      };
    }

    const ledgerFlowAvailable = previous.schemaVersion === 2
      && snapshot.schemaVersion === 2
      && previous.total.externalFlowUsd != null
      && snapshot.total.externalFlowUsd != null
      && previous.total.externalFlowIdr != null
      && snapshot.total.externalFlowIdr != null;
    const inferredFlowUsd = ledgerFlowAvailable
      ? snapshot.total.externalFlowUsd! - previous.total.externalFlowUsd!
      : inferPositionFlowUsd(previous, snapshot);
    const inferredFlowIdr = ledgerFlowAvailable
      ? snapshot.total.externalFlowIdr! - previous.total.externalFlowIdr!
      : inferredFlowUsd * snapshot.fxRateUsdIdr;
    const previousValue = currency === "idr" ? snapshotTotalValueIdr(previous) : snapshotTotalValueUsd(previous);
    const currentValue = currency === "idr" ? snapshotTotalValueIdr(snapshot) : snapshotTotalValueUsd(snapshot);
    const flow = currency === "idr" ? inferredFlowIdr : inferredFlowUsd;
    const returnStatus = previous.status === "complete" && snapshot.status === "complete" ? "valid" : "suppressed";
    const dailyReturnPct = returnStatus === "valid" && previousValue > 0
      ? ((currentValue - flow) / previousValue - 1) * 100
      : null;

    return {
      ...snapshot,
      inferredFlowUsd,
      inferredFlowIdr: round(inferredFlowIdr, 2),
      flowSource: ledgerFlowAvailable ? "ledger" : "estimated",
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
  return Object.fromEntries(BUCKETS.map((bucket) => [bucket, {
    valueUsd: 0,
    valueIdr: 0,
    costBasisUsd: 0,
    unrealizedUsd: 0,
    positionCount: 0,
  }])) as Record<PortfolioBucket, SnapshotBucket>;
}
