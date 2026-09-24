import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, deleteField, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import type { PortfolioBucket } from "./portfolioBuckets";
import type { PortfolioSnapshot } from "./portfolioPerformance";
import { normalizePortfolioSnapshot } from "./portfolioPerformance";
import {
  validatePersonalFinanceMonth,
  type PersonalFinanceMonthInput,
} from "./personalFinance";
import {
  ledgerTransactionsEqual,
  prepareLedgerAppend,
  prepareLedgerRemoval,
  reducePortfolioLedger,
  sortLedgerTransactions,
  type LedgerTransaction,
  type PortfolioLedgerState,
  type ReduceLedgerOptions,
} from "./portfolioLedger";

export async function loadStockData(ticker: string) {
  const ref = doc(db, "stocks", ticker);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Additive storage for long-term assumptions, judgments, and tracking fields.
export async function getLongTermAnalyses(): Promise<Record<string, Record<string, unknown>>> {
  const snap = await getDocs(collection(db, "long_term_analysis"));
  const result: Record<string, Record<string, unknown>> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveLongTermAnalysis(ticker: string, data: Record<string, unknown>) {
  await setDoc(doc(db, "long_term_analysis", ticker), { ...data, manual_updated_at: new Date().toISOString() }, { merge: true });
}

export async function saveBusinessQuality(ticker: string, data: object) {
  const ref = doc(db, "stocks", ticker);
  await setDoc(ref, { business_quality: { ...data, generated_at: new Date().toISOString() } }, { merge: true });
}

export async function saveVerdict(ticker: string, verdict: object) {
  const dated = { ...verdict, date: new Date().toISOString() };

  // Save as latest
  const ref = doc(db, "stocks", ticker);
  await setDoc(ref, { latest_verdict: dated }, { merge: true });

  // Save to history
  const histRef = collection(db, "verdict_history", ticker, "snapshots");
  await addDoc(histRef, dated);
}

// Stock status helpers (portfolio / watchlist membership)
export async function getPortfolioTickers(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "portfolio"));
  return new Set(snap.docs.map((d) => d.id));
}

export async function getWatchlistTickers(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "watchlist"));
  return new Set(snap.docs.map((d) => d.id));
}

// Custom stocks (added beyond the 54 seed stocks)
export async function getCustomStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "custom_stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveCustomStock(ticker: string, data: object) {
  await setDoc(doc(db, "custom_stocks", ticker), data);
}

export async function removeCustomStock(ticker: string) {
  await deleteDoc(doc(db, "custom_stocks", ticker));
}

// IHSG custom stocks (stored without .JK suffix as document ID)
export async function getIhsgCustomStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "custom_stocks_ihsg"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveIhsgCustomStock(ticker: string, data: object) {
  await setDoc(doc(db, "custom_stocks_ihsg", ticker), data);
}

export async function removeIhsgCustomStock(ticker: string) {
  await deleteDoc(doc(db, "custom_stocks_ihsg", ticker));
}

// IHSG Midterm/Swing watchlist — a separate, manually-managed ticker list
// independent from the IHSG "List" tab entries (stored without .JK suffix as document ID)
export async function getIhsgSwingStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "ihsg_swing_stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveIhsgSwingStock(ticker: string, data: object) {
  await setDoc(doc(db, "ihsg_swing_stocks", ticker), data);
}

export async function updateIhsgSwingEntryPrice(ticker: string, entryPrice: number | null) {
  await setDoc(doc(db, "ihsg_swing_stocks", ticker), { entry_price: entryPrice }, { merge: true });
}

export async function removeIhsgSwingStock(ticker: string) {
  await deleteDoc(doc(db, "ihsg_swing_stocks", ticker));
}

// US Swing watchlist — a separate, manually-managed ticker list independent
// from the US "List" tab entries (SEED_STOCKS + custom_stocks)
export async function getUsSwingStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "us_swing_stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveUsSwingStock(ticker: string, data: object) {
  await setDoc(doc(db, "us_swing_stocks", ticker), data);
}

export async function removeUsSwingStock(ticker: string) {
  await deleteDoc(doc(db, "us_swing_stocks", ticker));
}

export async function updateUsSwingStar(ticker: string, starred: boolean) {
  await setDoc(doc(db, "us_swing_stocks", ticker), { starred }, { merge: true });
}

