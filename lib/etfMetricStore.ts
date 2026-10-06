import { collection, doc, getDoc, getDocs, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ETFMetricSnapshot } from "@/lib/etfCatalog";
import type { TiingoDailyBar } from "@/lib/etfTiingo";

const COLLECTION = "etf_metrics";

export async function getETFMetricSnapshots(): Promise<Record<string, ETFMetricSnapshot>> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as ETFMetricSnapshot]));
}

export async function saveETFMetricSnapshot(snapshot: ETFMetricSnapshot): Promise<void> {
  const ref = doc(db, COLLECTION, snapshot.ticker);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    const previous = existing.exists() ? existing.data() as ETFMetricSnapshot : undefined;
    transaction.set(ref, {
      ...snapshot,
      scoreAssessments: snapshot.scoreAssessments ?? previous?.scoreAssessments ?? [],
      scoreObservedAt: snapshot.scoreObservedAt ?? previous?.scoreObservedAt ?? null,
      scoreHistoryHash: snapshot.scoreHistoryHash ?? previous?.scoreHistoryHash ?? null,
    });
  });
}

const HISTORY_COLLECTION = "etf_score_history";
const REFRESH_STATE_COLLECTION = "etf_source_jobs";

export interface ETFCoreHistoryChunk {
  ticker: string;
  year: number;
  sourceId: string;
  fetchedAt: string;
  rows: TiingoDailyBar[];
}

export interface ETFSourceJobState {
  universeId: string;
  cursor: number;
  completedAt: string | null;
  runId: string;
  scoreCutoffDate: string;
  updatedAt: string;
  hourWindow: string;
  requestsThisHour: number;
}

function tiingoJobRef() {
  return doc(db, REFRESH_STATE_COLLECTION, "tiingo_core_history");
}

export async function getETFSourceJobState(): Promise<ETFSourceJobState | null> {
  const snapshot = await getDoc(tiingoJobRef());
  return snapshot.exists() ? snapshot.data() as ETFSourceJobState : null;
}

export async function reserveTiingoRequest(now: Date, hourlyLimit = 40): Promise<boolean> {
  const ref = tiingoJobRef();
  const hourWindow = now.toISOString().slice(0, 13);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists() ? snapshot.data() as ETFSourceJobState : null;
    const requestsThisHour = existing?.hourWindow === hourWindow ? existing.requestsThisHour : 0;
    if (requestsThisHour >= hourlyLimit) return false;
    transaction.set(ref, {
      ...(existing ?? { universeId: "", cursor: 0, completedAt: null, runId: "", scoreCutoffDate: "", updatedAt: now.toISOString() }),
      hourWindow,
      requestsThisHour: requestsThisHour + 1,
      updatedAt: now.toISOString(),
    }, { merge: true });
    return true;
  });
}

export async function advanceETFSourceJob(input: {
  universeId: string;
  cursor: number;
  completedAt?: string | null;
  runId: string;
  scoreCutoffDate: string;
  now: Date;
}): Promise<void> {
  await setDoc(tiingoJobRef(), {
    universeId: input.universeId,
    cursor: input.cursor,
    completedAt: input.completedAt ?? null,
    runId: input.runId,
    scoreCutoffDate: input.scoreCutoffDate,
    updatedAt: input.now.toISOString(),
  }, { merge: true });
}

export async function getETFCoreHistory(ticker: string): Promise<TiingoDailyBar[]> {
  const snapshot = await getDocs(collection(db, HISTORY_COLLECTION, ticker, "years"));
  return snapshot.docs.flatMap((item) => {
    const data = item.data() as ETFCoreHistoryChunk;
    return Array.isArray(data.rows) ? data.rows : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

export async function saveETFCoreHistory(input: {
  ticker: string;
  rows: TiingoDailyBar[];
  fetchedAt: string;
  sourceId: string;
}): Promise<void> {
  const grouped = new Map<number, TiingoDailyBar[]>();
  for (const row of input.rows) {
    const year = Number(row.date.slice(0, 4));
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(row);
  }
  for (const [year, rows] of grouped.entries()) {
    const ref = doc(collection(db, HISTORY_COLLECTION, input.ticker, "years"), String(year));
    await setDoc(ref, { ticker: input.ticker, year, sourceId: input.sourceId, fetchedAt: input.fetchedAt, rows } satisfies ETFCoreHistoryChunk);
  }
}

export async function saveETFCoreAssessments(input: {
  ticker: string;
  assessments: NonNullable<ETFMetricSnapshot["scoreAssessments"]>;
  observedAt: string;
  historyHash: string;
}): Promise<void> {
  const ref = doc(db, COLLECTION, input.ticker);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    const previous = existing.exists() ? existing.data() as ETFMetricSnapshot : undefined;
    const retained = (previous?.scoreAssessments ?? []).filter((assessment) => assessment.kind !== "core" && assessment.kind !== "cost-only");
    transaction.set(ref, {
      ...(previous ?? { ticker: input.ticker }),
      scoreAssessments: [...retained, ...input.assessments],
      scoreObservedAt: input.observedAt,
      scoreStale: false,
      scoreHistoryHash: input.historyHash,
    }, { merge: true });
  });
}

export async function recordETFMetricRefreshError(ticker: string, message: string, attemptedAt: string): Promise<void> {
  await setDoc(doc(db, COLLECTION, ticker), { ticker, lastAttemptAt: attemptedAt, lastError: message }, { merge: true });
}
