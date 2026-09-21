import { PORTFOLIO_BUCKETS, type PortfolioBucket } from "./portfolioBuckets";

export const LEDGER_BUCKETS: PortfolioBucket[] = [...PORTFOLIO_BUCKETS];
export const LEDGER_CURRENCIES = ["USD", "IDR"] as const;

export type LedgerCurrency = (typeof LEDGER_CURRENCIES)[number];
export type LedgerTransactionType =
  | "deposit"
  | "withdrawal"
  | "buy"
  | "sell"
  | "transfer"
  | "dividend"
  | "fee"
  | "fx_conversion"
  | "opening_balance"
  | "reconciliation_adjustment";
export type LedgerTransactionSource = "manual" | "import" | "reconciliation" | "system";

export interface LedgerTransaction {
  transactionId: string;
  occurredAt: string;
  recordedAt: string;
  type: LedgerTransactionType;
  bucket?: PortfolioBucket;
  fromBucket?: PortfolioBucket;
  toBucket?: PortfolioBucket;
  ticker?: string;
  quantity?: number;
  price?: number;
  grossAmount?: number;
  fees?: number;
  /** Optional exact cost-basis change for reconciliation position adjustments. */
  costBasisDeltaUsd?: number;
  currency: LedgerCurrency;
  /** Signed cash movement for the transaction's bucket and currency. */
  cashDelta?: number;
  /** Signed external cash flow: positive for contributions, negative for withdrawals. */
  externalFlow?: number;
  transferId?: string;
  notes?: string;
  source: LedgerTransactionSource;
}

export interface LedgerPosition {
  ticker: string;
  quantity: number;
  costBasisUsd: number;
  averageCostUsd: number;
}

export interface LedgerBucketState {
  cash: Record<LedgerCurrency, number>;
  positions: Record<string, LedgerPosition>;
  realizedGainUsd: number;
  income: Record<LedgerCurrency, number>;
  fees: Record<LedgerCurrency, number>;
  externalFlow: Record<LedgerCurrency, number>;
}

export interface PortfolioLedgerTotals {
  cash: Record<LedgerCurrency, number>;
  realizedGainUsd: number;
  income: Record<LedgerCurrency, number>;
  fees: Record<LedgerCurrency, number>;
  externalFlow: Record<LedgerCurrency, number>;
}

export interface PortfolioLedgerState {
  ledgerVersion: number;
  asOf: string | null;
  buckets: Record<PortfolioBucket, LedgerBucketState>;
  total: PortfolioLedgerTotals;
}

export interface ReduceLedgerOptions {
  /** Ignore transactions after this timestamp when deriving a historical state. */
  asOf?: string;
}

const EPSILON = 1e-8;

export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

function isPortfolioBucket(value: unknown): value is PortfolioBucket {
  return typeof value === "string" && LEDGER_BUCKETS.includes(value as PortfolioBucket);
}

