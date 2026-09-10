import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPerformancePoints,
  calculateReturnStatistics,
  emptySnapshotBuckets,
  type PortfolioSnapshot,
  type SnapshotPosition,
} from "../lib/portfolioPerformance";

function snapshot(
  sessionDate: string,
  priceUsd: number,
  quantity: number,
  fxRateUsdIdr = 15_000,
): PortfolioSnapshot {
  const position: SnapshotPosition = {
    ticker: "TEST",
    bucket: "longterm",
    quantity,
    priceUsd,
    valueUsd: priceUsd * quantity,
    valueIdr: priceUsd * quantity * fxRateUsdIdr,
    entryPriceUsd: 90,
    costBasisUsd: 90 * quantity,
  };
  const buckets = emptySnapshotBuckets();
  buckets.longterm = {
    valueUsd: position.valueUsd,
    valueIdr: position.valueIdr,
    costBasisUsd: position.costBasisUsd ?? 0,
    unrealizedUsd: position.valueUsd - (position.costBasisUsd ?? 0),
    positionCount: 1,
  };
  return {
    sessionDate,
    capturedAt: `${sessionDate}T20:15:00.000Z`,
    marketTimeZone: "America/New_York",
    fxRateUsdIdr,
    fxCapturedAt: `${sessionDate}T20:15:00.000Z`,
    total: buckets.longterm,
    buckets,
    positions: [position],
    missingTickers: [],
    status: "complete",
    source: "scheduled",
    schemaVersion: 1,
  };
}

test("calculates daily market return when quantity is unchanged", () => {
  const points = buildPerformancePoints([
    snapshot("2026-09-08", 100, 10),
    snapshot("2026-09-09", 110, 10),
  ]);
  assert.equal(points[1].dailyReturnPct, 10);
  assert.equal(points[1].inferredFlowUsd, 0);
});

test("removes an inferred position addition from investment return", () => {
  const points = buildPerformancePoints([
    snapshot("2026-09-08", 100, 10),
    snapshot("2026-09-09", 110, 15),
  ]);
  assert.equal(points[1].inferredFlowUsd, 550);
  assert.equal(points[1].dailyValueChangeUsd, 650);
  assert.equal(points[1].dailyReturnPct, 10);
});

test("IDR return includes currency movement while USD return does not", () => {
  const values = [
    snapshot("2026-09-08", 100, 10, 15_000),
    snapshot("2026-09-09", 100, 10, 16_500),
  ];
  assert.equal(buildPerformancePoints(values, "usd")[1].dailyReturnPct, 0);
  assert.equal(buildPerformancePoints(values, "idr")[1].dailyReturnPct, 10);
});

test("compounds period return and reports peak-to-trough drawdown", () => {
  const points = buildPerformancePoints([
    snapshot("2026-09-07", 100, 10),
    snapshot("2026-09-08", 110, 10),
    snapshot("2026-09-09", 99, 10),
  ]);
  const stats = calculateReturnStatistics(points);
  assert.ok(Math.abs((stats.periodReturnPct ?? 0) - (-1)) < 1e-9);
  assert.ok(Math.abs((stats.maxDrawdownPct ?? 0) - (-10)) < 1e-9);
});

