import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildETFEquityIndexM3Snapshot,
  createETFEquityIndexM3Artifact,
  ETFEquityIndexM3Acquisition,
  ETFEquityIndexM3Sample,
  ETFEquityIndexM3Scenario,
  ETFEquityIndexM3ReturnEvidenceReview,
  runETFEquityIndexM3FixtureChecks,
  verifyETFEquityIndexM3Artifact,
} from "../lib/etfEquityIndexM3Validation";
import { isUsEquityTradingSession } from "../lib/etfCorePipeline";

const sampleBytes = readFileSync("data/etf-equity-index-m3-sample-v1.json");
const sample = JSON.parse(sampleBytes.toString("utf8")) as ETFEquityIndexM3Sample;
const expectedDigest = readFileSync("data/etf-equity-index-m3-sample-v1.sha256", "utf8").split(/\s+/)[0];
const sampleSha256 = createHash("sha256").update(sampleBytes).digest("hex");
const audit = JSON.parse(readFileSync("data/etf-equity-index-audit-2026-10-07.json", "utf8"));
const sensitivityScenarios = audit.sensitivity.scenarios as ETFEquityIndexM3Scenario[];
const now = new Date("2026-10-07T04:50:00.000Z");

function syntheticHistories(): Record<string, ETFEquityIndexM3Acquisition> {
  const result: Record<string, ETFEquityIndexM3Acquisition> = {};
  for (let index = 0; index < sample.funds.length; index += 1) {
    const fund = sample.funds[index];
    const bars: Array<{ date: string; adjustedClose: number }> = [];
    const cursor = new Date("2022-09-01T00:00:00Z");
    let close = 60 + index;
    while (cursor <= new Date("2026-10-06T00:00:00Z")) {
      const date = cursor.toISOString().slice(0, 10);
      if (isUsEquityTradingSession(date)) {
        close *= 1 + 0.00035 + Math.sin(cursor.getTime() / 86_400_000 / 13 + index) * 0.002;
        bars.push({ date, adjustedClose: close });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    result[fund.ticker] = {
      provider: "Yahoo Finance",
      sourceId: "yahoo-finance2.chart:adjusted-close",
      sourceUrl: `https://finance.yahoo.com/quote/${fund.ticker}/history/`,
      retrievedAt: now.toISOString(),
      currency: "USD",
      bars,
    };
  }
  return result;
}

function returnEvidenceReview(histories: Record<string, ETFEquityIndexM3Acquisition>, discrepancyTicker?: string): ETFEquityIndexM3ReturnEvidenceReview {
  const returnAt = (ticker: string, startDate: string, years: number) => {
    const history = histories[ticker] as Exclude<ETFEquityIndexM3Acquisition, { error: string }>;
    const start = history.bars.find((bar) => bar.date === startDate)!.adjustedClose;
    const end = history.bars.find((bar) => bar.date === "2026-08-31")!.adjustedClose;
    return (Math.pow(end / start, 1 / years) - 1) * 100;
  };
  return {
    protocolId: "issuer-market-price-return-reconciliation-v1",
    comparisonAsOf: "2026-08-31",
    oneYearStartDate: "2025-08-29",
    threeYearStartDate: "2023-08-31",
    endDate: "2026-08-31",
    tolerancePctPoints: 0.25,
    funds: sample.funds.map((fund) => ({
      ticker: fund.ticker,
      reviewNote: "synthetic fixture evidence",
      sources: [{
        sourceName: "synthetic official return table",
        sourceType: "official-issuer",
        sourceUrl: `https://example.com/${fund.ticker}`,
        asOfDate: "2026-08-31",
        returnConvention: "market-price total return",
        oneYearReturnPct: returnAt(fund.ticker, "2025-08-29", 1) + (fund.ticker === discrepancyTicker ? 2 : 0),
        threeYearAnnualizedReturnPct: returnAt(fund.ticker, "2023-08-31", 3),
      }],
    })),
  };
}

test("the registered M3 sample still matches its frozen raw-text SHA-256", () => {
  assert.equal(expectedDigest, sampleSha256);
  assert.equal(sample.funds.length, 12);
  assert.equal(sample.issuerDomainReviews.length, 4);
});

test("invalid source and history fixtures are rejected with specific blockers", () => {
  const fixtures = runETFEquityIndexM3FixtureChecks({ sample, now });
  assert.equal(fixtures.passed, true, JSON.stringify(fixtures.checks.filter((check) => !check.passed)));
  assert.ok(fixtures.checks.length >= 9);
});

test("12 synthetic M3 histories reconcile independent returns and block a mismatched fund", () => {
  assert.equal(sensitivityScenarios.length, 37);
  const histories = syntheticHistories();
  const snapshot = buildETFEquityIndexM3Snapshot({
    sample,
    sampleSha256,
    histories,
    now,
    commonCutoff: "2026-09-30",
    sensitivityScenarios,
    returnEvidenceReview: returnEvidenceReview(histories, "IEFA"),
  });
  assert.equal(snapshot.validation.sampleCounts.total, 12);
  assert.equal(snapshot.validation.captureValidity, "pass");
  assert.equal(snapshot.validation.independentCalculation.status, "pass", JSON.stringify(snapshot.validation.independentCalculation));
  assert.ok(snapshot.validation.independentCalculation.checkedRows >= 24);
  assert.ok(snapshot.validation.independentCalculation.maxAbsoluteDelta <= 1e-10);
  assert.equal(snapshot.validation.invalidCaseFixtures.status, "pass");
  assert.equal(snapshot.validation.independentReturnReconciliation.status, "complete");
  assert.deepEqual(snapshot.validation.independentReturnReconciliation.discrepancyTickers, ["IEFA"]);
  assert.equal(snapshot.funds.find((fund) => fund.ticker === "IEFA")?.results.find((row) => row.cutoff === snapshot.commonCutoff && row.horizon === "1Y")?.status, "blocked");
  assert.equal(snapshot.validation.inRange, "pass");
  for (const coverage of Object.values(snapshot.validation.primaryScoreCoverage)) {
    assert.ok(coverage["1Y"] >= 2);
    assert.ok(coverage["3Y"] >= 2);
  }
  assert.equal(snapshot.sensitivityRows.filter((row) => row.scenarioId === "baseline").length, 22);
  const artifact = createETFEquityIndexM3Artifact(snapshot);
  const verified = verifyETFEquityIndexM3Artifact(artifact);
  assert.equal(verified.status, "passed", verified.issues.join(" "));
  assert.equal(verified.rowCount, 120);
});

test("tampered M3 scores and adjusted-price inputs are blocked by replay and integrity checks", () => {
  const histories = syntheticHistories();
  const snapshot = buildETFEquityIndexM3Snapshot({
    sample,
    sampleSha256,
    histories,
    now,
    commonCutoff: "2026-09-30",
    sensitivityScenarios,
    returnEvidenceReview: returnEvidenceReview(histories),
  });
  const saved = createETFEquityIndexM3Artifact(snapshot);
  const changedScore = structuredClone(saved);
  const scoreRow = changedScore.snapshot.funds[0].results.find((row) => row.cutoff === "2026-09-30" && row.horizon === "1Y")!;
  scoreRow.score = (scoreRow.score ?? 0) + 0.25;
  assert.equal(verifyETFEquityIndexM3Artifact(changedScore).status, "blocked");
  const changedPrice = structuredClone(saved);
  changedPrice.snapshot.funds[0].history!.bars[100].adjustedClose *= 1.01;
  assert.equal(verifyETFEquityIndexM3Artifact(changedPrice).status, "blocked");
  const changedReturnEvidence = structuredClone(saved);
  const firstReturnSource = changedReturnEvidence.snapshot.funds[0]!.independentReturnEvidence.sources[0]!;
  firstReturnSource.oneYearReturnPct = (firstReturnSource.oneYearReturnPct ?? 0) + 0.5;
  assert.equal(verifyETFEquityIndexM3Artifact(changedReturnEvidence).status, "blocked");
});

test("stale or missing Yahoo captures block the affected current horizon without substituting a score", () => {
  const histories = syntheticHistories();
  const spym = histories.SPYM as Exclude<ETFEquityIndexM3Acquisition, { error: string }>;
  histories.SPYM = { ...spym, retrievedAt: "2026-09-01T00:00:00.000Z" };
  histories.SPY = { error: "fixture: provider unavailable" };
  const snapshot = buildETFEquityIndexM3Snapshot({
    sample,
    sampleSha256,
    histories,
    now,
    commonCutoff: "2026-09-30",
    sensitivityScenarios,
  });
  const stale = snapshot.funds.find((fund) => fund.ticker === "SPYM")!;
  const missing = snapshot.funds.find((fund) => fund.ticker === "SPY")!;
  assert.equal(stale.results.find((row) => row.cutoff === snapshot.commonCutoff && row.horizon === "1Y")?.status, "blocked");
  assert.match(stale.historyCaptureBlockers.join(" "), /retrieval.*older than 5 days/);
  assert.equal(missing.results.find((row) => row.cutoff === snapshot.commonCutoff && row.horizon === "3Y")?.score, null);
  assert.match(missing.historyCaptureBlockers.join(" "), /provider unavailable/);
  const integrityReplay = verifyETFEquityIndexM3Artifact(createETFEquityIndexM3Artifact(snapshot));
  assert.equal(integrityReplay.status, "passed", integrityReplay.issues.join(" "));
});
