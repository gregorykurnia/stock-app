import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths,
  assessEligibility,
  horizonMeasures,
  horizonWeights,
  isMonthEnd,
  medianDollarVolume,
  monthEndLevels,
  momentumScores,
  monthsBetween,
  percentileOf,
  percentileRanks,
  rankFunds,
  tierOf,
  trendFeatures,
  vehicleScore,
  type RankingBar,
  type RankingFundInput,
  type RankingHorizon,
} from "../lib/etfRanking";

const CUTOFF = "2026-09-30";

function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

// One month-end bar per entry, oldest first, ending at endMonth.
function monthEndBars(endMonth: string, prices: number[], volume = 1_000_000): RankingBar[] {
  return prices.map((price, index) => {
    const month = addMonths(endMonth, index - (prices.length - 1));
    return { date: lastDayOf(month), close: price, adjustedClose: price, volume };
  });
}

// Every calendar day in each month, carrying that month's price. Used where 30 sessions of volume are needed.
function dailyBars(endMonth: string, prices: number[], volume = 1_000_000): RankingBar[] {
  const bars: RankingBar[] = [];
  prices.forEach((price, index) => {
    const month = addMonths(endMonth, index - (prices.length - 1));
    const days = Number(lastDayOf(month).slice(8, 10));
    for (let day = 1; day <= days; day += 1) {
      bars.push({ date: `${month}-${String(day).padStart(2, "0")}`, close: price, adjustedClose: price, volume });
    }
  });
  return bars;
}

// Up 2% in two months out of three, down 1% in the third. 36 monthly returns, 37 levels.
function patternPrices(length: number, upRate = 0.02, downRate = -0.01, start = 100): number[] {
  const prices = [start];
  for (let step = 0; step < length - 1; step += 1) {
    const rate = step % 3 === 2 ? downRate : upRate;
    prices.push(prices[prices.length - 1] * (1 + rate));
  }
  return prices;
}

function fundInput(overrides: Partial<RankingFundInput> & { bars: RankingBar[] }): RankingFundInput {
  return {
    ticker: "TEST",
    structure: "ETF; verify current legal form",
    productClass: "standard",
    legalFormVerified: true,
    netExpenseRatioPct: 0.2,
    aumUsd: 5_000_000_000,
    aumAsOf: "2026-09-30",
    ...overrides,
  };
}

test("percentile ranks: ties share the midpoint and the ends are 0 and 100", () => {
  const values = new Map([["a", 1], ["b", 2], ["c", 2], ["d", 3]]);
  const higher = percentileRanks(values, "higher");
  assert.equal(higher.get("a"), 0);
  assert.equal(higher.get("b"), 50);
  assert.equal(higher.get("c"), 50);
  assert.equal(higher.get("d"), 100);

  const lower = percentileRanks(values, "lower");
  assert.equal(lower.get("a"), 100);
  assert.equal(lower.get("b"), 50);
  assert.equal(lower.get("d"), 0);
});

test("percentile ranks: a lone fund is neutral, two funds are 0 and 100", () => {
  assert.equal(percentileOf(5, [], "higher"), 50);
  assert.equal(percentileRanks(new Map([["only", 5]]), "higher").get("only"), 50);
  const pair = percentileRanks(new Map([["low", 1], ["high", 2]]), "higher");
  assert.equal(pair.get("low"), 0);
  assert.equal(pair.get("high"), 100);
});

test("percentile ranks: monotonic in the value and reversed for lower-is-better", () => {
  const values = [0.31, -0.2, 0.05, 0.05, 1.7, 0.9, -0.2, 0.44];
  const map = new Map(values.map((value, index) => [`f${index}`, value]));
  const higher = percentileRanks(map, "higher");
  const lower = percentileRanks(map, "lower");
  for (const [keyA, valueA] of map) {
    for (const [keyB, valueB] of map) {
      if (valueA > valueB) {
        assert.ok(higher.get(keyA)! > higher.get(keyB)!, `${keyA} should outrank ${keyB}`);
        assert.ok(lower.get(keyA)! < lower.get(keyB)!, `${keyA} should rank below ${keyB} when lower is better`);
      }
    }
  }
  for (const key of map.keys()) assert.ok(Math.abs(higher.get(key)! + lower.get(key)! - 100) < 1e-9);
});

