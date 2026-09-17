import test from "node:test";
import assert from "node:assert/strict";
import {
  LedgerValidationError,
  prepareLedgerAppend,
  prepareLedgerRemoval,
  reducePortfolioLedger,
  type LedgerTransaction,
} from "../lib/portfolioLedger";

let nextId = 0;

function transaction(
  type: LedgerTransaction["type"],
  fields: Partial<LedgerTransaction>,
): LedgerTransaction {
  nextId += 1;
  return {
    transactionId: `${type}-${nextId}`,
    occurredAt: fields.occurredAt ?? `2026-09-17T09:${String(nextId).padStart(2, "0")}:00.000Z`,
    recordedAt: fields.recordedAt ?? `2026-09-17T12:00:00.000Z`,
    type,
    currency: "USD",
    source: "manual",
    ...fields,
  };
}

test("deposits increase pocket and total cash as external flow", () => {
  const state = reducePortfolioLedger([
    transaction("deposit", { bucket: "swing", cashDelta: 2_000, externalFlow: 2_000 }),
  ]);

  assert.equal(state.buckets.swing.cash.USD, 2_000);
  assert.equal(state.total.cash.USD, 2_000);
  assert.equal(state.buckets.swing.externalFlow.USD, 2_000);
  assert.equal(state.total.externalFlow.USD, 2_000);
});