export async function updateUsSwingPortfolio(ticker: string, inPortfolio: boolean) {
  await setDoc(doc(db, "us_swing_stocks", ticker), { in_portfolio: inPortfolio }, { merge: true });
}

// US Breakout watchlist — a separate, manually-managed ticker list independent
// from the US "List"/"Swing" tab entries. Tracks RSI/MACD divergence-off-a-low candidates.
export async function getUsBreakoutStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "us_breakout_stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveUsBreakoutStock(ticker: string, data: object) {
  await setDoc(doc(db, "us_breakout_stocks", ticker), data);
}

export async function removeUsBreakoutStock(ticker: string) {
  await deleteDoc(doc(db, "us_breakout_stocks", ticker));
}

export async function updateUsBreakoutStar(ticker: string, starred: boolean) {
  await setDoc(doc(db, "us_breakout_stocks", ticker), { starred }, { merge: true });
}

export async function updateUsBreakoutType(ticker: string, breakoutType: "benchmark" | "new") {
  await setDoc(doc(db, "us_breakout_stocks", ticker), { breakout_type: breakoutType }, { merge: true });
}

export type UsBreakoutListTrialCohort = "benchmark" | "control";

export interface UsBreakoutListTrialRecord {
  id: string;
  ticker: string;
  candidateDate: string;
  cohort: UsBreakoutListTrialCohort;
  note: string;
}

const US_BREAKOUT_LIST_TRIAL_COLLECTION = "us_breakout_list_trial";

export async function getUsBreakoutListTrialRecords(): Promise<UsBreakoutListTrialRecord[]> {
  const snap = await getDocs(collection(db, US_BREAKOUT_LIST_TRIAL_COLLECTION));
  const records: UsBreakoutListTrialRecord[] = [];
  snap.forEach((d) => {
    const data = d.data();
    if (typeof data.ticker !== "string" || typeof data.candidate_date !== "string") return;
    records.push({
      id: d.id,
      ticker: data.ticker,
      candidateDate: data.candidate_date,
      cohort: data.cohort === "control" ? "control" : "benchmark",
      note: typeof data.note === "string" ? data.note : "",
    });
  });
  return records.sort((a, b) => a.candidateDate.localeCompare(b.candidateDate) || a.ticker.localeCompare(b.ticker));
}

export async function saveUsBreakoutListTrialRecord(record: Omit<UsBreakoutListTrialRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, US_BREAKOUT_LIST_TRIAL_COLLECTION), {
    ticker: record.ticker,
    candidate_date: record.candidateDate,
    cohort: record.cohort,
    note: record.note,
    created_at: new Date().toISOString(),
  });
  return ref.id;
}

export async function removeUsBreakoutListTrialRecord(id: string) {
  await deleteDoc(doc(db, US_BREAKOUT_LIST_TRIAL_COLLECTION, id));
}

export interface UsBreakoutListTrialLiveRecord {
  id: string;
  ticker: string;
  addedAt: string;
  note: string;
}

const US_BREAKOUT_LIST_TRIAL_LIVE_COLLECTION = "us_breakout_list_trial_live";

export async function getUsBreakoutListTrialLiveRecords(): Promise<UsBreakoutListTrialLiveRecord[]> {
  const snap = await getDocs(collection(db, US_BREAKOUT_LIST_TRIAL_LIVE_COLLECTION));
  const records: UsBreakoutListTrialLiveRecord[] = [];
  snap.forEach((d) => {
    const data = d.data();
    if (typeof data.ticker !== "string" || typeof data.added_at !== "string") return;
    records.push({
      id: d.id,
      ticker: data.ticker,
      addedAt: data.added_at,
      note: typeof data.note === "string" ? data.note : "",
    });
  });
  return records.sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.ticker.localeCompare(b.ticker));
}

export async function saveUsBreakoutListTrialLiveRecord(record: Omit<UsBreakoutListTrialLiveRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, US_BREAKOUT_LIST_TRIAL_LIVE_COLLECTION), {
    ticker: record.ticker,
    added_at: record.addedAt,
    note: record.note,
  });
  return ref.id;
}