function isLedgerCurrency(value: unknown): value is LedgerCurrency {
  return typeof value === "string" && LEDGER_CURRENCIES.includes(value as LedgerCurrency);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function amount(value: number | undefined): number {
  return value ?? 0;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
}

function requireBucket(transaction: LedgerTransaction): PortfolioBucket {
  if (!isPortfolioBucket(transaction.bucket)) {
    throw new LedgerValidationError(`${transaction.transactionId}: bucket is required`);
  }
  return transaction.bucket;
}

function requirePositive(transaction: LedgerTransaction, field: string, value: number | undefined): number {
  if (!isFiniteNumber(value) || value <= 0) {
    throw new LedgerValidationError(`${transaction.transactionId}: ${field} must be positive`);
  }
  return value;
}

function requireCurrency(transaction: LedgerTransaction): LedgerCurrency {
  if (!isLedgerCurrency(transaction.currency)) {
    throw new LedgerValidationError(`${transaction.transactionId}: currency is required`);
  }
  return transaction.currency;
}

function requireUsdPosition(transaction: LedgerTransaction) {
  if (transaction.currency !== "USD") {
    throw new LedgerValidationError(`${transaction.transactionId}: security transactions must use USD`);
  }
}

function requireExternalFlow(transaction: LedgerTransaction, expected: number) {
  const externalFlow = transaction.externalFlow;
  if (!isFiniteNumber(externalFlow) || !nearlyEqual(externalFlow, expected)) {
    throw new LedgerValidationError(`${transaction.transactionId}: externalFlow must equal ${expected}`);
  }
}

function requireNoExternalFlow(transaction: LedgerTransaction) {
  if (Math.abs(amount(transaction.externalFlow)) > EPSILON) {
    throw new LedgerValidationError(`${transaction.transactionId}: internal activity cannot have externalFlow`);
  }
}

function validateCommon(transaction: LedgerTransaction) {
  if (!transaction || typeof transaction !== "object") {
    throw new LedgerValidationError("A ledger transaction is required");
  }
  if (typeof transaction.transactionId !== "string" || transaction.transactionId.trim() === "") {
    throw new LedgerValidationError("transactionId is required");
  }
  if (typeof transaction.occurredAt !== "string" || Number.isNaN(Date.parse(transaction.occurredAt))) {
    throw new LedgerValidationError(`${transaction.transactionId}: occurredAt must be a valid timestamp`);
  }
  if (typeof transaction.recordedAt !== "string" || Number.isNaN(Date.parse(transaction.recordedAt))) {
    throw new LedgerValidationError(`${transaction.transactionId}: recordedAt must be a valid timestamp`);
  }
  if (Date.parse(transaction.recordedAt) < Date.parse(transaction.occurredAt)) {
    throw new LedgerValidationError(`${transaction.transactionId}: recordedAt cannot precede occurredAt`);
  }
  if (!isLedgerCurrency(transaction.currency)) {
    throw new LedgerValidationError(`${transaction.transactionId}: unsupported currency`);
  }
  if (!transaction.source) {
    throw new LedgerValidationError(`${transaction.transactionId}: source is required`);
  }
  for (const [field, value] of Object.entries({
    quantity: transaction.quantity,
    price: transaction.price,
    grossAmount: transaction.grossAmount,
    fees: transaction.fees,
    costBasisDeltaUsd: transaction.costBasisDeltaUsd,
    cashDelta: transaction.cashDelta,
    externalFlow: transaction.externalFlow,
  })) {
    if (value !== undefined && !isFiniteNumber(value)) {
      throw new LedgerValidationError(`${transaction.transactionId}: ${field} must be finite`);
    }
  }
  if (amount(transaction.fees) < 0) {
    throw new LedgerValidationError(`${transaction.transactionId}: fees cannot be negative`);
  }
  if (transaction.grossAmount !== undefined && transaction.grossAmount < 0) {
    throw new LedgerValidationError(`${transaction.transactionId}: grossAmount cannot be negative`);
  }
}

export function validateLedgerTransaction(transaction: LedgerTransaction): void {
  validateCommon(transaction);
  const cashDelta = amount(transaction.cashDelta);
  const externalFlow = amount(transaction.externalFlow);

  switch (transaction.type) {
    case "deposit":
      requireBucket(transaction);
      requireCurrency(transaction);
      requirePositive(transaction, "cashDelta", cashDelta);
      requireExternalFlow(transaction, cashDelta);
      break;
    case "withdrawal":
      requireBucket(transaction);
      requireCurrency(transaction);
      if (cashDelta >= -EPSILON) throw new LedgerValidationError(`${transaction.transactionId}: withdrawal cashDelta must be negative`);
      requireExternalFlow(transaction, cashDelta);
      break;
    case "buy": {
      requireBucket(transaction);
      requireUsdPosition(transaction);
      const quantity = requirePositive(transaction, "quantity", transaction.quantity);
      const price = requirePositive(transaction, "price", transaction.price);
      const grossAmount = requirePositive(transaction, "grossAmount", transaction.grossAmount);
      const expectedGross = quantity * price;
      if (!nearlyEqual(grossAmount, expectedGross)) {
        throw new LedgerValidationError(`${transaction.transactionId}: grossAmount must equal quantity × price`);
      }
      const expectedCashDelta = -(grossAmount + amount(transaction.fees));
      if (!nearlyEqual(cashDelta, expectedCashDelta)) {
        throw new LedgerValidationError(`${transaction.transactionId}: cashDelta must equal -(grossAmount + fees)`);
      }
      if (!transaction.ticker?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: ticker is required`);
      requireNoExternalFlow(transaction);
      break;
    }
    case "sell": {
      requireBucket(transaction);
      requireUsdPosition(transaction);
      const quantity = requirePositive(transaction, "quantity", transaction.quantity);
      const price = requirePositive(transaction, "price", transaction.price);
      const grossAmount = requirePositive(transaction, "grossAmount", transaction.grossAmount);
      const expectedGross = quantity * price;
      if (!nearlyEqual(grossAmount, expectedGross)) {
        throw new LedgerValidationError(`${transaction.transactionId}: grossAmount must equal quantity × price`);
      }
      const expectedCashDelta = grossAmount - amount(transaction.fees);
      if (expectedCashDelta <= EPSILON || !nearlyEqual(cashDelta, expectedCashDelta)) {
        throw new LedgerValidationError(`${transaction.transactionId}: cashDelta must equal grossAmount - fees`);
      }
      if (!transaction.ticker?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: ticker is required`);
      requireNoExternalFlow(transaction);
      break;
    }
    case "transfer":
      requireBucket(transaction);
      requireCurrency(transaction);
      if (!transaction.transferId?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: transferId is required`);
      if (!isPortfolioBucket(transaction.fromBucket) || !isPortfolioBucket(transaction.toBucket) || transaction.fromBucket === transaction.toBucket) {
        throw new LedgerValidationError(`${transaction.transactionId}: transfer must have distinct fromBucket and toBucket`);
      }
      if (transaction.bucket !== transaction.fromBucket && transaction.bucket !== transaction.toBucket) {
        throw new LedgerValidationError(`${transaction.transactionId}: transfer leg bucket must be fromBucket or toBucket`);
      }
      if (Math.abs(cashDelta) <= EPSILON && Math.abs(amount(transaction.quantity)) <= EPSILON) {
        throw new LedgerValidationError(`${transaction.transactionId}: transfer must move cash or a position`);
      }
      if (Math.abs(cashDelta) > EPSILON && Math.abs(amount(transaction.quantity)) > EPSILON) {
        throw new LedgerValidationError(`${transaction.transactionId}: transfer cannot move cash and a position in one leg`);
      }
      if (Math.abs(amount(transaction.quantity)) > EPSILON && !transaction.ticker?.trim()) {
        throw new LedgerValidationError(`${transaction.transactionId}: position transfer requires ticker`);
      }
      if (Math.abs(amount(transaction.quantity)) > EPSILON) requireUsdPosition(transaction);
      requireNoExternalFlow(transaction);
      break;
    case "dividend":
      requireBucket(transaction);
      requireCurrency(transaction);
      const dividendAmount = requirePositive(transaction, "grossAmount", transaction.grossAmount);
      if (cashDelta <= EPSILON || !nearlyEqual(cashDelta, dividendAmount - amount(transaction.fees))) {
        throw new LedgerValidationError(`${transaction.transactionId}: cashDelta must equal grossAmount - fees`);
      }
      requireNoExternalFlow(transaction);
      break;
    case "fee": {
      requireBucket(transaction);
      requireCurrency(transaction);
      const fee = requirePositive(transaction, "fees", transaction.fees ?? (cashDelta < 0 ? -cashDelta : undefined));
      if (cashDelta >= -EPSILON || !nearlyEqual(cashDelta, -fee)) {
        throw new LedgerValidationError(`${transaction.transactionId}: fee cashDelta must equal -fees`);
      }
      requireNoExternalFlow(transaction);
      break;
    }
    case "fx_conversion":
      requireBucket(transaction);
      requireCurrency(transaction);
      if (!transaction.transferId?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: transferId is required`);
      if (Math.abs(cashDelta) <= EPSILON) throw new LedgerValidationError(`${transaction.transactionId}: FX conversion cashDelta must be non-zero`);
      requireNoExternalFlow(transaction);
      break;
    case "opening_balance":
      requireBucket(transaction);
      requireCurrency(transaction);
      if (Math.abs(cashDelta) <= EPSILON && Math.abs(amount(transaction.quantity)) <= EPSILON) {
        throw new LedgerValidationError(`${transaction.transactionId}: opening balance must include cash or a position`);
      }
      if (Math.abs(amount(transaction.quantity)) > EPSILON) {
        requireUsdPosition(transaction);
        requirePositive(transaction, "quantity", transaction.quantity);
        requirePositive(transaction, "price", transaction.price);
        if (!transaction.ticker?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: ticker is required`);
      }
      requireNoExternalFlow(transaction);
      break;
    case "reconciliation_adjustment":
      requireBucket(transaction);
      requireCurrency(transaction);
      if (!transaction.notes?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: reconciliation adjustment requires notes`);
      if (Math.abs(cashDelta) <= EPSILON && Math.abs(amount(transaction.quantity)) <= EPSILON && Math.abs(amount(transaction.costBasisDeltaUsd)) <= EPSILON) {
        throw new LedgerValidationError(`${transaction.transactionId}: reconciliation adjustment must change cash or a position`);
      }
      if (Math.abs(amount(transaction.quantity)) > EPSILON || Math.abs(amount(transaction.costBasisDeltaUsd)) > EPSILON) {
        requireUsdPosition(transaction);
        if (!transaction.ticker?.trim()) throw new LedgerValidationError(`${transaction.transactionId}: ticker is required`);
        if (transaction.costBasisDeltaUsd === undefined) requirePositive(transaction, "price", transaction.price);
        else if (transaction.price !== undefined && transaction.price <= 0) throw new LedgerValidationError(`${transaction.transactionId}: price must be positive when provided`);
      }
      requireNoExternalFlow(transaction);
      break;
    default:
      throw new LedgerValidationError(`${transaction.transactionId}: unsupported transaction type`);
  }

  if (transaction.type !== "deposit" && transaction.type !== "withdrawal" && Math.abs(externalFlow) > EPSILON) {
    throw new LedgerValidationError(`${transaction.transactionId}: only deposits and withdrawals may have externalFlow`);
  }
}

function transferGroups(transactions: readonly LedgerTransaction[]) {
  const groups = new Map<string, LedgerTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.type !== "transfer" && transaction.type !== "fx_conversion") continue;
    const transferId = transaction.transferId as string;
    groups.set(transferId, [...(groups.get(transferId) ?? []), transaction]);
  }
  return groups;
}

