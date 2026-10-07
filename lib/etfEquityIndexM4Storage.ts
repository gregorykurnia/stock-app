import { createHash } from "node:crypto";
import {
  type ETFEquityIndexM3Artifact,
  type ETFEquityIndexM3History,
  type ETFEquityIndexM3FundSnapshot,
  type ETFEquityIndexM3Sample,
  verifyETFEquityIndexM3Artifact,
} from "./etfEquityIndexM3Validation";
import { canonicalSha256 } from "./etfEquityIndexValidationBatch";
import {
  assertETFEquityIndexM4RetentionAllowed,
  assertETFEquityIndexM4YahooAcquisitionAllowed,
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

export interface ETFEquityIndexM4AcquisitionPlan {
  schemaVersion: 1;
  acquisitionId: string;
  sampleId: string;
  sampleSha256: string;
  commonCutoff: string;
  createdAt: string;
  expiresAt: string;
  tickers: string[];
  planSha256: string;
}

export interface ETFEquityIndexM4TickerHistoryStage {
  schemaVersion: 1;
  acquisitionId: string;
  sampleSha256: string;
  ticker: string;
  createdAt: string;
  expiresAt: string;
  history: ETFEquityIndexM3History;
  historySha256: string;
  stageSha256: string;
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

function validDateOnly(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function digestableManifest(manifest: ETFEquityIndexM4RunManifest): Omit<ETFEquityIndexM4RunManifest, "manifestSha256"> {
  const digestable = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "manifestSha256"));
  return digestable as Omit<ETFEquityIndexM4RunManifest, "manifestSha256">;
}

function historySha256(history: ETFEquityIndexM3History): string {
  return canonicalSha256({
    provider: history.provider,
    sourceId: history.sourceId,
    sourceUrl: history.sourceUrl,
    retrievedAt: history.retrievedAt,
    currency: history.currency,
    bars: history.bars,
  });
}

function digestableHistoryStage(stage: ETFEquityIndexM4TickerHistoryStage): Omit<ETFEquityIndexM4TickerHistoryStage, "stageSha256"> {
  const digestable = Object.fromEntries(Object.entries(stage).filter(([key]) => key !== "stageSha256"));
  return digestable as Omit<ETFEquityIndexM4TickerHistoryStage, "stageSha256">;
}

function digestableAcquisitionPlan(plan: ETFEquityIndexM4AcquisitionPlan): Omit<ETFEquityIndexM4AcquisitionPlan, "planSha256"> {
  const digestable = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "planSha256"));
  return digestable as Omit<ETFEquityIndexM4AcquisitionPlan, "planSha256">;
}

function validAcquisitionPlan(plan: ETFEquityIndexM4AcquisitionPlan): boolean {
  if (!isRecord(plan)) return false;
  return plan.schemaVersion === 1
    && /^m4a-[a-f0-9]{64}$/.test(plan.acquisitionId)
    && typeof plan.sampleId === "string" && plan.sampleId.length > 0
    && SHA256_PATTERN.test(plan.sampleSha256)
    && validDateOnly(plan.commonCutoff)
    && validTimestamp(plan.createdAt) && validTimestamp(plan.expiresAt)
    && Date.parse(plan.expiresAt) > Date.parse(plan.createdAt)
    && Array.isArray(plan.tickers) && plan.tickers.length > 0
    && plan.tickers.every((ticker) => /^[A-Z0-9.-]{1,12}$/.test(ticker))
    && new Set(plan.tickers).size === plan.tickers.length
    && plan.planSha256 === canonicalSha256(digestableAcquisitionPlan(plan))
    && plan.acquisitionId === `m4a-${canonicalSha256({
      sampleId: plan.sampleId,
      sampleSha256: plan.sampleSha256,
      commonCutoff: plan.commonCutoff,
      createdAt: plan.createdAt,
      expiresAt: plan.expiresAt,
      tickers: plan.tickers,
    })}`;
}