export async function removeUsBreakoutListTrialLiveRecord(id: string) {
  await deleteDoc(doc(db, US_BREAKOUT_LIST_TRIAL_LIVE_COLLECTION, id));
}

// Beaten Down — Coiling Reversal watchlist — a separate, manually-managed ticker list
export async function getCoilingReversalStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "coiling_reversal_stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveCoilingReversalStock(ticker: string, data: object) {
  await setDoc(doc(db, "coiling_reversal_stocks", ticker), data);
}

export async function removeCoilingReversalStock(ticker: string) {
  await deleteDoc(doc(db, "coiling_reversal_stocks", ticker));
}

// Beaten Down — Potential Bagger Reversal watchlist — a separate, manually-managed ticker list
export async function getBaggerReversalStocks(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "bagger_reversal_stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveBaggerReversalStock(ticker: string, data: object) {
  await setDoc(doc(db, "bagger_reversal_stocks", ticker), data);
}

export async function removeBaggerReversalStock(ticker: string) {
  await deleteDoc(doc(db, "bagger_reversal_stocks", ticker));
}

// Screener Draft — raw imports from finviz screener runs, pending triage into US-Swing
export async function getScreenerDraft(): Promise<Record<string, { company: string | null; added_at: string; rank?: number }>> {
  const snap = await getDocs(collection(db, "screener_draft"));
  const result: Record<string, { company: string | null; added_at: string; rank?: number }> = {};
  snap.forEach((d) => { result[d.id] = d.data() as { company: string | null; added_at: string; rank?: number }; });
  return result;
}

export async function importScreenerDraftEntries(entries: { ticker: string; company: string | null; rank?: number }[]) {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  for (const { ticker, company, rank } of entries) {
    batch.set(doc(db, "screener_draft", ticker), { company, added_at: now, ...(rank !== undefined ? { rank } : {}) });
  }
  await batch.commit();
}

export async function removeScreenerDraftEntry(ticker: string) {
  await deleteDoc(doc(db, "screener_draft", ticker));
}

// Refreshes rank (and company) on draft entries that already exist, without touching
// added_at — a screener re-run's market-cap order can shift for tickers already in the
// draft, and their rank would otherwise stay stuck at whatever it was on first import
// (or unset, for anything imported before rank existed).
export async function updateScreenerDraftRanks(entries: { ticker: string; company: string | null; rank?: number }[]) {
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const { ticker, company, rank } of entries.slice(i, i + chunkSize)) {
      batch.set(doc(db, "screener_draft", ticker), { company, ...(rank !== undefined ? { rank } : {}) }, { merge: true });
    }
    await batch.commit();
  }
}

// Screener Excluded — exclusions added from the app itself (on top of the static doc-sourced list),
// so a ticker excluded once doesn't reappear on the next screener import.
export async function getScreenerExcludedTickers(): Promise<Record<string, { reason: string | null; excluded_at: string }>> {
  const snap = await getDocs(collection(db, "screener_excluded"));
  const result: Record<string, { reason: string | null; excluded_at: string }> = {};
  snap.forEach((d) => { result[d.id] = d.data() as { reason: string | null; excluded_at: string }; });
  return result;
}

export async function excludeScreenerTicker(ticker: string, reason: string | null = null) {
  await setDoc(doc(db, "screener_excluded", ticker), { reason, excluded_at: new Date().toISOString() });
}

// Bulk version of excludeScreenerTicker + removeScreenerDraftEntry, chunked to stay under
// Firestore's 500-writes-per-batch limit. Each ticker writes an exclusion doc BEFORE its
// draft entry is deleted (both in the same batch/commit) so a failed commit leaves every
// ticker exactly as it was — never deleted from the draft without a recorded exclusion.
export async function excludeScreenerTickersBulk(tickers: string[], reason: string | null = null) {
  const now = new Date().toISOString();
  const chunkSize = 250; // 2 writes per ticker, well under the 500-op batch limit
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const ticker of chunk) {
      batch.set(doc(db, "screener_excluded", ticker), { reason, excluded_at: now });
      batch.delete(doc(db, "screener_draft", ticker));
    }
    await batch.commit();
  }
}

export async function unexcludeScreenerTicker(ticker: string) {
  await deleteDoc(doc(db, "screener_excluded", ticker));
}