function validateTransferGroups(transactions: readonly LedgerTransaction[]) {
  for (const [transferId, group] of transferGroups(transactions)) {
    if (group.length !== 2) {
      throw new LedgerValidationError(`${transferId}: linked activity must contain exactly two legs`);
    }
    if (group[0].occurredAt !== group[1].occurredAt) {
      throw new LedgerValidationError(`${transferId}: linked legs must share occurredAt`);
    }

    if (group[0].type === "transfer" && group[1].type === "transfer") {
      const first = group[0];
      const second = group[1];
      if (first.fromBucket !== second.fromBucket || first.toBucket !== second.toBucket || first.currency !== second.currency) {
        throw new LedgerValidationError(`${transferId}: cash/position transfer legs must share routing and currency`);
      }
      const firstQuantity = amount(first.quantity);
      const secondQuantity = amount(second.quantity);
      const firstCash = amount(first.cashDelta);
      const secondCash = amount(second.cashDelta);
      const positionTransfer = Math.abs(firstQuantity) > EPSILON || Math.abs(secondQuantity) > EPSILON;
      if (positionTransfer) {
        if (!first.ticker || first.ticker !== second.ticker || Math.abs(firstCash) > EPSILON || Math.abs(secondCash) > EPSILON || !nearlyEqual(firstQuantity + secondQuantity, 0)) {
          throw new LedgerValidationError(`${transferId}: position transfer legs must offset the same ticker quantity`);
        }
      } else if (Math.abs(firstCash) <= EPSILON || !nearlyEqual(firstCash + secondCash, 0)) {
        throw new LedgerValidationError(`${transferId}: cash transfer legs must offset cash exactly`);
      }
      if (first.bucket === second.bucket || first.bucket !== first.fromBucket && first.bucket !== first.toBucket || second.bucket !== first.fromBucket && second.bucket !== first.toBucket) {
        throw new LedgerValidationError(`${transferId}: transfer legs must identify both pockets`);
      }
      if (positionTransfer && !(firstQuantity < -EPSILON && secondQuantity > EPSILON || secondQuantity < -EPSILON && firstQuantity > EPSILON)) {
        throw new LedgerValidationError(`${transferId}: position transfer must have one source and one destination leg`);
      }
      if (!positionTransfer && !(firstCash < -EPSILON && secondCash > EPSILON || secondCash < -EPSILON && firstCash > EPSILON)) {
        throw new LedgerValidationError(`${transferId}: cash transfer must have one source and one destination leg`);
      }
      continue;
    }

    if (group[0].type === "fx_conversion" && group[1].type === "fx_conversion") {
      const first = group[0];
      const second = group[1];
      if (first.bucket !== second.bucket || first.currency === second.currency || Math.abs(amount(first.quantity)) > EPSILON || Math.abs(amount(second.quantity)) > EPSILON) {
        throw new LedgerValidationError(`${transferId}: FX conversion legs must share a pocket and use two currencies`);
      }
      if (!(amount(first.cashDelta) < -EPSILON && amount(second.cashDelta) > EPSILON || amount(second.cashDelta) < -EPSILON && amount(first.cashDelta) > EPSILON)) {
        throw new LedgerValidationError(`${transferId}: FX conversion must have one outgoing and one incoming leg`);
      }
    } else {
      throw new LedgerValidationError(`${transferId}: linked legs must use the same transaction type`);
    }
  }
}

