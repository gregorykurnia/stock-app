// Phase 2 check: runs lib/etfRanking.ts over the 222 Phase 1 entries and the local Tiingo pull.
// Raw price files stay outside the repo. Set ETF_RANKING_RAW_DIR to the folder holding <TICKER>.json files,
// and ETF_RANKING_OUT_DIR to a folder for the JSON output. Neither output is committed.
import fs from "node:fs";
import path from "node:path";
import { assessEligibility, monthEndLevels, rankFunds, type ProductClass, type RankingBar, type RankingFundInput } from "../lib/etfRanking";

const CUTOFF = "2026-09-30";
const REPO = process.cwd();
const RAW_DIR = process.env.ETF_RANKING_RAW_DIR ?? path.join(process.env.HOME ?? "", ".stock-app-local/etf-ranking/tiingo-raw");
const OUT_DIR = process.env.ETF_RANKING_OUT_DIR ?? path.join(RAW_DIR, "..", "out");

// RFC 4180 subset: quoted fields may contain commas and doubled quotes.
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}

interface TiingoBar { date: string; close: number; adjClose: number; volume: number }

function loadBars(ticker: string): RankingBar[] {
  const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${ticker}.json`), "utf8")) as TiingoBar[];
  return raw
    .map((bar) => ({ date: bar.date.slice(0, 10), close: bar.close, adjustedClose: bar.adjClose, volume: bar.volume }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

// Phase 1 records leveraged and ETN status only in its reason text, so the script reads it back from there.
function productClassOf(row: Record<string, string>): ProductClass {
  if (row.structure === "operating-company-stock" || row.structure === "closed-end-fund") return "excluded";
  if (row.structure === "ETN") return "etn";
  if (row.eligibility_reason.startsWith("leveraged/inverse")) return "leveraged_inverse";
  return "standard";
}

const csvPath = path.join(REPO, "data/etf-ranking-inputs.csv");
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const cashBars = loadBars("BIL");

const inputs: RankingFundInput[] = rows.map((row) => ({
  ticker: row.ticker,
  structure: row.structure,
  productClass: productClassOf(row),
  legalFormVerified: row.legal_form_verified === "yes",
  netExpenseRatioPct: row.net_expense_ratio_pct === "" ? null : Number(row.net_expense_ratio_pct),
  aumUsd: row.aum_usd === "" ? null : Number(row.aum_usd),
  aumAsOf: row.aum_as_of === "" ? null : row.aum_as_of,
  bars: loadBars(row.ticker),
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

const stateCounts: Record<string, number> = {};
for (const fund of run.funds) stateCounts[fund.state] = (stateCounts[fund.state] ?? 0) + 1;
const ranked = run.funds.filter((fund) => fund.state === "Ranked");
const scored = ranked.filter((fund) => fund.grand != null);
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
