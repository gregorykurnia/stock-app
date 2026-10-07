import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertETFEquityIndexM4ResumeCompatible,
  claimETFEquityIndexM4Ticker,
  compareETFEquityIndexM4HistoryRevisions,
  createETFEquityIndexM4ArtifactEnvelope,
  createETFEquityIndexM4Progress,
  ETF_M4_ARTIFACT_CHUNK_BYTES,
  persistETFEquityIndexM4ArtifactEnvelope,
  recordETFEquityIndexM4TickerFailure,
  recordETFEquityIndexM4TickerSuccess,
  replayETFEquityIndexM4ArtifactEnvelope,
  type ETFEquityIndexM4ArtifactChunk,
  type ETFEquityIndexM4ProgressCheckpoint,
  type ETFEquityIndexM4RunManifest,
  type ETFEquityIndexM4RunStorePort,
} from "../lib/etfEquityIndexM4Storage";
import { canonicalSha256 } from "../lib/etfEquityIndexValidationBatch";
import type { ETFM4DataUsePolicy } from "../lib/etfEquityIndexM4Policy";

const sourcePath = join(process.cwd(), "data", "etf-equity-index-m3-validation-2026-10-07.json");
const rawArtifactText = readFileSync(sourcePath, "utf8");
const reviewedPolicy: ETFM4DataUsePolicy = {
  schemaVersion: 1,
  targetDeployment: "personal-use",
  reviewedAt: "2026-10-07T12:00:00.000Z",
  reviewRecord: "synthetic-test-policy",
  retentionDays: 365,
  permissions: {
    yahooProviderRequests: "approved",
    rawAdjustedCloseRetention: "approved",
    derivedScoreRetention: "approved",
    issuerReturnEvidenceRetention: "approved",
    issuerProviderRequests: "unresolved",
  },
};
const createdAt = "2026-10-07T13:00:00.000Z";
const envelope = createETFEquityIndexM4ArtifactEnvelope({
  rawArtifactText,
  policy: reviewedPolicy,
  createdAt,
  now: new Date("2026-10-07T14:00:00.000Z"),
});

class MemoryRunStore implements ETFEquityIndexM4RunStorePort {
  readonly chunks = new Map<string, ETFEquityIndexM4ArtifactChunk>();
  readonly manifests = new Map<string, ETFEquityIndexM4RunManifest>();
  latestRunId: string | null = null;
  readonly progress = new Map<string, ETFEquityIndexM4ProgressCheckpoint>();

  async putChunkIfAbsent(runId: string, chunk: ETFEquityIndexM4ArtifactChunk): Promise<void> {
    const key = `${runId}/${chunk.id}`;
    const existing = this.chunks.get(key);
    if (existing && canonicalSha256(existing) !== canonicalSha256(chunk)) throw new Error("immutable chunk conflict");
    this.chunks.set(key, chunk);
  }

  async putManifestIfAbsent(manifest: ETFEquityIndexM4RunManifest): Promise<void> {
    const existing = this.manifests.get(manifest.runId);
    if (existing && canonicalSha256(existing) !== canonicalSha256(manifest)) throw new Error("immutable manifest conflict");
    this.manifests.set(manifest.runId, manifest);
  }

  async getManifest(runId: string): Promise<ETFEquityIndexM4RunManifest | null> {
    return this.manifests.get(runId) ?? null;
  }

  async getChunks(runId: string): Promise<ETFEquityIndexM4ArtifactChunk[]> {
    return [...this.chunks.values()].filter((chunk) => chunk.id && this.chunks.has(`${runId}/${chunk.id}`))
      .sort((left, right) => left.sequence - right.sequence);
  }

  async getProgress(budgetScope: string): Promise<ETFEquityIndexM4ProgressCheckpoint | null> {
    return this.progress.get(budgetScope) ?? null;
  }

  async compareAndSetProgress(runId: string, expectedRevision: number, checkpoint: ETFEquityIndexM4ProgressCheckpoint): Promise<boolean> {
    const current = this.progress.get(runId);
    if ((current?.revision ?? -1) !== expectedRevision) return false;
    this.progress.set(runId, checkpoint);
    return true;
  }