test("percentile ranks: independent of insertion order", () => {
  const entries: Array<[string, number]> = [["a", 0.1], ["b", -0.4], ["c", 0.1], ["d", 2], ["e", 0.7]];
  const forward = percentileRanks(new Map(entries), "higher");
  const reverse = percentileRanks(new Map([...entries].reverse()), "higher");
  for (const [key] of entries) assert.equal(forward.get(key), reverse.get(key));
});

test("CAGR uses (P_end / P_start)^(12/n) - 1 over n monthly returns", () => {
  const prices = patternPrices(37);
  const cash = Array(37).fill(100);
  const bars = monthEndBars(CUTOFF, prices);
  const outcome = horizonMeasures(3, bars, monthEndLevels(bars, CUTOFF), monthEndLevels(monthEndBars(CUTOFF, cash), CUTOFF), CUTOFF);
  assert.equal(outcome.available, true);
  if (!outcome.available) return;
  const expected = (prices[36] / prices[0]) ** (12 / 36) - 1;
  assert.ok(Math.abs(outcome.measures.cagr - expected) < 1e-12);
  assert.equal(outcome.measures.startDate, "2023-09-30");
  assert.equal(outcome.measures.endDate, "2026-09-30");
});

test("Sortino against flat cash matches the plan formula by hand", () => {
  // Excess months: 24 at +2% and 12 at -1%. Mean 1% a month, annualised 12%.
  // Downside deviation = sqrt(12 × (12 × 0.01²) / 36) = 2%. Sortino = 12% / 2% = 6.
  const bars = monthEndBars(CUTOFF, patternPrices(37));
  const cash = monthEndBars(CUTOFF, Array(37).fill(100));
  const outcome = horizonMeasures(3, bars, monthEndLevels(bars, CUTOFF), monthEndLevels(cash, CUTOFF), CUTOFF);
  assert.equal(outcome.available && outcome.measures.sortino != null ? Math.round(outcome.measures.sortino * 1e9) / 1e9 : null, 6);
});

test("Sortino with no negative excess months is undefined, not zero or infinite", () => {
  const rising = patternPrices(37, 0.02, 0.02);
  const bars = monthEndBars(CUTOFF, rising);
  const cash = monthEndBars(CUTOFF, Array(37).fill(100));
  const outcome = horizonMeasures(3, bars, monthEndLevels(bars, CUTOFF), monthEndLevels(cash, CUTOFF), CUTOFF);
  assert.equal(outcome.available, true);
  if (outcome.available) assert.equal(outcome.measures.sortino, null);
});

test("pain: depth and underwater share from the daily window", () => {
  // Every down month is exactly 1% below the running peak and the next up month makes a new peak.
  // That gives 12 underwater observations out of 37 daily observations (start included).
  const bars = monthEndBars(CUTOFF, patternPrices(37));
  const cash = monthEndBars(CUTOFF, Array(37).fill(100));
  const outcome = horizonMeasures(3, bars, monthEndLevels(bars, CUTOFF), monthEndLevels(cash, CUTOFF), CUTOFF);
  assert.equal(outcome.available, true);
  if (!outcome.available) return;
  assert.ok(Math.abs(outcome.measures.depth - 0.01) < 1e-12);
  assert.ok(Math.abs(outcome.measures.underwater - 12 / 37) < 1e-12);
});

test("horizon blend weights follow the plan's history bands", () => {
  assert.equal(horizonWeights(35), null);
  assert.deepEqual(horizonWeights(36), { 3: 1 });
  assert.deepEqual(horizonWeights(59), { 3: 1 });
  assert.deepEqual(horizonWeights(60), { 3: 0.4, 5: 0.6 });
  assert.deepEqual(horizonWeights(119), { 3: 0.4, 5: 0.6 });
  assert.deepEqual(horizonWeights(120), { 3: 0.2, 5: 0.3, 10: 0.5 });
});

test("horizon is unavailable, not shortened, when a month is missing", () => {
  const prices = patternPrices(37);
  const bars = monthEndBars(CUTOFF, prices).filter((_, index) => index !== 20);
  const cash = monthEndBars(CUTOFF, Array(37).fill(100));
  const outcome = horizonMeasures(3, bars, monthEndLevels(bars, CUTOFF), monthEndLevels(cash, CUTOFF), CUTOFF);
  assert.equal(outcome.available, false);
});

