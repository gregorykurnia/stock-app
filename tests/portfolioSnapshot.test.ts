import test from "node:test";
import assert from "node:assert/strict";
import { buildLedgerPortfolioSnapshot, type PortfolioSnapshotQuote } from "../lib/portfolioSnapshot";
import type { LedgerTransaction } from "../lib/portfolioLedger";

let nextId = 0;

function opening(fields: Partial<LedgerTransaction>): LedgerTransaction {
  nextId += 1;
  return {
    transactionId: `opening-${nextId}`,
    occurredAt: "2026-09-17T15:00:00.000Z",
    recordedAt: "2026-09-17T16:00:00.000Z",
    type: "opening_balance",
    currency: "USD",
    source: "manual",
    ...fields,
  };
}

function quote(price: number | null, marketDate: string | null): PortfolioSnapshotQuote {
  return {
    price,
    marketDate,
    marketTime: marketDate ? `${marketDate}T20:00:00.000Z` : null,
  };
}

test("ledger snapshots include per-pocket cash, conserve pocket totals, and mark missing quotes partial", async () => {
  const transactions = [
    opening({ bucket: "longterm", cashDelta: 1_000 }),
    opening({ bucket: "longterm", ticker: "ABC", quantity: 10, price: 100 }),
    opening({ bucket: "index", currency: "IDR", cashDelta: 15_000_000 }),
    opening({ bucket: "treasury", cashDelta: 500 }),
    opening({ bucket: "treasury", ticker: "XYZ", quantity: 5, price: 50 }),
  ];
  const requested: string[][] = [];
  const quotes: Record<string, PortfolioSnapshotQuote> = {
    ABC: quote(120, "2026-09-17"),
    XYZ: quote(null, null),
    "IDR=X": quote(15_000, "2026-09-17"),
  };

  const snapshot = await buildLedgerPortfolioSnapshot(
    "preview",
    transactions,
    async (tickers) => {
      requested.push(tickers);
      return Object.fromEntries(tickers.map((ticker) => [ticker, quotes[ticker]]));
    },
    { capturedAt: "2026-09-17T20:15:00.000Z" },
  );

  assert.deepEqual(requested, [["ABC", "XYZ", "IDR=X"]]);
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.baseCurrency, "USD");
  assert.equal(snapshot.ledgerVersion, transactions.length);
  assert.equal(snapshot.capturedAt, "2026-09-17T20:15:00.000Z");
  assert.equal(snapshot.status, "partial");
  assert.deepEqual(snapshot.missingTickers, ["XYZ"]);
  assert.deepEqual(snapshot.positions.map((position) => position.ticker), ["ABC"]);

  assert.equal(snapshot.buckets.longterm.cashValueUsd, 1_000);
  assert.equal(snapshot.buckets.longterm.investedValueUsd, 1_200);
  assert.equal(snapshot.buckets.longterm.totalValueUsd, 2_200);
  assert.equal(snapshot.buckets.index.cashValueUsd, 1_000);
  assert.equal(snapshot.buckets.index.totalValueUsd, 1_000);
  assert.equal(snapshot.buckets.treasury.cashValueUsd, 500);
  assert.equal(snapshot.buckets.treasury.investedValueUsd, 0);
  assert.equal(snapshot.buckets.treasury.totalValueUsd, 500);
  assert.equal(snapshot.total.cashValueUsd, 2_500);
  assert.equal(snapshot.total.investedValueUsd, 1_200);
  assert.equal(snapshot.total.totalValueUsd, 3_700);
  assert.equal(snapshot.total.totalValueUsd, snapshot.buckets.longterm.totalValueUsd + snapshot.buckets.index.totalValueUsd + snapshot.buckets.treasury.totalValueUsd);
});

test("ledger snapshots value Treasury positions and include the new bucket in totals", async () => {
  const transactions = [
    opening({ bucket: "treasury", cashDelta: 250 }),
    opening({ bucket: "treasury", ticker: "T-BILL", quantity: 2, price: 100 }),
  ];
  const snapshot = await buildLedgerPortfolioSnapshot(
    "preview",
    transactions,
    async (tickers) => Object.fromEntries(tickers.map((ticker) => [ticker, quote(ticker === "IDR=X" ? 15_000 : 105, "2026-09-17")])),
  );

  assert.equal(snapshot.buckets.treasury.cashValueUsd, 250);
  assert.equal(snapshot.buckets.treasury.investedValueUsd, 210);
  assert.equal(snapshot.buckets.treasury.totalValueUsd, 460);
  assert.equal(snapshot.total.totalValueUsd, 460);
  assert.equal(snapshot.positions[0].bucket, "treasury");
});

test("ledger snapshot fails closed when USD/IDR FX is unavailable", async () => {
  await assert.rejects(
    buildLedgerPortfolioSnapshot(
      "preview",
      [opening({ bucket: "longterm", cashDelta: 100 })],
      async () => ({ "IDR=X": quote(null, null) }),
    ),
    /USD\/IDR quote is unavailable/,
  );
});

test("historical ledger snapshots use the requested as-of state and session date", async () => {
  const transactions: LedgerTransaction[] = [
    opening({
      transactionId: "opening-cash",
      bucket: "longterm",
      cashDelta: 1_000,
      occurredAt: "2026-09-01T15:00:00.000Z",
      recordedAt: "2026-09-01T16:00:00.000Z",
    }),
    opening({
      transactionId: "opening-position",
      bucket: "longterm",
      ticker: "ABC",
      quantity: 10,
      price: 100,
      occurredAt: "2026-09-01T15:00:00.000Z",
      recordedAt: "2026-09-01T16:00:00.000Z",
    }),
    {
      transactionId: "later-buy",
      occurredAt: "2026-09-10T15:00:00.000Z",
      recordedAt: "2026-09-10T16:00:00.000Z",
      type: "buy",
      bucket: "longterm",
      ticker: "ABC",
      quantity: 1,
      price: 100,
      grossAmount: 100,
      currency: "USD",
      cashDelta: -100,
      source: "manual",
    },
  ];
  const snapshot = await buildLedgerPortfolioSnapshot(
    "scheduled",
    transactions,
    async (tickers) => Object.fromEntries(tickers.map((ticker) => [ticker, quote(ticker === "IDR=X" ? 15_000 : 120, "2026-09-05")])),
    {
      asOf: "2026-09-05T23:59:59.999Z",
      sessionDate: "2026-09-05",
      capturedAt: "2026-09-18T12:00:00.000Z",
    },
  );

  assert.equal(snapshot.sessionDate, "2026-09-05");
  assert.equal(snapshot.ledgerVersion, 2);
  assert.equal(snapshot.buckets.longterm.cashValueUsd, 1_000);
  assert.equal(snapshot.positions[0].quantity, 10);
});
