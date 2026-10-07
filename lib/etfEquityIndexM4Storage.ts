import { createHash } from "node:crypto";
import {
  type ETFEquityIndexM3Artifact,
  type ETFEquityIndexM3FundSnapshot,
  verifyETFEquityIndexM3Artifact,
} from "./etfEquityIndexM3Validation";
import { canonicalSha256 } from "./etfEquityIndexValidationBatch";
import {
  assertETFEquityIndexM4RetentionAllowed,
  type ETFM4DataUsePolicy,
} from "./etfEquityIndexM4Policy";

export const ETF_M4_ARTIFACT_CHUNK_BYTES = 512 * 1024;
export const ETF_M4_YAHOO_BUDGET_SCOPE = "yahoo-equity-index-m4";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 10 * 60 * 1000;

export interface ETFEquityIndexM4ArtifactChunk {
  id: string;
  sequence: number;
  chunkCount: number;
  encoding: "base64";
  rawByteLength: number;
  contentSha256: string;
  contentBase64: string;
  expiresAt: string;
}

export interface ETFEquityIndexM4FundRunSummary {
  ticker: string;
  historySha256: string | null;
  acquisitionError: string | null;
  historyRetrievedAt: string | null;
  latestPriceSessionDate: string | null;
  captureValidity: "pass" | "blocked";
  currentFreshnessAtCapture: "fresh" | "stale-or-invalid";
  feeFinancialDate: string;
  sourceBlockers: string[];
  historyBlockers: string[];
  independentReturnBlockers: string[];
  scoredRows: number;
  blockedRows: number;
}

export interface ETFEquityIndexM4RunManifest {
  schemaVersion: 1;
  runId: string;
  parentRunId: string | null;
  createdAt: string;
  expiresAt: string;
  methodologyVersion: string;
  sampleId: string;
  sampleSha256: string;
  commonCutoff: string;
  sourceCaptureAt: string;
  rawArtifactSha256: string;
  rawArtifactBytes: number;
  artifactIntegritySha256: string;
  artifactChunkCount: number;
  retentionDays: number;
  promotionEligible: boolean;
  validation: {
    captureValidity: string;
    independentCalculation: string;
    batchReadyForM4Review: boolean;
  };
  funds: ETFEquityIndexM4FundRunSummary[];
  manifestSha256: string;
}

export interface ETFEquityIndexM4ArtifactEnvelope {
  manifest: ETFEquityIndexM4RunManifest;
  chunks: ETFEquityIndexM4ArtifactChunk[];
}

export interface ETFEquityIndexM4ReplayResult {
  status: "passed" | "blocked";
  artifact: ETFEquityIndexM3Artifact | null;
  rawArtifactSha256: string;
  issues: string[];
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function validTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function digestableManifest(manifest: ETFEquityIndexM4RunManifest): Omit<ETFEquityIndexM4RunManifest, "manifestSha256"> {
  const digestable = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "manifestSha256"));
  return digestable as Omit<ETFEquityIndexM4RunManifest, "manifestSha256">;
}

function fundSummary(fund: ETFEquityIndexM3FundSnapshot): ETFEquityIndexM4FundRunSummary {
  return {
    ticker: fund.ticker,
    historySha256: fund.history?.sha256 ?? null,
    acquisitionError: fund.acquisitionError,
    historyRetrievedAt: fund.history?.retrievedAt ?? null,
    latestPriceSessionDate: fund.history?.lastDate ?? null,
    captureValidity: fund.captureValidity,
    currentFreshnessAtCapture: fund.currentFreshnessAtCapture,
    feeFinancialDate: fund.expenseRatio.financialDate,
    sourceBlockers: [...fund.sourceBlockers],
    historyBlockers: [...fund.historyCaptureBlockers],
    independentReturnBlockers: [...fund.independentReturnEvidence.blockers],
    scoredRows: fund.results.filter((row) => row.status === "scored").length,
    blockedRows: fund.results.filter((row) => row.status !== "scored").length,
  };
}

