import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioActivityRows,
  buildReconciliationAdjustments,
  buildReconciliationPreview,
} from "../lib/portfolioActivity";
import { reducePortfolioLedger, type LedgerTransaction } from "../lib/portfolioLedger";

let nextId = 0;

function transaction(type: LedgerTransaction["type"], fields: Partial<LedgerTransaction>): LedgerTransaction {
  nextId += 1;
  return {
    transactionId: `${type}-${nextId}`,
    occurredAt: fields.occurredAt ?? `2026-09-17T0${nextId}:00:00.000Z`,
    recordedAt: fields.recordedAt ?? "2026-09-17T12:00:00.000Z",
    type,
    currency: "USD",
    source: "manual",
    ...fields,
  };
}

test("reconciliation adjustments exactly match target cash and weighted-average cost", () => {
  const opening = transaction("opening_balance", {
    bucket: "swing", ticker: "ABC", quantity: 10, price: 100,
  });
  const initial = [opening, transaction("opening_balance", { bucket: "swing", cashDelta: 500 })];
  const currentState = reducePortfolioLedger(initial);
  const adjustments = buildReconciliationAdjustments({
    currentState,
    cashTargets: [
      { bucket: "swing", currency: "USD", cash: 650 },
      { bucket: "swing", currency: "IDR", cash: 0 },
    ],
    positionTargets: [
      { bucket: "swing", ticker: "ABC", quantity: 12, costBasisUsd: 1_260 },
      { bucket: "swing", ticker: "XYZ", quantity: 3, costBasisUsd: 330 },
    ],
    occurredAt: "2026-09-18T09:00:00.000Z",
    recordedAt: "2026-09-18T10:00:00.000Z",
    notes: "Broker statement reconciliation",
    idFactory: (kind, index) => `${kind}-${index}`,
  });
  const finalState = reducePortfolioLedger([...initial, ...adjustments]);

  assert.equal(adjustments.length, 3);
  assert.equal(adjustments[0].cashDelta, 150);
  assert.equal(adjustments[1].quantity, 2);
  assert.equal(adjustments[1].costBasisDeltaUsd, 260);
  assert.equal(finalState.buckets.swing.cash.USD, 650);
  assert.equal(finalState.buckets.swing.positions.ABC.quantity, 12);
  assert.equal(finalState.buckets.swing.positions.ABC.costBasisUsd, 1_260);
  assert.equal(finalState.buckets.swing.positions.ABC.averageCostUsd, 105);
  assert.equal(finalState.buckets.swing.positions.XYZ.quantity, 3);
  assert.equal(finalState.buckets.swing.positions.XYZ.averageCostUsd, 110);
});

test("reconciliation preview reports deltas without mutating the current ledger state", () => {
  const initial = [
    transaction("opening_balance", { bucket: "swing", ticker: "ABC", quantity: 10, price: 100 }),
    transaction("opening_balance", { bucket: "swing", cashDelta: 500 }),
  ];
  const currentState = reducePortfolioLedger(initial);
  const preview = buildReconciliationPreview({
    currentState,
    cashTargets: [
      { bucket: "swing", currency: "USD", cash: 650 },
      { bucket: "swing", currency: "IDR", cash: 0 },
    ],
    positionTargets: [
      { bucket: "swing", ticker: "ABC", quantity: 12, costBasisUsd: 1_260 },
      { bucket: "swing", ticker: "XYZ", quantity: 3, costBasisUsd: 330 },
    ],
    notes: "Broker statement reconciliation",
  });

  assert.equal(preview.adjustmentCount, 3);
  assert.equal(preview.hasChanges, true);
  assert.deepEqual(preview.cash.find((row) => row.currency === "USD"), {
    bucket: "swing",
    currency: "USD",
    currentCash: 500,
    targetCash: 650,
    deltaCash: 150,
  });
  assert.deepEqual(preview.positions.find((row) => row.ticker === "ABC"), {
    bucket: "swing",
    ticker: "ABC",
    currentQuantity: 10,
    targetQuantity: 12,
    quantityDelta: 2,
    currentCostBasisUsd: 1_000,
    targetCostBasisUsd: 1_260,
    costBasisDeltaUsd: 260,
    currentAverageCostUsd: 100,
    targetAverageCostUsd: 105,
  });
  assert.equal(currentState.buckets.swing.cash.USD, 500);
  assert.equal(currentState.buckets.swing.positions.ABC.quantity, 10);
});

test("activity rows combine transfer legs and show late sell P/L and remaining quantity", () => {
  const activity = [
    transaction("opening_balance", { bucket: "longterm", ticker: "ABC", quantity: 10, price: 100, occurredAt: "2026-09-16T09:00:00.000Z" }),
    transaction("transfer", { transactionId: "transfer-out", bucket: "longterm", fromBucket: "longterm", toBucket: "swing", transferId: "t-1", ticker: "ABC", quantity: -2, occurredAt: "2026-09-17T09:00:00.000Z" }),
    transaction("transfer", { transactionId: "transfer-in", bucket: "swing", fromBucket: "longterm", toBucket: "swing", transferId: "t-1", ticker: "ABC", quantity: 2, occurredAt: "2026-09-17T09:00:00.000Z" }),
    transaction("sell", { bucket: "swing", ticker: "ABC", quantity: 1, price: 120, grossAmount: 120, cashDelta: 120, occurredAt: "2026-09-18T09:00:00.000Z", recordedAt: "2026-09-19T12:00:00.000Z" }),
  ];
  const rows = buildPortfolioActivityRows(activity);
  const sell = rows.find((row) => row.type === "sell");
  const transfer = rows.find((row) => row.type === "transfer");

  assert.equal(rows.length, 3);
  assert.equal(sell?.price, 120);
  assert.equal(sell?.grossAmount, 120);
  assert.equal(sell?.fees, undefined);
  assert.equal(sell?.cashDelta, 120);
  assert.equal(sell?.costBasisUsd, 100);
  assert.equal(sell?.realizedGainUsd, 20);
  assert.equal(sell?.remainingQuantity, 1);
  assert.equal(sell?.isLate, true);
  assert.deepEqual(transfer?.transactionIds, ["transfer-out", "transfer-in"]);
  assert.equal(transfer?.quantity, 2);
});
