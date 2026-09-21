"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  appendPortfolioLedgerTransactions,
  getPortfolioDivisionStocks,
  getPortfolioLedgerTransactions,
  removePortfolioLedgerTransactions,
} from "@/lib/firestore";
import {
  reducePortfolioLedger,
  type LedgerCurrency,
  type LedgerTransaction,
  type PortfolioLedgerState,
} from "@/lib/portfolioLedger";
import {
  buildPortfolioActivityRows,
  buildReconciliationAdjustments,
  buildReconciliationPreview,
  type PortfolioActivityRow,
  type ReconciliationPreview,
  type ReconciliationPositionTarget,
} from "@/lib/portfolioActivity";
import type { PortfolioBucket } from "@/lib/portfolioPerformance";
import { PORTFOLIO_BUCKET_DEFINITIONS } from "@/lib/portfolioBuckets";

const BUCKETS: { id: PortfolioBucket; label: string }[] = [
  ...PORTFOLIO_BUCKET_DEFINITIONS,
];
const CURRENCIES: LedgerCurrency[] = ["USD", "IDR"];
const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "deposit", label: "Deposit" },
  { id: "withdrawal", label: "Withdrawal" },
  { id: "buy", label: "Buy" },
  { id: "sell", label: "Sell" },
  { id: "dividend", label: "Dividend" },
  { id: "fee", label: "Fee" },
  { id: "transfer", label: "Pocket transfer" },
  { id: "fx_conversion", label: "FX conversion" },
];
const LABELS = Object.fromEntries(ACTIVITY_TYPES.map((item) => [item.id, item.label])) as Record<ActivityType, string>;

type ActivityType = Exclude<LedgerTransaction["type"], "opening_balance" | "reconciliation_adjustment">;
type Tab = "opening" | "reconcile" | "activity" | "history";
type TransferMode = "cash" | "position";
type LegacyHolding = { bucket: PortfolioBucket; ticker: string; quantity: number; price: number | null };
type PositionForm = { bucket: PortfolioBucket; ticker: string; quantity: string; costBasisUsd: string };
type CashForm = Record<PortfolioBucket, Record<LedgerCurrency, string>>;
type ReconciliationPreviewState = ReconciliationPreview & { inputKey: string };

function emptyCash(value = "0"): CashForm {
  return Object.fromEntries(BUCKETS.map(({ id }) => [id, { USD: value, IDR: value }])) as CashForm;
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function isoFromDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid effective date and time");
  return date.toISOString();
}

function parseAmount(value: string, label: string, allowZero = false) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new Error(`${label} must be ${allowZero ? "zero or positive" : "positive"}`);
  }
  return amount;
}