  async advanceLatestSuccessfulRun(manifest: ETFEquityIndexM4RunManifest): Promise<void> {
    if (!manifest.promotionEligible) throw new Error("partial run cannot become latest");
    const previous = this.latestRunId ? this.manifests.get(this.latestRunId) : null;
    if (!previous || previous.createdAt <= manifest.createdAt) this.latestRunId = manifest.runId;
  }
}

test("raw M3 bytes are chunked below the Firestore-safe limit and replay exactly", () => {
  assert.ok(envelope.chunks.length > 1);
  assert.ok(envelope.chunks.every((chunk) => chunk.rawByteLength <= ETF_M4_ARTIFACT_CHUNK_BYTES));
  assert.equal(envelope.manifest.rawArtifactBytes, Buffer.byteLength(rawArtifactText, "utf8"));
  assert.equal(envelope.manifest.rawArtifactSha256, envelope.manifest.runId.slice(3));
  const replay = replayETFEquityIndexM4ArtifactEnvelope(envelope);
  assert.equal(replay.status, "passed", replay.issues.join(" "));
  assert.equal(replay.artifact?.integrityManifest.artifactHash, envelope.manifest.artifactIntegritySha256);
});

test("changed chunks block readback replay", () => {
  const corrupted = {
    manifest: envelope.manifest,
    chunks: envelope.chunks.map((chunk, index) => index === 0
      ? { ...chunk, contentBase64: `${chunk.contentBase64.slice(0, -4)}AAAA` }
      : chunk),
  };
  const replay = replayETFEquityIndexM4ArtifactEnvelope(corrupted);
  assert.equal(replay.status, "blocked");
  assert.match(replay.issues.join(" "), /chunk 0 failed/);
});

test("adjustment changes, newly available history, and failed refreshes are distinguished", () => {
  const [first, second, third] = envelope.manifest.funds;
  const previous = {
    ...envelope.manifest,
    funds: envelope.manifest.funds.map((fund, index) => index === 2 ? { ...fund, historySha256: null } : fund),
  };
  const current = {
    ...envelope.manifest,
    funds: envelope.manifest.funds.map((fund, index) => index === 0
      ? { ...fund, historySha256: "b".repeat(64) }
      : index === 1 ? { ...fund, historySha256: null } : fund),
  };
  const revisions = compareETFEquityIndexM4HistoryRevisions(previous, current);
  assert.equal(revisions.find((item) => item.ticker === first.ticker)?.status, "revised");
  assert.equal(revisions.find((item) => item.ticker === second.ticker)?.status, "unavailable");
  assert.equal(revisions.find((item) => item.ticker === third.ticker)?.status, "available");
  assert.equal(revisions.find((item) => item.ticker === envelope.manifest.funds[3].ticker)?.status, "unchanged");
  assert.throws(() => compareETFEquityIndexM4HistoryRevisions(previous, { ...current, sampleSha256: "0".repeat(64) }), /same method and frozen sample/);
});

test("M4 checkpoint resumes in ticker order and enforces its shared hourly request budget", () => {
  const checkpoint = createETFEquityIndexM4Progress({
    manifest: envelope.manifest,
    now: createdAt,
    maxRequestsPerHour: 1,
    maxAttemptsPerTicker: 2,
  });
  const first = claimETFEquityIndexM4Ticker({ checkpoint, now: createdAt });
  assert.equal(first.ticker, envelope.manifest.funds[0].ticker);
  const saved = recordETFEquityIndexM4TickerSuccess({
    checkpoint: first.checkpoint,
    ticker: first.ticker!,
    historySha256: "a".repeat(64),
    now: "2026-10-07T13:00:10.000Z",
  });
  const limited = claimETFEquityIndexM4Ticker({ checkpoint: saved, now: "2026-10-07T13:30:00.000Z" });
  assert.equal(limited.ticker, null);
  assert.equal(limited.reason, "hourly-budget-exhausted");
  const nextHour = claimETFEquityIndexM4Ticker({ checkpoint: saved, now: "2026-10-07T14:00:00.000Z" });
  assert.equal(nextHour.ticker, envelope.manifest.funds[1].ticker);
  assertETFEquityIndexM4ResumeCompatible(nextHour.checkpoint, envelope.manifest);

  assert.throws(() => createETFEquityIndexM4Progress({
    manifest: envelope.manifest,
    now: "2026-10-07T13:45:00.000Z",
    maxRequestsPerHour: 1,
    maxAttemptsPerTicker: 2,
    previousCheckpoint: saved,
  }), /already active/);

  const terminal = {
    ...saved,
    status: "partial" as const,
    tickers: saved.tickers.map((ticker) => ({ ...ticker, status: "failed" as const })),
  };
  const sameHourBudget = createETFEquityIndexM4Progress({
    manifest: envelope.manifest,
    now: "2026-10-07T13:45:00.000Z",
    maxRequestsPerHour: 1,
    maxAttemptsPerTicker: 2,
    previousCheckpoint: terminal,
  });
  assert.equal(sameHourBudget.requestsThisHour, 1);
  assert.equal(claimETFEquityIndexM4Ticker({ checkpoint: sameHourBudget, now: "2026-10-07T13:45:00.000Z" }).reason, "hourly-budget-exhausted");
});