export function createETFEquityIndexM4AcquisitionPlan(input: {
  sample: ETFEquityIndexM3Sample;
  sampleSha256: string;
  commonCutoff: string;
  createdAt: string;
  policy: ETFM4DataUsePolicy;
  now?: Date;
}): ETFEquityIndexM4AcquisitionPlan {
  assertETFEquityIndexM4YahooAcquisitionAllowed(input.policy, input.now);
  if (!input.sample || input.sample.frozenBeforePriceAcquisition !== true
    || typeof input.sample.sampleId !== "string" || input.sample.sampleId.length === 0
    || !SHA256_PATTERN.test(input.sampleSha256) || !validDateOnly(input.commonCutoff)
    || !validTimestamp(input.createdAt) || input.commonCutoff > input.createdAt.slice(0, 10)) {
    throw new Error("M4 acquisition plan requires a frozen sample identity, SHA-256, cutoff and canonical creation time.");
  }
  const tickers = input.sample.funds.map((fund) => fund.ticker);
  if (tickers.length === 0 || tickers.some((ticker) => !/^[A-Z0-9.-]{1,12}$/.test(ticker))
    || new Set(tickers).size !== tickers.length) {
    throw new Error("M4 acquisition plan requires a nonempty frozen sample with unique valid tickers.");
  }
  const retentionDays = input.policy.retentionDays as number;
  const expiresAt = new Date(Date.parse(input.createdAt) + retentionDays * 86_400_000).toISOString();
  const now = input.now ?? new Date();
  if (Date.parse(input.createdAt) > now.getTime() || Date.parse(expiresAt) <= now.getTime()) {
    throw new Error("M4 acquisition plan creation time must be current and inside its configured retention window.");
  }
  const identity = {
    sampleId: input.sample.sampleId,
    sampleSha256: input.sampleSha256,
    commonCutoff: input.commonCutoff,
    createdAt: input.createdAt,
    expiresAt,
    tickers,
  };
  const acquisitionId = `m4a-${canonicalSha256(identity)}`;
  const planWithoutHash = { schemaVersion: 1 as const, acquisitionId, ...identity };
  return { ...planWithoutHash, planSha256: canonicalSha256(planWithoutHash) };
}