function validM3Artifact(rawText: string): { artifact: ETFEquityIndexM3Artifact; artifactHash: string } {
  let artifact: ETFEquityIndexM3Artifact;
  try {
    artifact = JSON.parse(rawText) as ETFEquityIndexM3Artifact;
  } catch {
    throw new Error("M4 requires a retained M3 artifact that parses from raw JSON text.");
  }
  if (!artifact?.snapshot || !artifact.integrityManifest) throw new Error("The retained JSON does not have the M3 artifact shape.");
  const replay = verifyETFEquityIndexM3Artifact(artifact);
  if (replay.status !== "passed") throw new Error(`M3 integrity replay blocked M4 storage: ${replay.issues.join(" ")}`);
  return { artifact, artifactHash: artifact.integrityManifest.artifactHash };
}

export function createETFEquityIndexM4ArtifactEnvelope(input: {
  rawArtifactText: string;
  policy: ETFM4DataUsePolicy;
  createdAt: string;
  parentRunId?: string | null;
  now?: Date;
  chunkBytes?: number;
}): ETFEquityIndexM4ArtifactEnvelope {
  assertETFEquityIndexM4RetentionAllowed(input.policy, input.now);
  if (!validTimestamp(input.createdAt)) throw new Error("M4 run createdAt must be a canonical UTC timestamp.");
  const { artifact, artifactHash } = validM3Artifact(input.rawArtifactText);
  const snapshot = artifact.snapshot;
  const rawBytes = Buffer.from(input.rawArtifactText, "utf8");
  const rawArtifactSha256 = sha256Bytes(rawBytes);
  const runId = `m4-${rawArtifactSha256}`;
  const parentRunId = input.parentRunId ?? null;
  if (parentRunId === runId) throw new Error("An M4 run cannot be its own parent or revision.");
  if (parentRunId !== null && !/^m4-[a-f0-9]{64}$/.test(parentRunId)) throw new Error("parentRunId must reference a valid M4 run ID.");

  const chunkBytes = input.chunkBytes ?? ETF_M4_ARTIFACT_CHUNK_BYTES;
  if (!Number.isInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > ETF_M4_ARTIFACT_CHUNK_BYTES) {
    throw new Error(`M4 raw chunks must be between 1 byte and ${ETF_M4_ARTIFACT_CHUNK_BYTES} bytes.`);
  }
  const chunkCount = Math.ceil(rawBytes.length / chunkBytes);
  if (chunkCount < 1) throw new Error("M4 cannot store an empty retained artifact.");
  const retentionDays = input.policy.retentionDays as number;
  const expiresAt = new Date(Date.parse(input.createdAt) + retentionDays * 86_400_000).toISOString();
  const chunks = Array.from({ length: chunkCount }, (_, sequence): ETFEquityIndexM4ArtifactChunk => {
    const bytes = rawBytes.subarray(sequence * chunkBytes, Math.min((sequence + 1) * chunkBytes, rawBytes.length));
    return {
      id: String(sequence).padStart(4, "0"),
      sequence,
      chunkCount,
      encoding: "base64",
      rawByteLength: bytes.byteLength,
      contentSha256: sha256Bytes(bytes),
      contentBase64: bytes.toString("base64"),
      expiresAt,
    };
  });
  const promotionEligible = snapshot.validation.captureValidity === "pass"
    && snapshot.validation.independentCalculation.status === "pass"
    && snapshot.validation.batchReadyForM4Review;
  const manifestWithoutHash = {
    schemaVersion: 1 as const,
    runId,
    parentRunId,
    createdAt: input.createdAt,
    expiresAt,
    methodologyVersion: snapshot.methodologyVersion,
    sampleId: snapshot.sampleId,
    sampleSha256: snapshot.sampleSha256,
    commonCutoff: snapshot.commonCutoff,
    sourceCaptureAt: snapshot.asOf,
    rawArtifactSha256,
    rawArtifactBytes: rawBytes.byteLength,
    artifactIntegritySha256: artifactHash,
    artifactChunkCount: chunkCount,
    retentionDays,
    promotionEligible,
    validation: {
      captureValidity: snapshot.validation.captureValidity,
      independentCalculation: snapshot.validation.independentCalculation.status,
      batchReadyForM4Review: snapshot.validation.batchReadyForM4Review,
    },
    funds: snapshot.funds.map(fundSummary),
  };
  const manifest: ETFEquityIndexM4RunManifest = {
    ...manifestWithoutHash,
    manifestSha256: canonicalSha256(manifestWithoutHash),
  };
  return { manifest, chunks };
}