export function validateLedgerTransactionSet(transactions: readonly LedgerTransaction[]): void {
  const ids = new Set<string>();
  for (const transaction of transactions) {
    validateLedgerTransaction(transaction);
    if (ids.has(transaction.transactionId)) {
      throw new LedgerValidationError(`duplicate transactionId: ${transaction.transactionId}`);
    }
    ids.add(transaction.transactionId);
  }
  validateTransferGroups(transactions);
}

const LEDGER_TRANSACTION_KEYS: (keyof LedgerTransaction)[] = [
  "transactionId", "occurredAt", "recordedAt", "type", "bucket", "fromBucket", "toBucket",
  "ticker", "quantity", "price", "grossAmount", "fees", "costBasisDeltaUsd", "currency", "cashDelta",
  "externalFlow", "transferId", "notes", "source",
];

export function ledgerTransactionsEqual(left: LedgerTransaction, right: LedgerTransaction): boolean {
  return LEDGER_TRANSACTION_KEYS.every((key) => left[key] === right[key]);
}

export interface LedgerAppendPlan {
  transactions: LedgerTransaction[];
  pending: LedgerTransaction[];
}

export interface LedgerRemovalPlan {
  transactions: LedgerTransaction[];
  removed: LedgerTransaction[];
}

/**
 * Validates the append-only write contract without touching persistence. Existing
 * identical ids are safe retries; an existing id with different data is a conflict.
 */