test("vehicle bands: cost, liquidity and size hit their anchors and midpoints", () => {
  const free = vehicleScore({ expenseRatioPct: 0, aumUsd: 1e9, medianDollarVolume: 50e6 });
  assert.equal(free?.costScore, 100);
  assert.equal(free?.liquidityScore, 100);
  assert.equal(free?.sizeScore, 100);
  assert.equal(free?.vehicle, 100);

  const worst = vehicleScore({ expenseRatioPct: 1, aumUsd: 50e6, medianDollarVolume: 1e6 });
  assert.equal(worst?.costScore, 0);
  assert.equal(worst?.liquidityScore, 0);
  assert.equal(worst?.sizeScore, 0);

  const mid = vehicleScore({ expenseRatioPct: 0.5, aumUsd: Math.sqrt(50e6 * 1e9), medianDollarVolume: Math.sqrt(1e6 * 50e6) });
  assert.ok(Math.abs(mid!.costScore - 50) < 1e-9);
  assert.ok(Math.abs(mid!.liquidityScore - 50) < 1e-9);
  assert.ok(Math.abs(mid!.sizeScore - 50) < 1e-9);
  assert.ok(Math.abs(mid!.vehicle - 50) < 1e-9);
});

test("vehicle is null when any input is missing", () => {
  assert.equal(vehicleScore({ expenseRatioPct: null, aumUsd: 1e9, medianDollarVolume: 1e7 }), null);
  assert.equal(vehicleScore({ expenseRatioPct: 0.1, aumUsd: null, medianDollarVolume: 1e7 }), null);
  assert.equal(vehicleScore({ expenseRatioPct: 0.1, aumUsd: 1e9, medianDollarVolume: null }), null);
});

test("median dollar volume uses the last 30 sessions through the cutoff and needs 30", () => {
  const bars = [...dailyBars(CUTOFF, [100], 1_000)];
  const sessions = bars.filter((bar) => bar.date <= CUTOFF).slice(-30);
  assert.equal(medianDollarVolume(bars, CUTOFF), 100 * 1_000);
  assert.equal(sessions.length, 30);
  assert.equal(medianDollarVolume(bars.slice(0, 29), CUTOFF), null);
});

test("trend: a flat series sits on its moving average and counts as uptrend", () => {
  const levels = monthEndLevels(monthEndBars(CUTOFF, Array(13).fill(100)), CUTOFF);
  const features = trendFeatures(levels, CUTOFF);
  assert.ok(features);
  assert.equal(features.uptrend, true);
  assert.equal(features.mom3, 0);
  assert.equal(features.sma10, 100);
});

test("trend: a last month below its 10-month average is a downtrend", () => {
  const prices = [...Array(12).fill(100), 80];
  const features = trendFeatures(monthEndLevels(monthEndBars(CUTOFF, prices), CUTOFF), CUTOFF);
  assert.ok(features);
  assert.equal(features.uptrend, false);
  assert.ok(Math.abs(features.mom12x - 0) < 1e-12);
});

test("trend needs 12 months of history", () => {
  const levels = monthEndLevels(monthEndBars(CUTOFF, Array(12).fill(100)), CUTOFF);
  assert.equal(trendFeatures(levels, CUTOFF), null);
});

test("momentum: the best fund on every component scores 100", () => {
  const features = new Map([
    ["best", { mom3: 0.3, mom6: 0.5, mom12x: 0.9, close: 1, sma10: 1, uptrend: true }],
    ["mid", { mom3: 0.1, mom6: 0.2, mom12x: 0.3, close: 1, sma10: 1, uptrend: true }],
    ["worst", { mom3: -0.2, mom6: -0.1, mom12x: -0.3, close: 1, sma10: 1, uptrend: false }],
  ]);
  const scores = momentumScores(features, new Set(["best", "mid", "worst"]));
  assert.equal(scores.get("best"), 100);
  assert.equal(scores.get("worst"), 0);
  assert.equal(scores.get("mid"), 50);
});

