import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { ETF_FREE_CORE_TRIAL_TICKERS, type ETFFreeCoreTrialHistory, type ETFFreeCoreTrialSnapshot, type ETFFreeCoreTrialTicker } from "./etfFreeCoreTrial";

const SNAPSHOTS = "etf_free_core_trials";
const HISTORY = "etf_free_core_trial_history";

export async function getETFFreeCoreTrialSnapshots(): Promise<ETFFreeCoreTrialSnapshot[]> {
  const snapshots = await Promise.all(ETF_FREE_CORE_TRIAL_TICKERS.map((ticker) => getDoc(doc(db, SNAPSHOTS, ticker))));
  return snapshots.flatMap((snapshot) => snapshot.exists() ? [snapshot.data() as ETFFreeCoreTrialSnapshot] : []);
}

export async function getSavedETFFreeCoreTrialHistory(snapshot: ETFFreeCoreTrialSnapshot): Promise<ETFFreeCoreTrialHistory> {
  const chunks = await getDocs(collection(db, HISTORY, snapshot.ticker, "runs", snapshot.historyHash, "years"));
  const bars = chunks.docs.flatMap((item) => item.data().rows ?? []).sort((left, right) => left.date.localeCompare(right.date));
  return { ...snapshot.source, bars };
}

export async function getRetainedTiingoTrialReference(ticker: ETFFreeCoreTrialTicker): Promise<ETFFreeCoreTrialHistory | null> {
  const snapshot = await getDocs(collection(db, "etf_score_history", ticker, "years"));
  const chunks = snapshot.docs.map((item) => item.data());
  if (!chunks.length || chunks.some((chunk) => chunk.sourceId !== "tiingo:eod:adjusted-close:v1" || !Array.isArray(chunk.rows))) return null;
  return {
    provider: "Tiingo", sourceId: "tiingo:eod:adjusted-close:v1", sourceUrl: "https://www.tiingo.com/documentation/end-of-day",
    retrievedAt: chunks.map((chunk) => String(chunk.fetchedAt)).sort()[0], currency: "USD",
    bars: chunks.flatMap((chunk) => chunk.rows).sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export async function saveETFFreeCoreTrial(input: { snapshot: ETFFreeCoreTrialSnapshot; history: ETFFreeCoreTrialHistory }): Promise<void> {
  if (input.snapshot.results.some((result) => result.status !== "trial" || result.score == null)) throw new Error("An incomplete refresh cannot replace a successful trial snapshot.");
  const grouped = new Map<string, ETFFreeCoreTrialHistory["bars"]>();
  for (const row of input.history.bars) {
    const year = row.date.slice(0, 4);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(row);
  }
  // Immutable run chunks retain inputs even when a later refresh replaces the displayed snapshot.
  const run = input.snapshot.historyHash;
  for (const [year, rows] of grouped) {
    await setDoc(doc(db, HISTORY, input.snapshot.ticker, "runs", run, "years", year), {
      ticker: input.snapshot.ticker, year, source: input.snapshot.source, rows,
    });
  }
  await setDoc(doc(db, SNAPSHOTS, input.snapshot.ticker), input.snapshot);
}
