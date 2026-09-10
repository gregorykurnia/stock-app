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
}

export interface SnapshotBucket {
  valueUsd: number;
  valueIdr: number;
  costBasisUsd: number;
  unrealizedUsd: number;
  positionCount: number;
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
  schemaVersion: 1;
}

export interface PerformancePoint extends PortfolioSnapshot {
  inferredFlowUsd: number;
  inferredFlowIdr: number;
  dailyReturnPct: number | null;
  dailyValueChangeUsd: number | null;
  dailyValueChangeIdr: number | null;
}

export interface ReturnStatistics {
  averageDailyPct: number | null;
  averageWeeklyPct: number | null;
  averageMonthlyPct: number | null;
  periodReturnPct: number | null;
  maxDrawdownPct: number | null;
}

const BUCKETS: PortfolioBucket[] = ["longterm", "index", "swing"];

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function positionKey(position: SnapshotPosition) {
  return `${position.bucket}:${position.ticker}`;
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

export function buildPerformancePoints(snapshots: PortfolioSnapshot[], currency: "usd" | "idr" = "usd"): PerformancePoint[] {
  const sorted = [...snapshots].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  return sorted.map((snapshot, index) => {
    const previous = sorted[index - 1];
    if (!previous) {
      return {
        ...snapshot,
        inferredFlowUsd: 0,
        inferredFlowIdr: 0,
        dailyReturnPct: null,
        dailyValueChangeUsd: null,
        dailyValueChangeIdr: null,
      };
    }

    const inferredFlowUsd = inferPositionFlowUsd(previous, snapshot);
    const inferredFlowIdr = inferredFlowUsd * snapshot.fxRateUsdIdr;
    const previousValue = currency === "idr" ? previous.total.valueIdr : previous.total.valueUsd;
    const currentValue = currency === "idr" ? snapshot.total.valueIdr : snapshot.total.valueUsd;
    const flow = currency === "idr" ? inferredFlowIdr : inferredFlowUsd;
    const dailyReturnPct = previousValue > 0
      ? ((currentValue - flow) / previousValue - 1) * 100
      : null;

    return {
      ...snapshot,
      inferredFlowUsd,
      inferredFlowIdr: round(inferredFlowIdr, 2),
      dailyReturnPct: dailyReturnPct == null ? null : round(dailyReturnPct, 6),
      dailyValueChangeUsd: round(snapshot.total.valueUsd - previous.total.valueUsd, 2),
      dailyValueChangeIdr: round(snapshot.total.valueIdr - previous.total.valueIdr, 2),
    };
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
    averageDailyPct: average(daily),
    averageWeeklyPct: average(weekly),
    averageMonthlyPct: average(monthly),
    periodReturnPct,
    maxDrawdownPct: daily.length === 0 ? null : maxDrawdown,
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