function transactionId(prefix: string, suffix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}-${suffix}`;
}

function formatNumber(value: number | undefined, maximumFractionDigits = 4) {
  return value == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

function formatMoney(value: number | undefined, currency: LedgerCurrency | null = "USD") {
  if (value == null) return "—";
  if (currency === null) return formatNumber(value, 2);
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value);
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;
}

function formatSignedMoney(value: number, currency: LedgerCurrency) {
  return `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(value), currency)}`;
}

function bucketLabel(bucket: PortfolioBucket) {
  return BUCKETS.find((item) => item.id === bucket)?.label ?? bucket;
}

function readableLedgerError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Could not save ledger activity";
  const cashMatch = message.match(/transaction would make (longterm|index|swing|treasury) (USD|IDR) cash negative/i);
  if (!cashMatch) return message;

  const [, bucket, currency] = cashMatch;
  return `${bucketLabel(bucket as PortfolioBucket)} does not have enough ${currency} cash for this activity. A buy or fee spends cash from the selected pocket. If you meant to move sale proceeds from another pocket, record Pocket transfer → Cash first; if you meant to move an existing holding, use Pocket transfer → Position instead of recording another buy.`;
}

function humanType(type: LedgerTransaction["type"]) {
  if (type in LABELS) return LABELS[type as ActivityType];
  return type === "opening_balance" ? "Opening balance" : "Reconciliation";
}

function readLegacyHoldings(data: Record<PortfolioBucket, Record<string, object>>): LegacyHolding[] {
  return BUCKETS.flatMap(({ id: bucket }) => Object.entries(data[bucket] ?? {}).map(([ticker, value]) => {
    const raw = value as { entry_quantity?: unknown; entry_price?: unknown };
    const quantity = typeof raw.entry_quantity === "number" && Number.isFinite(raw.entry_quantity) ? raw.entry_quantity : 0;
    const price = typeof raw.entry_price === "number" && Number.isFinite(raw.entry_price) && raw.entry_price > 0 ? raw.entry_price : null;
    return { bucket, ticker: ticker.toUpperCase(), quantity: quantity > 0 ? quantity : 0, price };
  })).sort((left, right) => left.bucket.localeCompare(right.bucket) || left.ticker.localeCompare(right.ticker));
}

function positionKey(bucket: PortfolioBucket, ticker: string) {
  return `${bucket}:${ticker}`;
}

function reconcilePositionForms(state: PortfolioLedgerState, legacy: LegacyHolding[]): PositionForm[] {
  const rows = new Map<string, PositionForm>();
  for (const holding of legacy) {
    const key = positionKey(holding.bucket, holding.ticker);
    const current = state.buckets[holding.bucket].positions[holding.ticker];
    rows.set(key, {
      bucket: holding.bucket,
      ticker: holding.ticker,
      quantity: holding.quantity > 0 ? String(holding.quantity) : "0",
      // A legacy row without an entry price is not enough evidence to overwrite a
      // known ledger cost basis; keep the current ledger value as the safe default
      // and let the user enter the broker-confirmed target explicitly.
      costBasisUsd: holding.quantity > 0
        ? String(holding.price != null ? holding.quantity * holding.price : current?.costBasisUsd ?? 0)
        : "0",
    });
  }
  for (const bucket of BUCKETS.map(({ id }) => id)) {
    for (const position of Object.values(state.buckets[bucket].positions)) {
      const key = positionKey(bucket, position.ticker);
      if (!rows.has(key)) rows.set(key, {
        bucket,
        ticker: position.ticker,
        quantity: String(position.quantity),
        costBasisUsd: String(position.costBasisUsd),
      });
    }
  }
  return [...rows.values()].sort((left, right) => left.bucket.localeCompare(right.bucket) || left.ticker.localeCompare(right.ticker));
}

interface Props {
  onLedgerChanged?: () => void;
}

export default function PortfolioAccountingPanel({ onLedgerChanged }: Props) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [ledgerState, setLedgerState] = useState<PortfolioLedgerState | null>(null);
  const [legacyHoldings, setLegacyHoldings] = useState<LegacyHolding[]>([]);
  const [openingCash, setOpeningCash] = useState<CashForm>(() => emptyCash());
  const [reconcileCash, setReconcileCash] = useState<CashForm>(() => emptyCash());
  const [reconcilePositions, setReconcilePositions] = useState<PositionForm[]>([]);
  const [reconcilePreview, setReconcilePreview] = useState<ReconciliationPreviewState | null>(null);
  const [newReconcileBucket, setNewReconcileBucket] = useState<PortfolioBucket>("swing");
  const [newReconcileTicker, setNewReconcileTicker] = useState("");
  const [tab, setTab] = useState<Tab>("opening");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openingDate, setOpeningDate] = useState(localDateTimeValue());
  const [reconcileDate, setReconcileDate] = useState(localDateTimeValue());
  const [reconcileReason, setReconcileReason] = useState("Reconciled against current pocket records");
  const [activityType, setActivityType] = useState<ActivityType>("deposit");
  const [activityBucket, setActivityBucket] = useState<PortfolioBucket>("swing");
  const [activityCurrency, setActivityCurrency] = useState<LedgerCurrency>("USD");
  const [activityAmount, setActivityAmount] = useState("");
  const [activityTicker, setActivityTicker] = useState("");
  const [activityQuantity, setActivityQuantity] = useState("");
  const [activityPrice, setActivityPrice] = useState("");
  const [activityFees, setActivityFees] = useState("0");
  const [activityDate, setActivityDate] = useState(localDateTimeValue());
  const [activityNotes, setActivityNotes] = useState("");
  const [transferMode, setTransferMode] = useState<TransferMode>("cash");
  const [transferToBucket, setTransferToBucket] = useState<PortfolioBucket>("index");
  const [fxToCurrency, setFxToCurrency] = useState<LedgerCurrency>("IDR");
  const [historyType, setHistoryType] = useState("all");
  const [historyBucket, setHistoryBucket] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const [nextTransactions, ...pockets] = await Promise.all([
        getPortfolioLedgerTransactions(),
        ...BUCKETS.map(({ id }) => getPortfolioDivisionStocks(id)),
      ]);
      const nextState = reducePortfolioLedger(nextTransactions);
      const legacy = readLegacyHoldings({
        longterm: pockets[0] as Record<string, object>,
        index: pockets[1] as Record<string, object>,
        swing: pockets[2] as Record<string, object>,
        treasury: pockets[3] as Record<string, object>,
      });
      setTransactions(nextTransactions);
      setLedgerState(nextState);
      setLegacyHoldings(legacy);
      setReconcileCash(Object.fromEntries(BUCKETS.map(({ id }) => [id, {
        USD: String(nextState.buckets[id].cash.USD),
        IDR: String(nextState.buckets[id].cash.IDR),
      }])) as CashForm);
      setReconcilePositions(reconcilePositionForms(nextState, legacy));
      if (nextTransactions.length > 0) setTab((current) => current === "opening" ? "activity" : current);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load accounting data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(task);
  }, []);

  const openingHoldings = legacyHoldings.filter((holding) => holding.quantity > 0);
  const missingOpeningData = openingHoldings.filter((holding) => holding.price == null);

  const historyRows = useMemo(() => {
    const search = historySearch.trim().toUpperCase();
    return buildPortfolioActivityRows(transactions).filter((row) => {
      const occurredDate = row.occurredAt.slice(0, 10);
      const typeMatches = historyType === "all" || row.type === historyType;
      const bucketMatches = historyBucket === "all"
        || row.bucket === historyBucket
        || row.fromBucket === historyBucket
        || row.toBucket === historyBucket;
      const searchMatches = !search || row.ticker?.includes(search) || row.notes?.toUpperCase().includes(search);
      const fromMatches = !historyFrom || occurredDate >= historyFrom;
      const toMatches = !historyTo || occurredDate <= historyTo;
      return typeMatches && bucketMatches && searchMatches && fromMatches && toMatches;
    });
  }, [historyBucket, historyFrom, historySearch, historyTo, historyType, transactions]);

  const reconciliationFormKey = useMemo(() => JSON.stringify({
    ledgerVersion: ledgerState?.ledgerVersion ?? null,
    date: reconcileDate,
    reason: reconcileReason,
    cash: reconcileCash,
    positions: reconcilePositions,
  }), [ledgerState?.ledgerVersion, reconcileCash, reconcileDate, reconcilePositions, reconcileReason]);
  const currentReconcilePreview = reconcilePreview?.inputKey === reconciliationFormKey ? reconcilePreview : null;

  function readReconciliationTargets() {
    const cashTargets = BUCKETS.flatMap(({ id: bucket }) => CURRENCIES.map((currency) => ({
      bucket,
      currency,
      cash: parseAmount(reconcileCash[bucket][currency], `${bucket} ${currency} target cash`, true),
    })));
    const positionTargets: ReconciliationPositionTarget[] = reconcilePositions.map((row) => ({
      bucket: row.bucket,
      ticker: row.ticker,
      quantity: parseAmount(row.quantity, `${row.ticker} target quantity`, true),
      costBasisUsd: parseAmount(row.costBasisUsd, `${row.ticker} target cost basis`, true),
    }));
    return { cashTargets, positionTargets };
  }

  function previewReconciliation() {
    if (!ledgerState) return;
    setError("");
    setSuccess("");
    try {
      const { cashTargets, positionTargets } = readReconciliationTargets();
      const preview = buildReconciliationPreview({
        currentState: ledgerState,
        cashTargets,
        positionTargets,
        notes: reconcileReason,
      });
      setReconcilePreview({ ...preview, inputKey: reconciliationFormKey });
    } catch (reason) {
      setReconcilePreview(null);
      setError(reason instanceof Error ? reason.message : "Could not preview reconciliation adjustments");
    }
  }

  async function saveRecords(records: LedgerTransaction[], message: string): Promise<boolean> {
    if (records.length === 0) throw new Error("There is nothing to record");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await appendPortfolioLedgerTransactions(records);
      await reload();
      setSuccess(message);
      onLedgerChanged?.();
      return true;
    } catch (reason) {
      setError(readableLedgerError(reason));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function removeActivity(row: PortfolioActivityRow) {
    const label = `${humanType(row.type)}${row.ticker ? ` · ${row.ticker}` : ""}`;
    if (!window.confirm(`Remove ${label} from the ledger and Activity history? This cannot be undone from the app.`)) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await removePortfolioLedgerTransactions(row.transactionIds);
      await reload();
      setSuccess(`${label} removed. Re-enter it under Record activity if it was meant to be recorded with different details.`);
      onLedgerChanged?.();
    } catch (reason) {
      setError(readableLedgerError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function submitOpening(event: FormEvent) {
    event.preventDefault();
    if (!ledgerState || transactions.length > 0) {
      setError("Opening balance is only available before the first ledger activity.");
      return;
    }
    try {
      const occurredAt = isoFromDateInput(openingDate);
      const recordedAt = new Date().toISOString();
      const records: LedgerTransaction[] = [];
      for (const { id: bucket } of BUCKETS) {
        for (const currency of CURRENCIES) {
          const cash = parseAmount(openingCash[bucket][currency], `${bucket} ${currency} opening cash`, true);
          if (cash > 0) records.push({
            transactionId: transactionId("opening", `${bucket}-${currency}`),
            occurredAt,
            recordedAt,
            type: "opening_balance",
            bucket,
            currency,
            cashDelta: cash,
            notes: "Opening balance from current pocket records",
            source: "manual",
          });
        }
      }
      for (const holding of openingHoldings) {
        if (holding.price == null) throw new Error(`${holding.bucket} ${holding.ticker} needs a positive entry price before opening balance can be created`);
        records.push({
          transactionId: transactionId("opening", `${holding.bucket}-${holding.ticker}`),
          occurredAt,
          recordedAt,
          type: "opening_balance",
          bucket: holding.bucket,
          ticker: holding.ticker,
          quantity: holding.quantity,
          price: holding.price,
          currency: "USD",
          notes: "Opening balance from current pocket records",
          source: "manual",
        });
      }
      await saveRecords(records, `Opening balance recorded: ${records.length} ledger entries.`);
    } catch (reason) {
      setError(readableLedgerError(reason));
    }
  }

  async function submitReconciliation(event: FormEvent) {
    event.preventDefault();
    if (!ledgerState) return;
    try {
      if (!currentReconcilePreview) {
        throw new Error("Preview the reconciliation changes again before recording them");
      }
      const occurredAt = isoFromDateInput(reconcileDate);
      const recordedAt = new Date().toISOString();
      const { cashTargets, positionTargets } = readReconciliationTargets();
      const records = buildReconciliationAdjustments({
        currentState: ledgerState,
        cashTargets,
        positionTargets,
        occurredAt,
        recordedAt,
        notes: reconcileReason,
        idFactory: (kind, index) => transactionId("reconcile", `${kind}-${index}`),
      });
      // Run the exact append payload through the full loaded ledger before any
      // Firestore write. This catches stale previews and backdated adjustments
      // that would be invalid once later activity is replayed in timestamp order.
      reducePortfolioLedger([...transactions, ...records]);
      const saved = await saveRecords(records, `Reconciliation recorded: ${records.length} adjustment${records.length === 1 ? "" : "s"}.`);
      if (saved) setReconcilePreview(null);
    } catch (reason) {
      setError(readableLedgerError(reason));
    }
  }

  async function submitActivity(event: FormEvent) {
    event.preventDefault();
    try {
      const occurredAt = isoFromDateInput(activityDate);
      const recordedAt = new Date().toISOString();
      const base = { occurredAt, recordedAt, source: "manual" as const };
      const notes = activityNotes.trim();
      let records: LedgerTransaction[];
      if (activityType === "deposit" || activityType === "withdrawal") {
        const amount = parseAmount(activityAmount, "Amount");
        const sign = activityType === "deposit" ? 1 : -1;
        records = [{ ...base, transactionId: transactionId("activity", activityType), type: activityType, bucket: activityBucket, currency: activityCurrency, cashDelta: sign * amount, externalFlow: sign * amount, ...(notes ? { notes } : {}) }];
      } else if (activityType === "buy" || activityType === "sell") {
        const ticker = activityTicker.trim().toUpperCase();
        if (!ticker) throw new Error("Ticker is required");
        const quantity = parseAmount(activityQuantity, "Quantity");
        const price = parseAmount(activityPrice, "Price");
        const fees = parseAmount(activityFees || "0", "Fees", true);
        const grossAmount = quantity * price;
        records = [{
          ...base,
          transactionId: transactionId("activity", `${activityType}-${ticker}`),
          type: activityType,
          bucket: activityBucket,
          ticker,
          quantity,
          price,
          grossAmount,
          fees,
          currency: "USD",
          cashDelta: activityType === "buy" ? -(grossAmount + fees) : grossAmount - fees,
          ...(notes ? { notes } : {}),
        }];
      } else if (activityType === "dividend") {
        const grossAmount = parseAmount(activityAmount, "Dividend amount");
        const fees = parseAmount(activityFees || "0", "Fees", true);
        if (grossAmount <= fees) throw new Error("Dividend amount must be greater than fees");
        const ticker = activityTicker.trim().toUpperCase();
        records = [{ ...base, transactionId: transactionId("activity", "dividend"), type: "dividend", bucket: activityBucket, ...(ticker ? { ticker } : {}), grossAmount, fees, currency: activityCurrency, cashDelta: grossAmount - fees, ...(notes ? { notes } : {}) }];
      } else if (activityType === "fee") {
        const fees = parseAmount(activityAmount, "Fee amount");
        records = [{ ...base, transactionId: transactionId("activity", "fee"), type: "fee", bucket: activityBucket, fees, currency: activityCurrency, cashDelta: -fees, ...(notes ? { notes } : {}) }];
      } else if (activityType === "transfer") {
        if (activityBucket === transferToBucket) throw new Error("Transfer source and destination must be different pockets");
        const transferId = transactionId("transfer", "group");
        if (transferMode === "cash") {
          const amount = parseAmount(activityAmount, "Transfer amount");
          records = [
            { ...base, transactionId: transactionId("transfer", "out"), type: "transfer", bucket: activityBucket, fromBucket: activityBucket, toBucket: transferToBucket, transferId, currency: activityCurrency, cashDelta: -amount, ...(notes ? { notes } : {}) },
            { ...base, transactionId: transactionId("transfer", "in"), type: "transfer", bucket: transferToBucket, fromBucket: activityBucket, toBucket: transferToBucket, transferId, currency: activityCurrency, cashDelta: amount, ...(notes ? { notes } : {}) },
          ];
        } else {
          const ticker = activityTicker.trim().toUpperCase();
          if (!ticker) throw new Error("Ticker is required for a position transfer");
          const quantity = parseAmount(activityQuantity, "Quantity");
          records = [
            { ...base, transactionId: transactionId("transfer", "position-out"), type: "transfer", bucket: activityBucket, fromBucket: activityBucket, toBucket: transferToBucket, transferId, ticker, quantity: -quantity, currency: "USD", ...(notes ? { notes } : {}) },
            { ...base, transactionId: transactionId("transfer", "position-in"), type: "transfer", bucket: transferToBucket, fromBucket: activityBucket, toBucket: transferToBucket, transferId, ticker, quantity, currency: "USD", ...(notes ? { notes } : {}) },
          ];
        }
      } else {
        if (activityCurrency === fxToCurrency) throw new Error("FX conversion must use two different currencies");
        const fromAmount = parseAmount(activityAmount, "FX amount out");
        const toAmount = parseAmount(activityPrice, "FX amount in");
        const transferId = transactionId("fx", "group");
        records = [
          { ...base, transactionId: transactionId("fx", "out"), type: "fx_conversion", bucket: activityBucket, transferId, currency: activityCurrency, cashDelta: -fromAmount, ...(notes ? { notes } : {}) },
          { ...base, transactionId: transactionId("fx", "in"), type: "fx_conversion", bucket: activityBucket, transferId, currency: fxToCurrency, cashDelta: toAmount, ...(notes ? { notes } : {}) },
        ];
      }
      const saved = await saveRecords(records, `${humanType(activityType)} recorded.`);
      if (saved) {
        setActivityAmount("");
        setActivityQuantity("");
        setActivityPrice("");
        setActivityTicker("");
        setActivityNotes("");
      }
    } catch (reason) {
      setError(readableLedgerError(reason));
    }
  }

  function updateCash(setter: typeof setOpeningCash, bucket: PortfolioBucket, currency: LedgerCurrency, value: string) {
    setter((current) => ({ ...current, [bucket]: { ...current[bucket], [currency]: value } }));
  }

  function updateReconcilePosition(index: number, field: "quantity" | "costBasisUsd", value: string) {
    setReconcilePositions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function addReconcilePosition() {
    const ticker = newReconcileTicker.trim().toUpperCase();
    if (!ticker) {
      setError("Enter a ticker before adding a reconciliation position");
      return;
    }
    if (reconcilePositions.some((row) => row.bucket === newReconcileBucket && row.ticker === ticker)) {
      setError(`${newReconcileBucket} / ${ticker} is already in the reconciliation table`);
      return;
    }
    setReconcilePositions((current) => [...current, {
      bucket: newReconcileBucket,
      ticker,
      quantity: "0",
      costBasisUsd: "0",
    }]);
    setNewReconcileTicker("");
    setError("");
  }

  const ledgerReady = Boolean(ledgerState && transactions.length > 0);

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold">Accounting workflow</h3>
              <span className="badge bg-indigo-50 text-indigo-700">USD base · weighted average</span>
              {ledgerState && <span className="badge bg-gray-100 text-gray-600">{ledgerState.ledgerVersion} ledger records</span>}
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">Initialize the ledger from current holdings, record activity as it happens, and use explicit adjustments when the ledger needs to be reconciled. Legacy snapshot history remains unchanged and estimated.</p>
          </div>
          {ledgerReady && <div className="text-right text-[11px] text-gray-500"><div>Cash: {formatMoney(ledgerState?.total.cash.USD, "USD")} USD · {formatMoney(ledgerState?.total.cash.IDR, "IDR")}</div><div>Positions: {Object.values(ledgerState?.buckets ?? {}).reduce((sum, bucket) => sum + Object.keys(bucket.positions).length, 0)}</div></div>}
        </div>
        <div className="mt-4 flex flex-wrap gap-1">
          {([...(transactions.length === 0 ? ["opening" as const] : []), "activity" as const, "reconcile" as const, "history" as const]).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${tab === item ? "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]" : "text-gray-500 hover:bg-gray-50"}`}>
              {item === "opening" ? "Opening balance" : item === "reconcile" ? "Reconcile" : item === "activity" ? "Record activity" : "Activity history"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 sm:mx-5">{error}</div>}
      {success && <div className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800 sm:mx-5">{success}</div>}
      {loading ? <div className="px-5 py-8 text-sm text-gray-400">Loading ledger and pocket records…</div> : (
        <>
          {tab === "opening" && transactions.length === 0 && (
            <form onSubmit={submitOpening} className="space-y-4 px-4 py-4 sm:px-5">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs leading-5 text-indigo-900">This creates the accurate-history starting point. It uses positive quantities and the existing entry price from each pocket; it does not turn the opening balance into a contribution.</div>
              {missingOpeningData.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">Add a positive entry price for: {missingOpeningData.map((holding) => `${holding.bucket}/${holding.ticker}`).join(", ")}.</div>}
              <label className="block max-w-xs"><span className="field-label">Effective date and time</span><input className="input-field w-full" type="datetime-local" value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} /></label>
              <div className="grid gap-3 md:grid-cols-3">
                {BUCKETS.map(({ id: bucket, label }) => <div key={bucket} className="rounded-xl border border-gray-100 p-3"><div className="text-xs font-bold text-gray-700">{label} opening cash</div><div className="mt-2 grid grid-cols-2 gap-2">{CURRENCIES.map((currency) => <label key={currency} className="text-[11px] text-gray-500">{currency}<input className="input-field mt-1 w-full" inputMode="decimal" value={openingCash[bucket][currency]} onChange={(event) => updateCash(setOpeningCash, bucket, currency, event.target.value)} /></label>)}</div></div>)}
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Pocket</th><th className="px-3 py-2">Ticker</th><th className="px-3 py-2">Quantity</th><th className="px-3 py-2">Weighted-average cost</th></tr></thead><tbody className="divide-y divide-gray-100">{openingHoldings.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-gray-400">No positive quantities found in the current pocket records.</td></tr> : openingHoldings.map((holding) => <tr key={`${holding.bucket}-${holding.ticker}`}><td className="px-3 py-2 capitalize">{holding.bucket}</td><td className="px-3 py-2 font-mono font-semibold">{holding.ticker}</td><td className="px-3 py-2">{formatNumber(holding.quantity)}</td><td className="px-3 py-2">{holding.price == null ? "Missing" : formatMoney(holding.price, "USD")}</td></tr>)}</tbody></table></div>
              <button className="btn btn-primary" type="submit" disabled={saving || missingOpeningData.length > 0 || (openingHoldings.length === 0 && Object.values(openingCash).every((cash) => Number(cash.USD) <= 0 && Number(cash.IDR) <= 0))}>{saving ? "Recording…" : "Create opening balance"}</button>
            </form>
          )}

          {tab === "activity" && <form onSubmit={submitActivity} className="space-y-4 px-4 py-4 sm:px-5">
            {activityType === "buy" && <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs leading-5 text-indigo-900"><strong>This records a new buy, not an edit.</strong> A buy spends USD cash in the selected pocket. To move sale proceeds between pockets, use <strong>Pocket transfer → Cash</strong> first. To move an existing holding, use <strong>Pocket transfer → Position</strong> instead.</div>}
            <div className="grid gap-3 md:grid-cols-4">
              <label><span className="field-label">Activity</span><select className="input-field w-full" value={activityType} onChange={(event) => setActivityType(event.target.value as ActivityType)}>{ACTIVITY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label><span className="field-label">Pocket</span><select className="input-field w-full" value={activityBucket} onChange={(event) => setActivityBucket(event.target.value as PortfolioBucket)}>{BUCKETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              {activityType !== "transfer" && <label><span className="field-label">Currency</span><select className="input-field w-full" value={activityCurrency} onChange={(event) => setActivityCurrency(event.target.value as LedgerCurrency)}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></label>}
              <label><span className="field-label">Occurred at</span><input className="input-field w-full" type="datetime-local" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} /></label>
            </div>
            {activityType === "transfer" && <div className="grid gap-3 md:grid-cols-4"><label><span className="field-label">Transfer type</span><select className="input-field w-full" value={transferMode} onChange={(event) => setTransferMode(event.target.value as TransferMode)}><option value="cash">Cash</option><option value="position">Position</option></select></label><label><span className="field-label">To pocket</span><select className="input-field w-full" value={transferToBucket} onChange={(event) => setTransferToBucket(event.target.value as PortfolioBucket)}>{BUCKETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{transferMode === "cash" && <label><span className="field-label">Currency</span><select className="input-field w-full" value={activityCurrency} onChange={(event) => setActivityCurrency(event.target.value as LedgerCurrency)}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></label>}</div>}
            {activityType === "fx_conversion" && <div className="grid gap-3 md:grid-cols-3"><label><span className="field-label">Currency out</span><select className="input-field w-full" value={activityCurrency} onChange={(event) => setActivityCurrency(event.target.value as LedgerCurrency)}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></label><label><span className="field-label">Currency in</span><select className="input-field w-full" value={fxToCurrency} onChange={(event) => setFxToCurrency(event.target.value as LedgerCurrency)}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div>}
            <div className="grid gap-3 md:grid-cols-4">
              {(activityType === "buy" || activityType === "sell" || (activityType === "transfer" && transferMode === "position") || activityType === "dividend") && <label><span className="field-label">Ticker (optional for dividend)</span><input className="input-field w-full uppercase" value={activityTicker} onChange={(event) => setActivityTicker(event.target.value)} placeholder="AAPL" /></label>}
              {(activityType === "buy" || activityType === "sell" || (activityType === "transfer" && transferMode === "position")) && <label><span className="field-label">Quantity</span><input className="input-field w-full" inputMode="decimal" value={activityQuantity} onChange={(event) => setActivityQuantity(event.target.value)} /></label>}
              {(activityType === "buy" || activityType === "sell") && <label><span className="field-label">Execution price (USD)</span><input className="input-field w-full" inputMode="decimal" value={activityPrice} onChange={(event) => setActivityPrice(event.target.value)} /></label>}
              {activityType === "fx_conversion" && <><label><span className="field-label">Amount out</span><input className="input-field w-full" inputMode="decimal" value={activityAmount} onChange={(event) => setActivityAmount(event.target.value)} /></label><label><span className="field-label">Amount in</span><input className="input-field w-full" inputMode="decimal" value={activityPrice} onChange={(event) => setActivityPrice(event.target.value)} /></label></>}
              {activityType !== "fx_conversion" && !(activityType === "buy" || activityType === "sell") && !(activityType === "transfer" && transferMode === "position") && <label><span className="field-label">Amount</span><input className="input-field w-full" inputMode="decimal" value={activityAmount} onChange={(event) => setActivityAmount(event.target.value)} /></label>}
              {(activityType === "buy" || activityType === "sell" || activityType === "dividend") && <label><span className="field-label">Fees</span><input className="input-field w-full" inputMode="decimal" value={activityFees} onChange={(event) => setActivityFees(event.target.value)} /></label>}
              <label className="md:col-span-2"><span className="field-label">Note</span><input className="input-field w-full" value={activityNotes} onChange={(event) => setActivityNotes(event.target.value)} placeholder="Optional accounting note" /></label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving || !ledgerReady}>{saving ? "Recording…" : `Record new ${humanType(activityType).toLowerCase()}`}</button>
            {!ledgerReady && <p className="text-xs text-amber-700">Create the opening balance first. Activity entry becomes available after the ledger has a starting state.</p>}
          </form>}

          {tab === "reconcile" && <form onSubmit={submitReconciliation} className="space-y-4 px-4 py-4 sm:px-5">
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900">Reconciliation compares the ledger with the current pocket records. It appends adjustment entries and leaves the legacy pocket documents and v1 snapshots untouched.</div>
            <div className="grid gap-3 md:grid-cols-3"><label><span className="field-label">Effective date and time</span><input className="input-field w-full" type="datetime-local" value={reconcileDate} onChange={(event) => setReconcileDate(event.target.value)} /></label><label className="md:col-span-2"><span className="field-label">Reason (required)</span><input className="input-field w-full" value={reconcileReason} onChange={(event) => setReconcileReason(event.target.value)} /></label></div>
            <div className="grid gap-3 md:grid-cols-3">{BUCKETS.map(({ id: bucket, label }) => <div key={bucket} className="rounded-xl border border-gray-100 p-3"><div className="text-xs font-bold text-gray-700">{label} target cash</div><div className="mt-2 grid grid-cols-2 gap-2">{CURRENCIES.map((currency) => <label key={currency} className="text-[11px] text-gray-500">{currency}<input className="input-field mt-1 w-full" inputMode="decimal" value={reconcileCash[bucket][currency]} onChange={(event) => updateCash(setReconcileCash, bucket, currency, event.target.value)} /></label>)}</div></div>)}</div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><div className="text-xs font-bold text-indigo-900">Add a broker position</div><p className="mt-1 text-[11px] leading-5 text-indigo-800">Use this when a position exists in the broker statement but is missing from the legacy pocket records. Add it here, then enter its target quantity and USD cost below.</p><div className="mt-2 flex flex-wrap items-end gap-2"><label className="min-w-36 flex-1"><span className="field-label">Pocket</span><select className="input-field w-full" value={newReconcileBucket} onChange={(event) => setNewReconcileBucket(event.target.value as PortfolioBucket)}>{BUCKETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="min-w-36 flex-1"><span className="field-label">Ticker</span><input className="input-field w-full uppercase" value={newReconcileTicker} onChange={(event) => setNewReconcileTicker(event.target.value)} placeholder="AAPL" /></label><button className="btn btn-secondary" type="button" onClick={addReconcilePosition}>Add position</button></div></div>
            <div className="overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Pocket / ticker</th><th className="px-3 py-2">Ledger quantity</th><th className="px-3 py-2">Ledger cost</th><th className="px-3 py-2">Target quantity</th><th className="px-3 py-2">Target cost (USD)</th></tr></thead><tbody className="divide-y divide-gray-100">{reconcilePositions.length === 0 ? <tr><td colSpan={5} className="px-3 py-4 text-gray-400">No positions to reconcile.</td></tr> : reconcilePositions.map((row, index) => { const current = ledgerState?.buckets[row.bucket].positions[row.ticker]; return <tr key={`${row.bucket}-${row.ticker}`}><td className="px-3 py-2"><span className="capitalize text-gray-500">{row.bucket}</span><span className="ml-2 font-mono font-semibold">{row.ticker}</span></td><td className="px-3 py-2">{formatNumber(current?.quantity ?? 0)}</td><td className="px-3 py-2">{formatMoney(current?.costBasisUsd, "USD")}</td><td className="px-3 py-2"><input className="input-field w-28" inputMode="decimal" value={row.quantity} onChange={(event) => updateReconcilePosition(index, "quantity", event.target.value)} /></td><td className="px-3 py-2"><input className="input-field w-32" inputMode="decimal" value={row.costBasisUsd} onChange={(event) => updateReconcilePosition(index, "costBasisUsd", event.target.value)} /></td></tr>; })}</tbody></table></div>
            {currentReconcilePreview ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><strong>Preview only:</strong> {currentReconcilePreview.hasChanges ? `${currentReconcilePreview.adjustmentCount} adjustment ${currentReconcilePreview.adjustmentCount === 1 ? "entry" : "entries"} would be appended.` : "The targets already match the ledger; there is nothing to append."}</div>
                  <span className="badge bg-white text-indigo-700">Nothing recorded</span>
                </div>
                {currentReconcilePreview.hasChanges && <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white">
                    <table className="min-w-full text-left text-[11px]"><thead className="bg-indigo-50/60 uppercase tracking-wide text-indigo-700"><tr><th className="px-2 py-1.5">Cash</th><th className="px-2 py-1.5">Current → target</th><th className="px-2 py-1.5">Delta</th></tr></thead><tbody className="divide-y divide-indigo-50">{currentReconcilePreview.cash.filter((row) => Math.abs(row.deltaCash) > 1e-8).map((row) => <tr key={`${row.bucket}-${row.currency}`}><td className="px-2 py-1.5 capitalize">{row.bucket} · {row.currency}</td><td className="px-2 py-1.5">{formatMoney(row.currentCash, row.currency)} → {formatMoney(row.targetCash, row.currency)}</td><td className={`px-2 py-1.5 font-semibold ${row.deltaCash >= 0 ? "text-green-600" : "text-red-500"}`}>{formatSignedMoney(row.deltaCash, row.currency)}</td></tr>)}</tbody></table>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white">
                    <table className="min-w-full text-left text-[11px]"><thead className="bg-indigo-50/60 uppercase tracking-wide text-indigo-700"><tr><th className="px-2 py-1.5">Position</th><th className="px-2 py-1.5">Quantity Δ</th><th className="px-2 py-1.5">Cost basis Δ</th></tr></thead><tbody className="divide-y divide-indigo-50">{currentReconcilePreview.positions.filter((row) => Math.abs(row.quantityDelta) > 1e-8 || Math.abs(row.costBasisDeltaUsd) > 1e-8).map((row) => <tr key={`${row.bucket}-${row.ticker}`}><td className="px-2 py-1.5"><span className="capitalize">{row.bucket}</span> · <span className="font-mono font-semibold">{row.ticker}</span><div className="text-[10px] text-gray-400">{formatNumber(row.currentQuantity)} → {formatNumber(row.targetQuantity)} · avg {formatMoney(row.targetAverageCostUsd, "USD")}</div></td><td className={`px-2 py-1.5 font-semibold ${row.quantityDelta >= 0 ? "text-green-600" : "text-red-500"}`}>{formatSignedNumber(row.quantityDelta)}</td><td className={`px-2 py-1.5 font-semibold ${row.costBasisDeltaUsd >= 0 ? "text-green-600" : "text-red-500"}`}>{formatSignedMoney(row.costBasisDeltaUsd, "USD")}</td></tr>)}</tbody></table>
                  </div>
                </div>}
              </div>
            ) : reconcilePreview ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">The targets changed after the last preview. Preview again before recording.</div>
            ) : (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">Preview the cash and position deltas before anything is appended to the ledger.</div>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary" type="button" onClick={previewReconciliation} disabled={saving || !ledgerReady}>Preview changes</button>
              <button className="btn btn-primary" type="submit" disabled={saving || !ledgerReady || !currentReconcilePreview?.hasChanges}>{saving ? "Recording…" : "Record reconciliation"}</button>
            </div>
          </form>}

          {tab === "history" && <div className="space-y-3 px-4 py-4 sm:px-5"><div className="grid gap-2 md:grid-cols-5"><select className="input-field" value={historyType} onChange={(event) => setHistoryType(event.target.value)}><option value="all">All activity types</option>{[...ACTIVITY_TYPES, { id: "opening_balance" as const, label: "Opening balance" }, { id: "reconciliation_adjustment" as const, label: "Reconciliation" }].map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select className="input-field" value={historyBucket} onChange={(event) => setHistoryBucket(event.target.value)}><option value="all">Total portfolio</option>{BUCKETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input className="input-field" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} aria-label="Activity from date" /><input className="input-field" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} aria-label="Activity to date" /><input className="input-field" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Filter ticker or note" /></div><div className="overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Occurred / recorded</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Pocket / ticker</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Gross / amount</th><th className="px-3 py-2">Fees</th><th className="px-3 py-2">Net cash</th><th className="px-3 py-2">Cost basis</th><th className="px-3 py-2">Realized P/L</th><th className="px-3 py-2">Remaining</th><th className="px-3 py-2">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{historyRows.length === 0 ? <tr><td colSpan={12} className="px-3 py-6 text-center text-gray-400">No ledger activity matches these filters.</td></tr> : historyRows.map((row) => { const canRemove = row.transactionIds.every((id) => { const transaction = transactions.find((item) => item.transactionId === id); return Boolean(transaction && transaction.source === "manual" && transaction.type !== "opening_balance" && transaction.type !== "reconciliation_adjustment"); }); return <ActivityRowView key={row.transactionIds.join("/")} row={row} onRemove={canRemove ? () => { void removeActivity(row); } : undefined} />; })}</tbody></table></div></div>}
        </>
      )}
    </section>
  );
}

function ActivityRowView({ row, onRemove }: { row: PortfolioActivityRow; onRemove?: () => void }) {
  const pocket = row.fromBucket && row.toBucket ? `${row.fromBucket} → ${row.toBucket}` : row.bucket ?? "—";
  const amount = row.grossAmount ?? (row.cashDelta != null ? Math.abs(row.cashDelta) : undefined);
  const signedCash = row.cashDelta;
  return <tr className="align-top hover:bg-gray-50"><td className="whitespace-nowrap px-3 py-2"><div className="font-semibold">{row.occurredAt.slice(0, 16).replace("T", " ")}</div><div className="text-[10px] text-gray-400">recorded {row.recordedAt.slice(0, 16).replace("T", " ")}{row.isLate ? " · late" : ""}</div></td><td className="px-3 py-2"><span className="font-semibold">{humanType(row.type)}</span>{row.notes && <div className="mt-0.5 max-w-xs text-[10px] text-gray-400">{row.notes}</div>}</td><td className="px-3 py-2"><div className="capitalize text-gray-600">{pocket}</div>{row.ticker && <div className="font-mono font-semibold">{row.ticker}</div>}</td><td className="px-3 py-2">{row.quantity == null ? "—" : formatNumber(row.quantity)}</td><td className="px-3 py-2">{row.price == null ? "—" : formatMoney(row.price, "USD")}</td><td className="px-3 py-2">{amount == null ? "—" : `${formatMoney(amount, row.currency)}${row.currency ? ` ${row.currency}` : ""}`}</td><td className="px-3 py-2">{row.fees == null ? "—" : `${formatMoney(row.fees, row.currency)}${row.currency ? ` ${row.currency}` : ""}`}</td><td className={`px-3 py-2 ${(signedCash ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>{signedCash == null ? "—" : `${signedCash >= 0 ? "+" : ""}${formatMoney(signedCash, row.currency)}${row.currency ? ` ${row.currency}` : ""}`}</td><td className="px-3 py-2">{row.costBasisUsd == null ? "—" : formatMoney(row.costBasisUsd, "USD")}</td><td className={`px-3 py-2 font-semibold ${(row.realizedGainUsd ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>{row.realizedGainUsd == null ? "—" : formatMoney(row.realizedGainUsd, "USD")}</td><td className="px-3 py-2">{row.remainingQuantity == null ? "—" : formatNumber(row.remainingQuantity)}</td><td className="px-3 py-2">{onRemove ? <button className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50" type="button" onClick={onRemove}>Remove</button> : <span className="text-gray-300">—</span>}</td></tr>;
}
