import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
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
