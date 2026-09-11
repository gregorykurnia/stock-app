// Pure financial + scoring calculations for the US Market Heatmap. No fetching,
// no React, no server-only APIs — every function here is directly unit-testable
// (same convention as lib/markets/calc.ts).
//
// Definitions used across the heatmap (also surfaced in the UI methodology note):
//   - Return for a period: (latest price / reference close - 1) * 100, where the
//     reference is the nearest prior trading close at or before the period's
//     target date. 1D compares the latest price to the official previous close.
//   - Relative return: stock return minus the S&P 500 (^GSPC) return for the
//     same period. Positive = outperformed the index.
//   - Relative volume: regular session volume divided by average volume
//     (Yahoo's 3-month averageVolume). 1.0 = in line with average.
//   - Distance from a moving average: (price / MA - 1) * 100, signed.
//   - Distance from 52-week high: (price / high52 - 1) * 100, always <= ~0.
//   - Contribution (est.): stock weight (share of total heatmap market cap)
//     times its return, in index-percentage-points. Approximate — official
//     index weights are float-adjusted and not available from this provider.
//   - Any computation that cannot be done honestly returns null — the UI
//     renders "—". Never NaN, never Infinity, never a misleading 0.

import type {
  HeatmapColorMetric,
  HeatmapDataStatus,
  HeatmapGrouping,
  HeatmapMoversFilter,
  HeatmapPalette,
  HeatmapPeriod,
  HeatmapReturns,
  HeatmapSizeMetric,
  HeatmapStock,
  HeatmapViewMode,
  HeatmapViewState,
  MarketSessionState,
} from "./types";
import { addDays, pctChange, periodReturnPct, type HistoryBar } from "../markets/calc";

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export const HEATMAP_PERIODS: HeatmapPeriod[] = ["1D", "1W", "1M", "3M", "YTD", "1Y"];

export function periodLabel(period: HeatmapPeriod): string {
  switch (period) {
    case "1D": return "1 day";
    case "1W": return "1 week";
    case "1M": return "1 month";
    case "3M": return "3 months";
    case "YTD": return "year to date";
    case "1Y": return "1 year";
  }
}

// Accessor for the selected period's return. Null-safe by construction.
export function periodReturn(returns: HeatmapReturns | null | undefined, period: HeatmapPeriod): number | null {
  if (!returns) return null;
  switch (period) {
    case "1D": return returns.oneDay;
    case "1W": return returns.oneWeek;
    case "1M": return returns.oneMonth;
    case "3M": return returns.threeMonths;
    case "YTD": return returns.ytd;
    case "1Y": return returns.oneYear;
  }
}

// Comparison target dates anchored to the latest bar date (stable across
// weekends — a Friday close viewed on Sunday still compares to the prior
// Friday's window). Extends lib/markets/calc returnTargets with 3M and 1Y.
export function returnTargetsFor(latestBarDate: string): {
  week: string; month: string; quarter: string; ytd: string; year: string;
} {
  const year = Number(latestBarDate.slice(0, 4));
  return {
    week: addDays(latestBarDate, -7),
    month: addDays(latestBarDate, -30),
    quarter: addDays(latestBarDate, -91),
    ytd: `${year - 1}-12-31`,
    year: addDays(latestBarDate, -365),
  };
}

