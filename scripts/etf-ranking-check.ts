// Phase 2/3 check: runs lib/etfRanking.ts over the 222 Phase 1 entries and the local Tiingo pull.
// Raw price files stay outside the repo. Set ETF_RANKING_RAW_DIR to the folder holding <TICKER>.json files,
// and ETF_RANKING_OUT_DIR to a folder for the JSON output. Neither output is committed.
// Phase 3 additions: builds the stored-run document in memory, measures its size, and reproduces it from its
// stored inputs. Nothing is written to Firestore.
import fs from "node:fs";
import path from "node:path";
import { assessEligibility, monthEndLevels, rankFunds, type RankingBar, type RankingFundInput } from "../lib/etfRanking";
import { CASH_TICKER, fundInputMetaFromCsv, parseCsv } from "../lib/etfRankingInputs";
import { buildStoredRun, reproduceStoredRun, type RankingSnapshot } from "../lib/etfRankingRun";

const CUTOFF = "2026-09-30";
const REPO = process.cwd();
const RAW_DIR = process.env.ETF_RANKING_RAW_DIR ?? path.join(process.env.HOME ?? "", ".stock-app-local/etf-ranking/tiingo-raw");
const OUT_DIR = process.env.ETF_RANKING_OUT_DIR ?? path.join(RAW_DIR, "..", "out");

interface TiingoBar { date: string; close: number; adjClose: number; volume: number }

function loadBars(ticker: string): RankingBar[] {
  const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${ticker}.json`), "utf8")) as TiingoBar[];
  return raw
    .map((bar) => ({ date: bar.date.slice(0, 10), close: bar.close, adjustedClose: bar.adjClose, volume: bar.volume }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

const csvPath = path.join(REPO, "data/etf-ranking-inputs.csv");
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const metas = fundInputMetaFromCsv(rows);
const barsByTicker: Record<string, RankingBar[]> = Object.fromEntries(metas.map((meta) => [meta.ticker, loadBars(meta.ticker)]));
const cashBars = barsByTicker[CASH_TICKER];

const inputs: RankingFundInput[] = metas.map((meta) => ({
  ticker: meta.ticker,
  structure: meta.structure,
  productClass: meta.productClass,
  legalFormVerified: meta.legalFormVerified,
  netExpenseRatioPct: meta.netExpenseRatioPct,
  aumUsd: meta.aumUsd,
  aumAsOf: meta.aumAsOf,
  bars: barsByTicker[meta.ticker],
}));

// Re-derive each state from the inputs and compare with Phase 1.
const phase1State = new Map(rows.map((row) => [row.ticker, row.eligibility_state]));
const mismatches: Array<{ ticker: string; phase1: string; derived: string; reason: string }> = [];
for (const input of inputs) {
  const derived = assessEligibility(input, monthEndLevels(input.bars, CUTOFF), CUTOFF);
  if (derived.state !== phase1State.get(input.ticker)) {
    mismatches.push({ ticker: input.ticker, phase1: phase1State.get(input.ticker)!, derived: derived.state, reason: derived.reason });
  }
}

const run = rankFunds(inputs, { cutoff: CUTOFF, cashBars });

// Phase 3: the stored-run document, its size, and a reproduction from the stored form.
const snapshot: RankingSnapshot = { cutoff: CUTOFF, metas, barsByTicker };
const stored = buildStoredRun(snapshot, "2026-10-10T00:00:00.000Z");
const storedJson = JSON.stringify(stored);
const storedBytes = Buffer.byteLength(storedJson, "utf8");
const scoresOnly = (funds: unknown) => JSON.stringify(funds, (key, value) => (key === "flags" ? undefined : value));
const storedScoresMatchRun = scoresOnly(stored.funds) === scoresOnly(JSON.parse(JSON.stringify(run.funds)));
const reproduction = reproduceStoredRun(JSON.parse(storedJson), barsByTicker);
// Tamper check: one changed volume must change the input hash.
const tamperedBars = { ...barsByTicker, VOO: barsByTicker.VOO.map((bar, index) => (index === 0 ? { ...bar, volume: bar.volume + 1 } : bar)) };
const tamperedHashMatches = reproduceStoredRun(JSON.parse(storedJson), tamperedBars).hashMatches;

const stateCounts: Record<string, number> = {};
for (const fund of run.funds) stateCounts[fund.state] = (stateCounts[fund.state] ?? 0) + 1;
const ranked = run.funds.filter((fund) => fund.state === "Ranked");
const scored = ranked.filter((fund) => fund.grand != null);
const flagCounts: Record<string, number> = {};
for (const fund of stored.funds) for (const flag of fund.flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
const summary = {
  methodVersion: run.methodVersion,
  cutoff: CUTOFF,
  entries: run.funds.length,
  stateCounts,
  eligibilityMismatchesVsPhase1: mismatches,
  rankedScored: scored.length,
  rankedNotScored: ranked.filter((fund) => fund.grand == null).map((fund) => ({ ticker: fund.ticker, note: fund.scoreNote })),
  tierCounts: [1, 2, 3, 4, 5].map((tier) => scored.filter((fund) => fund.tier === tier).length),
  tiedFunds: scored.filter((fund) => fund.tied).length,
  blendMix: scored.reduce<Record<string, number>>((counts, fund) => {
    const key = Object.keys(fund.blendWeights ?? {}).sort().join("+");
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}),
  storedRun: {
    bytes: storedBytes,
    shareOfFirestoreLimit: Number((storedBytes / 1_048_576).toFixed(3)),
    inputHash: stored.inputHash,
    storedScoresMatchRun,
    reproducesFromStoredInputs: reproduction.hashMatches && reproduction.scoresMatch,
    tamperedVolumeChangesHash: !tamperedHashMatches,
    flagCounts,
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "rank-v1-cutoff-2026-09-30.json"), JSON.stringify(run, null, 1));
console.log(JSON.stringify(summary, null, 2));

console.log("\nRanked, by Grand:");
for (const fund of [...scored].sort((left, right) => (right.grand ?? 0) - (left.grand ?? 0))) {
  console.log([
    String(fund.rank).padStart(3),
    fund.ticker.padEnd(6),
    `grand ${fund.grand!.toFixed(2).padStart(6)}`,
    `outcome ${fund.outcome!.toFixed(2).padStart(6)}`,
    `vehicle ${fund.vehicle!.vehicle.toFixed(2).padStart(6)}`,
    `tactical ${fund.tactical?.toFixed(2).padStart(6) ?? "   n/a"}`,
    `tier ${fund.tier}`,
    fund.tied ? "tied" : "",
    `months ${fund.monthsOfHistory}`,
  ].join("  "));
}