function validateHistory(historyValue: unknown, ticker: string): string[] {
  const issues: string[] = [];
  if (!isRecord(historyValue)) return ["M4 ticker history must be an object."];
  const history = historyValue as unknown as ETFEquityIndexM3History;
  if (history.provider !== "Yahoo Finance" || history.sourceId !== "yahoo-finance2.chart:adjusted-close") {
    issues.push("M4 ticker staging accepts only the registered Yahoo adjusted-close source contract.");
  }
  try {
    const source = new URL(history.sourceUrl);
    if (source.protocol !== "https:" || source.hostname !== "finance.yahoo.com"
      || source.pathname !== `/quote/${ticker}/history/` || source.search || source.hash) {
      issues.push("M4 ticker history source URL is not the canonical ticker-specific Yahoo history page.");
    }
  } catch {
    issues.push("M4 ticker history source URL is invalid.");
  }
  if (!validTimestamp(history.retrievedAt)) issues.push("M4 ticker history retrievedAt must be a canonical UTC timestamp.");
  if (history.currency !== "USD") issues.push("M4 ticker history must be denominated in USD.");
  if (!Array.isArray(history.bars) || history.bars.length === 0) {
    issues.push("M4 ticker history must contain at least one adjusted-close observation.");
  } else {
    let previousDate = "";
    for (const barValue of history.bars) {
      if (!isRecord(barValue)) {
        issues.push("M4 ticker history contains an invalid date or nonpositive adjusted close.");
        break;
      }
      const bar = barValue as unknown as { date: string; adjustedClose: number };
      const parsedDate = new Date(`${bar.date}T00:00:00.000Z`);
      if (typeof bar.date !== "string" || !validDateOnly(bar.date) || !Number.isFinite(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== bar.date || !Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0) {
        issues.push("M4 ticker history contains an invalid date or nonpositive adjusted close.");
        break;
      }
      if (previousDate && bar.date <= previousDate) {
        issues.push("M4 ticker history dates must be unique and strictly increasing.");
        break;
      }
      previousDate = bar.date;
    }
    if (validTimestamp(history.retrievedAt) && previousDate > history.retrievedAt.slice(0, 10)) {
      issues.push("M4 ticker history contains a price date after its retrieval timestamp.");
    }
  }
  return issues;
}

export function createETFEquityIndexM4TickerHistoryStage(input: {
  plan: ETFEquityIndexM4AcquisitionPlan;
  ticker: string;
  history: ETFEquityIndexM3History;
  policy: ETFM4DataUsePolicy;
  createdAt: string;
  now?: Date;
}): ETFEquityIndexM4TickerHistoryStage {
  assertETFEquityIndexM4YahooAcquisitionAllowed(input.policy, input.now);
  if (!validAcquisitionPlan(input.plan)) throw new Error("M4 ticker stage acquisition plan is malformed or has an invalid integrity hash.");
  if (!validTimestamp(input.createdAt)) throw new Error("M4 ticker stage createdAt must be a canonical UTC timestamp.");
  if (Date.parse(input.createdAt) < Date.parse(input.plan.createdAt) || Date.parse(input.createdAt) >= Date.parse(input.plan.expiresAt)) {
    throw new Error("M4 ticker stage time must fall inside the acquisition plan's retention window.");
  }
  if (!/^[A-Z0-9.-]{1,12}$/.test(input.ticker) || !input.plan.tickers.includes(input.ticker)) {
    throw new Error("M4 ticker stage must reference a ticker registered in the immutable acquisition plan.");
  }
  const issues = validateHistory(input.history, input.ticker);
  if (issues.length) throw new Error(`M4 ticker history staging blocked: ${issues.join(" ")}`);
  const stageWithoutHash = {
    schemaVersion: 1 as const,
    acquisitionId: input.plan.acquisitionId,
    sampleSha256: input.plan.sampleSha256,
    ticker: input.ticker,
    createdAt: input.createdAt,
    expiresAt: input.plan.expiresAt,
    history: input.history,
    historySha256: historySha256(input.history),
  };
  return { ...stageWithoutHash, stageSha256: canonicalSha256(stageWithoutHash) };
}

export function verifyETFEquityIndexM4TickerHistoryStage(input: {
  plan: ETFEquityIndexM4AcquisitionPlan;
  stage: ETFEquityIndexM4TickerHistoryStage;
  now?: Date;
}): { status: "passed" | "blocked"; issues: string[] } {
  const { plan, stage } = input;
  const issues: string[] = [];
  if (!validAcquisitionPlan(plan)) {
    return { status: "blocked", issues: ["M4 ticker stage acquisition plan is malformed or has an invalid integrity hash."] };
  }
  if (!isRecord(stage)) return { status: "blocked", issues: ["M4 ticker history stage is malformed."] };
  if (stage.schemaVersion !== 1 || stage.acquisitionId !== plan.acquisitionId || stage.sampleSha256 !== plan.sampleSha256
    || !plan.tickers.includes(stage.ticker)) {
    issues.push("M4 ticker history stage does not match the immutable acquisition plan and frozen sample.");
  }
  if (!validTimestamp(stage.createdAt) || !validTimestamp(stage.expiresAt) || stage.expiresAt !== plan.expiresAt
    || Date.parse(stage.createdAt) < Date.parse(plan.createdAt) || Date.parse(stage.createdAt) >= Date.parse(plan.expiresAt)) {
    issues.push("M4 ticker history stage timestamps do not match the immutable run retention window.");
  }
  if (input.now && Date.parse(stage.expiresAt) <= input.now.getTime()) issues.push("M4 ticker history stage has expired.");
  const historyIssues = validateHistory(stage.history, stage.ticker);
  issues.push(...historyIssues);
  if (historyIssues.length === 0
    && (!SHA256_PATTERN.test(stage.historySha256) || historySha256(stage.history) !== stage.historySha256)) {
    issues.push("M4 staged history SHA-256 does not match its provider metadata and adjusted-close bars.");
  }
  if (!SHA256_PATTERN.test(stage.stageSha256) || canonicalSha256(digestableHistoryStage(stage)) !== stage.stageSha256) {
    issues.push("M4 ticker history stage content hash is invalid.");
  }
  return { status: issues.length === 0 ? "passed" : "blocked", issues: [...new Set(issues)] };
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
  acquisitionId: string;
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
  plan: ETFEquityIndexM4AcquisitionPlan;
  now: string;
  maxRequestsPerHour: number;
  maxAttemptsPerTicker: number;
  leaseMs?: number;
  previousCheckpoint?: ETFEquityIndexM4ProgressCheckpoint | null;
}): ETFEquityIndexM4ProgressCheckpoint {
  if (!validAcquisitionPlan(input.plan)) throw new Error("M4 progress requires a valid immutable acquisition plan.");
  if (!validTimestamp(input.now)) throw new Error("M4 progress updatedAt must be a canonical UTC timestamp.");
  if (!Number.isInteger(input.maxRequestsPerHour) || input.maxRequestsPerHour < 1) throw new Error("M4 maxRequestsPerHour must be a positive integer.");
  if (!Number.isInteger(input.maxAttemptsPerTicker) || input.maxAttemptsPerTicker < 1) throw new Error("M4 maxAttemptsPerTicker must be a positive integer.");
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  if (!Number.isInteger(leaseMs) || leaseMs < 1 || leaseMs > HOUR_MS) throw new Error("M4 ticker lease must be between 1 ms and one hour.");
  const previous = input.previousCheckpoint ?? null;
  if (previous?.status === "running" && Date.parse(previous.expiresAt) > Date.parse(input.now)) {
    throw new Error("An M4 acquisition is already active in the shared Yahoo request-budget scope.");
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
    acquisitionId: input.plan.acquisitionId,
    sampleSha256: input.plan.sampleSha256,
    commonCutoff: input.plan.commonCutoff,
    expiresAt: input.plan.expiresAt,
    revision: previous ? previous.revision + 1 : 0,
    status: "running",
    updatedAt: input.now,
    currentHour,
    requestsThisHour: sameHour ? previous.requestsThisHour : 0,
    maxRequestsPerHour: input.maxRequestsPerHour,
    maxAttemptsPerTicker: input.maxAttemptsPerTicker,
    leaseMs,
    tickers: input.plan.tickers.map((ticker) => ({
      ticker,
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
  plan: ETFEquityIndexM4AcquisitionPlan,
): void {
  const checkpointTickers = checkpoint.tickers.map((item) => item.ticker);
  if (!validAcquisitionPlan(plan)) throw new Error("M4 acquisition plan failed its immutable identity or integrity check.");
  if (checkpoint.schemaVersion !== 1 || checkpoint.budgetScope !== ETF_M4_YAHOO_BUDGET_SCOPE
    || checkpoint.acquisitionId !== plan.acquisitionId || checkpoint.sampleSha256 !== plan.sampleSha256
    || checkpoint.commonCutoff !== plan.commonCutoff || checkpoint.expiresAt !== plan.expiresAt
    || JSON.stringify(checkpointTickers) !== JSON.stringify(plan.tickers)) {
    throw new Error("M4 resume checkpoint does not match the immutable acquisition, sample, cutoff and ticker order.");
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
  /** Create-only acquisition plans and ticker stages allow collection to resume without recapturing completed tickers. */
  putAcquisitionPlanIfAbsent(plan: ETFEquityIndexM4AcquisitionPlan): Promise<void>;
  getAcquisitionPlan(acquisitionId: string): Promise<ETFEquityIndexM4AcquisitionPlan | null>;
  putTickerHistoryStageIfAbsent(stage: ETFEquityIndexM4TickerHistoryStage): Promise<void>;
  getTickerHistoryStage(acquisitionId: string, ticker: string): Promise<ETFEquityIndexM4TickerHistoryStage | null>;
  /** Must atomically keep the newest promotion-eligible run; partial runs cannot replace it. */
  advanceLatestSuccessfulRun(manifest: ETFEquityIndexM4RunManifest): Promise<void>;
}

export async function persistETFEquityIndexM4TickerHistoryStage(input: {
  plan: ETFEquityIndexM4AcquisitionPlan;
  stage: ETFEquityIndexM4TickerHistoryStage;
  store: ETFEquityIndexM4RunStorePort;
  policy: ETFM4DataUsePolicy;
  now?: Date;
}): Promise<ETFEquityIndexM4TickerHistoryStage> {
  assertETFEquityIndexM4YahooAcquisitionAllowed(input.policy, input.now);
  const preflight = verifyETFEquityIndexM4TickerHistoryStage({ plan: input.plan, stage: input.stage, now: input.now });
  if (preflight.status !== "passed") throw new Error(`M4 ticker stage preflight failed: ${preflight.issues.join(" ")}`);
  await input.store.putAcquisitionPlanIfAbsent(input.plan);
  await input.store.putTickerHistoryStageIfAbsent(input.stage);
  const [storedPlan, storedStage] = await Promise.all([
    input.store.getAcquisitionPlan(input.plan.acquisitionId),
    input.store.getTickerHistoryStage(input.plan.acquisitionId, input.stage.ticker),
  ]);
  if (!storedPlan || !storedStage) throw new Error(`M4 ticker history stage readback failed for ${input.stage.ticker}.`);
  const planReplay = validAcquisitionPlan(storedPlan);
  const stageReplay = verifyETFEquityIndexM4TickerHistoryStage({ plan: storedPlan, stage: storedStage, now: input.now });
  if (!planReplay || stageReplay.status !== "passed"
    || canonicalSha256(storedPlan) !== canonicalSha256(input.plan)
    || canonicalSha256(storedStage) !== canonicalSha256(input.stage)) {
    throw new Error(`M4 persisted ticker history stage replay failed for ${input.stage.ticker}: ${stageReplay.issues.join(" ")}`);
  }
  return storedStage;
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
