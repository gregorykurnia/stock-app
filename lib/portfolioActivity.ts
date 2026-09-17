import {
  reducePortfolioLedger,
  sortLedgerTransactions,
  type LedgerCurrency,
  type LedgerTransaction,
  type PortfolioLedgerState,
} from "./portfolioLedger";
import type { PortfolioBucket } from "./portfolioPerformance";

const EPSILON = 1e-8;

export interface ReconciliationCashTarget {
  bucket: PortfolioBucket;
  currency: LedgerCurrency;
  cash: number;
}

export interface ReconciliationPositionTarget {
  bucket: PortfolioBucket;
  ticker: string;
  quantity: number;
  costBasisUsd: number;
}

export interface BuildReconciliationAdjustmentsInput {
  currentState: PortfolioLedgerState;
  cashTargets: readonly ReconciliationCashTarget[];
  positionTargets: readonly ReconciliationPositionTarget[];
  occurredAt: string;
  recordedAt: string;
  notes: string;
  idFactory?: (kind: "cash" | "position", index: number) => string;
}

function defaultIdFactory(kind: "cash" | "position", index: number) {
  return `reconciliation-${kind}-${Date.now()}-${index}`;
}

function finiteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be zero or positive`);
}

/**
 * Converts a user-entered target balance into append-only reconciliation records.
 * Position records carry an exact cost-basis delta so the resulting weighted-average
 * cost matches the reconciled target, including cost-only corrections.
 */
export function buildReconciliationAdjustments(input: BuildReconciliationAdjustmentsInput): LedgerTransaction[] {
  if (!input.notes.trim()) throw new Error("A reconciliation reason is required");
  const idFactory = input.idFactory ?? defaultIdFactory;
  const transactions: LedgerTransaction[] = [];
  let cashIndex = 0;
  let positionIndex = 0;

  for (const target of input.cashTargets) {
    finiteNonNegative(target.cash, `${target.bucket} ${target.currency} cash`);
    const current = input.currentState.buckets[target.bucket].cash[target.currency];
    const delta = target.cash - current;
    if (Math.abs(delta) <= EPSILON) continue;
    transactions.push({
      transactionId: idFactory("cash", cashIndex),
      occurredAt: input.occurredAt,
      recordedAt: input.recordedAt,
      type: "reconciliation_adjustment",
      bucket: target.bucket,
      currency: target.currency,
      cashDelta: delta,
      notes: input.notes.trim(),
      source: "reconciliation",
    });
    cashIndex += 1;
  }

  for (const target of input.positionTargets) {
    const ticker = target.ticker.trim().toUpperCase();
    if (!ticker) throw new Error("Reconciliation ticker is required");
    finiteNonNegative(target.quantity, `${ticker} quantity`);
    finiteNonNegative(target.costBasisUsd, `${ticker} cost basis`);

    const current = input.currentState.buckets[target.bucket].positions[ticker];
    const currentQuantity = current?.quantity ?? 0;
    const currentCostBasis = current?.costBasisUsd ?? 0;
    const quantityDelta = target.quantity - currentQuantity;
    const costBasisDelta = target.costBasisUsd - currentCostBasis;
    if (Math.abs(quantityDelta) <= EPSILON && Math.abs(costBasisDelta) <= EPSILON) continue;

    const referenceCost = target.quantity > EPSILON
      ? target.costBasisUsd / target.quantity
      : current?.averageCostUsd ?? 0;
    const transaction: LedgerTransaction = {
      transactionId: idFactory("position", positionIndex),
      occurredAt: input.occurredAt,
      recordedAt: input.recordedAt,
      type: "reconciliation_adjustment",
      bucket: target.bucket,
      ticker,
      quantity: Math.abs(quantityDelta) <= EPSILON ? undefined : quantityDelta,
      price: referenceCost > EPSILON ? referenceCost : undefined,
      costBasisDeltaUsd: costBasisDelta,
      currency: "USD",
      notes: input.notes.trim(),
      source: "reconciliation",
    };
    transactions.push(transaction);
    positionIndex += 1;
  }

  return transactions;
}

export interface PortfolioActivityRow {
  transactionIds: string[];
  type: LedgerTransaction["type"];
  occurredAt: string;
  recordedAt: string;
  bucket?: PortfolioBucket;
  fromBucket?: PortfolioBucket;
  toBucket?: PortfolioBucket;
  ticker?: string;
  quantity?: number;
  price?: number;
  grossAmount?: number;
  fees?: number;
  cashDelta?: number;
  currency: LedgerCurrency | null;
  externalFlow?: number;
  realizedGainUsd?: number;
  remainingQuantity?: number;
  notes?: string;
  isLate: boolean;
}

function datePart(value: string) {
  return value.slice(0, 10);
}

function uniqueNotes(transactions: readonly LedgerTransaction[]) {
  return [...new Set(transactions.map((transaction) => transaction.notes?.trim()).filter(Boolean))].join(" · ") || undefined;
}

function eventAmount(transactions: readonly LedgerTransaction[]) {
  const gross = transactions.find((transaction) => transaction.grossAmount != null)?.grossAmount;
  if (gross != null) return gross;
  const cash = transactions.reduce((sum, transaction) => Math.max(sum, Math.abs(transaction.cashDelta ?? 0)), 0);
  return cash > EPSILON ? cash : undefined;
}

/**
 * Produces audit-friendly activity rows from the append-only ledger. Linked transfer
 * and FX legs are deliberately shown as one event while their two records remain intact.
 */
export function buildPortfolioActivityRows(transactions: readonly LedgerTransaction[]): PortfolioActivityRow[] {
  const sorted = sortLedgerTransactions(transactions);
  const rows: PortfolioActivityRow[] = [];
  const handled = new Set<string>();

  for (let index = 0; index < sorted.length; index += 1) {
    const transaction = sorted[index];
    if (handled.has(transaction.transactionId)) continue;

    let event = [transaction];
    let startIndex = index;
    let endIndex = index;
    if (transaction.transferId) {
      event = sorted.filter((candidate) => candidate.transferId === transaction.transferId).sort((left, right) => (
        (left.cashDelta ?? left.quantity ?? 0) - (right.cashDelta ?? right.quantity ?? 0)
      ));
      const eventIndexes = event.map((candidate) => sorted.findIndex((item) => item.transactionId === candidate.transactionId));
      startIndex = Math.min(...eventIndexes);
      endIndex = Math.max(...eventIndexes);
      for (const leg of event) handled.add(leg.transactionId);
    } else {
      handled.add(transaction.transactionId);
    }

    const before = reducePortfolioLedger(sorted.slice(0, startIndex));
    const after = reducePortfolioLedger(sorted.slice(0, endIndex + 1));
    const representative = event[0];
    const sameCurrency = event.every((item) => item.currency === representative.currency);
    const row: PortfolioActivityRow = {
      transactionIds: event.map((item) => item.transactionId),
      type: representative.type,
      occurredAt: representative.occurredAt,
      recordedAt: event.map((item) => item.recordedAt).sort().at(-1) ?? representative.recordedAt,
      bucket: event.length === 1 ? representative.bucket : undefined,
      fromBucket: representative.fromBucket,
      toBucket: representative.toBucket,
      ticker: representative.ticker,
      quantity: event.length === 1 ? representative.quantity : Math.max(...event.map((item) => Math.abs(item.quantity ?? 0))),
      price: representative.price,
      grossAmount: eventAmount(event),
      fees: event.reduce((sum, item) => sum + (item.fees ?? 0), 0) || undefined,
      cashDelta: event.reduce((sum, item) => sum + (item.cashDelta ?? 0), 0) || undefined,
      currency: sameCurrency ? representative.currency : null,
      externalFlow: event.reduce((sum, item) => sum + (item.externalFlow ?? 0), 0) || undefined,
      notes: uniqueNotes(event),
      isLate: event.some((item) => datePart(item.occurredAt) !== datePart(item.recordedAt)),
    };

    if (representative.type === "sell" && representative.bucket && representative.ticker) {
      const beforePosition = before.buckets[representative.bucket].positions[representative.ticker];
      row.realizedGainUsd = (representative.grossAmount ?? 0)
        - (representative.fees ?? 0)
        - (beforePosition?.averageCostUsd ?? 0) * (representative.quantity ?? 0);
    }

    const positionBucket = representative.bucket ?? representative.toBucket;
    if (positionBucket && representative.ticker && representative.type !== "fx_conversion") {
      row.remainingQuantity = after.buckets[positionBucket].positions[representative.ticker]?.quantity ?? 0;
    }

    rows.push(row);
  }

  return rows.sort((left, right) => (
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
    || Date.parse(right.recordedAt) - Date.parse(left.recordedAt)
    || right.transactionIds[0].localeCompare(left.transactionIds[0])
  ));
}
