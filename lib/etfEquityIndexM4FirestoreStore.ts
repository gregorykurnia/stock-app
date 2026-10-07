import "server-only";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { canonicalSha256 } from "./etfEquityIndexValidationBatch";
import { getETFEquityIndexM4Firestore } from "./firebaseAdminServer";
import {
  ETF_M4_YAHOO_BUDGET_SCOPE,
  type ETFEquityIndexM4AcquisitionPlan,
  type ETFEquityIndexM4ArtifactChunk,
  type ETFEquityIndexM4ProgressCheckpoint,
  type ETFEquityIndexM4RunManifest,
  type ETFEquityIndexM4RunStorePort,
  type ETFEquityIndexM4TickerHistoryStage,
} from "./etfEquityIndexM4Storage";

const RUNS = "etf_equity_index_m4_runs";
const JOBS = "etf_equity_index_m4_jobs";
const CONTROL = "etf_equity_index_m4_control";
const ACQUISITIONS = "etf_equity_index_m4_acquisitions";
const MAX_DOCUMENT_JSON_BYTES = 900 * 1024;

function fitsDocument(value: unknown, label: string): void {
  const size = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (size > MAX_DOCUMENT_JSON_BYTES) throw new Error(`${label} is ${size} bytes, above the M4 Firestore document safety limit.`);
}

function alreadyExists(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code: unknown }).code;
  return code === 6 || code === "6" || code === "already-exists" || code === "ALREADY_EXISTS";
}

function cleanFirestoreRecord<T extends Record<string, unknown>>(data: T): Omit<T, "ttlExpiresAt"> {
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "ttlExpiresAt"));
  return clean as Omit<T, "ttlExpiresAt">;
}

function withTtl<T extends { expiresAt: string }>(record: T) {
  return { ...record, ttlExpiresAt: Timestamp.fromDate(new Date(record.expiresAt)) };
}

export class ETFEquityIndexM4FirestoreStore implements ETFEquityIndexM4RunStorePort {
  constructor(private readonly db: Firestore = getETFEquityIndexM4Firestore()) {}

  private runRef(runId: string) {
    return this.db.collection(RUNS).doc(runId);
  }

  private acquisitionRef(acquisitionId: string) {
    if (!/^m4a-[a-f0-9]{64}$/.test(acquisitionId)) throw new Error("Invalid ETF M4 acquisition ID.");
    return this.db.collection(ACQUISITIONS).doc(acquisitionId);
  }

  async putChunkIfAbsent(runId: string, chunk: ETFEquityIndexM4ArtifactChunk): Promise<void> {
    const payload = withTtl(chunk);
    fitsDocument(payload, `ETF M4 chunk ${runId}/${chunk.id}`);
    const ref = this.runRef(runId).collection("artifact_chunks").doc(chunk.id);
    try {
      await ref.create(payload);
    } catch (error) {
      if (!alreadyExists(error)) throw error;
      const existing = await ref.get();
      if (!existing.exists || canonicalSha256(cleanFirestoreRecord(existing.data()!)) !== canonicalSha256(chunk)) {
        throw new Error(`Immutable ETF M4 chunk conflict for ${runId}/${chunk.id}.`);
      }
    }
  }

  async putManifestIfAbsent(manifest: ETFEquityIndexM4RunManifest): Promise<void> {
    const payload = withTtl(manifest);
    fitsDocument(payload, `ETF M4 manifest ${manifest.runId}`);
    const ref = this.runRef(manifest.runId);
    try {
      await ref.create(payload);
    } catch (error) {
      if (!alreadyExists(error)) throw error;
      const existing = await ref.get();
      if (!existing.exists || canonicalSha256(cleanFirestoreRecord(existing.data()!)) !== canonicalSha256(manifest)) {
        throw new Error(`Immutable ETF M4 manifest conflict for ${manifest.runId}.`);
      }
    }
  }

  async getManifest(runId: string): Promise<ETFEquityIndexM4RunManifest | null> {
    const snapshot = await this.runRef(runId).get();
    return snapshot.exists ? cleanFirestoreRecord(snapshot.data()!) as unknown as ETFEquityIndexM4RunManifest : null;
  }

  async getChunks(runId: string): Promise<ETFEquityIndexM4ArtifactChunk[]> {
    const snapshot = await this.runRef(runId).collection("artifact_chunks").orderBy("sequence", "asc").get();
    return snapshot.docs.map((doc) => cleanFirestoreRecord(doc.data()) as unknown as ETFEquityIndexM4ArtifactChunk);
  }

  async getProgress(
    budgetScope: typeof ETF_M4_YAHOO_BUDGET_SCOPE,
  ): Promise<ETFEquityIndexM4ProgressCheckpoint | null> {
    const snapshot = await this.db.collection(JOBS).doc(budgetScope).get();
    return snapshot.exists
      ? cleanFirestoreRecord(snapshot.data()!) as unknown as ETFEquityIndexM4ProgressCheckpoint
      : null;
  }

