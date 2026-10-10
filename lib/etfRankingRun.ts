import { createHash } from "node:crypto";
import {
  rankFunds,
  RANKING_METHOD_VERSION,
  RANKING_TIE_THRESHOLD,
  type FundRankingResult,
  type RankingBar,
  type RankingFundInput,
  type RankingRun,
} from "./etfRanking";
import { CASH_TICKER, type StoredFundInputMeta } from "./etfRankingInputs";
import { runFlagsFor, VOLUME_CONSOLIDATION_VERIFIED } from "./etfRunFlags";

// Stored-run builder (plan Section 6, Storage; Phase 3). Pure: callers load the history and the CSV metadata.
// Scores come only from rankFunds. Flags are attached after scoring and never change a score.

export interface RankingSnapshot {
  cutoff: string;
  metas: StoredFundInputMeta[];
  barsByTicker: Record<string, RankingBar[]>;
}

export interface StoredFundResult extends FundRankingResult {
  flags: string[];
}

export interface StoredRankingRun {
  methodVersion: string;
  cutoff: string;
  tieThreshold: number;
  capturedAt: string;
  inputHash: string;
  volumeVerified: boolean;
  inputs: StoredFundInputMeta[];
  funds: StoredFundResult[];
}

export interface ReproductionResult {
  hashMatches: boolean;
  scoresMatch: boolean;
  recomputedHash: string;
}

// Fail closed: no imputed volume. Old history chunks carry no volume until the backfill is run.
export function assertBarsUsable(ticker: string, bars: readonly RankingBar[]): void {
  const missingVolume = bars.filter((bar) => typeof bar.volume !== "number" || !Number.isFinite(bar.volume) || bar.volume < 0).length;
  if (missingVolume > 0) {
    throw new Error(`${ticker}: ${missingVolume} bars have no usable volume. Backfill history before building a run.`);
  }
  for (let index = 1; index < bars.length; index += 1) {
    if (bars[index - 1].date >= bars[index].date) {
      throw new Error(`${ticker}: history is not strictly ascending by date at ${bars[index].date}.`);
    }
  }
}

export function validateSnapshot(snapshot: RankingSnapshot): void {
  const seen = new Set<string>();
  for (const meta of snapshot.metas) {
    if (seen.has(meta.ticker)) throw new Error(`${meta.ticker}: listed twice in the inputs.`);
    seen.add(meta.ticker);
    const bars = snapshot.barsByTicker[meta.ticker];
    if (!bars) throw new Error(`${meta.ticker}: no stored history.`);
    assertBarsUsable(meta.ticker, bars);
  }
  if (!snapshot.barsByTicker[CASH_TICKER]) throw new Error(`${CASH_TICKER}: cash proxy history is missing.`);
}

// Canonical hash over the run's inputs. Fund order does not matter (sorted by ticker). Bar order is date order.
export function inputHashOf(snapshot: RankingSnapshot): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify([RANKING_METHOD_VERSION, snapshot.cutoff, RANKING_TIE_THRESHOLD]));
  const sorted = [...snapshot.metas].sort((left, right) => (left.ticker < right.ticker ? -1 : left.ticker > right.ticker ? 1 : 0));
  for (const meta of sorted) {
    const metaRow = [meta.ticker, meta.structure, meta.productClass, meta.legalFormVerified, meta.netExpenseRatioPct, meta.aumUsd, meta.aumAsOf, meta.feeAsOf];
    const bars = (snapshot.barsByTicker[meta.ticker] ?? []).map((bar) => [bar.date, bar.close, bar.adjustedClose, bar.volume]);
    hash.update(JSON.stringify([metaRow, bars]));
  }
  return hash.digest("hex");
}

function toRankingInput(meta: StoredFundInputMeta, bars: RankingBar[]): RankingFundInput {
  return {
    ticker: meta.ticker,
    structure: meta.structure,
    productClass: meta.productClass,
    legalFormVerified: meta.legalFormVerified,
    netExpenseRatioPct: meta.netExpenseRatioPct,
    aumUsd: meta.aumUsd,
    aumAsOf: meta.aumAsOf,
    bars,
  };
}

export function scoreSnapshot(snapshot: RankingSnapshot): RankingRun {
  const inputs = snapshot.metas.map((meta) => toRankingInput(meta, snapshot.barsByTicker[meta.ticker]));
  return rankFunds(inputs, { cutoff: snapshot.cutoff, cashBars: snapshot.barsByTicker[CASH_TICKER] });
}

export function buildStoredRun(snapshot: RankingSnapshot, capturedAt: string): StoredRankingRun {
  validateSnapshot(snapshot);
  const run = scoreSnapshot(snapshot);
  const metaByTicker = new Map(snapshot.metas.map((meta) => [meta.ticker, meta]));
  const funds: StoredFundResult[] = run.funds.map((fund) => {
    const meta = metaByTicker.get(fund.ticker)!;
    return {
      ...fund,
      flags: runFlagsFor({ state: fund.state, legalFormVerified: meta.legalFormVerified, feeAsOf: meta.feeAsOf, cutoff: snapshot.cutoff }),
    };
  });
  return {
    methodVersion: run.methodVersion,
    cutoff: snapshot.cutoff,
    tieThreshold: run.tieThreshold,
    capturedAt,
    inputHash: inputHashOf(snapshot),
    volumeVerified: VOLUME_CONSOLIDATION_VERIFIED,
    inputs: snapshot.metas,
    funds,
  };
}

// Rebuilds a run from what was stored (input metadata in the run document, bars from the history chunks)
// and checks the hash and every score. Flags are excluded from the score comparison.
export function reproduceStoredRun(stored: StoredRankingRun, barsByTicker: Record<string, RankingBar[]>): ReproductionResult {
  const snapshot: RankingSnapshot = { cutoff: stored.cutoff, metas: stored.inputs, barsByTicker };
  const rebuilt = buildStoredRun(snapshot, stored.capturedAt);
  // JSON.stringify omits undefined fields, so blanking flags leaves only the scores.
  const scoresOnly = (funds: StoredFundResult[]) => JSON.stringify(funds.map((fund) => ({ ...fund, flags: undefined })));
  return {
    hashMatches: rebuilt.inputHash === stored.inputHash,
    scoresMatch: scoresOnly(rebuilt.funds) === scoresOnly(stored.funds),
    recomputedHash: rebuilt.inputHash,
  };
}
