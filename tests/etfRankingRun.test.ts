import assert from "node:assert/strict";
import test from "node:test";
import type { RankingBar } from "../lib/etfRanking";
import type { StoredFundInputMeta } from "../lib/etfRankingInputs";
import { buildStoredRun, inputHashOf, reproduceStoredRun, type RankingSnapshot } from "../lib/etfRankingRun";
import {
  FLAG_FEE_OLDER_THAN_12_MONTHS,
  FLAG_LEGAL_FORM_NOT_RECORDED,
  FLAG_VOLUME_NOT_VERIFIED,
  feeStaleBefore,
  runFlagsFor,
} from "../lib/etfRunFlags";

const CUTOFF = "2026-09-30";
const DAY_MS = 86_400_000;

// Synthetic daily history, every calendar day from 2014-10-01 to the cutoff. Not market data.
function dailyHistory(startPrice: number, drift: number, volume = 2_000_000): RankingBar[] {
  const bars: RankingBar[] = [];
  const end = Date.parse(`${CUTOFF}T00:00:00Z`);
  let index = 0;
  for (let time = Date.UTC(2014, 9, 1); time <= end; time += DAY_MS, index += 1) {
    const close = startPrice * Math.exp(drift * index + 0.05 * Math.sin(index / 37));
    bars.push({ date: new Date(time).toISOString().slice(0, 10), close, adjustedClose: close, volume });
  }
  return bars;
}

function meta(ticker: string, overrides: Partial<StoredFundInputMeta> = {}): StoredFundInputMeta {
  return {
    ticker,
    structure: "ETF",
    productClass: "standard",
    legalFormVerified: true,
    netExpenseRatioPct: 0.5,
    aumUsd: 1_000_000_000,
    aumAsOf: CUTOFF,
    feeAsOf: "2026-03-01",
    ...overrides,
  };
}

// Three ranked-eligible funds plus the cash proxy. AAA can be varied to test flags.
function snapshot(aaa: Partial<StoredFundInputMeta> = {}): RankingSnapshot {
  const metas = [meta("AAA", aaa), meta("BBB", { structure: "ETF" }), meta("CCC", { feeAsOf: "2025-09-30" }), meta("BIL", { netExpenseRatioPct: 0.14 })];
  const barsByTicker: Record<string, RankingBar[]> = {
    AAA: dailyHistory(100, 0.0004),
    BBB: dailyHistory(120, 0.0002),
    CCC: dailyHistory(90, 0.0006),
    BIL: dailyHistory(100, 0.00001),
  };
  return { cutoff: CUTOFF, metas, barsByTicker };
}

// Scores only: every field except flags, serialised the way a stored run is.
function scoresOf(funds: Array<{ flags?: string[] }>): string {
  return JSON.stringify(funds.map((fund) => ({ ...fund, flags: undefined })));
}

test("fee cutoff: a fee is stale when dated before 2025-09-30 at the 2026-09-30 cutoff", () => {
  assert.equal(feeStaleBefore(CUTOFF), "2025-09-30");
  assert.equal(runFlagsFor({ state: "Ranked", legalFormVerified: true, feeAsOf: "2025-09-29", cutoff: CUTOFF }).includes(FLAG_FEE_OLDER_THAN_12_MONTHS), true);
  assert.equal(runFlagsFor({ state: "Ranked", legalFormVerified: true, feeAsOf: "2025-09-30", cutoff: CUTOFF }).includes(FLAG_FEE_OLDER_THAN_12_MONTHS), false);
  assert.equal(runFlagsFor({ state: "Ranked", legalFormVerified: true, feeAsOf: "2025-03-01", cutoff: CUTOFF }).includes(FLAG_FEE_OLDER_THAN_12_MONTHS), true);
  assert.equal(runFlagsFor({ state: "Ranked", legalFormVerified: true, feeAsOf: null, cutoff: CUTOFF }).includes(FLAG_FEE_OLDER_THAN_12_MONTHS), false);
});

test("legal-form flag: only Ranked funds with legal form not verified", () => {
  const cutoffInput = { cutoff: CUTOFF, feeAsOf: "2026-03-01" };
  assert.deepEqual(runFlagsFor({ ...cutoffInput, state: "Ranked", legalFormVerified: false }), [FLAG_LEGAL_FORM_NOT_RECORDED, FLAG_VOLUME_NOT_VERIFIED]);
  assert.equal(runFlagsFor({ ...cutoffInput, state: "Ranked", legalFormVerified: true }).includes(FLAG_LEGAL_FORM_NOT_RECORDED), false);
  assert.equal(runFlagsFor({ ...cutoffInput, state: "Separate list", legalFormVerified: false }).includes(FLAG_LEGAL_FORM_NOT_RECORDED), false);
});