// A daily bar with the optional fields the heatmap needs. Structurally
// compatible with HistoryBar ({date, close}) so periodReturnPct accepts it.
export interface HeatmapBar extends HistoryBar {
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

// Full return set for one symbol from its daily bars. `price` (the freshest
// quote) overrides the last bar close when ahead; `previousClose` is the
// authoritative official previous close for the 1D return.
export function computeReturnsFromBars(
  bars: HeatmapBar[],
  price: number | null,
  previousClose: number | null
): HeatmapReturns {
  const latestBar = bars.at(-1) ?? null;
  const oneDay = price != null && previousClose != null ? pctChange(price, previousClose) : null;
  if (!latestBar) {
    return { oneDay, oneWeek: null, oneMonth: null, threeMonths: null, ytd: null, oneYear: null };
  }
  const targets = returnTargetsFor(latestBar.date);
  return {
    oneDay,
    oneWeek: periodReturnPct(bars, targets.week, price),
    oneMonth: periodReturnPct(bars, targets.month, price),
    threeMonths: periodReturnPct(bars, targets.quarter, price),
    ytd: periodReturnPct(bars, targets.ytd, price),
    oneYear: periodReturnPct(bars, targets.year, price),
  };
}

// ---------------------------------------------------------------------------
// Per-symbol metric math
// ---------------------------------------------------------------------------

// Stock return minus benchmark return for the same period. Null when either
// side is missing — never silently reported as 0.
export function relativeReturn(stockReturnPct: number | null, benchmarkReturnPct: number | null): number | null {
  if (stockReturnPct == null || benchmarkReturnPct == null) return null;
  if (!Number.isFinite(stockReturnPct) || !Number.isFinite(benchmarkReturnPct)) return null;
  return stockReturnPct - benchmarkReturnPct;
}

// Today's regular volume / average volume. Null when either is missing or the
// average is zero (no honest ratio exists).
export function relativeVolume(volume: number | null, averageVolume: number | null): number | null {
  if (volume == null || averageVolume == null) return null;
  if (!Number.isFinite(volume) || !Number.isFinite(averageVolume) || averageVolume <= 0) return null;
  return volume / averageVolume;
}

export function dollarVolume(price: number | null, volume: number | null): number | null {
  if (price == null || volume == null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(volume) || price < 0 || volume < 0) return null;
  return price * volume;
}

// Signed percent distance from a moving average: (price / ma - 1) * 100.
export function distanceFromMa(price: number | null, ma: number | null): number | null {
  if (price == null || ma == null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(ma) || ma <= 0) return null;
  return pctChange(price, ma);
}

// Percent distance below the 52-week high: (price / high - 1) * 100. Values are
// <= ~0 by construction (an intraday quote can nick above the stored high).
export function distanceFrom52wHigh(price: number | null, high52Week: number | null): number | null {
  if (price == null || high52Week == null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(high52Week) || high52Week <= 0) return null;
  return pctChange(price, high52Week);
}

export function isAboveMa(price: number | null, ma: number | null): boolean | null {
  if (price == null || ma == null || !Number.isFinite(price) || !Number.isFinite(ma)) return null;
  return price > ma;
}

// A stock whose tile can carry no market data at all (per-symbol provider
// failure, or a delisted/rename drift the static list hasn't caught up with).
export function isUnavailable(stock: HeatmapStock): boolean {
  return stock.error != null || stock.price == null;
}

// Estimated index weight from market cap: marketCap / totalMarketCap. Returns
// null when either input is missing or the total is not positive.
export function estimatedWeight(marketCap: number | null, totalMarketCap: number | null): number | null {
  if (marketCap == null || totalMarketCap == null) return null;
  if (!Number.isFinite(marketCap) || !Number.isFinite(totalMarketCap) || marketCap < 0 || totalMarketCap <= 0) return null;
  return marketCap / totalMarketCap;
}

// Contribution of one stock to the (proxy) index move, in percentage points:
// weight x return. Explicitly an estimate — see module header.
export function contributionPct(marketCap: number | null, totalMarketCap: number | null, returnPct: number | null): number | null {
  const weight = estimatedWeight(marketCap, totalMarketCap);
  if (weight == null || returnPct == null || !Number.isFinite(returnPct)) return null;
  return weight * returnPct;
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export interface WeightedValue {
  weight: number | null;
  value: number | null;
}

// Cap-weighted mean of `value` over entries that have both a positive weight
// and a finite value. Weights are re-normalized over the contributing entries
// so missing market caps don't bias the average.
export function capWeightedMean(entries: WeightedValue[]): number | null {
  let weightSum = 0;
  let weighted = 0;
  for (const entry of entries) {
    if (entry.weight == null || entry.value == null) continue;
    if (!Number.isFinite(entry.weight) || !Number.isFinite(entry.value) || entry.weight <= 0) continue;
    weightSum += entry.weight;
    weighted += entry.weight * entry.value;
  }
  if (weightSum <= 0) return null;
  return weighted / weightSum;
}

// Plain average of the finite values. Null when no values are usable.
export function equalWeightedMean(values: Array<number | null>): number | null {
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    sum += value;
    count += 1;
  }
  if (count === 0) return null;
  return sum / count;
}

export interface Breadth {
  advancers: number;
  decliners: number;
  unchanged: number;
  withData: number;
  pctAdvancing: number | null;
}

// Advancers/decliners for a set of period returns. "Unchanged" is exactly 0 —
// a rounding artifact at 4dp at most, and kept separate so it isn't silently
// counted on either side.
export function breadth(returns: Array<number | null>): Breadth {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  for (const value of returns) {
    if (value == null || !Number.isFinite(value)) continue;
    if (value > 0) advancers += 1;
    else if (value < 0) decliners += 1;
    else unchanged += 1;
  }
  const withData = advancers + decliners + unchanged;
  return {
    advancers,
    decliners,
    unchanged,
    withData,
    pctAdvancing: withData > 0 ? (advancers / withData) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Ranking (deterministic, tie-safe)
// ---------------------------------------------------------------------------

export interface RankedStock {
  stock: HeatmapStock;
  value: number;
  rank: number;
}

// Ranks stocks by a metric value. Nulls and non-finite values are excluded —
// a leaderboard cannot honestly rank missing data. Ties break by symbol A→Z so
// repeated renders (and repeated tests) always agree.
export function rankBy(
  stocks: HeatmapStock[],
  value: (stock: HeatmapStock) => number | null,
  options: { descending?: boolean; limit?: number } = {}
): RankedStock[] {
  const { descending = true, limit } = options;
  const scored: Array<{ stock: HeatmapStock; value: number }> = [];
  for (const stock of stocks) {
    const raw = value(stock);
    if (raw == null || !Number.isFinite(raw)) continue;
    scored.push({ stock, value: raw });
  }
  scored.sort((a, b) => {
    if (a.value !== b.value) return descending ? b.value - a.value : a.value - b.value;
    return a.stock.symbol.localeCompare(b.stock.symbol);
  });
  const ranked = scored.map((entry, index) => ({ ...entry, rank: index + 1 }));
  return limit != null ? ranked.slice(0, limit) : ranked;
}

// ---------------------------------------------------------------------------
// Metric dispatch (single source of truth for tile color, tables, tooltip)
// ---------------------------------------------------------------------------

// The value a display metric produces for one stock. Returns null when the
// metric cannot be computed — callers render "unavailable", never 0.
export function metricValue(
  stock: HeatmapStock,
  metric: HeatmapColorMetric,
  period: HeatmapPeriod,
  benchmarkReturnPct: number | null
): number | null {
  switch (metric) {
    case "performance":
      return periodReturn(stock.returns, period);
    case "relative":
      return relativeReturn(periodReturn(stock.returns, period), benchmarkReturnPct);
    case "relVolume":
      return stock.relativeVolume;
    case "dist52wHigh":
      return distanceFrom52wHigh(stock.price, stock.high52Week);
    case "distMa20":
      return distanceFromMa(stock.price, stock.ma20);
    case "distMa50":
      return distanceFromMa(stock.price, stock.ma50);
    case "distMa200":
      return distanceFromMa(stock.price, stock.ma200);
  }
}

// Tile sizing weight. Null means "no honest weight" — the layout assigns a
// small epsilon area so the stock stays visible instead of vanishing.
export function tileWeight(stock: HeatmapStock, sizeMetric: HeatmapSizeMetric): number | null {
  switch (sizeMetric) {
    case "equal":
      return 1;
    case "marketCap":
      return stock.marketCap != null && Number.isFinite(stock.marketCap) && stock.marketCap > 0 ? stock.marketCap : null;
    case "dollarVolume": {
      const dv = stock.dollarVolume ?? dollarVolume(stock.price, stock.volume);
      return dv != null && Number.isFinite(dv) && dv > 0 ? dv : null;
    }
  }
}

// ---------------------------------------------------------------------------
// Color scales
// ---------------------------------------------------------------------------

// A diverging scale: a neutral value plus four cutoffs per arm, measured as
// absolute distance from the neutral value. Values inside the first cutoff are
// flat/neutral (the gray band), beyond them the color deepens stepwise.
export interface MetricScale {
  neutralValue: number;
  positive: [number, number, number, number];
  negative: [number, number, number, number];
  // One-sided metrics only ever use one arm (distance from 52-week high can
  // only be <= 0; a data glitch above the high renders neutral, not green).
  oneSided?: "positive" | "negative";
}

// Cutoffs per period for performance/relative returns, chosen so typical
// session moves spread across the scale instead of pinning at the extremes.
export const PERFORMANCE_SCALES: Record<HeatmapPeriod, MetricScale> = {
  "1D": { neutralValue: 0, positive: [0.5, 1, 2, 4], negative: [0.5, 1, 2, 4] },
  "1W": { neutralValue: 0, positive: [1, 2.5, 5, 10], negative: [1, 2.5, 5, 10] },
  "1M": { neutralValue: 0, positive: [2, 5, 10, 20], negative: [2, 5, 10, 20] },
  "3M": { neutralValue: 0, positive: [5, 10, 20, 35], negative: [5, 10, 20, 35] },
  YTD: { neutralValue: 0, positive: [5, 10, 20, 35], negative: [5, 10, 20, 35] },
  "1Y": { neutralValue: 0, positive: [10, 20, 35, 60], negative: [10, 20, 35, 60] },
};

export function scaleForMetric(metric: HeatmapColorMetric, period: HeatmapPeriod): MetricScale {
  switch (metric) {
    case "performance":
    case "relative":
      return PERFORMANCE_SCALES[period];
    case "relVolume":
      // Diverging around 1.0x: up = trading above average volume.
      return { neutralValue: 1, positive: [0.15, 0.5, 1, 2], negative: [0.15, 0.33, 0.5, 0.67] };
    case "dist52wHigh":
      return { neutralValue: 0, positive: [2, 5, 12, 25], negative: [2, 5, 12, 25], oneSided: "negative" };
    case "distMa20":
      return { neutralValue: 0, positive: [1, 2.5, 5, 10], negative: [1, 2.5, 5, 10] };
    case "distMa50":
      return { neutralValue: 0, positive: [2, 5, 10, 20], negative: [2, 5, 10, 20] };
    case "distMa200":
      return { neutralValue: 0, positive: [5, 10, 20, 40], negative: [5, 10, 20, 40] };
  }
}

export type TileBucket = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

// Maps a metric value to a bucket on its scale. Null input stays null (missing
// data is its own visual treatment, never "neutral").
export function colorBucket(value: number | null | undefined, scale: MetricScale): TileBucket | null {
  if (value == null || !Number.isFinite(value)) return null;
  const diff = value - scale.neutralValue;
  if (diff === 0) return 0;
  const side: 1 | -1 = diff > 0 ? 1 : -1;
  if (scale.oneSided && ((scale.oneSided === "positive" && side < 0) || (scale.oneSided === "negative" && side > 0))) {
    return 0;
  }
  const thresholds = side > 0 ? scale.positive : scale.negative;
  const abs = Math.abs(diff);
  if (abs < thresholds[0]) return 0;
  if (abs < thresholds[1]) return (1 * side) as TileBucket;
  if (abs < thresholds[2]) return (2 * side) as TileBucket;
  if (abs < thresholds[3]) return (3 * side) as TileBucket;
  return (4 * side) as TileBucket;
}

// Discrete diverging fills: two hues + a neutral gray midpoint, per the
// diverging-scale rules (equal steps per arm, hue never at the midpoint).
// "classic" follows the app-wide green=up/red=down convention;
// "colorblindSafe" swaps to the warm/cool blue<->orange pair for
// protanopia/deuteranopia. Every fill is unit-tested to carry readable text.
export const TILE_PALETTES: Record<"classic" | "colorblindSafe", Record<TileBucket, string>> = {
  classic: {
    [-4]: "#7f1d1d",
    [-3]: "#b91c1c",
    [-2]: "#dc2626",
    [-1]: "#fca5a5",
    0: "#e9e9f0",
    1: "#bbf7d0",
    2: "#22c55e",
    3: "#15803d",
    4: "#14532d",
  },
  colorblindSafe: {
    [-4]: "#1e3a8a",
    [-3]: "#1d4ed8",
    [-2]: "#2563eb",
    [-1]: "#93c5fd",
    0: "#e9e9f0",
    1: "#fdba74",
    2: "#f97316",
    3: "#c2410c",
    4: "#7c2d12",
  },
};

export function tileFill(bucket: TileBucket | null, palette: "classic" | "colorblindSafe"): string | null {
  if (bucket == null) return null; // missing data — the UI draws a hatched tile
  return TILE_PALETTES[palette][bucket];
}

// ---------------------------------------------------------------------------
// Contrast-checked tile text (computed, not eyeballed)
// ---------------------------------------------------------------------------

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export const TILE_TEXT_INK = "#16161d";
export const TILE_TEXT_WHITE = "#ffffff";

// Picks white or near-black ink for a tile fill, whichever contrasts harder.
// Unit tests assert every palette fill reaches >= 4.5:1 with the chosen color.
export function tileTextColor(fill: string): string {
  return contrastRatio(fill, TILE_TEXT_WHITE) >= contrastRatio(fill, TILE_TEXT_INK) ? TILE_TEXT_WHITE : TILE_TEXT_INK;
}

// Legend labels for the active scale — the extreme (4th) cutoff of each arm,
// matching what the legend swatches actually render.
export function legendThresholds(metric: HeatmapColorMetric, period: HeatmapPeriod): { low: string; high: string } {
  const scale = scaleForMetric(metric, period);
  if (metric === "relVolume") {
    return {
      low: `${Math.round((1 - scale.negative[3]) * 100)}% of avg`,
      high: `${scale.positive[3] + 1}× avg`,
    };
  }
  const fmt = (value: number) => (value < 1 ? `${value}` : `${value}%`);
  return { low: `−${fmt(scale.negative[3])}`, high: `+${fmt(scale.positive[3])}` };
}

// ---------------------------------------------------------------------------
// Sector + market aggregates
// ---------------------------------------------------------------------------

export interface SectorAggregate {
  sector: string;
  count: number;
  withReturn: number;
  capWeightedReturn: number | null;
  equalWeightedReturn: number | null;
  advancers: number;
  decliners: number;
  pctAdvancing: number | null;
  pctAboveMa20: number | null;
  pctAboveMa50: number | null;
  pctAboveMa200: number | null;
  contribution: number | null;
  strongest: { symbol: string; companyName: string; value: number } | null;
  weakest: { symbol: string; companyName: string; value: number } | null;
}

export function totalMarketCap(stocks: HeatmapStock[]): number | null {
  let sum = 0;
  let count = 0;
  for (const stock of stocks) {
    if (stock.marketCap != null && Number.isFinite(stock.marketCap) && stock.marketCap > 0) {
      sum += stock.marketCap;
      count += 1;
    }
  }
  return count > 0 ? sum : null;
}

// Aggregate every sector present in `stocks` for the selected period.
// `globalMarketCap` is the total across the whole universe (not just the
// sector) so sector contributions sum to the index-proxy move.
export function aggregateSectors(
  stocks: HeatmapStock[],
  period: HeatmapPeriod,
  globalMarketCap: number | null,
  sectorsInOrder: string[]
): SectorAggregate[] {
  const bySector = new Map<string, HeatmapStock[]>();
  for (const stock of stocks) {
    const list = bySector.get(stock.sector);
    if (list) list.push(stock);
    else bySector.set(stock.sector, [stock]);
  }

  const aggregates: SectorAggregate[] = [];
  for (const sector of sectorsInOrder) {
    const members = bySector.get(sector);
    if (!members || members.length === 0) continue;
    const returns = members.map((stock) => periodReturn(stock.returns, period));
    const sectorBreadth = breadth(returns);
    const capWeighted = capWeightedMean(
      members.map((stock) => ({ weight: stock.marketCap, value: periodReturn(stock.returns, period) }))
    );
    const strongest = rankBy(members, (stock) => periodReturn(stock.returns, period), { limit: 1 })[0] ?? null;
    const weakest = rankBy(members, (stock) => periodReturn(stock.returns, period), { descending: false, limit: 1 })[0] ?? null;

    const pctAbove = (ma: (stock: HeatmapStock) => number | null): number | null => {
      let above = 0;
      let withData = 0;
      for (const stock of members) {
        const flag = isAboveMa(stock.price, ma(stock));
        if (flag == null) continue;
        withData += 1;
        if (flag) above += 1;
      }
      return withData > 0 ? (above / withData) * 100 : null;
    };

    let contribution: number | null = null;
    if (globalMarketCap != null && globalMarketCap > 0) {
      let sum = 0;
      let any = false;
      for (const stock of members) {
        const c = contributionPct(stock.marketCap, globalMarketCap, periodReturn(stock.returns, period));
        if (c == null) continue;
        sum += c;
        any = true;
      }
      contribution = any ? sum : null;
    }

    aggregates.push({
      sector,
      count: members.length,
      withReturn: sectorBreadth.withData,
      capWeightedReturn: capWeighted,
      equalWeightedReturn: equalWeightedMean(returns),
      advancers: sectorBreadth.advancers,
      decliners: sectorBreadth.decliners,
      pctAdvancing: sectorBreadth.pctAdvancing,
      pctAboveMa20: pctAbove((stock) => stock.ma20),
      pctAboveMa50: pctAbove((stock) => stock.ma50),
      pctAboveMa200: pctAbove((stock) => stock.ma200),
      contribution,
      strongest: strongest ? { symbol: strongest.stock.symbol, companyName: strongest.stock.companyName, value: strongest.value } : null,
      weakest: weakest ? { symbol: weakest.stock.symbol, companyName: weakest.stock.companyName, value: weakest.value } : null,
    });
  }
  return aggregates;
}

export interface MarketSummary {
  unavailableCount: number;
  breadth: Breadth;
  capWeightedReturn: number | null;
  equalWeightedReturn: number | null;
  strongestSector: { sector: string; value: number } | null;
  weakestSector: { sector: string; value: number } | null;
}

// Universe-wide summary strip values for the selected period. Strongest /
// weakest sectors rank by cap-weighted return (ties break A→Z by sector name).
export function marketSummary(stocks: HeatmapStock[], period: HeatmapPeriod): MarketSummary {
  const returns = stocks.map((stock) => periodReturn(stock.returns, period));
  const capWeightedReturn = capWeightedMean(stocks.map((stock) => ({ weight: stock.marketCap, value: periodReturn(stock.returns, period) })));
  const equalWeightedReturn = equalWeightedMean(returns);
  const totalCap = totalMarketCap(stocks);

  const sectorAggregates = aggregateSectors(
    stocks,
    period,
    totalCap,
    [...new Set(stocks.map((stock) => stock.sector))].sort((a, b) => a.localeCompare(b))
  );

  const rankedSectors = sectorAggregates
    .filter((aggregate) => aggregate.capWeightedReturn != null)
    .sort((a, b) => {
      const av = a.capWeightedReturn as number;
      const bv = b.capWeightedReturn as number;
      if (av !== bv) return bv - av;
      return a.sector.localeCompare(b.sector);
    });

  return {
    unavailableCount: stocks.filter(isUnavailable).length,
    breadth: breadth(returns),
    capWeightedReturn,
    equalWeightedReturn,
    strongestSector: rankedSectors.length ? { sector: rankedSectors[0].sector, value: rankedSectors[0].capWeightedReturn as number } : null,
    weakestSector: rankedSectors.length ? { sector: rankedSectors.at(-1)!.sector, value: rankedSectors.at(-1)!.capWeightedReturn as number } : null,
  };
}

// ---------------------------------------------------------------------------
// Data status + session
// ---------------------------------------------------------------------------

const SNAPSHOT_FRESH_MS = 15 * 60 * 1000;
const QUOTE_STALE_MS = 4 * 24 * 60 * 60 * 1000;

// Honest status label for a response. Precedence: stale (old snapshot or old
// quotes) > partial (some constituents failed) > delayed (provider marks the
// majority of quotes delayed) > recent.
export function deriveDataStatus(input: {
  totalStocks: number;
  errorCount: number;
  snapshotAgeMs: number;
  newestQuoteAgeMs: number | null;
  delayedShare: number;
}): HeatmapDataStatus {
  if (input.snapshotAgeMs > SNAPSHOT_FRESH_MS) return "stale";
  if (input.newestQuoteAgeMs != null && input.newestQuoteAgeMs > QUOTE_STALE_MS) return "stale";
  if (input.totalStocks > 0 && input.errorCount > 0) return "partial";
  if (input.delayedShare >= 0.5) return "delayed";
  return "recent";
}

// Approximate US equity session from the wall clock in America/New_York.
// Weekday-only (no holiday calendar) — the UI labels this as approximate.
export function marketSessionAt(now: Date): MarketSessionState {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  if (Number.isNaN(minutes)) return "closed";
  if (minutes >= 240 && minutes < 570) return "pre";
  if (minutes >= 570 && minutes < 960) return "regular";
  if (minutes >= 960 && minutes < 1200) return "post";
  return "closed";
}

export function sessionLabel(session: MarketSessionState): string {
  switch (session) {
    case "pre": return "US pre-market";
    case "regular": return "US market open";
    case "post": return "US post-market";
    case "closed": return "US market closed";
  }
}

// ---------------------------------------------------------------------------
// View state <-> URL query params
// ---------------------------------------------------------------------------

const PERIOD_VALUES: HeatmapPeriod[] = HEATMAP_PERIODS;
const COLOR_METRIC_VALUES: HeatmapColorMetric[] = ["performance", "relative", "relVolume", "dist52wHigh", "distMa20", "distMa50", "distMa200"];
const SIZE_METRIC_VALUES: HeatmapSizeMetric[] = ["marketCap", "equal", "dollarVolume"];
const GROUPING_VALUES: HeatmapGrouping[] = ["sector", "sectorIndustry"];
const MOVERS_VALUES: HeatmapMoversFilter[] = ["all", "gainers", "losers"];
const PALETTE_VALUES: HeatmapPalette[] = ["classic", "colorblindSafe"];
const VIEW_MODE_VALUES: HeatmapViewMode[] = ["map", "list"];

export const DEFAULT_VIEW_STATE: HeatmapViewState = {
  period: "1D",
  colorMetric: "performance",
  sizeMetric: "marketCap",
  grouping: "sector",
  search: "",
  sectorFilter: "",
  movers: "all",
  watchlistOnly: false,
  viewMode: "map",
  palette: "classic",
  zoomSector: "",
  zoomIndustry: "",
};

function pick<T extends string>(allowed: T[], raw: string | null, fallback: T): T {
  return raw != null && (allowed as string[]).includes(raw) ? (raw as T) : fallback;
}

function pickText(raw: string | null, maxLength = 60): string {
  if (raw == null) return "";
  return raw.trim().slice(0, maxLength);
}

// Parses + validates view state from anything with URLSearchParams' `get`
// (URLSearchParams itself, or a small adapter over Next's searchParams object).
// Unknown or invalid values fall back to defaults — a hand-edited or stale
// URL can never put the page in an impossible state.
export function parseHeatmapViewState(get: (key: string) => string | null): HeatmapViewState {
  const state: HeatmapViewState = {
    period: pick(PERIOD_VALUES, get("p"), DEFAULT_VIEW_STATE.period),
    colorMetric: pick(COLOR_METRIC_VALUES, get("c"), DEFAULT_VIEW_STATE.colorMetric),
    sizeMetric: pick(SIZE_METRIC_VALUES, get("s"), DEFAULT_VIEW_STATE.sizeMetric),
    grouping: pick(GROUPING_VALUES, get("g"), DEFAULT_VIEW_STATE.grouping),
    search: pickText(get("q"), 40),
    sectorFilter: pickText(get("sector")),
    movers: pick(MOVERS_VALUES, get("m"), DEFAULT_VIEW_STATE.movers),
    watchlistOnly: get("w") === "1",
    viewMode: pick(VIEW_MODE_VALUES, get("v"), DEFAULT_VIEW_STATE.viewMode),
    palette: pick(PALETTE_VALUES, get("pal"), DEFAULT_VIEW_STATE.palette),
    zoomSector: pickText(get("z"), 40),
    zoomIndustry: pickText(get("zi"), 80),
  };
  return state;
}

// Serializes only the non-default values so shared URLs stay readable.
export function viewStateToQuery(state: HeatmapViewState): string {
  const params = new URLSearchParams();
  if (state.period !== DEFAULT_VIEW_STATE.period) params.set("p", state.period);
  if (state.colorMetric !== DEFAULT_VIEW_STATE.colorMetric) params.set("c", state.colorMetric);
  if (state.sizeMetric !== DEFAULT_VIEW_STATE.sizeMetric) params.set("s", state.sizeMetric);
  if (state.grouping !== DEFAULT_VIEW_STATE.grouping) params.set("g", state.grouping);
  if (state.search !== "") params.set("q", state.search);
  if (state.sectorFilter !== "") params.set("sector", state.sectorFilter);
  if (state.movers !== DEFAULT_VIEW_STATE.movers) params.set("m", state.movers);
  if (state.watchlistOnly) params.set("w", "1");
  if (state.viewMode !== DEFAULT_VIEW_STATE.viewMode) params.set("v", state.viewMode);
  if (state.palette !== DEFAULT_VIEW_STATE.palette) params.set("pal", state.palette);
  if (state.zoomSector !== "") params.set("z", state.zoomSector);
  if (state.zoomIndustry !== "") params.set("zi", state.zoomIndustry);
  return params.toString();
}
