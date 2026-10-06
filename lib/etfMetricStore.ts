import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ETFMetricSnapshot } from "@/lib/etfCatalog";

const COLLECTION = "etf_metrics";

export async function getETFMetricSnapshots(): Promise<Record<string, ETFMetricSnapshot>> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as ETFMetricSnapshot]));
}

export async function saveETFMetricSnapshot(snapshot: ETFMetricSnapshot): Promise<void> {
  await setDoc(doc(db, COLLECTION, snapshot.ticker), snapshot);
}

export async function recordETFMetricRefreshError(ticker: string, message: string, attemptedAt: string): Promise<void> {
  await setDoc(doc(db, COLLECTION, ticker), { ticker, lastAttemptAt: attemptedAt, lastError: message }, { merge: true });
}