export function replayETFEquityIndexM4ArtifactEnvelope(envelope: ETFEquityIndexM4ArtifactEnvelope): ETFEquityIndexM4ReplayResult {
  const issues: string[] = [];
  const { manifest, chunks } = envelope;
  if (!manifest || !Array.isArray(chunks)) {
    return { status: "blocked", artifact: null, rawArtifactSha256: "", issues: ["M4 run envelope is malformed."] };
  }
  if (manifest.schemaVersion !== 1 || manifest.manifestSha256 !== canonicalSha256(digestableManifest(manifest))) {
    issues.push("M4 run manifest hash or schema version is invalid.");
  }
  if (manifest.runId !== `m4-${manifest.rawArtifactSha256}`) issues.push("M4 run ID does not match its raw artifact hash.");
  if (!validTimestamp(manifest.createdAt) || !validTimestamp(manifest.expiresAt)
    || !Number.isInteger(manifest.retentionDays) || manifest.retentionDays < 1 || manifest.retentionDays > 3650
    || manifest.expiresAt !== new Date(Date.parse(manifest.createdAt) + manifest.retentionDays * 86_400_000).toISOString()) {
    issues.push("M4 manifest creation time, retention period or expiry is invalid.");
  }
  if (manifest.parentRunId !== null && (!/^m4-[a-f0-9]{64}$/.test(manifest.parentRunId) || manifest.parentRunId === manifest.runId)) {
    issues.push("M4 parent run reference is invalid.");
  }
  if (!SHA256_PATTERN.test(manifest.rawArtifactSha256) || !SHA256_PATTERN.test(manifest.artifactIntegritySha256)) {
    issues.push("M4 run manifest contains an invalid SHA-256 digest.");
  }
  if (!Number.isInteger(manifest.artifactChunkCount) || manifest.artifactChunkCount < 1 || chunks.length !== manifest.artifactChunkCount) {
    issues.push("M4 run chunk count differs from the manifest or is invalid.");
  }
  const ordered = [...chunks].sort((left, right) => left.sequence - right.sequence);
  const parts: Buffer[] = [];
  for (const [index, chunk] of ordered.entries()) {
    if (chunk.sequence !== index || chunk.id !== String(index).padStart(4, "0")
      || chunk.chunkCount !== manifest.artifactChunkCount || chunk.encoding !== "base64" || chunk.expiresAt !== manifest.expiresAt) {
      issues.push(`M4 artifact chunk ${index} has an invalid sequence or count.`);
      continue;
    }
    const bytes = Buffer.from(chunk.contentBase64, "base64");
    if (bytes.toString("base64") !== chunk.contentBase64 || bytes.byteLength !== chunk.rawByteLength
      || bytes.byteLength < 1 || sha256Bytes(bytes) !== chunk.contentSha256) {
      issues.push(`M4 artifact chunk ${index} failed its base64, length or SHA-256 check.`);
      continue;
    }
    if (bytes.byteLength > ETF_M4_ARTIFACT_CHUNK_BYTES) issues.push(`M4 artifact chunk ${index} exceeds the safe Firestore chunk payload.`);
    parts.push(bytes);
  }
  if (issues.length) return { status: "blocked", artifact: null, rawArtifactSha256: "", issues: [...new Set(issues)] };

  const bytes = Buffer.concat(parts);
  const rawArtifactSha256 = sha256Bytes(bytes);
  if (bytes.byteLength !== manifest.rawArtifactBytes || rawArtifactSha256 !== manifest.rawArtifactSha256) {
    issues.push("Reassembled M4 artifact length or raw-text hash does not match the manifest.");
  }
  let artifact: ETFEquityIndexM3Artifact | null = null;
  const rawText = bytes.toString("utf8");
  if (!Buffer.from(rawText, "utf8").equals(bytes)) issues.push("Reassembled M4 artifact is not valid UTF-8 text.");
  try {
    artifact = JSON.parse(rawText) as ETFEquityIndexM3Artifact;
  } catch {
    issues.push("Reassembled M4 artifact is not valid UTF-8 JSON text.");
  }
  if (artifact) {
    const replay = verifyETFEquityIndexM3Artifact(artifact);
    if (replay.status !== "passed") issues.push(`Persisted M3 artifact replay failed: ${replay.issues.join(" ")}`);
    if (artifact.integrityManifest.artifactHash !== manifest.artifactIntegritySha256
      || artifact.snapshot.methodologyVersion !== manifest.methodologyVersion
      || artifact.snapshot.sampleId !== manifest.sampleId
      || artifact.snapshot.sampleSha256 !== manifest.sampleSha256
      || artifact.snapshot.commonCutoff !== manifest.commonCutoff
      || artifact.snapshot.asOf !== manifest.sourceCaptureAt
      || manifest.promotionEligible !== (artifact.snapshot.validation.captureValidity === "pass"
        && artifact.snapshot.validation.independentCalculation.status === "pass"
        && artifact.snapshot.validation.batchReadyForM4Review)
      || canonicalSha256(artifact.snapshot.funds.map(fundSummary)) !== canonicalSha256(manifest.funds)) {
      issues.push("M4 manifest identity does not match the persisted M3 artifact.");
    }
  }
  return {
    status: issues.length === 0 ? "passed" : "blocked",
    artifact: issues.length === 0 ? artifact : null,
    rawArtifactSha256,
    issues: [...new Set(issues)],
  };
}

