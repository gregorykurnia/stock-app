// Full-history backfill for the ETF ranking (plan Section 6). One Tiingo request per fund, full history with volume,
// written to etf_ranking_history/{ticker}/years/{year}. Resumable: funds already marked stored are skipped.
// Progress lives outside the repo at ETF_RANKING_PROGRESS (counts and dates only, no prices).
// Pacing stays under the Starter hourly limit. Run from the repo root.
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../lib/etfRankingInputs";
import { groupBarsByYear } from "../lib/etfRankingHistory";
import { saveFullHistoryYears } from "../lib/etfRankingHistoryStore";
import { parseTiingoDailyBars } from "../lib/etfTiingoParse";

const REPO = process.cwd();
const PROGRESS_PATH = process.env.ETF_RANKING_PROGRESS ?? path.join(process.env.HOME ?? "", ".stock-app-local/etf-ranking/backfill-progress.json");
const PACE_MS = 80_000; // 45 requests per hour, under the Starter limit of 50.
const RATE_LIMIT_WAIT_MS = 3_600_000;
const START_DATE = "1970-01-01";

interface ProgressEntry {
  status: "stored" | "failed";
  bars?: number;
  firstDate?: string;
  lastDate?: string;
  years?: number;
  missingVolume?: number;
  error?: string;
  at: string;
}

function loadTiingoToken(): string {
  const envText = fs.readFileSync(path.join(REPO, ".env.local"), "utf8");
  const line = envText.split("\n").find((entry) => entry.startsWith("TIINGO_API_TOKEN="));
  if (!line) throw new Error("TIINGO_API_TOKEN is not set in .env.local");
  return line.slice("TIINGO_API_TOKEN=".length).trim().replace(/^["']|["']$/g, "");
}

function loadProgress(): Record<string, ProgressEntry> {
  return fs.existsSync(PROGRESS_PATH) ? JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8")) : {};
}

function saveProgress(progress: Record<string, ProgressEntry>): void {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 1));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function tomorrowUtc(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

async function fetchFullHistory(token: string, ticker: string): Promise<{ status: number; body: unknown }> {
  const url = new URL(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}/prices`);
  url.searchParams.set("startDate", START_DATE);
  url.searchParams.set("endDate", tomorrowUtc());
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const body = response.ok ? await response.json().catch(() => null) : null;
  return { status: response.status, body };
}

async function main(): Promise<void> {
  const token = loadTiingoToken();
  const rows = parseCsv(fs.readFileSync(path.join(REPO, "data/etf-ranking-inputs.csv"), "utf8"));
  const tickers = rows.map((row) => row.ticker);
  const progress = loadProgress();
  const todo = tickers.filter((ticker) => progress[ticker]?.status !== "stored");
  console.log(`funds ${tickers.length}, already stored ${tickers.length - todo.length}, to fetch ${todo.length}`);

  for (const ticker of todo) {
    let attempt = 0;
    while (true) {
      attempt += 1;
      const { status, body } = await fetchFullHistory(token, ticker);
      if (status === 401 || status === 403) {
        throw new Error(`Tiingo rejected the token or entitlement (HTTP ${status}) at ${ticker}. Stopped; nothing else was fetched.`);
      }
      if (status === 429 && attempt < 5) {
        console.log(`${ticker}: rate limited, waiting one hour`);
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      const parsed = status === 200 ? parseTiingoDailyBars(body) : { error: `Tiingo HTTP ${status}` };
      if ("error" in parsed) {
        progress[ticker] = { status: "failed", error: parsed.error, at: new Date().toISOString() };
        console.log(`${ticker}: failed: ${parsed.error}`);
      } else {
        const bars = parsed.bars;
        const missingVolume = bars.filter((bar) => !Number.isFinite(bar.volume) || bar.volume < 0).length;
        const years = groupBarsByYear(ticker, bars, new Date().toISOString());
        await saveFullHistoryYears(ticker, years);
        progress[ticker] = {
          status: "stored",
          bars: bars.length,
          firstDate: bars[0]?.date,
          lastDate: bars.at(-1)?.date,
          years: years.length,
          missingVolume,
          at: new Date().toISOString(),
        };
        console.log(`${ticker}: stored ${bars.length} bars, ${bars[0]?.date} to ${bars.at(-1)?.date}, ${years.length} years, missing volume ${missingVolume}`);
      }
      saveProgress(progress);
      break;
    }
    await sleep(PACE_MS);
  }

  const failed = tickers.filter((ticker) => progress[ticker]?.status !== "stored");
  console.log(`done: stored ${tickers.length - failed.length} of ${tickers.length}; not stored: ${failed.join(", ") || "none"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