// Overrides a ticker from the static doc-sourced exclusion list (lib/screenerExclusions.ts),
// which can't itself be edited from the app — deleting a doc-sourced entry from the
// Excluded tab writes one of these instead so it stops showing up as excluded.
export async function getScreenerExclusionOverrides(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "screener_exclusion_overrides"));
  return new Set(snap.docs.map((d) => d.id));
}

export async function addScreenerExclusionOverride(ticker: string) {
  await setDoc(doc(db, "screener_exclusion_overrides", ticker), { added_at: new Date().toISOString() });
}

// Beaten Down Screener Draft — same shape as Screener Draft above, but sourced from the
// 40%+-below-all-time-high finviz screener instead of the near-52wk-high one. Kept in
// separate collections since it's a fully parallel triage list with its own Excluded set —
// no static doc-sourced exclusion list here, everything is fair game except what's already
// been excluded from this tab.
export async function getScreenerDraftBeatenDown(): Promise<Record<string, { company: string | null; added_at: string; rank?: number }>> {
  const snap = await getDocs(collection(db, "screener_draft_beatendown"));
  const result: Record<string, { company: string | null; added_at: string; rank?: number }> = {};
  snap.forEach((d) => { result[d.id] = d.data() as { company: string | null; added_at: string; rank?: number }; });
  return result;
}

export async function importScreenerDraftEntriesBeatenDown(entries: { ticker: string; company: string | null; rank?: number }[]) {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  for (const { ticker, company, rank } of entries) {
    batch.set(doc(db, "screener_draft_beatendown", ticker), { company, added_at: now, ...(rank !== undefined ? { rank } : {}) });
  }
  await batch.commit();
}

export async function removeScreenerDraftEntryBeatenDown(ticker: string) {
  await deleteDoc(doc(db, "screener_draft_beatendown", ticker));
}

export async function updateScreenerDraftRanksBeatenDown(entries: { ticker: string; company: string | null; rank?: number }[]) {
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const { ticker, company, rank } of entries.slice(i, i + chunkSize)) {
      batch.set(doc(db, "screener_draft_beatendown", ticker), { company, ...(rank !== undefined ? { rank } : {}) }, { merge: true });
    }
    await batch.commit();
  }
}

export async function getScreenerExcludedTickersBeatenDown(): Promise<Record<string, { reason: string | null; excluded_at: string }>> {
  const snap = await getDocs(collection(db, "screener_excluded_beatendown"));
  const result: Record<string, { reason: string | null; excluded_at: string }> = {};
  snap.forEach((d) => { result[d.id] = d.data() as { reason: string | null; excluded_at: string }; });
  return result;
}

export async function excludeScreenerTickerBeatenDown(ticker: string, reason: string | null = null) {
  await setDoc(doc(db, "screener_excluded_beatendown", ticker), { reason, excluded_at: new Date().toISOString() });
}

export async function excludeScreenerTickersBulkBeatenDown(tickers: string[], reason: string | null = null) {
  const now = new Date().toISOString();
  const chunkSize = 250;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const ticker of chunk) {
      batch.set(doc(db, "screener_excluded_beatendown", ticker), { reason, excluded_at: now });
      batch.delete(doc(db, "screener_draft_beatendown", ticker));
    }
    await batch.commit();
  }
}

export async function unexcludeScreenerTickerBeatenDown(ticker: string) {
  await deleteDoc(doc(db, "screener_excluded_beatendown", ticker));
}

// Portfolio
export async function getPortfolio(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "portfolio"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function savePortfolioEntry(ticker: string, data: object) {
  await setDoc(doc(db, "portfolio", ticker), data);
}

export async function removePortfolioEntry(ticker: string) {
  await deleteDoc(doc(db, "portfolio", ticker));
}

// Portfolio divisions — independent, manually-managed ticker lists ("Long Term",
// "Index", "Treasury"), each holding entry_price/entry_value alongside name/industry.
export type PortfolioDivision = PortfolioBucket;

function portfolioDivisionCollection(division: PortfolioDivision) {
  return `portfolio_${division}`;
}

export async function getPortfolioDivisionStocks(division: PortfolioDivision): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, portfolioDivisionCollection(division)));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function savePortfolioDivisionStock(division: PortfolioDivision, ticker: string, data: object) {
  await setDoc(doc(db, portfolioDivisionCollection(division), ticker), data, { merge: true });
}