export function prepareLedgerAppend(
  existingTransactions: readonly LedgerTransaction[],
  requestedTransactions: readonly LedgerTransaction[],
): LedgerAppendPlan {
  if (requestedTransactions.length === 0) return { transactions: [...existingTransactions], pending: [] };
  validateLedgerTransactionSet(requestedTransactions);

  const existingById = new Map(existingTransactions.map((transaction) => [transaction.transactionId, transaction]));
  const pending = requestedTransactions.filter((transaction) => {
    const existing = existingById.get(transaction.transactionId);
    if (!existing) return true;
    if (!ledgerTransactionsEqual(existing, transaction)) {
      throw new LedgerValidationError(`Ledger transaction ${transaction.transactionId} already exists with different data`);
    }
    return false;
  });
  const transactions = [...existingTransactions, ...pending];
  validateLedgerTransactionSet(transactions);
  reducePortfolioLedger(transactions);
  return { transactions, pending };
}

/**
 * Validates a user-requested removal before persistence. This is intentionally
 * limited to manually entered activity; opening balances and reconciliation
 * adjustments remain immutable. Removing a linked transfer/FX leg removes the
 * complete linked event so the ledger never retains an orphaned leg.
 */
export function prepareLedgerRemoval(
  existingTransactions: readonly LedgerTransaction[],
  transactionIds: readonly string[],
): LedgerRemovalPlan {
  if (transactionIds.length === 0) throw new LedgerValidationError("At least one transaction is required");

  validateLedgerTransactionSet(existingTransactions);
  const requestedIds = new Set(transactionIds);
  if (requestedIds.size !== transactionIds.length) {
    throw new LedgerValidationError("Duplicate transaction ids cannot be removed");
  }

  const requested = existingTransactions.filter((transaction) => requestedIds.has(transaction.transactionId));
  if (requested.length !== requestedIds.size) {
    throw new LedgerValidationError("One or more transactions could not be found");
  }
  if (requested.some((transaction) => transaction.source !== "manual" || transaction.type === "opening_balance" || transaction.type === "reconciliation_adjustment")) {
    throw new LedgerValidationError("Only manually recorded activity can be removed");
  }

  const linkedTransferIds = new Set(requested.map((transaction) => transaction.transferId).filter(Boolean));
  const removalIds = new Set(requestedIds);
  if (linkedTransferIds.size > 0) {
    for (const transaction of existingTransactions) {
      if (transaction.transferId && linkedTransferIds.has(transaction.transferId)) removalIds.add(transaction.transactionId);
    }
  }

  const removed = existingTransactions.filter((transaction) => removalIds.has(transaction.transactionId));
  const transactions = existingTransactions.filter((transaction) => !removalIds.has(transaction.transactionId));
  validateLedgerTransactionSet(transactions);
  reducePortfolioLedger(transactions);
  return { transactions: [...transactions], removed };
}