test("eligibility: excluded, separate list and too-new come first", () => {
  const bars = monthEndBars(CUTOFF, patternPrices(41));
  const levels = monthEndLevels(bars, CUTOFF);
  assert.equal(assessEligibility(fundInput({ productClass: "excluded", structure: "closed-end-fund", bars }), levels, CUTOFF).state, "Excluded");
  assert.equal(assessEligibility(fundInput({ productClass: "leveraged_inverse", bars }), levels, CUTOFF).state, "Separate list");
  assert.equal(assessEligibility(fundInput({ productClass: "etn", structure: "ETN", bars }), levels, CUTOFF).state, "Separate list");

  const young = monthEndBars(CUTOFF, patternPrices(30));
  const tooNew = assessEligibility(fundInput({ bars: young }), monthEndLevels(young, CUTOFF), CUTOFF);
  assert.equal(tooNew.state, "Too new");
  assert.match(tooNew.reason, /29 months from 2024-04/);
});

test("eligibility: legal-form gate covers commodity, metal and bitcoin trusts only", () => {
  const bars = monthEndBars(CUTOFF, patternPrices(41));
  const levels = monthEndLevels(bars, CUTOFF);
  const gated = (structure: string, legalFormVerified: boolean) => assessEligibility(fundInput({ structure, legalFormVerified, bars }), levels, CUTOFF).state;

  assert.equal(gated("physical-metal-trust", false), "Legal form unverified");
  assert.equal(gated("commodity-pool/trust; verify exact legal form", false), "Legal form unverified");
  assert.equal(gated("physical-metal-trust", true), "Ranked");
  assert.equal(gated("ETF; verify current legal form", false), "Ranked", "plain ETFs are not gated (Phase 1 decision 4)");
  assert.equal(gated("ETF trust", true), "Ranked");
});

test("eligibility: legal form is checked before inputs, and each missing input is named", () => {
  const bars = monthEndBars(CUTOFF, patternPrices(41));
  const levels = monthEndLevels(bars, CUTOFF);
  assert.equal(assessEligibility(fundInput({ structure: "physical-metal-trust", legalFormVerified: false, netExpenseRatioPct: null, bars }), levels, CUTOFF).state, "Legal form unverified");

  const noFee = assessEligibility(fundInput({ netExpenseRatioPct: null, bars }), levels, CUTOFF);
  assert.equal(noFee.state, "Input missing");
  assert.match(noFee.reason, /net_expense_ratio_pct/);

  const noAum = assessEligibility(fundInput({ aumUsd: null, aumAsOf: null, bars }), levels, CUTOFF);
  assert.equal(noAum.state, "Input missing");
  assert.match(noAum.reason, /aum_usd/);
});

test("eligibility: AUM must be dated within 12 months of the cutoff, boundary included", () => {
  const bars = monthEndBars(CUTOFF, patternPrices(41));
  const levels = monthEndLevels(bars, CUTOFF);
  assert.equal(assessEligibility(fundInput({ aumAsOf: "2025-09-30", bars }), levels, CUTOFF).state, "Ranked");
  const stale = assessEligibility(fundInput({ aumAsOf: "2025-09-29", bars }), levels, CUTOFF);
  assert.equal(stale.state, "Input missing");
  assert.match(stale.reason, /older than 12 months/);
});

test("eligibility: price history must reach the cutoff", () => {
  const bars = monthEndBars("2026-08", patternPrices(41));
  const result = assessEligibility(fundInput({ bars }), monthEndLevels(bars, CUTOFF), CUTOFF);
  assert.equal(result.state, "Input missing");
  assert.match(result.reason, /does not reach the cutoff/);
});

test("tiers: top 20% is tier 1, equal scores share a tier, the bottom is tier 5", () => {
  assert.equal(tierOf(0, 45), 1);
  assert.equal(tierOf(8, 45), 1);
  assert.equal(tierOf(9, 45), 2);
  assert.equal(tierOf(18, 45), 3);
  assert.equal(tierOf(36, 45), 5);
  assert.equal(tierOf(44, 45), 5);
  assert.equal(tierOf(0, 1), 1);
});