export async function removePortfolioDivisionStock(division: PortfolioDivision, ticker: string) {
  await deleteDoc(doc(db, portfolioDivisionCollection(division), ticker));
}

export async function updatePortfolioDivisionEntry(
  division: PortfolioDivision,
  ticker: string,
  data: {
    entry_price?: number | null; entry_quantity?: number | null;
  }
) {
  await setDoc(doc(db, portfolioDivisionCollection(division), ticker), data, { merge: true });
}

const PORTFOLIO_LEDGER_COLLECTION = "portfolio_ledger";

// Append-only accounting activity. Document ids are transaction ids so a retry can be
// safely treated as an idempotent no-op, while a conflicting payload is rejected.
export async function getPortfolioLedgerTransactions(): Promise<LedgerTransaction[]> {
  const snap = await getDocs(collection(db, PORTFOLIO_LEDGER_COLLECTION));
  return sortLedgerTransactions(snap.docs.map((item) => item.data() as LedgerTransaction));
}

export async function getPortfolioLedgerTransaction(transactionId: string): Promise<LedgerTransaction | null> {
  const snap = await getDoc(doc(db, PORTFOLIO_LEDGER_COLLECTION, transactionId));
  return snap.exists() ? snap.data() as LedgerTransaction : null;
}

export async function getPortfolioLedgerState(options?: ReduceLedgerOptions): Promise<PortfolioLedgerState> {
  const transactions = await getPortfolioLedgerTransactions();
  return reducePortfolioLedger(transactions, options);
}

export async function appendPortfolioLedgerTransactions(transactions: readonly LedgerTransaction[]): Promise<void> {
  if (transactions.length === 0) return;
  const existingTransactions = await getPortfolioLedgerTransactions();
  // Validate the full append contract before the write. The transaction below still
  // rechecks document payloads because another client may have written concurrently.
  prepareLedgerAppend(existingTransactions, transactions);
  const refs = transactions.map((item) => doc(db, PORTFOLIO_LEDGER_COLLECTION, item.transactionId));

  await runTransaction(db, async (transaction) => {
    const existing = [] as (LedgerTransaction | null)[];
    for (const ref of refs) {
      const snapshot = await transaction.get(ref);
      existing.push(snapshot.exists() ? snapshot.data() as LedgerTransaction : null);
    }
    for (let index = 0; index < transactions.length; index += 1) {
      const current = transactions[index];
      const saved = existing[index];
      if (saved && !ledgerTransactionsEqual(saved, current)) {
        throw new Error(`Ledger transaction ${current.transactionId} already exists with different data`);
      }
      if (!saved) transaction.set(refs[index], current);
    }
  });
}

export async function appendPortfolioLedgerTransaction(transaction: LedgerTransaction): Promise<void> {
  await appendPortfolioLedgerTransactions([transaction]);
}

/**
 * Removes manually entered activity after validating that the remaining ledger
 * is still a valid, replayable accounting history. This is a deliberate
 * correction path for mistaken manual entries; opening balances and
 * reconciliation records remain immutable.
 */
export async function removePortfolioLedgerTransactions(transactionIds: readonly string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const existingTransactions = await getPortfolioLedgerTransactions();
  const plan = prepareLedgerRemoval(existingTransactions, transactionIds);
  const refs = plan.removed.map((item) => doc(db, PORTFOLIO_LEDGER_COLLECTION, item.transactionId));

  await runTransaction(db, async (transaction) => {
    const existing = [] as (LedgerTransaction | null)[];
    for (const ref of refs) {
      const snapshot = await transaction.get(ref);
      existing.push(snapshot.exists() ? snapshot.data() as LedgerTransaction : null);
    }
    for (let index = 0; index < plan.removed.length; index += 1) {
      const saved = existing[index];
      const current = plan.removed[index];
      if (!saved || !ledgerTransactionsEqual(saved, current)) {
        throw new Error(`Ledger transaction ${current.transactionId} changed before it could be removed`);
      }
    }
    for (const ref of refs) transaction.delete(ref);
  });
}

