import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEqualWeightBasketAnnualReturns,
  buildTickerAnnualReturns,
  buildVooExcessReturns,
  calculateDailyCashReturns,
  calculateDailyReturnStats,
  summarizeBasketReturns,
  summarizeTickerReturns,
  type AnnualTickerReturn,
  type TickerHistory,
} from "../lib/performanceReturns";

function history(overrides: Partial<TickerHistory> = {}): TickerHistory {
  return {
    ticker: "AAA",
    name: "Example Co.",
    currency: "USD",
    bars: [],
    dividends: [],
    dividendDataAvailable: true,
    priceDataAvailable: true,
    providerAvailable: true,
    error: null,
    ...overrides,
  };
}

function assertApprox(actual: number | null | undefined, expected: number, tolerance = 1e-8) {
  assert.ok(actual != null && Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("full calendar-year return uses the prior close and first in-year close dividend denominator", () => {
  const rows = buildTickerAnnualReturns(history({
    bars: [
      { date: "2015-12-31", close: 100 },
      { date: "2016-01-04", close: 102 },
      { date: "2016-12-30", close: 110 },
    ],
    dividends: [{ date: "2016-06-15", amount: 2 }],
  }), 2016, 2016, "2016-12-31");

  assertApprox(rows[0].priceReturnPct, 10);
  assertApprox(rows[0].dividendYieldPct, 2 / 102 * 100);
  assertApprox(rows[0].cashTotalReturnPct, 12);
  assert.equal(rows[0].status, "complete");
  assert.equal(rows[0].dividendsPerShare, 2);
});

test("current year return is capped at the latest close and labels dividend events through that date", () => {
  const rows = buildTickerAnnualReturns(history({
    bars: [
      { date: "2025-12-31", close: 100 },
      { date: "2026-01-02", close: 105 },
      { date: "2026-06-30", close: 110 },
      { date: "2026-07-01", close: 140 },
    ],
    dividends: [
      { date: "2026-03-01", amount: 1 },
      { date: "2026-07-01", amount: 4 },
    ],
  }), 2026, 2026, "2026-06-30");

  assert.equal(rows[0].endDate, "2026-06-30");
  assertApprox(rows[0].priceReturnPct, 10);
  assert.equal(rows[0].dividendsPerShare, 1);
  assert.equal(rows[0].cashTotalReturnPct, 11);
});

test("confirmed no-dividend history is zero while unavailable dividend history remains null", () => {
  const base = {
    bars: [{ date: "2015-12-31", close: 100 }, { date: "2016-12-30", close: 110 }],
  };
  const noPayer = buildTickerAnnualReturns(history(base), 2016, 2016, "2016-12-31")[0];
  const unavailable = buildTickerAnnualReturns(history({ ...base, dividendDataAvailable: false }), 2016, 2016, "2016-12-31")[0];

  assert.equal(noPayer.dividendsPerShare, 0);
  assert.equal(noPayer.dividendYieldPct, 0);
  assertApprox(noPayer.cashTotalReturnPct, 10);
  assert.equal(unavailable.dividendsPerShare, null);
  assert.equal(unavailable.dividendYieldPct, null);
  assert.equal(unavailable.cashTotalReturnPct, null);
  assert.equal(unavailable.status, "dividend history unavailable");
});

test("missing prior-year close and missing in-year data have explicit statuses", () => {
  const missingPrior = buildTickerAnnualReturns(history({
    bars: [{ date: "2016-01-04", close: 10 }, { date: "2016-12-30", close: 11 }],
  }), 2016, 2016, "2016-12-31")[0];
  const missingYear = buildTickerAnnualReturns(history({
    bars: [{ date: "2015-12-31", close: 10 }],
  }), 2016, 2016, "2016-12-31")[0];
  const unavailable = buildTickerAnnualReturns(history({
    bars: [], priceDataAvailable: false, dividendDataAvailable: false, providerAvailable: false, error: "Provider request failed",
  }), 2016, 2016, "2016-12-31")[0];
  const noHistory = buildTickerAnnualReturns(history({
    bars: [], priceDataAvailable: false, providerAvailable: true, error: "No price history",
  }), 2016, 2016, "2016-12-31")[0];

  assert.equal(missingPrior.status, "missing prior-year close");
  assert.equal(missingPrior.priceReturnPct, null);
  assert.equal(missingYear.status, "missing in-year close");
  assert.equal(missingYear.priceReturnPct, null);
  assert.equal(unavailable.status, "provider unavailable");
  assert.equal(noHistory.status, "no price history");
});

test("split-adjusted input prices avoid treating a split as a market loss", () => {
  const row = buildTickerAnnualReturns(history({
    bars: [
      { date: "2019-12-31", close: 50 },
      { date: "2020-01-02", close: 51 },
      { date: "2020-12-31", close: 60 },
    ],
    dividends: [{ date: "2020-09-01", amount: 1 }],
  }), 2020, 2020, "2020-12-31")[0];

  assertApprox(row.priceReturnPct, 20);
  assertApprox(row.cashTotalReturnPct, 22);
});

test("cash total return preserves a negative year and cash dividends in the same denominator", () => {
  const row = buildTickerAnnualReturns(history({
    bars: [{ date: "2022-12-30", close: 100 }, { date: "2023-12-29", close: 90 }],
    dividends: [{ date: "2023-05-01", amount: 2 }],
  }), 2023, 2023, "2023-12-31")[0];

  assertApprox(row.priceReturnPct, -10);
  assertApprox(row.cashTotalReturnPct, -8);
});

test("daily volatility and drawdown require enough observations and include cash dividends", () => {
  const bars = Array.from({ length: 42 }, (_, index) => ({
    date: new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10),
    close: index === 25 ? 80 : index < 25 ? 100 + index : 80 + (index - 25),
  }));
  const source = history({ bars, dividends: [{ date: bars[10].date, amount: 1 }] });
  const daily = calculateDailyCashReturns(source, bars[0].date, bars.at(-1)!.date);
  const stats = calculateDailyReturnStats(daily);

  assert.equal(daily.length, bars.length - 1);
  assert.ok((daily.find((item) => item.date === bars[10].date)?.returnPct ?? 0) > 0);
  assert.ok(stats.annualizedVolatilityPct != null && stats.annualizedVolatilityPct > 0);
  assert.ok(stats.maxDrawdownPct != null && stats.maxDrawdownPct < 0);
});

test("daily cash returns retain dividends instead of reinvesting them", () => {
  const rows = calculateDailyCashReturns(history({
    bars: [
      { date: "2024-12-31", close: 100 },
      { date: "2025-01-02", close: 100 },
      { date: "2025-01-03", close: 110 },
    ],
    dividends: [{ date: "2025-01-02", amount: 10 }],
  }), "2024-12-31", "2025-01-03");

  assertApprox(rows[0].returnPct, 10);
  assertApprox(rows[1].returnPct, (120 / 110 - 1) * 100);
  assertApprox((rows.reduce((growth, row) => growth * (1 + row.returnPct / 100), 1) - 1) * 100, 20);
});

test("equal-weight basket averages usable tickers and reports partial coverage", () => {
  const complete: AnnualTickerReturn = {
    ticker: "AAA", year: 2024, startDate: "2023-12-29", firstDate: "2024-01-02", endDate: "2024-12-31",
    startClose: 100, firstClose: 100, endClose: 110, dividendsPerShare: 2,
    priceReturnPct: 10, dividendYieldPct: 2, cashTotalReturnPct: 12, status: "complete",
  };
  const partial: AnnualTickerReturn = { ...complete, ticker: "BBB", priceReturnPct: -2, dividendYieldPct: 0, dividendsPerShare: 0, cashTotalReturnPct: -2 };
  const missing: AnnualTickerReturn = { ...complete, ticker: "CCC", priceReturnPct: null, dividendYieldPct: null, dividendsPerShare: null, cashTotalReturnPct: null, status: "missing prior-year close" };
  const annualByTicker = { AAA: [complete], BBB: [partial], CCC: [missing] };
  const row = buildEqualWeightBasketAnnualReturns(annualByTicker, ["AAA", "BBB", "CCC"], 2024, 2024, { AAA: "USD", BBB: "USD", CCC: "USD" })[0];

  assert.equal(row.cashTotalReturnPct, 5);
  assert.equal(row.priceReturnPct, 4);
  assert.equal(row.holdingsWithUsableData, 2);
  assertApprox(row.weightCoveragePct, 200 / 3);
  assert.equal(row.partial, true);
  assert.equal(row.dividendsPerShare, 1);
});

test("arithmetic average annual return differs from compounded return and CAGR", () => {
  const first: AnnualTickerReturn = {
    ticker: "AAA", year: 2017, startDate: "2016-12-30", firstDate: "2017-01-03", endDate: "2017-12-29",
    startClose: 100, firstClose: 100, endClose: 150, dividendsPerShare: 0,
    priceReturnPct: 50, dividendYieldPct: 0, cashTotalReturnPct: 50, status: "complete",
  };
  const second: AnnualTickerReturn = {
    ...first, year: 2018, startDate: "2017-12-29", firstDate: "2018-01-02", endDate: "2018-12-31",
    startClose: 150, firstClose: 150, endClose: 75, priceReturnPct: -50, cashTotalReturnPct: -50,
  };
  const summary = summarizeTickerReturns([first, second], history(), []);

  assertApprox(summary.averageAnnualCashTotalReturnPct, 0);
  assertApprox(summary.cumulativeCashTotalReturnPct, -25);
  assert.ok(summary.cashTotalReturnCagrPct != null && summary.cashTotalReturnCagrPct < -13 && summary.cashTotalReturnCagrPct > -14);
  assert.equal(summary.positiveYears, 1);
  assert.equal(summary.usableYears, 2);
});

test("VOO excess returns only appear when both annual cash returns are available", () => {
  const tickerRows: AnnualTickerReturn[] = [
    { ticker: "AAA", year: 2024, startDate: null, firstDate: null, endDate: null, startClose: null, firstClose: null, endClose: null, dividendsPerShare: 0, priceReturnPct: 10, dividendYieldPct: 0, cashTotalReturnPct: 10, status: "complete" },
    { ticker: "AAA", year: 2025, startDate: null, firstDate: null, endDate: null, startClose: null, firstClose: null, endClose: null, dividendsPerShare: null, priceReturnPct: 5, dividendYieldPct: null, cashTotalReturnPct: null, status: "dividend history unavailable" },
  ];
  const vooRows: AnnualTickerReturn[] = [
    { ...tickerRows[0], ticker: "VOO", cashTotalReturnPct: 8 },
    { ...tickerRows[1], ticker: "VOO", cashTotalReturnPct: 4 },
  ];

  assert.deepEqual(buildVooExcessReturns(tickerRows, vooRows), [
    { year: 2024, excessReturnPct: 2, benchmarkReturnPct: 8, benchmarkStartDate: null, benchmarkEndDate: null },
    { year: 2025, excessReturnPct: null, benchmarkReturnPct: 4, benchmarkStartDate: null, benchmarkEndDate: null },
  ]);
});

test("basket summaries retain historical comparison rows without treating missing years as zero", () => {
  const first: AnnualTickerReturn = {
    ticker: "AAA", year: 2024, startDate: "2023-12-29", firstDate: "2024-01-02", endDate: "2024-12-31",
    startClose: 100, firstClose: 100, endClose: 110, dividendsPerShare: 0,
    priceReturnPct: 10, dividendYieldPct: 0, cashTotalReturnPct: 10, status: "complete",
  };
  const missing: AnnualTickerReturn = { ...first, year: 2025, priceReturnPct: null, dividendYieldPct: null, cashTotalReturnPct: null, dividendsPerShare: null, status: "missing prior-year close" };
  const annualRows = buildEqualWeightBasketAnnualReturns({ AAA: [first, missing] }, ["AAA"], 2024, 2025, { AAA: "USD" });
  const summary = summarizeBasketReturns(annualRows, { AAA: history() }, ["AAA"]);

  assert.equal(annualRows[1].cashTotalReturnPct, null);
  assert.equal(annualRows[1].weightCoveragePct, 0);
  assertApprox(summary.averageAnnualCashTotalReturnPct, 10);
  assert.equal(summary.cumulativeCashTotalReturnPct, null);
  assert.equal(summary.cashTotalReturnCagrPct, null);
});
