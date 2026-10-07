import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Use Node 22 or newer for the validation batch.");
const require = createRequire(import.meta.url);
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
mkdirSync(join(root, ".next"), { recursive: true });
const tempDir = mkdtempSync(join(root, ".next", "etf-equity-index-validation-"));
const outputPath = join(root, "data", "etf-equity-index-validation-batch.json");
const reportPath = join(root, "docs", "etf-equity-index-validation-batch-2026-10-07.md");

const { execFileSync } = await import("node:child_process");
execFileSync(join(root, "node_modules", ".bin", "tsc"), [
  "lib/etfEquityIndexValidationBatch.ts", "--outDir", tempDir, "--rootDir", ".",
  "--module", "commonjs", "--target", "es2022", "--esModuleInterop", "--resolveJsonModule", "--skipLibCheck", "--strict",
], { cwd: root, stdio: "inherit" });

const { buildETFEquityIndexBatchSnapshot, renderETFEquityIndexBatchReport, ETF_EQUITY_INDEX_BATCH_TICKERS } = require(join(tempDir, "lib", "etfEquityIndexValidationBatch.js"));

function dateOnly(value) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Yahoo returned an invalid adjusted-price date.");
  return parsed.toISOString().slice(0, 10);
}

function normalizeYahoo(chart, ticker, retrievedAt) {
  const bars = (chart.quotes ?? []).map((quote) => ({
    date: dateOnly(quote.date),
    adjustedClose: quote.adjclose,
  }));
  return {
    provider: "Yahoo Finance",
    sourceId: "yahoo-finance2.chart:adjusted-close",
    sourceUrl: `https://finance.yahoo.com/quote/${ticker}/history/`,
    retrievedAt,
    currency: chart.meta?.currency ?? "",
    bars,
  };
}

function shortError(error) {
  return String(error?.message ?? error).replace(/https?:\/\/\S+/g, "Yahoo chart endpoint").slice(0, 240);
}

const now = new Date();
const retrievedAt = now.toISOString();
const period1 = new Date("2016-01-01T00:00:00Z");
const period2 = new Date(now.getTime() + 86_400_000);
const histories = {};

for (const [index, ticker] of ETF_EQUITY_INDEX_BATCH_TICKERS.entries()) {
  try {
    const chart = await yf.chart(ticker, {
      period1,
      period2,
      interval: "1d",
      events: "div,splits",
      return: "array",
    });
    histories[ticker] = normalizeYahoo(chart, ticker, retrievedAt);
    console.log(`${ticker}: Yahoo returned ${histories[ticker].bars.length} adjusted daily observations (${histories[ticker].currency || "currency missing"}).`);
  } catch (error) {
    histories[ticker] = { error: shortError(error) };
    console.error(`${ticker}: Yahoo history blocked: ${histories[ticker].error}`);
  }
  if (index < ETF_EQUITY_INDEX_BATCH_TICKERS.length - 1) await new Promise((resolve) => setTimeout(resolve, 600));
}

const snapshot = buildETFEquityIndexBatchSnapshot({ histories, now });
mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
const report = renderETFEquityIndexBatchReport(snapshot);
const jsonTemp = `${outputPath}.${process.pid}.tmp`;
const reportTemp = `${reportPath}.${process.pid}.tmp`;
writeFileSync(jsonTemp, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(reportTemp, report);
renameSync(jsonTemp, outputPath);
renameSync(reportTemp, reportPath);

const summary = {
  asOf: snapshot.asOf,
  commonCutoff: snapshot.commonCutoff,
  commonScores: `${snapshot.validation.commonScoresPassed}/${snapshot.validation.requiredCommonScores}`,
  historicalWindows: `${snapshot.validation.historicalWindowsPassed}/${snapshot.validation.requiredHistoricalWindows}`,
  reproducibility: snapshot.validation.scoreReproducibility,
  batchReady: snapshot.validation.batchReady,
  saved: outputPath,
  report: reportPath,
  snapshotHash: createHash("sha256").update(readFileSync(outputPath)).digest("hex"),
};
console.log(JSON.stringify(summary, null, 2));
if (!snapshot.validation.batchReady || snapshot.validation.historicalWindowsPassed !== snapshot.validation.requiredHistoricalWindows) process.exitCode = 1;
rmSync(tempDir, { recursive: true, force: true });