// Immutable daily portfolio summaries. The US session date is the document id, making
// scheduled retries idempotent while preserving the position-level inputs for auditing.
export async function getPortfolioPerformanceSnapshots(): Promise<PortfolioSnapshot[]> {
  const snap = await getDocs(collection(db, "portfolio_performance_snapshots"));
  return snap.docs
    .map((item) => normalizePortfolioSnapshot(item.data() as PortfolioSnapshot))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

export async function getPortfolioPerformanceSnapshot(sessionDate: string): Promise<PortfolioSnapshot | null> {
  const snap = await getDoc(doc(db, "portfolio_performance_snapshots", sessionDate));
  return snap.exists() ? normalizePortfolioSnapshot(snap.data() as PortfolioSnapshot) : null;
}

export async function savePortfolioPerformanceSnapshot(snapshot: PortfolioSnapshot) {
  await setDoc(doc(db, "portfolio_performance_snapshots", snapshot.sessionDate), snapshot);
}

export interface PersonalFinanceMonthRecord extends PersonalFinanceMonthInput {
  createdAt: string;
  updatedAt: string;
}

const PERSONAL_FINANCE_COLLECTION = "personal_finance_months";

export async function getPersonalFinanceMonths(): Promise<PersonalFinanceMonthRecord[]> {
  const snap = await getDocs(collection(db, PERSONAL_FINANCE_COLLECTION));
  return snap.docs
    .map((item) => {
      const data = item.data();
      const record: PersonalFinanceMonthRecord = {
        month: data.month as string,
        income: data.income as number,
        creditCardPayment: data.credit_card_payment as number,
        futurePlanningInstallments: data.future_planning_installments as number,
        actualMonthlySpending: data.actual_monthly_spending == null ? null : data.actual_monthly_spending as number,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
      };
      if (record.month !== item.id) {
        throw new Error(`Personal finance month ${item.id} has a mismatched month field`);
      }
      validatePersonalFinanceMonth(record);
      if (typeof record.createdAt !== "string" || typeof record.updatedAt !== "string") {
        throw new Error(`Personal finance month ${item.id} has invalid timestamps`);
      }
      return record;
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function savePersonalFinanceMonth(
  input: PersonalFinanceMonthInput,
  createdAt?: string,
): Promise<PersonalFinanceMonthRecord> {
  validatePersonalFinanceMonth(input);
  const now = new Date().toISOString();
  const record: PersonalFinanceMonthRecord = {
    ...input,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
  await setDoc(doc(db, PERSONAL_FINANCE_COLLECTION, input.month), {
    month: record.month,
    income: record.income,
    credit_card_payment: record.creditCardPayment,
    future_planning_installments: record.futurePlanningInstallments,
    actual_monthly_spending: record.actualMonthlySpending,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  });
  return record;
}

export async function removePersonalFinanceMonth(month: string): Promise<void> {
  validatePersonalFinanceMonth({
    month,
    income: 0,
    creditCardPayment: 0,
    futurePlanningInstallments: 0,
    actualMonthlySpending: null,
  });
  await deleteDoc(doc(db, PERSONAL_FINANCE_COLLECTION, month));
}

// Watchlist
export async function getWatchlist(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "watchlist"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function saveWatchlistEntry(ticker: string, data: object) {
  await setDoc(doc(db, "watchlist", ticker), data);
}

export async function removeWatchlistEntry(ticker: string) {
  await deleteDoc(doc(db, "watchlist", ticker));
}

export async function updateWatchlistAlertState(ticker: string, data: { triggered?: boolean; last_price_side?: "above" | "below" }) {
  await setDoc(doc(db, "watchlist", ticker), data, { merge: true });
}

export async function updateWatchlistEarningsAlert(ticker: string, data: { earnings_alert?: boolean; earnings_date?: string | null; earnings_alert_fired?: boolean }) {
  await setDoc(doc(db, "watchlist", ticker), data, { merge: true });
}

// Standalone price alerts (any ticker, independent of watchlist/portfolio membership).
// Docs use auto-generated ids (not the ticker) so a ticker can have multiple alerts — e.g. installment buys at different prices.
export async function getPriceAlerts(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "price_alerts"));
  const result: Record<string, object> = {};
  snap.forEach((d) => { result[d.id] = { id: d.id, ...d.data() }; });
  return result;
}

export async function savePriceAlert(ticker: string, alertPrice: number) {
  await addDoc(collection(db, "price_alerts"), {
    ticker,
    alert_price: alertPrice,
    created_at: new Date().toISOString(),
  });
}

// No target price yet — just ping once earnings is reported, notes carries the $ amount to deploy.
export async function savePostEarningsAlert(ticker: string, notes: string) {
  await addDoc(collection(db, "price_alerts"), {
    ticker,
    created_at: new Date().toISOString(),
    earnings_alert: true,
    notes,
  });
}

export async function removePriceAlert(id: string) {
  await deleteDoc(doc(db, "price_alerts", id));
}

export async function updatePriceAlertState(id: string, data: { triggered?: boolean; last_price_side?: "above" | "below" }) {
  const { last_price_side, ...rest } = data;
  await setDoc(
    doc(db, "price_alerts", id),
    { ...rest, last_price_side: last_price_side ?? deleteField() },
    { merge: true }
  );
}

export async function updatePriceAlertEarnings(id: string, data: { earnings_alert?: boolean; earnings_date?: string | null; earnings_alert_fired?: boolean }) {
  await setDoc(doc(db, "price_alerts", id), data, { merge: true });
}

export async function updatePriceAlertNotes(id: string, notes: string) {
  await setDoc(doc(db, "price_alerts", id), { notes }, { merge: true });
}

export async function updatePriceAlertPrice(id: string, alertPrice: number) {
  await setDoc(
    doc(db, "price_alerts", id),
    { alert_price: alertPrice, triggered: false, last_price_side: deleteField() },
    { merge: true }
  );
}

// Push subscriptions (for price alert notifications)
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const id = encodeURIComponent(sub.endpoint);
  await setDoc(doc(db, "push_subscriptions", id), {
    endpoint: sub.endpoint,
    keys: sub.keys,
    created_at: new Date().toISOString(),
  });
}

export async function getPushSubscriptions(): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }[]> {
  const snap = await getDocs(collection(db, "push_subscriptions"));
  return snap.docs.map((d) => d.data() as { endpoint: string; keys: { p256dh: string; auth: string } });
}

export async function removePushSubscription(endpoint: string) {
  await deleteDoc(doc(db, "push_subscriptions", encodeURIComponent(endpoint)));
}

// 5Y P/E z-score stats — cached under stocks/{ticker}.pe_stats since it's derived,
// slow-to-compute data (SEC EDGAR + Yahoo), not something we recompute on every page load.
export async function getPeStatsMap(): Promise<Record<string, object>> {
  const snap = await getDocs(collection(db, "stocks"));
  const result: Record<string, object> = {};
  snap.forEach((d) => {
    const data = d.data();
    if (data.pe_stats) result[d.id] = data.pe_stats;
  });
  return result;
}

export async function savePeStats(ticker: string, stats: object) {
  await setDoc(doc(db, "stocks", ticker), { pe_stats: stats }, { merge: true });
}

// Marked stocks (danger zone)
export async function getMarkedTickers(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "marked"));
  return new Set(snap.docs.map((d) => d.id));
}

export async function markTicker(ticker: string) {
  await setDoc(doc(db, "marked", ticker), { marked_at: new Date().toISOString() });
}

export async function unmarkTicker(ticker: string) {
  await deleteDoc(doc(db, "marked", ticker));
}

// Starred stocks (Master Table - List)
export async function getStarredTickers(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "starred"));
  return new Set(snap.docs.map((d) => d.id));
}

export async function starTicker(ticker: string) {
  await setDoc(doc(db, "starred", ticker), { starred_at: new Date().toISOString() });
}

export async function unstarTicker(ticker: string) {
  await deleteDoc(doc(db, "starred", ticker));
}

// Notes (document editor)
export async function getNotes(): Promise<import("./types").NoteDoc[]> {
  const snap = await getDocs(collection(db, "notes"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as import("./types").NoteDoc)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function createNote(title: string): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, "notes"), {
    title,
    content: "",
    created_at: now,
    updated_at: now,
  });
  return ref.id;
}

export async function updateNote(id: string, data: { title?: string; content?: string }) {
  await setDoc(
    doc(db, "notes", id),
    { ...data, updated_at: new Date().toISOString() },
    { merge: true }
  );
}

export async function deleteNote(id: string) {
  await deleteDoc(doc(db, "notes", id));
}