export function sortLedgerTransactions(transactions: readonly LedgerTransaction[]): LedgerTransaction[] {
  return [...transactions].sort((left, right) => (
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    || Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
    || left.transactionId.localeCompare(right.transactionId)
  ));
}

function emptyCurrencyRecord(): Record<LedgerCurrency, number> {
  return { USD: 0, IDR: 0 };
}

function emptyBucketState(): LedgerBucketState {
  return {
    cash: emptyCurrencyRecord(),
    positions: {},
    realizedGainUsd: 0,
    income: emptyCurrencyRecord(),
    fees: emptyCurrencyRecord(),
    externalFlow: emptyCurrencyRecord(),
  };
}

function emptyTotals(): PortfolioLedgerTotals {
  return {
    cash: emptyCurrencyRecord(),
    realizedGainUsd: 0,
    income: emptyCurrencyRecord(),
    fees: emptyCurrencyRecord(),
    externalFlow: emptyCurrencyRecord(),
  };
}

export function emptyPortfolioLedgerState(): PortfolioLedgerState {
  return {
    ledgerVersion: 0,
    asOf: null,
    buckets: {
      longterm: emptyBucketState(),
      index: emptyBucketState(),
      swing: emptyBucketState(),
      treasury: emptyBucketState(),
    },
    total: emptyTotals(),
  };
}

function addCurrency(target: Record<LedgerCurrency, number>, currency: LedgerCurrency, delta: number) {
  target[currency] += delta;
}

function applyCash(state: PortfolioLedgerState, bucket: PortfolioBucket, currency: LedgerCurrency, delta: number, transactionId: string) {
  const cash = state.buckets[bucket].cash;
  const next = cash[currency] + delta;
  if (next < -EPSILON) {
    throw new LedgerValidationError(`${transactionId}: transaction would make ${bucket} ${currency} cash negative`);
  }
  cash[currency] = next;
}

function getPosition(bucket: LedgerBucketState, ticker: string): LedgerPosition {
  return bucket.positions[ticker] ?? { ticker, quantity: 0, costBasisUsd: 0, averageCostUsd: 0 };
}

function removePosition(bucket: LedgerBucketState, ticker: string, quantity: number, transactionId: string): number {
  const position = getPosition(bucket, ticker);
  if (position.quantity + EPSILON < quantity) {
    throw new LedgerValidationError(`${transactionId}: cannot remove more ${ticker} than the current position`);
  }
  const costBasis = position.averageCostUsd * quantity;
  position.quantity -= quantity;
  position.costBasisUsd -= costBasis;
  if (Math.abs(position.quantity) <= EPSILON) {
    delete bucket.positions[ticker];
  } else {
    position.quantity = Math.max(0, position.quantity);
    position.costBasisUsd = Math.max(0, position.costBasisUsd);
    position.averageCostUsd = position.costBasisUsd / position.quantity;
    bucket.positions[ticker] = position;
  }
  return costBasis;
}