export function compareETFEquityIndexM4HistoryRevisions(
  previous: ETFEquityIndexM4RunManifest,
  current: ETFEquityIndexM4RunManifest,
): Array<{
  ticker: string;
  previousHistorySha256: string | null;
  currentHistorySha256: string | null;
  status: "unchanged" | "available" | "revised" | "unavailable";
}> {
  if (previous.methodologyVersion !== current.methodologyVersion || previous.sampleId !== current.sampleId
    || previous.sampleSha256 !== current.sampleSha256) {
    throw new Error("M4 history revisions can only be compared within the same method and frozen sample.");
  }
  const previousByTicker = new Map(previous.funds.map((fund) => [fund.ticker, fund.historySha256]));
  return current.funds.map((fund) => {
    const previousHistorySha256 = previousByTicker.get(fund.ticker) ?? null;
    const currentHistorySha256 = fund.historySha256;
    const status = previousHistorySha256 === currentHistorySha256
      ? "unchanged"
      : previousHistorySha256 === null
        ? "available"
        : currentHistorySha256 === null
          ? "unavailable"
          : "revised";
    return { ticker: fund.ticker, previousHistorySha256, currentHistorySha256, status };
  });
}

export interface ETFEquityIndexM4TickerCheckpoint {
  ticker: string;
  status: "pending" | "capturing" | "captured" | "retryable-failure" | "failed";
  attempts: number;
  leaseUntil: string | null;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  historySha256: string | null;
}

export interface ETFEquityIndexM4ProgressCheckpoint {
  schemaVersion: 1;
  budgetScope: typeof ETF_M4_YAHOO_BUDGET_SCOPE;
  runId: string;
  sampleSha256: string;
  commonCutoff: string;
  expiresAt: string;
  revision: number;
  status: "running" | "partial" | "complete";
  updatedAt: string;
  currentHour: string;
  requestsThisHour: number;
  maxRequestsPerHour: number;
  maxAttemptsPerTicker: number;
  leaseMs: number;
  tickers: ETFEquityIndexM4TickerCheckpoint[];
}

