import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Use Node 22 or newer for this trial.");
const require = createRequire(import.meta.url);
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
mkdirSync(join(root, ".next"), { recursive: true });
const runtime = mkdtempSync(join(root, ".next", "etf-trial-runtime-"));

function dateOnly(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid Yahoo session/event date.");
  return date.toISOString().slice(0, 10);
}

function normalizeYahoo(chart, ticker, retrievedAt) {
  const dividends = new Map();
  for (const event of Object.values(chart.events?.dividends ?? {})) {
    if (!Number.isFinite(event.amount) || event.amount < 0) throw new Error("Invalid Yahoo dividend amount.");
    const date = dateOnly(event.date);
    dividends.set(date, (dividends.get(date) ?? 0) + event.amount);
  }
  if (!dividends.size) throw new Error("Yahoo returned no dividend events for this distributing trial ETF.");
  const splits = new Map();
  for (const event of Object.values(chart.events?.splits ?? {})) {
    const factor = event.numerator / event.denominator;
    if (!Number.isFinite(factor) || factor <= 0) throw new Error("Invalid Yahoo split ratio.");
    splits.set(dateOnly(event.date), factor);
  }
  const bars = (chart.quotes ?? []).map((quote) => {
    const date = dateOnly(quote.date);
    return { date, close: quote.close, adjustedClose: quote.adjclose, dividendCash: dividends.get(date) ?? 0, splitFactor: splits.get(date) ?? 1 };
  });
  const dates = new Set(bars.map((bar) => bar.date));
  if ([...dividends.keys(), ...splits.keys()].some((date) => !dates.has(date))) throw new Error("A Yahoo corporate action has no corresponding daily price row.");
  return { provider: "Yahoo Finance", sourceId: "yahoo-finance2.chart:adjusted-close", sourceUrl: `https://finance.yahoo.com/quote/${ticker}/history/`, retrievedAt, currency: chart.meta?.currency ?? "", bars };
}

try {
  execFileSync(join(root, "node_modules", ".bin", "tsc"), [
    "lib/etfFreeCoreTrial.ts", "lib/etfFreeCoreTrialStore.ts", "--outDir", runtime, "--rootDir", ".",
    "--module", "commonjs", "--target", "es2022", "--esModuleInterop", "--resolveJsonModule", "--skipLibCheck", "--strict",
  ], { cwd: root, stdio: "inherit" });
  const { calculateETFFreeCoreTrial, ETF_FREE_CORE_TRIAL_TICKERS } = require(join(runtime, "lib", "etfFreeCoreTrial.js"));
  const { getRetainedTiingoTrialReference, saveETFFreeCoreTrial, getETFFreeCoreTrialSnapshots, getSavedETFFreeCoreTrialHistory } = require(join(runtime, "lib", "etfFreeCoreTrialStore.js"));
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 37, 1));
  for (const ticker of ETF_FREE_CORE_TRIAL_TICKERS) {
    const reference = await getRetainedTiingoTrialReference(ticker).catch(() => null);
    const notes = [];
    let history;
    try {
      const chart = await yf.chart(ticker, { period1: start, period2: now, interval: "1d", events: "div,splits", return: "array" });
      history = normalizeYahoo(chart, ticker, now.toISOString());
      const check = calculateETFFreeCoreTrial({ ticker, history, historyHash: "preflight", now });
      if (check.results.some((result) => result.status !== "trial")) throw new Error(check.results.map((result) => result.reason).filter(Boolean).join(" "));
    } catch (error) {
      if (!reference) throw error;
      history = reference;
      notes.push("Yahoo was unavailable or its history did not pass validation; this trial uses retained Tiingo history.");
      console.error(`${ticker}: ${String(error.message).replace(/https?:\/\/\S+/g, "provider URL").slice(0, 160)}`);
    }
    const historyHash = createHash("sha256").update(JSON.stringify({ source: history.sourceId, bars: history.bars })).digest("hex");
    const snapshot = calculateETFFreeCoreTrial({ ticker, history, historyHash, now });
    snapshot.sourceNotes = notes;
    if (history.provider === "Yahoo Finance" && reference) {
      const comparison = calculateETFFreeCoreTrial({ ticker, history: reference, historyHash: "reference", now });
      if (comparison.results.every((result) => result.status === "trial")) {
        snapshot.referenceCheck = { provider: "Tiingo", retrievedAt: reference.retrievedAt, differences: snapshot.results.map((result, index) => ({
          horizon: result.horizon, score: result.score - comparison.results[index].score,
          cagrPct: result.historicalComponents.growth.inputValue - comparison.results[index].historicalComponents.growth.inputValue,
          maxDrawdownPct: result.window.maxDrawdownMagnitudePct - comparison.results[index].window.maxDrawdownMagnitudePct,
        })) };
      }
    }
    await saveETFFreeCoreTrial({ snapshot, history });
    console.log(JSON.stringify({
      ticker, asOf: snapshot.asOf, source: snapshot.source, fee: snapshot.fee, historyHash,
      historyObservations: snapshot.historyObservations, dividendEvents: snapshot.dividendEvents, splitEvents: snapshot.splitEvents,
      results: snapshot.results.map(({ horizon, score, feePoints, historicalPoints, historicalComponents, window }) => ({
        horizon, score, feePoints, historicalPoints, historicalComponents, cutoff: window.cutoff,
        startDate: window.startDate, dailyObservations: window.dailyObservations, expectedSessions: window.expectedSessions,
        missingSessions: window.missingSessionDates.length, monthlyReturns: window.monthlyReturns.length,
      })), referenceCheck: snapshot.referenceCheck, sourceNotes: snapshot.sourceNotes,
    }));
  }
  const saved = await getETFFreeCoreTrialSnapshots();
  for (const snapshot of saved) {
    const history = await getSavedETFFreeCoreTrialHistory(snapshot);
    const hash = createHash("sha256").update(JSON.stringify({ source: history.sourceId, bars: history.bars })).digest("hex");
    if (hash !== snapshot.historyHash) throw new Error(`Retained trial input hash mismatch for ${snapshot.ticker}.`);
    const reproduced = calculateETFFreeCoreTrial({ ticker: snapshot.ticker, history, historyHash: hash, now: new Date(snapshot.asOf) });
    if (JSON.stringify(reproduced.results) !== JSON.stringify(snapshot.results)) throw new Error(`Saved trial scores failed reproduction for ${snapshot.ticker}.`);
  }
  console.log(JSON.stringify({ savedReadback: saved.map(({ ticker, source, results, historyHash }) => ({ ticker, provider: source.provider, scores: results.map(({ horizon, score }) => ({ horizon, score })), historyHash })) }));
} finally {
  const { getApps, deleteApp } = require("firebase/app");
  await Promise.all(getApps().map((app) => deleteApp(app)));
  rmSync(runtime, { recursive: true, force: true });
}