test("expired capture lease is recovered and becomes a recorded failure after retry exhaustion", () => {
  const singleTickerManifest = { ...envelope.manifest, funds: envelope.manifest.funds.slice(0, 1) };
  const checkpoint = createETFEquityIndexM4Progress({
    manifest: singleTickerManifest,
    now: createdAt,
    maxRequestsPerHour: 4,
    maxAttemptsPerTicker: 1,
    leaseMs: 1_000,
  });
  const claim = claimETFEquityIndexM4Ticker({ checkpoint, now: createdAt });
  const recovered = claimETFEquityIndexM4Ticker({ checkpoint: claim.checkpoint, now: "2026-10-07T13:00:01.000Z" });
  assert.equal(recovered.checkpoint.tickers[0].status, "failed");
  assert.match(recovered.checkpoint.tickers[0].lastError!, /lease expired/);
  assert.equal(recovered.checkpoint.revision, claim.checkpoint.revision + 1);
  assert.equal(recovered.checkpoint.status, "partial");
});

test("retry delay is bounded, provider URLs are redacted, and retries exhaust explicitly", () => {
  const singleTickerManifest = { ...envelope.manifest, funds: envelope.manifest.funds.slice(0, 1) };
  let checkpoint = createETFEquityIndexM4Progress({
    manifest: singleTickerManifest,
    now: createdAt,
    maxRequestsPerHour: 10,
    maxAttemptsPerTicker: 2,
  });
  const ticker = envelope.manifest.funds[0].ticker;
  let claim = claimETFEquityIndexM4Ticker({ checkpoint, now: createdAt });
  checkpoint = recordETFEquityIndexM4TickerFailure({
    checkpoint: claim.checkpoint,
    ticker,
    error: "fetch failed https://provider.example/private?token=secret",
    retryable: true,
    now: "2026-10-07T13:00:05.000Z",
  });
  assert.equal(checkpoint.tickers[0].status, "retryable-failure");
  assert.equal(checkpoint.tickers[0].nextAttemptAt, "2026-10-07T13:00:20.000Z");
  assert.doesNotMatch(checkpoint.tickers[0].lastError!, /token=secret|https:\/\//);
  assert.equal(claimETFEquityIndexM4Ticker({ checkpoint, now: "2026-10-07T13:00:19.000Z" }).ticker, null);
  claim = claimETFEquityIndexM4Ticker({ checkpoint, now: "2026-10-07T13:00:20.000Z" });
  assert.equal(claim.ticker, ticker);
  checkpoint = recordETFEquityIndexM4TickerFailure({
    checkpoint: claim.checkpoint,
    ticker,
    error: "retry exhausted",
    retryable: true,
    now: "2026-10-07T13:00:21.000Z",
  });
  assert.equal(checkpoint.tickers[0].status, "failed");
});

test("persisted run readback is replayed before latest-run promotion", async () => {
  const store = new MemoryRunStore();
  const result = await persistETFEquityIndexM4ArtifactEnvelope({
    envelope,
    store,
    policy: reviewedPolicy,
    now: new Date("2026-10-07T14:00:00.000Z"),
  });
  assert.equal(result.replay.status, "passed");
  assert.equal(result.promoted, envelope.manifest.promotionEligible);
  assert.equal(store.latestRunId, envelope.manifest.promotionEligible ? envelope.manifest.runId : null);
});
