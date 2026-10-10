// First stored run for etf_rankings/{cutoff} (plan Phase 3). Loads each fund's full history from the store, cuts it at
// the cutoff, builds and checks the run, compares its scores with the Phase 2 reference, then writes it once.
// Refuses to run if any fund is missing history or volume. Re-running with the same inputs is a no-op.
import fs from "node:fs";
import path from "node:path";
import { parseCsv, fundInputMetaFromCsv } from "../lib/etfRankingInputs";
import { barsThrough } from "../lib/etfRankingHistory";
import { getFullHistory } from "../lib/etfRankingHistoryStore";
import { buildStoredRun, reproduceStoredRun, type RankingSnapshot, type StoredRankingRun } from "../lib/etfRankingRun";
import { getETFRankingRun, saveETFRankingRun } from "../lib/etfRankingStore";
import type { RankingBar } from "../lib/etfRanking";

const CUTOFF = "2026-09-30";
const REPO = process.cwd();
const REFERENCE_PATH = process.env.ETF_RANKING_REFERENCE ?? path.join(process.env.HOME ?? "", ".stock-app-local/etf-ranking/out/rank-v1-cutoff-2026-09-30.json");

function scoresOnly(funds: Array<{ flags?: string[] }>): string {
  return JSON.stringify(funds.map((fund) => ({ ...fund, flags: undefined })));
}

async function main(): Promise<void> {
  const rows = parseCsv(fs.readFileSync(path.join(REPO, "data/etf-ranking-inputs.csv"), "utf8"));
  const metas = fundInputMetaFromCsv(rows);

  const barsByTicker: Record<string, RankingBar[]> = {};
  const problems: string[] = [];
  for (const meta of metas) {
    const full = await getFullHistory(meta.ticker);
    if (full.length === 0) {
      problems.push(`${meta.ticker}: no stored history`);
      continue;
    }
    barsByTicker[meta.ticker] = barsThrough(full, CUTOFF);
  }
  if (problems.length > 0) {
    console.log(`Stopped: ${problems.length} funds have no stored history. First few: ${problems.slice(0, 5).join("; ")}`);
    process.exit(1);
  }

  const snapshot: RankingSnapshot = { cutoff: CUTOFF, metas, barsByTicker };
  const stored: StoredRankingRun = buildStoredRun(snapshot, new Date().toISOString());
  const json = JSON.stringify(stored);
  const roundTrip = JSON.parse(json) as StoredRankingRun;

  const reproduction = reproduceStoredRun(roundTrip, barsByTicker);
  const reference = JSON.parse(fs.readFileSync(REFERENCE_PATH, "utf8")) as { funds: Array<{ flags?: string[] }> };
  const matchesPhase2 = scoresOnly(roundTrip.funds) === scoresOnly(reference.funds);

  console.log(JSON.stringify({
    cutoff: CUTOFF,
    funds: stored.funds.length,
    inputHash: stored.inputHash,
    documentBytes: Buffer.byteLength(json, "utf8"),
    reproducesFromStoredInputs: reproduction.hashMatches && reproduction.scoresMatch,
    scoresMatchPhase2Reference: matchesPhase2,
  }, null, 2));

  if (!reproduction.hashMatches || !reproduction.scoresMatch || !matchesPhase2) {
    console.log("Not written: reproduction or Phase 2 comparison failed.");
    process.exit(1);
  }

  const outcome = await saveETFRankingRun(roundTrip);
  const readBack = await getETFRankingRun(CUTOFF);
  const readBackOk = readBack !== null && readBack.inputHash === stored.inputHash && scoresOnly(readBack.funds) === scoresOnly(roundTrip.funds);
  console.log(JSON.stringify({ write: outcome, readBackMatches: readBackOk }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