test("buying with cash preserves equity while creating weighted-average cost basis", () => {
  const state = reducePortfolioLedger([
    transaction("deposit", { bucket: "swing", cashDelta: 4_000, externalFlow: 4_000, occurredAt: "2026-09-17T09:00:00.000Z" }),
    transaction("buy", {
      bucket: "swing",
      ticker: "ABC",
      quantity: 20,
      price: 100,
      grossAmount: 2_000,
      cashDelta: -2_000,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
    transaction("buy", {
      bucket: "swing",
      ticker: "ABC",
      quantity: 10,
      price: 90,
      grossAmount: 900,
      cashDelta: -900,
      occurredAt: "2026-09-17T11:00:00.000Z",
    }),
  ]);

  assert.equal(state.buckets.swing.cash.USD, 1_100);
  assert.equal(state.buckets.swing.positions.ABC.quantity, 30);
  assert.equal(state.buckets.swing.positions.ABC.costBasisUsd, 2_900);
  assert.equal(state.buckets.swing.positions.ABC.averageCostUsd, 2_900 / 30);
  assert.equal(state.buckets.swing.realizedGainUsd, 0);
});

test("partial sales use weighted-average cost and calculate realized gain", () => {
  const state = reducePortfolioLedger([
    transaction("opening_balance", {
      bucket: "longterm",
      ticker: "ABC",
      quantity: 100,
      price: 100,
      occurredAt: "2026-09-16T09:00:00.000Z",
    }),
    transaction("sell", {
      bucket: "longterm",
      ticker: "ABC",
      quantity: 20,
      price: 110,
      grossAmount: 2_200,
      cashDelta: 2_200,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
  ]);

  assert.equal(state.buckets.longterm.cash.USD, 2_200);
  assert.equal(state.buckets.longterm.positions.ABC.quantity, 80);
  assert.equal(state.buckets.longterm.positions.ABC.costBasisUsd, 8_000);
  assert.equal(state.buckets.longterm.realizedGainUsd, 200);
});

test("dividends and fees affect cash and their separate accounting totals", () => {
  const state = reducePortfolioLedger([
    transaction("opening_balance", { bucket: "index", cashDelta: 1_000 }),
    transaction("dividend", { bucket: "index", grossAmount: 100, cashDelta: 100, ticker: "ETF" }),
    transaction("fee", { bucket: "index", fees: 50, cashDelta: -50 }),
  ]);

  assert.equal(state.buckets.index.cash.USD, 1_050);
  assert.equal(state.total.income.USD, 100);
  assert.equal(state.total.fees.USD, 50);
});

test("cash transfers preserve total cash while changing pocket allocation", () => {
  const state = reducePortfolioLedger([
    transaction("opening_balance", { bucket: "longterm", cashDelta: 3_000 }),
    transaction("transfer", {
      transactionId: "transfer-out",
      bucket: "longterm",
      fromBucket: "longterm",
      toBucket: "index",
      transferId: "transfer-1",
      cashDelta: -1_000,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
    transaction("transfer", {
      transactionId: "transfer-in",
      bucket: "index",
      fromBucket: "longterm",
      toBucket: "index",
      transferId: "transfer-1",
      cashDelta: 1_000,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
  ]);

  assert.equal(state.buckets.longterm.cash.USD, 2_000);
  assert.equal(state.buckets.index.cash.USD, 1_000);
  assert.equal(state.total.cash.USD, 3_000);
  assert.equal(state.total.externalFlow.USD, 0);
});

test("position transfers preserve weighted-average cost basis", () => {
  const state = reducePortfolioLedger([
    transaction("opening_balance", { bucket: "longterm", ticker: "ABC", quantity: 10, price: 100 }),
    transaction("transfer", {
      transactionId: "position-out",
      bucket: "longterm",
      fromBucket: "longterm",
      toBucket: "swing",
      transferId: "transfer-2",
      ticker: "ABC",
      quantity: -4,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
    transaction("transfer", {
      transactionId: "position-in",
      bucket: "swing",
      fromBucket: "longterm",
      toBucket: "swing",
      transferId: "transfer-2",
      ticker: "ABC",
      quantity: 4,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
  ]);

  assert.equal(state.buckets.longterm.positions.ABC.quantity, 6);
  assert.equal(state.buckets.swing.positions.ABC.quantity, 4);
  assert.equal(state.buckets.swing.positions.ABC.costBasisUsd, 400);
  assert.equal(state.total.realizedGainUsd, 0);
});

test("FX conversion keeps currencies separate without creating external flow", () => {
  const state = reducePortfolioLedger([
    transaction("opening_balance", { bucket: "index", cashDelta: 1_000 }),
    transaction("fx_conversion", {
      transactionId: "fx-out",
      bucket: "index",
      transferId: "fx-1",
      currency: "USD",
      cashDelta: -1_000,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
    transaction("fx_conversion", {
      transactionId: "fx-in",
      bucket: "index",
      transferId: "fx-1",
      currency: "IDR",
      cashDelta: 16_000_000,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
  ]);

  assert.equal(state.buckets.index.cash.USD, 0);
  assert.equal(state.buckets.index.cash.IDR, 16_000_000);
  assert.equal(state.total.externalFlow.USD, 0);
  assert.equal(state.total.externalFlow.IDR, 0);
});

test("same-day activity is applied in timestamp order", () => {
  const state = reducePortfolioLedger([
    transaction("buy", {
      bucket: "swing", ticker: "ABC", quantity: 1, price: 100, grossAmount: 100, cashDelta: -100,
      occurredAt: "2026-09-17T11:00:00.000Z",
    }),
    transaction("deposit", {
      bucket: "swing", cashDelta: 100, externalFlow: 100,
      occurredAt: "2026-09-17T10:00:00.000Z",
    }),
  ]);

  assert.equal(state.buckets.swing.cash.USD, 0);
  assert.equal(state.buckets.swing.positions.ABC.quantity, 1);
});

test("invalid transactions and duplicate ids are rejected", () => {
  const invalidBuy = transaction("buy", {
    bucket: "swing", ticker: "ABC", quantity: 1, price: 100, grossAmount: 100, cashDelta: -100,
  });
  assert.throws(() => reducePortfolioLedger([invalidBuy]), LedgerValidationError);

  const deposit = transaction("deposit", { bucket: "swing", cashDelta: 100, externalFlow: 100 });
  const duplicate = { ...deposit };
  assert.throws(() => reducePortfolioLedger([deposit, duplicate]), /duplicate transactionId/);
});

test("append planning treats identical retries as no-ops and rejects conflicting ids", () => {
  const opening = transaction("opening_balance", { bucket: "swing", cashDelta: 500 });
  const deposit = transaction("deposit", { bucket: "swing", cashDelta: 100, externalFlow: 100 });

  const plan = prepareLedgerAppend([opening], [opening, deposit]);
  assert.deepEqual(plan.pending, [deposit]);
  assert.equal(plan.transactions.length, 2);
  assert.equal(reducePortfolioLedger(plan.transactions).buckets.swing.cash.USD, 600);

  assert.throws(() => prepareLedgerAppend([opening], [{ ...opening, notes: "different payload" }]), /already exists with different data/);
});

test("removal planning deletes a manual activity only when the remaining ledger replays", () => {
  const opening = transaction("opening_balance", { bucket: "swing", ticker: "ABC", quantity: 10, price: 100 });
  const cash = transaction("opening_balance", { bucket: "swing", cashDelta: 1_000 });
  const sell = transaction("sell", {
    bucket: "swing", ticker: "ABC", quantity: 2, price: 110, grossAmount: 220, cashDelta: 220,
  });
  const plan = prepareLedgerRemoval([opening, cash, sell], [sell.transactionId]);

  assert.deepEqual(plan.removed, [sell]);
  assert.deepEqual(plan.transactions, [opening, cash]);
  assert.equal(reducePortfolioLedger(plan.transactions).buckets.swing.positions.ABC.quantity, 10);
});

test("removal planning protects opening balances and reconciliation records", () => {
  const opening = transaction("opening_balance", { bucket: "swing", cashDelta: 1_000 });
  assert.throws(() => prepareLedgerRemoval([opening], [opening.transactionId]), /Only manually recorded activity/);
});
