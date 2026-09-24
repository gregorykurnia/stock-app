import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPerformancePoints,
  calculateXirr,
  calculateReturnStatistics,
  emptySnapshotBuckets,
  findLedgerSnapshotImpact,
  normalizePortfolioSnapshot,
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

function ledgerSnapshot(sessionDate: string, quantity: number, cashUsd: number, externalFlowUsd: number): PortfolioSnapshot {
  const base = snapshot(sessionDate, 100, quantity);
  const investedValueUsd = quantity * 100;
  const totalValueUsd = investedValueUsd + cashUsd;
  const summary = {
    ...base.total,
    valueUsd: totalValueUsd,
    valueIdr: totalValueUsd * 15_000,
    cashValueUsd: cashUsd,
    cashValueIdr: cashUsd * 15_000,
    investedValueUsd,
    investedValueIdr: investedValueUsd * 15_000,
    totalValueUsd,
    totalValueIdr: totalValueUsd * 15_000,
    externalFlowUsd,
    externalFlowIdr: externalFlowUsd * 15_000,
  };
  return {
    ...base,
    schemaVersion: 2,
    baseCurrency: "USD",
    total: summary,
    buckets: { ...base.buckets, longterm: summary },
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

test("normalizes legacy snapshots that predate Treasury", () => {
  const original = snapshot("2026-09-08", 100, 10);
  const legacyBuckets = Object.fromEntries(
    Object.entries(original.buckets).filter(([bucket]) => bucket !== "treasury"),
  ) as PortfolioSnapshot["buckets"];
  const legacySnapshot = { ...original, buckets: legacyBuckets } as PortfolioSnapshot;
  const normalized = normalizePortfolioSnapshot(legacySnapshot);

  assert.equal(normalized.buckets.treasury.valueUsd, 0);
  assert.equal(normalized.buckets.treasury.positionCount, 0);
  assert.equal(normalized.buckets.longterm.valueUsd, original.buckets.longterm.valueUsd);
});

test("removes retired divisions from historical totals and positions", () => {
  const original = snapshot("2026-09-08", 100, 10);
  const retiredBucket = {
    valueUsd: 500,
    valueIdr: 7_500_000,
    costBasisUsd: 300,
    unrealizedUsd: 200,
    positionCount: 1,
    cashValueUsd: 100,
    cashValueIdr: 1_500_000,
    investedValueUsd: 400,
    investedValueIdr: 6_000_000,
    totalValueUsd: 500,
    totalValueIdr: 7_500_000,
  };
  const retiredPosition = {
    ...original.positions[0],
    ticker: "OLD",
    bucket: "retired" as unknown as SnapshotPosition["bucket"],
  };
  const retainedBucket = {
    ...original.buckets.longterm,
    cashValueUsd: 0,
    cashValueIdr: 0,
    investedValueUsd: original.total.valueUsd,
    investedValueIdr: original.total.valueIdr,
    totalValueUsd: original.total.valueUsd,
    totalValueIdr: original.total.valueIdr,
  };
  const storedSnapshot = {
    ...original,
    total: {
      ...original.total,
      valueUsd: original.total.valueUsd + retiredBucket.valueUsd,
      valueIdr: original.total.valueIdr + retiredBucket.valueIdr,
      costBasisUsd: original.total.costBasisUsd + retiredBucket.costBasisUsd,
      unrealizedUsd: original.total.unrealizedUsd + retiredBucket.unrealizedUsd,
      positionCount: original.total.positionCount + retiredBucket.positionCount,
      cashValueUsd: retiredBucket.cashValueUsd,
      cashValueIdr: retiredBucket.cashValueIdr,
      investedValueUsd: original.total.valueUsd + retiredBucket.investedValueUsd,
      investedValueIdr: original.total.valueIdr + retiredBucket.investedValueIdr,
      totalValueUsd: original.total.valueUsd + retiredBucket.totalValueUsd,
      totalValueIdr: original.total.valueIdr + retiredBucket.totalValueIdr,
    },
    buckets: { ...original.buckets, longterm: retainedBucket, retired: retiredBucket },
    positions: [...original.positions, retiredPosition],
  } as unknown as PortfolioSnapshot;

  const normalized = normalizePortfolioSnapshot(storedSnapshot);

  assert.deepEqual(Object.keys(normalized.buckets), ["longterm", "index", "treasury"]);
  assert.equal(normalized.total.valueUsd, original.total.valueUsd);
  assert.equal(normalized.total.cashValueUsd, 0);
  assert.equal(normalized.total.totalValueUsd, original.total.valueUsd);
  assert.deepEqual(normalized.positions.map((position) => position.ticker), ["TEST"]);
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

test("schema-version-2 snapshots use ledger external flow instead of inferred position flow", () => {
  const points = buildPerformancePoints([
    ledgerSnapshot("2026-09-08", 10, 1_000, 1_000),
    ledgerSnapshot("2026-09-09", 20, 0, 1_000),
  ]);

  assert.equal(points[1].inferredFlowUsd, 0);
  assert.equal(points[1].flowSource, "ledger");
  assert.equal(points[1].dailyValueChangeUsd, 0);
  assert.equal(points[1].dailyReturnPct, 0);
});

test("selected ranges use the immediately preceding snapshot as their opening baseline", () => {
  const opening = snapshot("2026-09-08", 100, 10);
  const selected = buildPerformancePoints([
    snapshot("2026-09-09", 110, 10),
  ], "usd", { openingSnapshot: opening });

  assert.equal(selected.length, 1);
  assert.ok(Math.abs((selected[0].dailyReturnPct ?? 0) - 10) < 1e-9);
  assert.equal(selected[0].dailyValueChangeUsd, 100);
  assert.equal(selected[0].returnStatus, "valid");
});

test("ledger external flow is excluded from a range return with a baseline", () => {
  const opening = ledgerSnapshot("2026-09-08", 10, 0, 1_000);
  const selected = ledgerSnapshot("2026-09-09", 10, 100, 1_100);
  const points = buildPerformancePoints([selected], "usd", { openingSnapshot: opening });

  assert.equal(points[0].inferredFlowUsd, 100);
  assert.equal(points[0].dailyValueChangeUsd, 100);
  assert.equal(points[0].dailyReturnPct, 0);
});

test("late ledger deposits recalculate the affected snapshot flow", () => {
  const points = buildPerformancePoints([
    ledgerSnapshot("2026-09-08", 10, 0, 0),
    ledgerSnapshot("2026-09-10", 10, 50, 0),
  ], "usd", {
    ledgerTransactions: [{
      transactionId: "late-deposit",
      occurredAt: "2026-09-09T14:00:00.000Z",
      recordedAt: "2026-09-11T14:00:00.000Z",
      type: "deposit",
      bucket: "longterm",
      currency: "USD",
      cashDelta: 50,
      externalFlow: 50,
      source: "manual",
    }],
  });

  assert.equal(points[1].inferredFlowUsd, 50);
  assert.equal(points[1].flowSource, "ledger");
  assert.equal(points[1].dailyReturnPct, 0);
});

test("backdated ledger activity invalidates later v2 snapshots until recapture", () => {
  const snapshots = [
    ledgerSnapshot("2026-09-08", 10, 0, 0),
    ledgerSnapshot("2026-09-09", 10, 50, 0),
  ];
  const lateTransaction = {
    transactionId: "late-dividend",
    occurredAt: "2026-09-08T14:00:00.000Z",
    recordedAt: "2026-09-10T14:00:00.000Z",
    type: "dividend" as const,
    bucket: "longterm" as const,
    ticker: "TEST",
    currency: "USD" as const,
    grossAmount: 50,
    cashDelta: 50,
    source: "manual" as const,
  };
  const impact = findLedgerSnapshotImpact(snapshots, [lateTransaction]);

  assert.equal(impact.firstAffectedSessionDate, "2026-09-08");
  assert.deepEqual(impact.affectedSnapshotDates, ["2026-09-08", "2026-09-09"]);
  assert.deepEqual(impact.transactionIds, ["late-dividend"]);

  const points = buildPerformancePoints(snapshots, "usd", {
    ledgerTransactions: [lateTransaction],
    invalidatedFromSessionDate: impact.firstAffectedSessionDate ?? undefined,
  });
  assert.equal(points.every((point) => point.needsRecapture), true);
  assert.equal(points.every((point) => point.returnStatus === "suppressed"), true);
  assert.equal(calculateReturnStatistics(points).quality, "partial");
});

test("ledger corrections invalidate snapshots whose stored ledger version is stale", () => {
  const snapshots = [
    { ...ledgerSnapshot("2026-09-08", 10, 0, 0), ledgerVersion: 3 },
    { ...ledgerSnapshot("2026-09-09", 10, 0, 0), ledgerVersion: 3 },
  ];
  const transactions = [{
    transactionId: "opening-position",
    occurredAt: "2026-09-08T14:00:00.000Z",
    recordedAt: "2026-09-08T14:00:00.000Z",
    type: "opening_balance" as const,
    bucket: "longterm" as const,
    ticker: "TEST",
    quantity: 10,
    price: 90,
    currency: "USD" as const,
    source: "manual" as const,
  }];
  const impact = findLedgerSnapshotImpact(snapshots, transactions);

  assert.equal(impact.firstAffectedSessionDate, "2026-09-08");
  assert.deepEqual(impact.affectedSnapshotDates, ["2026-09-08", "2026-09-09"]);
});

test("XIRR calculates annualized USD return from ledger-backed terminal value", () => {
  const result = calculateXirr([
    ledgerSnapshot("2025-01-01", 10, 0, 0),
    ledgerSnapshot("2026-01-01", 11, 0, 0),
  ], []);

  assert.equal(result.status, "valid");
  assert.ok(Math.abs((result.annualizedPct ?? 0) - 10) < 1e-6);
});

test("XIRR neutralizes a USD deposit at its actual cash-flow date", () => {
  const result = calculateXirr([
    ledgerSnapshot("2025-01-01", 10, 0, 0),
    ledgerSnapshot("2026-01-01", 10, 100, 100),
  ], [{
    transactionId: "midyear-deposit",
    occurredAt: "2025-07-01T14:00:00.000Z",
    recordedAt: "2025-07-01T14:00:00.000Z",
    type: "deposit",
    bucket: "longterm",
    currency: "USD",
    cashDelta: 100,
    externalFlow: 100,
    source: "manual",
  }]);

  assert.equal(result.status, "valid");
  assert.ok(Math.abs(result.annualizedPct ?? 1) < 1e-6);
});

test("XIRR fails closed when the period contains an IDR external flow", () => {
  const result = calculateXirr([
    ledgerSnapshot("2025-01-01", 10, 0, 0),
    ledgerSnapshot("2026-01-01", 10, 100, 0),
  ], [{
    transactionId: "idr-deposit",
    occurredAt: "2025-07-01T14:00:00.000Z",
    recordedAt: "2025-07-01T14:00:00.000Z",
    type: "deposit",
    bucket: "longterm",
    currency: "IDR",
    cashDelta: 1_000_000,
    externalFlow: 1_000_000,
    source: "manual",
  }]);

  assert.equal(result.annualizedPct, null);
  assert.equal(result.status, "unsupported_currency");
});

test("pocket returns neutralize internal cash and position transfers", () => {
  const before = ledgerSnapshot("2026-09-08", 1, 0, 0);
  const after = ledgerSnapshot("2026-09-10", 0, 0, 0);
  const transferLegs = [
    {
      transactionId: "transfer-out",
      occurredAt: "2026-09-09T14:00:00.000Z",
      recordedAt: "2026-09-09T14:00:00.000Z",
      type: "transfer" as const,
      bucket: "longterm" as const,
      fromBucket: "longterm" as const,
      toBucket: "index" as const,
      ticker: "TEST",
      quantity: -1,
      currency: "USD" as const,
      transferId: "transfer-1",
      source: "manual" as const,
    },
    {
      transactionId: "transfer-in",
      occurredAt: "2026-09-09T14:00:00.000Z",
      recordedAt: "2026-09-09T14:00:00.000Z",
      type: "transfer" as const,
      bucket: "index" as const,
      fromBucket: "longterm" as const,
      toBucket: "index" as const,
      ticker: "TEST",
      quantity: 1,
      currency: "USD" as const,
      transferId: "transfer-1",
      source: "manual" as const,
    },
  ];

  const longtermPoints = buildPerformancePoints([before, after], "usd", {
    bucket: "longterm",
    ledgerTransactions: transferLegs,
  });
  const totalPoints = buildPerformancePoints([before, after], "usd", { ledgerTransactions: transferLegs });

  assert.equal(longtermPoints[1].inferredFlowUsd, -100);
  assert.equal(longtermPoints[1].dailyReturnPct, 0);
  assert.equal(totalPoints[1].inferredFlowUsd, 0);
});

test("total returns treat retired-sleeve cash transfers as flows into the active portfolio", () => {
  const before = ledgerSnapshot("2026-09-08", 0, 1_000, 0);
  const after = ledgerSnapshot("2026-09-09", 4, 1_000, 0);
  const transactions = [
    {
      transactionId: "swing-cash-out",
      occurredAt: "2026-09-09T14:00:00.000Z",
      recordedAt: "2026-09-09T14:00:00.000Z",
      type: "transfer" as const,
      bucket: "swing" as const,
      fromBucket: "swing" as const,
      toBucket: "index" as const,
      transferId: "swing-to-index-cash",
      currency: "USD" as const,
      cashDelta: -400,
      source: "manual" as const,
    },
    {
      transactionId: "index-cash-in",
      occurredAt: "2026-09-09T14:00:00.000Z",
      recordedAt: "2026-09-09T14:00:00.000Z",
      type: "transfer" as const,
      bucket: "index" as const,
      fromBucket: "swing" as const,
      toBucket: "index" as const,
      transferId: "swing-to-index-cash",
      currency: "USD" as const,
      cashDelta: 400,
      source: "manual" as const,
    },
  ];

  const points = buildPerformancePoints([before, after], "usd", { ledgerTransactions: transactions });

  assert.equal(points[1].inferredFlowUsd, 400);
  assert.equal(points[1].dailyReturnPct, 0);
});

test("partial snapshots suppress TWR returns and statistics", () => {
  const partial = { ...snapshot("2026-09-09", 110, 10), status: "partial" as const };
  const points = buildPerformancePoints([snapshot("2026-09-08", 100, 10), partial]);
  const stats = calculateReturnStatistics(points);

  assert.equal(points[1].dailyReturnPct, null);
  assert.equal(points[1].returnStatus, "suppressed");
  assert.equal(stats.quality, "partial");
  assert.equal(stats.periodReturnPct, null);
});

test("average daily return is geometric", () => {
  const stats = calculateReturnStatistics(buildPerformancePoints([
    snapshot("2026-09-08", 100, 10),
    snapshot("2026-09-09", 110, 10),
    snapshot("2026-09-10", 110, 10),
  ]));

  assert.ok(Math.abs((stats.averageDailyPct ?? 0) - (Math.sqrt(1.1) - 1) * 100) < 1e-9);
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