export function createETFEquityIndexM4Progress(input: {
  manifest: ETFEquityIndexM4RunManifest;
  now: string;
  maxRequestsPerHour: number;
  maxAttemptsPerTicker: number;
  leaseMs?: number;
  previousCheckpoint?: ETFEquityIndexM4ProgressCheckpoint | null;
}): ETFEquityIndexM4ProgressCheckpoint {
  if (!validTimestamp(input.now)) throw new Error("M4 progress updatedAt must be a canonical UTC timestamp.");
  if (!Number.isInteger(input.maxRequestsPerHour) || input.maxRequestsPerHour < 1) throw new Error("M4 maxRequestsPerHour must be a positive integer.");
  if (!Number.isInteger(input.maxAttemptsPerTicker) || input.maxAttemptsPerTicker < 1) throw new Error("M4 maxAttemptsPerTicker must be a positive integer.");
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  if (!Number.isInteger(leaseMs) || leaseMs < 1 || leaseMs > HOUR_MS) throw new Error("M4 ticker lease must be between 1 ms and one hour.");
  const previous = input.previousCheckpoint ?? null;
  if (previous?.status === "running" && Date.parse(previous.expiresAt) > Date.parse(input.now)) {
    throw new Error("An M4 run is already active in the shared Yahoo request-budget scope.");
  }
  if (previous && previous.budgetScope !== ETF_M4_YAHOO_BUDGET_SCOPE) throw new Error("Prior M4 progress uses an unsupported request-budget scope.");
  if (previous && previous.maxRequestsPerHour !== input.maxRequestsPerHour) {
    throw new Error("M4 hourly request limit cannot change while carrying forward the active hour's request count.");
  }
  const currentHour = input.now.slice(0, 13);
  if (previous && previous.currentHour > currentHour) throw new Error("M4 progress clock moved backwards across UTC budget windows.");
  const sameHour = previous?.currentHour === currentHour;
  return {
    schemaVersion: 1,
    budgetScope: ETF_M4_YAHOO_BUDGET_SCOPE,
    runId: input.manifest.runId,
    sampleSha256: input.manifest.sampleSha256,
    commonCutoff: input.manifest.commonCutoff,
    expiresAt: input.manifest.expiresAt,
    revision: previous ? previous.revision + 1 : 0,
    status: "running",
    updatedAt: input.now,
    currentHour,
    requestsThisHour: sameHour ? previous.requestsThisHour : 0,
    maxRequestsPerHour: input.maxRequestsPerHour,
    maxAttemptsPerTicker: input.maxAttemptsPerTicker,
    leaseMs,
    tickers: input.manifest.funds.map((fund) => ({
      ticker: fund.ticker,
      status: "pending",
      attempts: 0,
      leaseUntil: null,
      nextAttemptAt: null,
      lastAttemptAt: null,
      lastError: null,
      historySha256: null,
    })),
  };
}

function copyProgress(progress: ETFEquityIndexM4ProgressCheckpoint): ETFEquityIndexM4ProgressCheckpoint {
  return { ...progress, tickers: progress.tickers.map((ticker) => ({ ...ticker })) };
}

function finishProgress(progress: ETFEquityIndexM4ProgressCheckpoint): void {
  const pending = progress.tickers.some((ticker) => ticker.status === "pending" || ticker.status === "capturing" || ticker.status === "retryable-failure");
  if (pending) progress.status = "running";
  else progress.status = progress.tickers.every((ticker) => ticker.status === "captured") ? "complete" : "partial";
}

