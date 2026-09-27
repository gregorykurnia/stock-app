import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSimulationForecasts,
  runTenYearSimulation,
  SIMULATION_END_YEAR,
  type SimulationForecast,
  type SimulationLedgerPosition,
  type SimulationMarketQuote,
  type SimulationUniverseTicker,
} from "../lib/performanceSimulation";
import type { TickerHistory } from "../lib/performanceReturns";

const universe: SimulationUniverseTicker[] = [
  { ticker: "AAA", name: "Example Stock", bucket: "longterm" },
  { ticker: "VOO", name: "S&P 500 ETF", bucket: "index" },
  { ticker: "VXUS", name: "International ETF", bucket: "index" },
  { ticker: "SGOV", name: "Treasury ETF", bucket: "treasury" },
];

function history(
  ticker: string,
  yearlyPriceReturns: readonly number[],
  yearlyDividendYields: readonly number[],
  dividendDataAvailable = true,
): TickerHistory {
  const bars = [{ date: "2015-12-31", close: 100 }];
  const dividends: { date: string; amount: number }[] = [];
  let priorClose = 100;
  for (let index = 0; index < yearlyPriceReturns.length; index += 1) {
    const year = 2016 + index;
    const firstClose = priorClose;
    bars.push({ date: `${year}-01-04`, close: firstClose });
    const dividendYield = yearlyDividendYields[index] ?? 0;
    if (dividendYield > 0) dividends.push({ date: `${year}-06-15`, amount: firstClose * dividendYield / 100 });
    priorClose = firstClose * (1 + yearlyPriceReturns[index] / 100);
    bars.push({ date: `${year}-12-30`, close: priorClose });
  }
  bars.push({ date: "2026-01-02", close: priorClose }, { date: "2026-09-25", close: priorClose * 1.2 });
  return {
    ticker,
    name: ticker,
    currency: "USD",
    bars,
    dividends,
    dividendDataAvailable,
    priceDataAvailable: true,
    providerAvailable: true,
    error: null,
  };
}

function forecast(
  ticker: string,
  priceReturnPct: number,
  dividendYieldPct: number,
  bucket: SimulationForecast["bucket"] = "longterm",
): SimulationForecast {
  return {
    ticker,
    name: ticker,
    bucket,
    forecastPriceReturnPct: priceReturnPct,
    forecastDividendYieldPct: dividendYieldPct,
    rawPriceEstimatePct: priceReturnPct,
    longWindowPriceCagrPct: priceReturnPct,
    recentPriceCagrPct: priceReturnPct,
    trimmedMeanPriceReturnPct: priceReturnPct,
    benchmarkTotalReturnPct: ticker === "VOO" ? null : 10,
    rawTotalReturnPct: priceReturnPct + dividendYieldPct,
    forecastTotalReturnPct: priceReturnPct + dividendYieldPct,
    observations: 10,
    longWindowYears: 10,
    recentWindowYears: 5,
    dividendObservations: 5,
    confidence: "high",
    shrunkTowardVoo: ticker !== "VOO",
    capped: false,
    dividendFallbackUsed: false,
    status: "test fixture",
  };
}

const testForecasts = [
  forecast("AAA", 5, 1, "longterm"),
  forecast("VOO", 8, 2, "index"),
  forecast("VXUS", 6, 3, "index"),
  forecast("SGOV", 0, 3, "treasury"),
];

function runModel(overrides: Partial<Parameters<typeof runTenYearSimulation>[0]> = {}) {
  const startingPositions: SimulationLedgerPosition[] = [
    { ticker: "AAA", bucket: "longterm", quantity: 10, costBasisUsd: 900 },
    { ticker: "SGOV", bucket: "treasury", quantity: 100, costBasisUsd: 4_900 },
  ];
  const quotes: Record<string, SimulationMarketQuote> = {
    AAA: { price: 100, marketDate: "2026-09-25" },
    SGOV: { price: 50, marketDate: "2026-09-25" },
    VOO: { price: 100, marketDate: "2026-09-25" },
  };
  return runTenYearSimulation({
    asOfDate: "2026-09-25",
    startingPositions,
    quotes,
    fxSpotUsdIdr: 16_000,
    unallocatedCashUsd: 0,
    unallocatedCashIdr: 16_000_000,
    forecasts: testForecasts,
    requiredForecastTickers: ["AAA", "VOO", "VXUS", "SGOV"],
    ...overrides,
  });
}