  async compareAndSetProgress(
    budgetScope: typeof ETF_M4_YAHOO_BUDGET_SCOPE,
    expectedRevision: number,
    checkpoint: ETFEquityIndexM4ProgressCheckpoint,
  ): Promise<boolean> {
    if (budgetScope !== checkpoint.budgetScope || expectedRevision < -1 || checkpoint.revision !== expectedRevision + 1) {
      throw new Error("ETF M4 progress scope or revision does not match the expected compare-and-set transition.");
    }
    const ref = this.db.collection(JOBS).doc(budgetScope);
    const payload = withTtl({ ...checkpoint, expiresAt: checkpoint.expiresAt });
    fitsDocument(payload, `ETF M4 progress ${budgetScope}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists ? snapshot.data() as ETFEquityIndexM4ProgressCheckpoint : null;
      const currentRevision = current?.revision ?? -1;
      if (currentRevision !== expectedRevision) return false;
      if (current?.status === "running" && current.acquisitionId !== checkpoint.acquisitionId
        && Date.parse(current.expiresAt) > Date.parse(checkpoint.updatedAt)) return false;
      transaction.set(ref, payload);
      return true;
    });
  }

  async putAcquisitionPlanIfAbsent(plan: ETFEquityIndexM4AcquisitionPlan): Promise<void> {
    const payload = withTtl(plan);
    fitsDocument(payload, `ETF M4 acquisition plan ${plan.acquisitionId}`);
    const ref = this.acquisitionRef(plan.acquisitionId);
    try {
      await ref.create(payload);
    } catch (error) {
      if (!alreadyExists(error)) throw error;
      const existing = await ref.get();
      if (!existing.exists || canonicalSha256(cleanFirestoreRecord(existing.data()!)) !== canonicalSha256(plan)) {
        throw new Error(`Immutable ETF M4 acquisition plan conflict for ${plan.acquisitionId}.`);
      }
    }
  }

  async getAcquisitionPlan(acquisitionId: string): Promise<ETFEquityIndexM4AcquisitionPlan | null> {
    const snapshot = await this.acquisitionRef(acquisitionId).get();
    return snapshot.exists
      ? cleanFirestoreRecord(snapshot.data()!) as unknown as ETFEquityIndexM4AcquisitionPlan
      : null;
  }

  async putTickerHistoryStageIfAbsent(stage: ETFEquityIndexM4TickerHistoryStage): Promise<void> {
    if (!/^[A-Z0-9.-]{1,12}$/.test(stage.ticker)) throw new Error("Invalid ETF M4 ticker history stage ticker.");
    const payload = withTtl(stage);
    fitsDocument(payload, `ETF M4 staged history ${stage.acquisitionId}/${stage.ticker}`);
    const ref = this.acquisitionRef(stage.acquisitionId).collection("ticker_histories").doc(stage.ticker);
    try {
      await ref.create(payload);
    } catch (error) {
      if (!alreadyExists(error)) throw error;
      const existing = await ref.get();
      if (!existing.exists || canonicalSha256(cleanFirestoreRecord(existing.data()!)) !== canonicalSha256(stage)) {
        throw new Error(`Immutable ETF M4 staged history conflict for ${stage.acquisitionId}/${stage.ticker}.`);
      }
    }
  }

  async getTickerHistoryStage(
    acquisitionId: string,
    ticker: string,
  ): Promise<ETFEquityIndexM4TickerHistoryStage | null> {
    if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) throw new Error("Invalid ETF M4 ticker history stage ticker.");
    const snapshot = await this.acquisitionRef(acquisitionId).collection("ticker_histories").doc(ticker).get();
    return snapshot.exists
      ? cleanFirestoreRecord(snapshot.data()!) as unknown as ETFEquityIndexM4TickerHistoryStage
      : null;
  }

  async advanceLatestSuccessfulRun(manifest: ETFEquityIndexM4RunManifest): Promise<void> {
    if (!manifest.promotionEligible) throw new Error("A partial or unvalidated ETF M4 run cannot replace the latest successful run.");
    const runRef = this.runRef(manifest.runId);
    const latestRef = this.db.collection(CONTROL).doc("latest_successful_run");
    await this.db.runTransaction(async (transaction) => {
      const storedRun = await transaction.get(runRef);
      const latest = await transaction.get(latestRef);
      if (!storedRun.exists || storedRun.get("manifestSha256") !== manifest.manifestSha256) {
        throw new Error(`ETF M4 run ${manifest.runId} is missing or changed before promotion.`);
      }
      const previousCreatedAt = latest.exists ? String(latest.get("createdAt") ?? "") : "";
      if (previousCreatedAt && previousCreatedAt >= manifest.createdAt) return;
      transaction.set(latestRef, {
        runId: manifest.runId,
        manifestSha256: manifest.manifestSha256,
        methodologyVersion: manifest.methodologyVersion,
        sampleId: manifest.sampleId,
        commonCutoff: manifest.commonCutoff,
        createdAt: manifest.createdAt,
        updatedAt: Timestamp.now(),
      });
    });
  }
}
