import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { FULL_HISTORY_COLLECTION, rankingBarsFrom, type FullHistoryYearDoc } from "./etfRankingHistory";
import type { RankingBar } from "./etfRanking";

// Reads and writes the full-history store. Only the backfill script and the first-run script use this module.
// Writes overwrite the year documents for one ticker, which is safe because each year holds the full Tiingo answer.

export async function saveFullHistoryYears(ticker: string, docs: readonly FullHistoryYearDoc[]): Promise<void> {
  for (const yearDoc of docs) {
    await setDoc(doc(collection(db, FULL_HISTORY_COLLECTION, ticker, "years"), String(yearDoc.year)), yearDoc);
  }
}

export async function getFullHistory(ticker: string): Promise<RankingBar[]> {
  const snapshot = await getDocs(collection(db, FULL_HISTORY_COLLECTION, ticker, "years"));
  return rankingBarsFrom(snapshot.docs.map((item) => item.data() as FullHistoryYearDoc));
}
