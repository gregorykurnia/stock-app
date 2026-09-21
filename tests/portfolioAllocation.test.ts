import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioAllocation } from "../lib/portfolioAllocation";
import type { LedgerTransaction } from "../lib/portfolioLedger";

let nextId = 0;

function transaction(type: LedgerTransaction["type"], fields: Partial<LedgerTransaction>): LedgerTransaction {
  nextId += 1;
  return {
    transactionId: `${type}-${nextId}`,
    occurredAt: `2026-09-17T09:${String(nextId).padStart(2, "0")}:00.000Z`,
    recordedAt: "2026-09-17T12:00:00.000Z",
    type,
    currency: "USD",
    source: "manual",
    ...fields,
  };
}

function opening(bucket: LedgerTransaction["bucket"], ticker: string, quantity: number, price: number) {
  return transaction("opening_balance", { bucket, ticker, quantity, price });
}

test("bucket percentages use cost basis and exclude cash", () => {
  const allocation = buildPortfolioAllocation([
    opening("longterm", "LONG", 10, 100),
    opening("index", "INDEX", 10, 200),
    opening("swing", "SWING", 10, 300),
    opening("treasury", "BOND", 10, 400),
    transaction("opening_balance", { bucket: "longterm", cashDelta: 100_000 }),
  ]);

  assert.equal(allocation.totalEntryValueUsd, 10_000);
  assert.equal(allocation.buckets.longterm.percentage, 10);
  assert.equal(allocation.buckets.index.percentage, 20);
  assert.equal(allocation.buckets.swing.percentage, 30);
  assert.equal(allocation.buckets.treasury.percentage, 40);
  assert.equal(allocation.positionCount, 4);
});

test("holdings are sorted largest first and receive individual percentages", () => {
  const allocation = buildPortfolioAllocation([
    opening("longterm", "SMALL", 1, 100),
    opening("swing", "LARGE", 3, 200),
    opening("index", "MID", 3, 100),
  ]);

  assert.deepEqual(allocation.holdings.map((holding) => holding.ticker), ["LARGE", "MID", "SMALL"]);
  assert.equal(allocation.holdings[0].percentage, 60);
  assert.equal(allocation.holdings[1].percentage, 30);
  assert.equal(allocation.holdings[2].percentage, 10);
});

test("positions without cost basis are marked incomplete instead of using another value", () => {
  const allocation = buildPortfolioAllocation([
    opening("longterm", "KNOWN", 10, 100),
    transaction("reconciliation_adjustment", {
      bucket: "swing",
      ticker: "MISSING",
      quantity: 10,
      costBasisDeltaUsd: 0,
      notes: "Position quantity known; broker cost basis pending",
    }),
  ]);

  assert.equal(allocation.status, "incomplete");
  assert.deepEqual(allocation.missingCostBasisTickers, ["MISSING"]);
  assert.equal(allocation.totalEntryValueUsd, 1_000);
  assert.equal(allocation.holdings.find((holding) => holding.ticker === "MISSING")?.percentage, 0);
});

test("empty and zero-value ledgers return safe zero percentages", () => {
  const empty = buildPortfolioAllocation([]);
  assert.equal(empty.status, "empty");
  assert.equal(empty.totalEntryValueUsd, 0);
  assert.equal(Object.values(empty.buckets).every((bucket) => bucket.percentage === 0), true);

  const zeroValue = buildPortfolioAllocation([
    transaction("reconciliation_adjustment", {
      bucket: "treasury",
      ticker: "ZERO",
      quantity: 1,
      costBasisDeltaUsd: 0,
      notes: "Awaiting cost basis",
    }),
  ]);
  assert.equal(zeroValue.status, "incomplete");
  assert.equal(zeroValue.totalEntryValueUsd, 0);
  assert.equal(zeroValue.holdings[0].percentage, 0);
});
