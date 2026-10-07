import assert from "node:assert/strict";
import test from "node:test";
import savedBatchDocument from "../data/etf-equity-index-validation-batch.json";
import {
  buildETFEquityIndexBatchSnapshot,
  ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF,
  ETF_EQUITY_INDEX_BATCH_TICKERS,
  reproduceETFEquityIndexBatchSnapshot,
  type ETFEquityIndexBatchSnapshot,
  type ETFEquityIndexHistory,
} from "../lib/etfEquityIndexValidationBatch";

const savedBatch = savedBatchDocument as unknown as ETFEquityIndexBatchSnapshot;

function savedHistories(): Partial<Record<typeof ETF_EQUITY_INDEX_BATCH_TICKERS[number], ETFEquityIndexHistory>> {
  return Object.fromEntries(savedBatch.funds.flatMap((fund) => fund.history ? [[fund.ticker, {
    provider: fund.history.provider,
    sourceId: fund.history.sourceId,
    sourceUrl: fund.history.sourceUrl,
    retrievedAt: fund.history.retrievedAt,
    currency: fund.history.currency,
    bars: fund.history.bars,
  }]] : []));
}

test("real Yahoo batch covers eight verified equity-index ETFs at the common 1Y and 3Y cutoff", () => {
  const { snapshot, savedScoresReproduce } = reproduceETFEquityIndexBatchSnapshot(savedBatch);
  assert.deepEqual(snapshot.funds.map((fund) => fund.ticker), ETF_EQUITY_INDEX_BATCH_TICKERS);
  assert.equal(snapshot.commonCutoff, ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF);
  assert.equal(snapshot.validation.commonScoresPassed, 16);
  assert.equal(snapshot.validation.requiredCommonScores, 16);
  assert.equal(snapshot.validation.historicalWindowsPassed, 64);
  assert.equal(snapshot.validation.requiredHistoricalWindows, 64);
  assert.equal(snapshot.validation.batchReady, true);
  assert.equal(savedScoresReproduce, true);
  for (const fund of snapshot.funds) {
    assert.equal(fund.coverage.identity, "pass");
    assert.equal(fund.coverage.mandate, "pass");
    assert.equal(fund.coverage.expenseRatio, "pass");
    assert.equal(fund.coverage.history, "pass");
    assert.equal(fund.history?.provider, "Yahoo Finance");
    assert.equal(fund.history?.currency, "USD");
    assert.ok((fund.history?.observations ?? 0) > 2_000);
    assert.equal("medianSpread" in fund, false);
    for (const result of fund.results) {
      assert.equal(result.status, "validated");
      assert.ok(result.score != null && result.score >= 0 && result.score <= 100);
      assert.ok(result.inputHash);
      assert.equal(result.monthlyReturnCount, result.horizon === "1Y" ? 12 : 36);
      assert.equal(result.missingSessionCount, 0);
      assert.equal(result.feeDateAfterCutoff, result.cutoff !== snapshot.commonCutoff);
    }
  }
});

test("a missing market session or wrong currency blocks the score without zero imputation", () => {
  const histories = savedHistories();
  const voo = histories.VOO!;
  histories.VOO = { ...voo, bars: voo.bars.filter((bar) => bar.date !== "2026-06-15") };
  const missingSession = buildETFEquityIndexBatchSnapshot({ histories, now: new Date(savedBatch.asOf) });
  const oneYear = missingSession.funds[0].results.find((result) => result.cutoff === ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF && result.horizon === "1Y")!;
  assert.equal(oneYear.status, "blocked");
  assert.equal(oneYear.score, null);
  assert.equal(oneYear.feePoints, null);
  assert.equal(oneYear.historicalPoints, null);
  assert.match(oneYear.reason, /2026-06-15/);

  const wrongCurrency = savedHistories();
  wrongCurrency.VOO = { ...wrongCurrency.VOO!, currency: "EUR" };
  const currencyBlocked = buildETFEquityIndexBatchSnapshot({ histories: wrongCurrency, now: new Date(savedBatch.asOf) });
  const result = currencyBlocked.funds[0].results.find((item) => item.cutoff === ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF && item.horizon === "3Y")!;
  assert.equal(result.status, "blocked");
  assert.equal(result.score, null);
  assert.match(result.reason, /currency is EUR/);
});

test("a saved-score mismatch is hidden when the retained inputs are replayed", () => {
  const changed = structuredClone(savedBatch);
  changed.funds[0].results[0].score = (changed.funds[0].results[0].score ?? 0) + 0.01;
  const replay = reproduceETFEquityIndexBatchSnapshot(changed);
  assert.equal(replay.savedScoresReproduce, false);
  assert.ok(replay.snapshot.funds[0].results.every((result) => result.status === "blocked" && result.score == null));
  assert.ok(replay.snapshot.funds[1].results.some((result) => result.status === "validated" && result.score != null));
});