function addPosition(bucket: LedgerBucketState, ticker: string, quantity: number, costBasisUsd: number) {
  const position = getPosition(bucket, ticker);
  position.quantity += quantity;
  position.costBasisUsd += costBasisUsd;
  position.averageCostUsd = position.quantity > EPSILON ? position.costBasisUsd / position.quantity : 0;
  bucket.positions[ticker] = position;
}

function applyPositionAdjustment(state: PortfolioLedgerState, transaction: LedgerTransaction) {
  const bucket = state.buckets[transaction.bucket as PortfolioBucket];
  const quantity = amount(transaction.quantity);
  const ticker = transaction.ticker as string;
  const position = getPosition(bucket, ticker);
  const costBasisDelta = transaction.costBasisDeltaUsd ?? quantity * (transaction.price as number);
  const nextQuantity = position.quantity + quantity;
  const nextCostBasis = position.costBasisUsd + costBasisDelta;
  if (nextQuantity < -EPSILON) {
    throw new LedgerValidationError(`${transaction.transactionId}: cannot reconcile more ${ticker} than the current position`);
  }
  if (nextCostBasis < -EPSILON) {
    throw new LedgerValidationError(`${transaction.transactionId}: reconciliation would make ${ticker} cost basis negative`);
  }
  if (Math.abs(nextQuantity) <= EPSILON) {
    if (Math.abs(nextCostBasis) > EPSILON) {
      throw new LedgerValidationError(`${transaction.transactionId}: a zero-quantity position cannot retain cost basis`);
    }
    delete bucket.positions[ticker];
    return;
  }
  bucket.positions[ticker] = {
    ticker,
    quantity: Math.max(0, nextQuantity),
    costBasisUsd: Math.max(0, nextCostBasis),
    averageCostUsd: Math.max(0, nextCostBasis) / Math.max(0, nextQuantity),
  };
}

function applyTransferGroup(state: PortfolioLedgerState, group: LedgerTransaction[]) {
  const first = group[0];
  if (first.type === "fx_conversion") {
    for (const leg of group) {
      applyCash(state, leg.bucket as PortfolioBucket, leg.currency, amount(leg.cashDelta), leg.transactionId);
    }
    return;
  }

  const positionTransfer = Math.abs(amount(first.quantity)) > EPSILON || Math.abs(amount(group[1].quantity)) > EPSILON;
  if (!positionTransfer) {
    for (const leg of group) {
      applyCash(state, leg.bucket as PortfolioBucket, leg.currency, amount(leg.cashDelta), leg.transactionId);
    }
    return;
  }

  const source = group.find((leg) => amount(leg.quantity) < -EPSILON) as LedgerTransaction;
  const destination = group.find((leg) => amount(leg.quantity) > EPSILON) as LedgerTransaction;
  const quantity = Math.abs(source.quantity as number);
  const sourceBucket = state.buckets[source.bucket as PortfolioBucket];
  const costBasis = removePosition(sourceBucket, source.ticker as string, quantity, source.transactionId);
  addPosition(state.buckets[destination.bucket as PortfolioBucket], destination.ticker as string, quantity, costBasis);
}