/** Pure transition; persist the returned checkpoint with a revision compare-and-set. */
export function claimETFEquityIndexM4Ticker(input: {
  checkpoint: ETFEquityIndexM4ProgressCheckpoint;
  now: string;
}): { checkpoint: ETFEquityIndexM4ProgressCheckpoint; ticker: string | null; reason: string | null } {
  if (!validTimestamp(input.now)) throw new Error("M4 claim time must be a canonical UTC timestamp.");
  const checkpoint = copyProgress(input.checkpoint);
  const nowMs = Date.parse(input.now);
  const currentHour = input.now.slice(0, 13);
  if (currentHour < checkpoint.currentHour) throw new Error("M4 progress clock moved backwards across UTC budget windows.");
  let changed = false;
  if (checkpoint.currentHour !== currentHour) {
    checkpoint.currentHour = currentHour;
    checkpoint.requestsThisHour = 0;
    changed = true;
  }
  for (const item of checkpoint.tickers) {
    const leaseExpired = item.status === "capturing" && item.leaseUntil && Date.parse(item.leaseUntil) <= nowMs;
    const retriesExhausted = item.attempts >= checkpoint.maxAttemptsPerTicker;
    if (leaseExpired && retriesExhausted) {
      item.status = "failed";
      item.leaseUntil = null;
      item.lastError = "Capture lease expired after retry exhaustion.";
      changed = true;
    } else if (item.status === "retryable-failure" && retriesExhausted) {
      item.status = "failed";
      item.nextAttemptAt = null;
      changed = true;
    }
  }
  const priorStatus = checkpoint.status;
  finishProgress(checkpoint);
  if (checkpoint.status !== priorStatus) changed = true;
  if (checkpoint.status !== "running") {
    if (changed) {
      checkpoint.revision += 1;
      checkpoint.updatedAt = input.now;
    }
    return { checkpoint, ticker: null, reason: "run-finished" };
  }
  if (checkpoint.requestsThisHour >= checkpoint.maxRequestsPerHour) {
    if (changed) {
      checkpoint.revision += 1;
      checkpoint.updatedAt = input.now;
    }
    return { checkpoint, ticker: null, reason: "hourly-budget-exhausted" };
  }
  const next = checkpoint.tickers.find((item) => {
    if (item.attempts >= checkpoint.maxAttemptsPerTicker) return false;
    if (item.status === "pending") return true;
    if (item.status === "retryable-failure") return !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= nowMs;
    if (item.status === "capturing") return Boolean(item.leaseUntil && Date.parse(item.leaseUntil) <= nowMs);
    return false;
  });
  if (!next) {
    if (changed) {
      checkpoint.revision += 1;
      checkpoint.updatedAt = input.now;
    }
    return { checkpoint, ticker: null, reason: "no-ticker-ready" };
  }
  next.status = "capturing";
  next.attempts += 1;
  next.lastAttemptAt = input.now;
  next.leaseUntil = new Date(nowMs + checkpoint.leaseMs).toISOString();
  next.nextAttemptAt = null;
  next.lastError = null;
  checkpoint.requestsThisHour += 1;
  checkpoint.revision += 1;
  checkpoint.updatedAt = input.now;
  return { checkpoint, ticker: next.ticker, reason: null };
}

function sanitizeError(message: string): string {
  return message.replace(/https?:\/\/\S+/g, "provider URL").slice(0, 240);
}

function checkpointTicker(
  source: ETFEquityIndexM4ProgressCheckpoint,
  ticker: string,
  now: string,
): { checkpoint: ETFEquityIndexM4ProgressCheckpoint; entry: ETFEquityIndexM4TickerCheckpoint } {
  if (!validTimestamp(now)) throw new Error("M4 checkpoint time must be a canonical UTC timestamp.");
  const checkpoint = copyProgress(source);
  const entry = checkpoint.tickers.find((item) => item.ticker === ticker);
  if (!entry || entry.status !== "capturing") throw new Error(`Ticker ${ticker} does not have an active M4 capture lease.`);
  if (!entry.leaseUntil || Date.parse(entry.leaseUntil) <= Date.parse(now)) throw new Error(`Ticker ${ticker} M4 capture lease expired.`);
  checkpoint.updatedAt = now;
  checkpoint.revision += 1;
  entry.leaseUntil = null;
  return { checkpoint, entry };
}

export function recordETFEquityIndexM4TickerSuccess(input: {
  checkpoint: ETFEquityIndexM4ProgressCheckpoint;
  ticker: string;
  historySha256: string;
  now: string;
}): ETFEquityIndexM4ProgressCheckpoint {
  if (!SHA256_PATTERN.test(input.historySha256)) throw new Error("Captured M4 history must include a SHA-256 digest.");
  const { checkpoint, entry } = checkpointTicker(input.checkpoint, input.ticker, input.now);
  entry.status = "captured";
  entry.historySha256 = input.historySha256;
  entry.lastError = null;
  entry.nextAttemptAt = null;
  finishProgress(checkpoint);
  return checkpoint;
}

export function recordETFEquityIndexM4TickerFailure(input: {
  checkpoint: ETFEquityIndexM4ProgressCheckpoint;
  ticker: string;
  error: string;
  retryable: boolean;
  now: string;
}): ETFEquityIndexM4ProgressCheckpoint {
  const { checkpoint, entry } = checkpointTicker(input.checkpoint, input.ticker, input.now);
  entry.lastError = sanitizeError(input.error);
  const canRetry = input.retryable && entry.attempts < checkpoint.maxAttemptsPerTicker;
  if (canRetry) {
    const delay = Math.min(15_000 * 2 ** Math.max(0, entry.attempts - 1), MAX_RETRY_DELAY_MS);
    entry.status = "retryable-failure";
    entry.nextAttemptAt = new Date(Date.parse(input.now) + delay).toISOString();
  } else {
    entry.status = "failed";
    entry.nextAttemptAt = null;
  }
  finishProgress(checkpoint);
  return checkpoint;
}

