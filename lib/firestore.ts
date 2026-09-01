import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, deleteField } from "firebase/firestore";
import { db } from "./firebase";

export async function loadStockData(ticker: string) {
  const ref = doc(db, "stocks", ticker);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
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

// Portfolio divisions — three independent, manually-managed ticker lists ("Long Term",
// "Index", "Swing"), each holding entry_price/entry_value alongside name/industry.
export type PortfolioDivision = "longterm" | "index" | "swing";

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
    nearest_support?: number | null; hard_support?: number | null;
    r1?: number | null; r2?: number | null; r3?: number | null;
  }
) {
  await setDoc(doc(db, portfolioDivisionCollection(division), ticker), data, { merge: true });
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