test("cutoff must be a month-end date", () => {
  assert.equal(isMonthEnd("2026-09-30"), true);
  assert.equal(isMonthEnd("2026-09-29"), false);
  assert.equal(isMonthEnd("2026-02-28"), true);
  assert.equal(isMonthEnd("2024-02-28"), false);
  assert.throws(() => rankFunds([], { cutoff: "2026-09-29", cashBars: [] }), /month-end/);
});

test("addMonths and monthsBetween cross year boundaries", () => {
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-09", -36), "2023-09");
  assert.equal(monthsBetween("2016-09", "2026-09"), 120);
});

// Six funds with the same 10-year history and the same Vehicle, except for cost, so the ordering is set by Outcome and cost.
// NOD has no negative months (down rate 0), so its Sortino is undefined.
function rankedUniverse(): RankingFundInput[] {
  const specs: Array<{ ticker: string; up: number; down: number; fee: number }> = [
    { ticker: "AAA", up: 0.02, down: -0.01, fee: 0.05 },
    { ticker: "BBB", up: 0.02, down: -0.01, fee: 0.5 },
    { ticker: "CCC", up: 0.012, down: -0.01, fee: 0.05 },
    { ticker: "DDD", up: 0.006, down: -0.03, fee: 0.2 },
    { ticker: "EEE", up: 0.009, down: -0.02, fee: 0.9 },
    { ticker: "FFF", up: 0.004, down: -0.05, fee: 0.3 },
    { ticker: "NOD", up: 0.03, down: 0, fee: 0.1 },
  ];
  return specs.map((spec) => fundInput({
    ticker: spec.ticker,
    netExpenseRatioPct: spec.fee,
    bars: dailyBars(CUTOFF, patternPrices(121, spec.up, spec.down)),
  }));
}

test("rankFunds: outcome and cost order the funds, tiers and ranks are consistent", () => {
  const cashBars = dailyBars(CUTOFF, Array(121).fill(100));
  const run = rankFunds(rankedUniverse(), { cutoff: CUTOFF, cashBars });
  const byTicker = new Map(run.funds.map((fund) => [fund.ticker, fund]));

  // "NOD" never has a negative excess month, so its Sortino is undefined and it is not scored.
  assert.equal(byTicker.get("NOD")?.state, "Ranked");
  assert.equal(byTicker.get("NOD")?.grand, null);
  assert.match(byTicker.get("NOD")?.scoreNote ?? "", /Sortino undefined/);

  const scored = run.funds.filter((fund) => fund.grand != null);
  assert.equal(scored.length, 6);
  assert.equal(byTicker.get("AAA")!.rank, 1);
  assert.ok(byTicker.get("AAA")!.grand! > byTicker.get("BBB")!.grand!, "same outcome, lower cost wins");
  assert.ok(byTicker.get("AAA")!.grand! > byTicker.get("CCC")!.grand!, "same cost, better outcome wins");
  assert.equal(byTicker.get("AAA")!.tier, 1);
  assert.equal(byTicker.get("FFF")!.tier, 5);
  assert.equal(byTicker.get("AAA")!.blendWeights?.[10 as RankingHorizon], 0.5);
});

test("rankFunds: independent of input order", () => {
  const cashBars = dailyBars(CUTOFF, Array(121).fill(100));
  const forward = rankFunds(rankedUniverse(), { cutoff: CUTOFF, cashBars });
  const reversed = rankFunds([...rankedUniverse()].reverse(), { cutoff: CUTOFF, cashBars });
  assert.deepEqual(reversed, forward);
});

test("rankFunds: duplicate tickers are rejected", () => {
  const bars = monthEndBars(CUTOFF, patternPrices(41));
  assert.throws(() => rankFunds([fundInput({ bars }), fundInput({ bars })], { cutoff: CUTOFF, cashBars: [] }), /Duplicate ticker/);
});

test("rankFunds: excluded funds carry no vehicle or trend", () => {
  const bars = monthEndBars(CUTOFF, patternPrices(41));
  const run = rankFunds([fundInput({ ticker: "OPC", productClass: "excluded", structure: "operating-company-stock", bars })], { cutoff: CUTOFF, cashBars: [] });
  assert.equal(run.funds[0].state, "Excluded");
  assert.equal(run.funds[0].vehicle, null);
  assert.equal(run.funds[0].trend, null);
  assert.equal(run.funds[0].grand, null);
});