function applyTransaction(state: PortfolioLedgerState, transaction: LedgerTransaction) {
  const bucketId = transaction.bucket as PortfolioBucket;
  const bucket = state.buckets[bucketId];
  const currency = transaction.currency;
  const cashDelta = amount(transaction.cashDelta);

  switch (transaction.type) {
    case "deposit":
    case "withdrawal":
      applyCash(state, bucketId, currency, cashDelta, transaction.transactionId);
      addCurrency(bucket.externalFlow, currency, transaction.externalFlow as number);
      break;
    case "buy": {
      const quantity = transaction.quantity as number;
      const grossAmount = transaction.grossAmount as number;
      const fees = amount(transaction.fees);
      applyCash(state, bucketId, "USD", cashDelta, transaction.transactionId);
      addPosition(bucket, transaction.ticker as string, quantity, grossAmount + fees);
      addCurrency(bucket.fees, "USD", fees);
      break;
    }
    case "sell": {
      const quantity = transaction.quantity as number;
      const grossAmount = transaction.grossAmount as number;
      const fees = amount(transaction.fees);
      const costBasis = removePosition(bucket, transaction.ticker as string, quantity, transaction.transactionId);
      applyCash(state, bucketId, "USD", cashDelta, transaction.transactionId);
      bucket.realizedGainUsd += grossAmount - fees - costBasis;
      addCurrency(bucket.fees, "USD", fees);
      break;
    }
    case "dividend":
      applyCash(state, bucketId, currency, cashDelta, transaction.transactionId);
      addCurrency(bucket.income, currency, transaction.grossAmount as number);
      addCurrency(bucket.fees, currency, amount(transaction.fees));
      break;
    case "fee": {
      applyCash(state, bucketId, currency, cashDelta, transaction.transactionId);
      addCurrency(bucket.fees, currency, transaction.fees ?? -cashDelta);
      break;
    }
    case "opening_balance":
      applyCash(state, bucketId, currency, cashDelta, transaction.transactionId);
      if (Math.abs(amount(transaction.quantity)) > EPSILON) {
        addPosition(bucket, transaction.ticker as string, transaction.quantity as number, (transaction.quantity as number) * (transaction.price as number));
      }
      break;
    case "reconciliation_adjustment":
      applyCash(state, bucketId, currency, cashDelta, transaction.transactionId);
      if (Math.abs(amount(transaction.quantity)) > EPSILON || Math.abs(amount(transaction.costBasisDeltaUsd)) > EPSILON) {
        applyPositionAdjustment(state, transaction);
      }
      break;
    case "transfer":
    case "fx_conversion":
      throw new LedgerValidationError(`${transaction.transactionId}: linked activity must be applied as a group`);
    default:
      throw new LedgerValidationError(`${transaction.transactionId}: unsupported transaction type`);
  }
}

function rebuildTotals(state: PortfolioLedgerState) {
  const total = emptyTotals();
  for (const bucket of LEDGER_BUCKETS) {
    const current = state.buckets[bucket];
    for (const currency of LEDGER_CURRENCIES) {
      total.cash[currency] += current.cash[currency];
      total.income[currency] += current.income[currency];
      total.fees[currency] += current.fees[currency];
      total.externalFlow[currency] += current.externalFlow[currency];
    }
    total.realizedGainUsd += current.realizedGainUsd;
  }
  state.total = total;
}

export function reducePortfolioLedger(
  transactions: readonly LedgerTransaction[],
  options: ReduceLedgerOptions = {},
): PortfolioLedgerState {
  validateLedgerTransactionSet(transactions);
  if (options.asOf !== undefined && Number.isNaN(Date.parse(options.asOf))) {
    throw new LedgerValidationError("asOf must be a valid timestamp");
  }

  const sorted = sortLedgerTransactions(transactions);
  const eligible = options.asOf === undefined
    ? sorted
    : sorted.filter((transaction) => Date.parse(transaction.occurredAt) <= Date.parse(options.asOf as string));
  const state = emptyPortfolioLedgerState();

  for (let index = 0; index < eligible.length; index += 1) {
    const transaction = eligible[index];
    if (transaction.type === "transfer" || transaction.type === "fx_conversion") {
      const transferId = transaction.transferId as string;
      const group = eligible.filter((candidate) => candidate.transferId === transferId);
      if (group.length !== 2) {
        throw new LedgerValidationError(`${transferId}: both linked legs must be present at the requested asOf`);
      }
      const firstIndex = Math.min(...group.map((leg) => eligible.findIndex((candidate) => candidate.transactionId === leg.transactionId)));
      if (index !== firstIndex) continue;
      applyTransferGroup(state, group);
      continue;
    }
    applyTransaction(state, transaction);
  }

  state.ledgerVersion = eligible.length;
  state.asOf = options.asOf ?? eligible.at(-1)?.occurredAt ?? null;
  rebuildTotals(state);
  return state;
}