function assertApprox(actual: number | null | undefined, expected: number, tolerance = 1e-6) {
  assert.ok(actual != null && Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("forecast inputs use trailing complete years, a trimmed mean, and VOO shrinkage", () => {
  const histories = {
    AAA: history("AAA", [-30, 5, 10, 15, 20, 25, 30, 40, 60, 200], Array(10).fill(1)),
    VOO: history("VOO", Array(10).fill(8), Array(10).fill(2)),
    VXUS: history("VXUS", Array(10).fill(6), Array(10).fill(3)),
    SGOV: history("SGOV", Array(10).fill(0), Array(10).fill(3)),
  };
  const forecasts = buildSimulationForecasts(histories, universe, "2026-09-25");
  const stock = forecasts.find((item) => item.ticker === "AAA");
  const voo = forecasts.find((item) => item.ticker === "VOO");
  assert.equal(stock?.observations, 10);
  assert.equal(stock?.longWindowYears, 10);
  assert.equal(stock?.recentWindowYears, 5);
  assertApprox(stock?.trimmedMeanPriceReturnPct, (5 + 10 + 15 + 20 + 25 + 30 + 40 + 60) / 8);
  assert.equal(stock?.shrunkTowardVoo, true);
  assert.equal(stock?.capped, true);
  assert.equal(stock?.forecastTotalReturnPct, 25);
  assert.equal(stock?.confidence, "high");
  assertApprox(voo?.forecastPriceReturnPct, 8);
  assertApprox(voo?.forecastDividendYieldPct, 2);
});

test("confirmed no-dividend history produces zero yield; unavailable history requires explicit fallback", () => {
  const complete = {
    AAA: history("AAA", Array(10).fill(5), Array(10).fill(0)),
    VOO: history("VOO", Array(10).fill(8), Array(10).fill(2)),
    VXUS: history("VXUS", Array(10).fill(6), Array(10).fill(3)),
    SGOV: history("SGOV", Array(10).fill(0), Array(10).fill(3)),
  };
  const noPayer = buildSimulationForecasts(complete, universe, "2026-09-25").find((item) => item.ticker === "AAA");
  assert.equal(noPayer?.forecastDividendYieldPct, 0);

  const unavailable = { ...complete, AAA: history("AAA", Array(10).fill(5), Array(10).fill(0), false) };
  const missing = buildSimulationForecasts(unavailable, universe, "2026-09-25").find((item) => item.ticker === "AAA");
  assert.equal(missing?.forecastDividendYieldPct, null);
  assert.match(missing?.status ?? "", /fallback/);
  const withFallback = buildSimulationForecasts(unavailable, universe, "2026-09-25", { AAA: 1.25 }).find((item) => item.ticker === "AAA");
  assert.equal(withFallback?.forecastDividendYieldPct, 1.25);
  assert.equal(withFallback?.dividendFallbackUsed, true);
});

test("limited history is used and marked low confidence", () => {
  const histories = {
    AAA: history("AAA", [10, -5, 8], [1, 1, 1]),
    VOO: history("VOO", Array(10).fill(8), Array(10).fill(2)),
    VXUS: history("VXUS", Array(10).fill(6), Array(10).fill(3)),
    SGOV: history("SGOV", Array(10).fill(0), Array(10).fill(3)),
  };
  const stock = buildSimulationForecasts(histories, universe, "2019-09-25").find((item) => item.ticker === "AAA");
  assert.equal(stock?.observations, 3);
  assert.equal(stock?.confidence, "low");
  assert.equal(stock?.recentWindowYears, 3);
});

test("as-of value uses current ledger quantities and does not reapply actual YTD return", () => {
  const result = runModel();
  assert.equal(result.status, "ready");
  assert.equal(result.asOfSnapshot?.date, "2026-09-25");
  assertApprox(result.asOfSnapshot?.tickerValuesUsd.AAA, 1_000);
  assertApprox(result.asOfSnapshot?.tickerValuesUsd.SGOV, 6_000);
  assertApprox(result.startingValueUsd, 7_000);
  assertApprox(result.startingCostBasisUsd, 5_800);
  assertApprox(result.startingUnrealizedUsd, 200);
  assert.equal(result.annualSnapshots[0].year, 2026);
  assert.ok(result.annualSnapshots[0].valueUsd > 7_000);
});

test("2026 uses only the remaining fraction of the year before year-end", () => {
  const result = runModel({
    startingPositions: [{ ticker: "AAA", bucket: "longterm", quantity: 1, costBasisUsd: 100 }],
    unallocatedCashUsd: 0,
    unallocatedCashIdr: 0,
    forecasts: [forecast("AAA", 10, 0), forecast("VOO", 8, 0, "index"), forecast("VXUS", 6, 0, "index"), forecast("SGOV", 0, 0, "treasury")],
    monthlyDcaIdr: 0,
  });
  const daysRemaining = (Date.parse("2026-12-31T00:00:00Z") - Date.parse("2026-09-25T00:00:00Z")) / 86_400_000;
  assertApprox(result.annualSnapshots[0].tickerValuesUsd.AAA, 100 * (1.1 ** (daysRemaining / 365.2425)), 1e-4);
  assert.equal(result.annualSnapshots[0].dcaContributionIdr, 0);
});

test("monthly VOO DCA starts in November 2026, uses fractional shares, and continues through 2036", () => {
  const result = runModel();
  assert.equal(result.status, "ready");
  assert.equal(result.annualSnapshots.length, SIMULATION_END_YEAR - 2026 + 1);
  assert.equal(result.annualSnapshots[0].dcaContributionIdr, 26_000_000);
  assert.equal(result.annualSnapshots.at(-1)?.dcaContributionIdr, 156_000_000);
  assert.equal(result.totalDcaPrincipalIdr, 122 * 13_000_000);
  assert.ok((result.endingVooDcaValueUsd ?? 0) > (result.totalDcaPrincipalUsd ?? 0));
  assert.ok((result.tickerSummaries.find((item) => item.ticker === "VOO")?.dcaShares ?? 0) > 0);
  assert.ok((result.tickerSummaries.find((item) => item.ticker === "VOO")?.dcaShares ?? 0) % 1 !== 0);
});

test("FX cases change converted USD purchases and preserve fixed IDR principal", () => {
  const flat = runModel({ annualFxGrowthPct: 0 });
  const base = runModel({ annualFxGrowthPct: 3 });
  const weak = runModel({ annualFxGrowthPct: 5 });
  assert.equal(flat.totalDcaPrincipalIdr, base.totalDcaPrincipalIdr);
  assert.equal(base.totalDcaPrincipalIdr, weak.totalDcaPrincipalIdr);
  assert.ok((flat.totalDcaPrincipalUsd ?? 0) > (base.totalDcaPrincipalUsd ?? 0));
  assert.ok((base.totalDcaPrincipalUsd ?? 0) > (weak.totalDcaPrincipalUsd ?? 0));
  assert.ok((weak.annualSnapshots.at(-1)?.valueIdr ?? 0) > (flat.annualSnapshots.at(-1)?.valueIdr ?? 0));
});

test("withholding changes cash swept to SGOV and all SGOV distributions compound in the sleeve", () => {
  const gross = runModel({ dividendWithholdingPct: 0 });
  const net85 = runModel({ dividendWithholdingPct: 15 });
  const net70 = runModel({ dividendWithholdingPct: 30 });
  assert.ok((gross.cumulativeNetDividendsUsd ?? 0) > (net85.cumulativeNetDividendsUsd ?? 0));
  assert.ok((net85.cumulativeNetDividendsUsd ?? 0) > (net70.cumulativeNetDividendsUsd ?? 0));
  assert.ok((gross.endingSgovBalanceUsd ?? 0) > (net85.endingSgovBalanceUsd ?? 0));
  assert.ok((gross.annualSnapshots[0].sgovGrowthUsd ?? 0) > 0);
  assert.equal(gross.annualSnapshots[0].grossDividendsUsd - gross.annualSnapshots[0].taxWithheldUsd, gross.annualSnapshots[0].netDividendsSweptUsd);
});

test("FX translation and annual contribution-versus-growth bridges reconcile", () => {
  const result = runModel({ annualFxGrowthPct: 3 });
  assert.ok(result.cumulativeFxTranslationIdr > 0);
  for (const row of result.annualSnapshots) {
    assertApprox(row.reconciliationErrorUsd, 0, 1e-6);
    assertApprox(
      row.valueIdr,
      row.beginningValueIdr + row.dcaContributionIdr + row.investmentGrowthUsd * row.fxUsdIdr + row.fxTranslationIdr,
      1e-4,
    );
  }
});

test("missing current quotes and missing forecast history block the model instead of becoming zero", () => {
  const missingQuote = runModel({ quotes: { VOO: { price: 100, marketDate: "2026-09-25" } } });
  assert.equal(missingQuote.status, "blocked");
  assert.ok(missingQuote.issues.some((issue) => issue.includes("AAA has no current market close")));

  const missingForecast = runModel({ forecasts: testForecasts.filter((item) => item.ticker !== "VXUS") });
  assert.equal(missingForecast.status, "blocked");
  assert.ok(missingForecast.issues.some((issue) => issue.includes("VXUS has no forecast input")));
});
