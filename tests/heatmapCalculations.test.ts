import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateSectors, breadth, colorBucket, computeReturnsFromBars,
  contrastRatio, contributionPct, distanceFromMa, equalWeightedMean,
  metricValue, rankBy, relativeReturn, relativeVolume, scaleForMetric,
  tileTextColor, totalMarketCap, viewStateToQuery, parseHeatmapViewState,
  TILE_PALETTES,
} from "../lib/heatmap/calculations";
import { toYahooSymbol } from "../lib/heatmap/constituents";
import { layoutGroups } from "../lib/heatmap/layout";
import type { HeatmapStock } from "../lib/heatmap/types";

function stock(symbol: string, overrides: Partial<HeatmapStock> = {}): HeatmapStock {
  return {
    symbol, companyName: symbol, sector: "Technology", industry: "Software", price: 110,
    previousClose: 100, returns: { oneDay: 10, oneWeek: 8, oneMonth: 5, threeMonths: 4, ytd: 3, oneYear: 2 },
    marketCap: 100, volume: 200, averageVolume: 100, relativeVolume: 2, dollarVolume: 22000,
    high52Week: 120, low52Week: 80, position52Week: 75, ma20: 100, ma50: 95, ma200: 90,
    timestamp: "2026-09-11T20:00:00.000Z", quoteSource: "Delayed Quote", ...overrides,
  };
}

test("heatmap returns use quote price, prior close, and nearest earlier trading bar", () => {
  const returns = computeReturnsFromBars([
    { date: "2025-09-10", close: 80 }, { date: "2026-08-11", close: 90 },
    { date: "2026-09-04", close: 100 }, { date: "2026-09-11", close: 105 },
  ], 110, 100);
  assert.ok(Math.abs((returns.oneDay ?? 0) - 10) < 1e-10);
  assert.ok(Math.abs((returns.oneWeek ?? 0) - 10) < 1e-10);
  assert.equal(returns.oneMonth, (110 / 90 - 1) * 100);
  assert.equal(returns.oneYear, (110 / 80 - 1) * 100);
});

test("relative metrics and moving-average distances reject invalid denominators", () => {
  assert.equal(relativeReturn(4, 1.5), 2.5);
  assert.equal(relativeReturn(null, 1), null);
  assert.equal(relativeVolume(250, 100), 2.5);
  assert.equal(relativeVolume(250, 0), null);
  assert.equal(distanceFromMa(110, 100), 10.000000000000009);
  assert.equal(distanceFromMa(110, 0), null);
});

test("sector aggregates distinguish cap and equal weighting and contributions add up", () => {
  const a = stock("AAA", { marketCap: 900, returns: { ...stock("x").returns, oneDay: 10 } });
  const b = stock("BBB", { marketCap: 100, returns: { ...stock("x").returns, oneDay: -10 } });
  const c = stock("CCC", { sector: "Energy", marketCap: 1000, returns: { ...stock("x").returns, oneDay: 5 } });
  assert.equal(equalWeightedMean([10, -10]), 0);
  assert.equal(totalMarketCap([a, b, c]), 2000);
  assert.equal(contributionPct(a.marketCap, 2000, 10), 4.5);
  const sectors = aggregateSectors([a, b, c], "1D", 2000, ["Technology", "Energy"]);
  assert.equal(sectors[0].capWeightedReturn, 8);
  assert.equal(sectors[0].equalWeightedReturn, 0);
  assert.equal(sectors[0].advancers, 1);
  assert.equal(sectors[0].decliners, 1);
  assert.equal(sectors.reduce((sum, sector) => sum + (sector.contribution ?? 0), 0), 6.5);
});

test("rankings are deterministic, and missing values do not rank", () => {
  const rows = rankBy([stock("BBB"), stock("AAA"), stock("NONE", { returns: { ...stock("x").returns, oneDay: null } })],
    (item) => item.returns.oneDay);
  assert.deepEqual(rows.map((row) => row.stock.symbol), ["AAA", "BBB"]);
  assert.deepEqual(rows.map((row) => row.rank), [1, 2]);
  assert.equal(metricValue(stock("A"), "relative", "1D", 2), 8);
});

test("breadth treats zeros separately and retains missing values", () => {
  const result = breadth([1, -1, 0, null]);
  assert.deepEqual({ ...result, pctAdvancing: null }, { advancers: 1, decliners: 1, unchanged: 1, withData: 3, pctAdvancing: null });
  assert.ok(Math.abs((result.pctAdvancing ?? 0) - 100 / 3) < 1e-10);
});

test("color buckets retain a neutral midpoint and 52-week-high is one-sided", () => {
  assert.equal(colorBucket(0.2, scaleForMetric("performance", "1D")), 0);
  assert.equal(colorBucket(2, scaleForMetric("performance", "1D")), 3);
  assert.equal(colorBucket(-20, scaleForMetric("dist52wHigh", "1D")), -3);
  assert.equal(colorBucket(2, scaleForMetric("dist52wHigh", "1D")), 0);
  assert.equal(colorBucket(null, scaleForMetric("performance", "1D")), null);
});

test("every tile fill receives a text color with at least 4.5:1 contrast", () => {
  for (const palette of Object.values(TILE_PALETTES)) {
    for (const fill of Object.values(palette)) assert.ok(contrastRatio(fill, tileTextColor(fill)) >= 4.5, fill);
  }
});

test("treemap group layout conserves contained area without invalid geometry", () => {
  const groups = layoutGroups([
    { key: "a", weight: 3, items: [{ key: "a1", weight: 2 }, { key: "a2", weight: 1 }] },
    { key: "b", weight: 1, items: [{ key: "b1", weight: 1 }] },
  ], { x: 0, y: 0, width: 100, height: 100 }, 8);
  for (const group of groups) for (const item of group.items) {
    assert.ok(Number.isFinite(item.x + item.y + item.width + item.height));
    assert.ok(item.x >= group.contentRect.x - 1e-8 && item.y >= group.contentRect.y - 1e-8);
    assert.ok(item.x + item.width <= group.contentRect.x + group.contentRect.width + 1e-8);
    assert.ok(item.y + item.height <= group.contentRect.y + group.contentRect.height + 1e-8);
  }
});

test("symbols and view state normalize safely and round trip", () => {
  assert.equal(toYahooSymbol("brk.b"), "BRK-B");
  const state = parseHeatmapViewState((key) => ({ p: "1M", q: " NVDA ", pal: "colorblindSafe", z: "Information Technology" }[key] ?? null));
  assert.equal(state.period, "1M");
  assert.equal(state.search, "NVDA");
  assert.match(viewStateToQuery(state), /p=1M/);
  assert.match(viewStateToQuery(state), /q=NVDA/);
});