export function assertETFEquityIndexM4ResumeCompatible(
  checkpoint: ETFEquityIndexM4ProgressCheckpoint,
  manifest: ETFEquityIndexM4RunManifest,
): void {
  const checkpointTickers = checkpoint.tickers.map((item) => item.ticker);
  const manifestTickers = manifest.funds.map((item) => item.ticker);
  if (checkpoint.schemaVersion !== 1 || checkpoint.budgetScope !== ETF_M4_YAHOO_BUDGET_SCOPE
    || checkpoint.runId !== manifest.runId || checkpoint.sampleSha256 !== manifest.sampleSha256
    || checkpoint.commonCutoff !== manifest.commonCutoff || checkpoint.expiresAt !== manifest.expiresAt
    || JSON.stringify(checkpointTickers) !== JSON.stringify(manifestTickers)) {
    throw new Error("M4 resume checkpoint does not match the immutable run, sample, cutoff and ticker order.");
  }
}

export interface ETFEquityIndexM4RunStorePort {
  /** Create-only: an existing chunk with different bytes must fail, never replace. */
  putChunkIfAbsent(runId: string, chunk: ETFEquityIndexM4ArtifactChunk): Promise<void>;
  /** Create-only: an existing manifest with different content must fail, never replace. */
  putManifestIfAbsent(manifest: ETFEquityIndexM4RunManifest): Promise<void>;
  getManifest(runId: string): Promise<ETFEquityIndexM4RunManifest | null>;
  getChunks(runId: string): Promise<ETFEquityIndexM4ArtifactChunk[]>;
  getProgress(budgetScope: typeof ETF_M4_YAHOO_BUDGET_SCOPE): Promise<ETFEquityIndexM4ProgressCheckpoint | null>;
  /** Store one active checkpoint at the shared provider budget scope; compare revision in one transaction. */
  compareAndSetProgress(budgetScope: typeof ETF_M4_YAHOO_BUDGET_SCOPE, expectedRevision: number, checkpoint: ETFEquityIndexM4ProgressCheckpoint): Promise<boolean>;
  /** Must atomically keep the newest promotion-eligible run; partial runs cannot replace it. */
  advanceLatestSuccessfulRun(manifest: ETFEquityIndexM4RunManifest): Promise<void>;
}

export async function persistETFEquityIndexM4ArtifactEnvelope(input: {
  envelope: ETFEquityIndexM4ArtifactEnvelope;
  store: ETFEquityIndexM4RunStorePort;
  policy: ETFM4DataUsePolicy;
  now?: Date;
}): Promise<{ replay: ETFEquityIndexM4ReplayResult; promoted: boolean }> {
  assertETFEquityIndexM4RetentionAllowed(input.policy, input.now);
  const { manifest, chunks } = input.envelope;
  const preflight = replayETFEquityIndexM4ArtifactEnvelope(input.envelope);
  if (preflight.status !== "passed") throw new Error(`M4 run preflight replay failed: ${preflight.issues.join(" ")}`);
  for (const chunk of chunks) await input.store.putChunkIfAbsent(manifest.runId, chunk);
  await input.store.putManifestIfAbsent(manifest);
  const [storedManifest, storedChunks] = await Promise.all([
    input.store.getManifest(manifest.runId),
    input.store.getChunks(manifest.runId),
  ]);
  if (!storedManifest) throw new Error(`M4 manifest readback failed for ${manifest.runId}.`);
  const replay = replayETFEquityIndexM4ArtifactEnvelope({ manifest: storedManifest, chunks: storedChunks });
  if (replay.status !== "passed") throw new Error(`M4 persisted run replay failed: ${replay.issues.join(" ")}`);
  if (!manifest.promotionEligible) return { replay, promoted: false };
  await input.store.advanceLatestSuccessfulRun(manifest);
  return { replay, promoted: true };
}