test("volume flag: every run carries it while consolidation is unverified", () => {
  const flags = runFlagsFor({ state: "Ranked", legalFormVerified: true, feeAsOf: "2026-03-01", cutoff: CUTOFF });
  assert.deepEqual(flags, [FLAG_VOLUME_NOT_VERIFIED]);
});

test("builder: flags are attached and scores are identical with and without them", () => {
  const flagged = buildStoredRun(snapshot({ legalFormVerified: false, feeAsOf: "2025-03-01" }), "2026-10-10T00:00:00.000Z");
  const clean = buildStoredRun(snapshot({ legalFormVerified: true, feeAsOf: "2026-03-01" }), "2026-10-10T00:00:00.000Z");

  const flaggedAAA = flagged.funds.find((fund) => fund.ticker === "AAA")!;
  const cleanAAA = clean.funds.find((fund) => fund.ticker === "AAA")!;
  assert.equal(flaggedAAA.state, "Ranked", "fixture must be Ranked for the legal-form flag to apply");
  assert.deepEqual(flaggedAAA.flags, [FLAG_LEGAL_FORM_NOT_RECORDED, FLAG_FEE_OLDER_THAN_12_MONTHS, FLAG_VOLUME_NOT_VERIFIED]);
  assert.deepEqual(cleanAAA.flags, [FLAG_VOLUME_NOT_VERIFIED]);

  // The flags differ between the two runs, and the scores must not.
  assert.equal(scoresOf(flagged.funds), scoresOf(clean.funds));
  assert.equal(flagged.inputHash === clean.inputHash, false, "a changed fee date is a changed input");
});

test("builder: CCC with fee dated exactly 2025-09-30 is not flagged for fee age", () => {
  const stored = buildStoredRun(snapshot(), "2026-10-10T00:00:00.000Z");
  const ccc = stored.funds.find((fund) => fund.ticker === "CCC")!;
  assert.equal(ccc.flags.includes(FLAG_FEE_OLDER_THAN_12_MONTHS), false);
});

test("builder: fails closed when any bar has no volume, and names the ticker", () => {
  const bad = snapshot();
  bad.barsByTicker.BBB = bad.barsByTicker.BBB.map((bar, index) => (index === 10 ? ({ ...bar, volume: undefined } as unknown as RankingBar) : bar));
  assert.throws(() => buildStoredRun(bad, "2026-10-10T00:00:00.000Z"), /BBB: 1 bars have no usable volume/);
});

test("builder: fails when history is not strictly ascending by date", () => {
  const bad = snapshot();
  const bars = bad.barsByTicker.AAA;
  bad.barsByTicker.AAA = [...bars.slice(0, 5), bars[3], ...bars.slice(6)];
  assert.throws(() => buildStoredRun(bad, "2026-10-10T00:00:00.000Z"), /AAA: history is not strictly ascending/);
});

test("builder: fails without the cash proxy history", () => {
  const bad = snapshot();
  delete bad.barsByTicker.BIL;
  assert.throws(() => buildStoredRun(bad, "2026-10-10T00:00:00.000Z"), /BIL: no stored history/);
});

test("input hash: independent of input order, changes when one volume changes", () => {
  const base = snapshot();
  const reversed: RankingSnapshot = { ...base, metas: [...base.metas].reverse() };
  assert.equal(inputHashOf(base), inputHashOf(reversed));

  const changed = snapshot();
  changed.barsByTicker.CCC = changed.barsByTicker.CCC.map((bar, index) => (index === 0 ? { ...bar, volume: bar.volume + 1 } : bar));
  assert.notEqual(inputHashOf(base), inputHashOf(changed));
});

test("reproduction: a stored run rebuilds from its stored inputs with the same hash and scores", () => {
  const stored = buildStoredRun(snapshot(), "2026-10-10T00:00:00.000Z");
  const fromJson = JSON.parse(JSON.stringify(stored));
  const barsByTicker = snapshot().barsByTicker;
  const result = reproduceStoredRun(fromJson, barsByTicker);
  assert.equal(result.hashMatches, true);
  assert.equal(result.scoresMatch, true);
  assert.equal(result.recomputedHash, stored.inputHash);
});

test("reproduction: a changed volume in the stored history is caught by the hash", () => {
  const stored = buildStoredRun(snapshot(), "2026-10-10T00:00:00.000Z");
  const tampered = snapshot().barsByTicker;
  tampered.AAA = tampered.AAA.map((bar, index) => (index === 100 ? { ...bar, volume: bar.volume + 1 } : bar));
  const result = reproduceStoredRun(JSON.parse(JSON.stringify(stored)), tampered);
  assert.equal(result.hashMatches, false);
});
