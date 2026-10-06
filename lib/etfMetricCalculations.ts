import type { ETFMetricSnapshot } from "@/lib/etfCatalog";

export interface ETFPriceBar {
  date: string;
  close: number;
  adjustedClose: number;
}

export interface ETFDistribution {
  date: string;
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.2425;
const SOURCE = "Yahoo Finance via yahoo-finance2; app-calculated from daily history";

function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values)!;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function dateMs(date: string): number {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
}

function closestBeforeOrAt(bars: ETFPriceBar[], target: number): ETFPriceBar | null {
  let low = 0;
  let high = bars.length - 1;
  let found: ETFPriceBar | null = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (dateMs(bars[middle].date) <= target) {
      found = bars[middle];
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}

function closestOnOrAfter(bars: ETFPriceBar[], target: number): ETFPriceBar | null {
  return bars.find((bar) => dateMs(bar.date) >= target) ?? null;
}

function statusForHistory(bars: ETFPriceBar[], years: number, asOf: number): string {
  if (bars.length === 0 || asOf - dateMs(bars[0].date) < (years - 0.04) * YEAR_DAYS * DAY_MS) return "Insufficient history";
  return "Available";
}

function periodReturn(bars: ETFPriceBar[], years: number, asOf: number): { changePct: number; elapsedYears: number } | null {
  const end = closestBeforeOrAt(bars, asOf);
  const start = closestOnOrAfter(bars, asOf - years * YEAR_DAYS * DAY_MS);
  if (!start || !end || start.date >= end.date) return null;
  const elapsedYears = (dateMs(end.date) - dateMs(start.date)) / (YEAR_DAYS * DAY_MS);
  if (elapsedYears < years - 0.04) return null;
  const factor = end.adjustedClose / start.adjustedClose;
  return factor > 0 ? { changePct: (factor - 1) * 100, elapsedYears } : null;
}

function cagrForPeriod(bars: ETFPriceBar[], years: number, asOf: number): number | null {
  const period = periodReturn(bars, years, asOf);
  if (!period) return null;
  const start = closestOnOrAfter(bars, asOf - years * YEAR_DAYS * DAY_MS)!;
  const end = closestBeforeOrAt(bars, asOf)!;
  const factor = end.adjustedClose / start.adjustedClose;
  return round((factor ** (1 / period.elapsedYears) - 1) * 100);
}

function annualReturns(bars: ETFPriceBar[], asOf: number): Record<string, number> {
  const firstYear = new Date(bars[0].date).getUTCFullYear();
  const lastYear = new Date(asOf).getUTCFullYear();
  const returns: Record<string, number> = {};
  for (let year = firstYear + 1; year <= lastYear; year += 1) {
    const periodEnd = year === lastYear ? asOf : Date.UTC(year, 11, 31, 23, 59, 59);
    const start = closestBeforeOrAt(bars, Date.UTC(year - 1, 11, 31, 23, 59, 59));
    const end = closestBeforeOrAt(bars, periodEnd);
    if (start && end && end.date > start.date) {
      const label = year === lastYear ? `${year} YTD` : String(year);
      returns[label] = round((end.adjustedClose / start.adjustedClose - 1) * 100);
    }
  }
  return returns;
}

function drawdown(bars: ETFPriceBar[], asOf: number, years: number) {
  const cutoff = asOf - years * YEAR_DAYS * DAY_MS;
  const window = bars.filter((bar) => dateMs(bar.date) >= cutoff);
  let peak = -Infinity;
  let peakDate = "";
  let worst = 0;
  let worstPeakDate = "";
  let worstTroughDate = "";
  for (const bar of window) {
    if (bar.adjustedClose > peak) {
      peak = bar.adjustedClose;
      peakDate = bar.date;
    }
    const decline = bar.adjustedClose / peak - 1;
    if (decline < worst) {
      worst = decline;
      worstPeakDate = peakDate;
      worstTroughDate = bar.date;
    }
  }
  if (!worstPeakDate) return { value: null, recovery: null, recoveryState: "No drawdown in available history" };
  const peakBar = window.find((bar) => bar.date === worstPeakDate)!;
  const recovered = window.find((bar) => bar.date > worstTroughDate && bar.adjustedClose >= peakBar.adjustedClose);
  if (!recovered) return { value: round(worst * 100), recovery: null, recoveryState: "Not yet recovered" };
  const marketDays = window.filter((bar) => bar.date >= worstPeakDate && bar.date <= recovered.date).length - 1;
  return { value: round(worst * 100), recovery: marketDays, recoveryState: "Available" };
}

function monthlyReturns(bars: ETFPriceBar[], asOf: number, years: number): number[] {
  const cutoff = asOf - years * YEAR_DAYS * DAY_MS;
  const lastByMonth = new Map<string, ETFPriceBar>();
  for (const bar of bars) {
    if (dateMs(bar.date) < cutoff) continue;
    lastByMonth.set(bar.date.slice(0, 7), bar);
  }
  const closes = [...lastByMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
  return closes.slice(1).flatMap((bar, index) => {
    const prior = closes[index];
    const value = bar.adjustedClose / prior.adjustedClose - 1;
    return Number.isFinite(value) ? [value] : [];
  });
}

function hasAtLeastYears(bars: ETFPriceBar[], years: number, asOf: number): boolean {
  return bars.length > 0 && asOf - dateMs(bars[0].date) >= (years - 0.04) * YEAR_DAYS * DAY_MS;
}

export function calculateETFMetrics(input: {
  ticker: string;
  bars: ETFPriceBar[];
  distributions: ETFDistribution[];
  distributionEventsAvailable: boolean;
  currency: string | null;
  observedAt: string;
  metadata?: {
    expenseRatio?: number | null;
    expenseRatioType?: string | null;
    netAssets?: number | null;
    inceptionDate?: string | null;
  };
  holdings?: Array<{ symbol: string; weightPct: number }>;
}): ETFMetricSnapshot {
  const bars = [...input.bars].sort((a, b) => a.date.localeCompare(b.date));
  const distributions = [...input.distributions].sort((a, b) => a.date.localeCompare(b.date));
  const values: ETFMetricSnapshot["values"] = {};
  const states: ETFMetricSnapshot["states"] = {};
  const now = dateMs(input.observedAt);
  const latest = bars.at(-1);

  const setHistory = (key: "totalReturn1Y" | "cagr3Y" | "cagr5Y" | "cagr10Y", years: number) => {
    const period = periodReturn(bars, years, now);
    const value = key === "totalReturn1Y" ? (period == null ? null : round(period.changePct)) : cagrForPeriod(bars, years, now);
    values[key] = value ?? "";
    states[key] = value == null ? statusForHistory(bars, years, now) : "Available";
    if (value == null) delete values[key];
  };
  setHistory("totalReturn1Y", 1);
  setHistory("cagr3Y", 3);
  setHistory("cagr5Y", 5);
  setHistory("cagr10Y", 10);

  const years = annualReturns(bars, now);
  if (Object.keys(years).length) values.calendarYearReturns = Object.entries(years).map(([year, value]) => `${year}: ${value.toFixed(2)}%`).join(" · ");
  states.calendarYearReturns = Object.keys(years).length ? "Available" : "Insufficient history";

  if (!input.distributionEventsAvailable) {
    states.trailingDistributionYield = "Distribution history unavailable from provider";
    states.averageCashYield5Y = "Distribution history unavailable from provider";
  } else if (!latest) {
    states.trailingDistributionYield = "Price history unavailable";
    states.averageCashYield5Y = "Price history unavailable";
  } else {
    const trailingCutoff = now - YEAR_DAYS * DAY_MS;
    const ttmCash = distributions.filter((event) => dateMs(event.date) > trailingCutoff && dateMs(event.date) <= now).reduce((sum, event) => sum + event.amount, 0);
    values.trailingDistributionYield = round((ttmCash / latest.close) * 100);
    states.trailingDistributionYield = ttmCash === 0 ? "No distributions reported in the trailing year" : "Available";

    if (!hasAtLeastYears(bars, 5, now)) states.averageCashYield5Y = "Insufficient history";
    else {
      const currentYear = new Date(now).getUTCFullYear();
      const annualYields: number[] = [];
      for (let year = currentYear - 5; year < currentYear; year += 1) {
        const yearStart = Date.UTC(year, 0, 1);
        const start = closestOnOrAfter(bars, yearStart);
        const end = closestBeforeOrAt(bars, Date.UTC(year, 11, 31, 23, 59, 59));
        if (!start || !end || new Date(start.date).getUTCFullYear() !== year || dateMs(start.date) - yearStart > 14 * DAY_MS || new Date(end.date).getUTCFullYear() !== year) continue;
        const cash = distributions.filter((event) => new Date(`${event.date}T00:00:00Z`).getUTCFullYear() === year).reduce((sum, event) => sum + event.amount, 0);
        annualYields.push(cash / start.close * 100);
      }
      if (annualYields.length === 5) {
        values.averageCashYield5Y = round(mean(annualYields)!);
        states.averageCashYield5Y = "Available";
      } else states.averageCashYield5Y = "Insufficient complete calendar years";
    }
  }

  if (!hasAtLeastYears(bars, 5, now)) {
    states.maxDrawdown5Y = "Insufficient history";
    states.volatility5Y = "Insufficient history";
    states.recoveryTime = "Insufficient history";
  } else {
    const risk = drawdown(bars, now, 5);
    if (risk.value != null) values.maxDrawdown5Y = risk.value;
    states.maxDrawdown5Y = risk.value == null ? risk.recoveryState : "Available";
    if (risk.recovery != null) values.recoveryTime = risk.recovery;
    states.recoveryTime = risk.recoveryState;
    const volatility = standardDeviation(monthlyReturns(bars, now, 5));
    if (volatility != null) values.volatility5Y = round(volatility * Math.sqrt(12) * 100);
    states.volatility5Y = volatility == null ? "Insufficient monthly observations" : "Available";
  }

  const held = [...(input.holdings ?? [])].filter((holding) => holding.symbol && Number.isFinite(holding.weightPct) && holding.weightPct > 0);
  if (held.length > 0) {
    values.topTenWeight = round(held.slice(0, 10).reduce((sum, holding) => sum + holding.weightPct, 0));
    states.topTenWeight = "Available";
  } else states.topTenWeight = "Holdings unavailable from provider";
  states.overlap = "Calculated for two or more funds in Compare";

  if (input.metadata?.expenseRatio != null && Number.isFinite(input.metadata.expenseRatio)) {
    values.expenseRatio = round(input.metadata.expenseRatio * 100, 4);
    states.expenseRatio = `Available (${input.metadata.expenseRatioType ?? "provider expense ratio"})`;
  } else states.expenseRatio = "Expense ratio unavailable from provider";
  if (input.metadata?.netAssets != null && Number.isFinite(input.metadata.netAssets)) {
    values.netAssets = input.metadata.netAssets;
    states.netAssets = "Available";
  } else states.netAssets = "Net assets unavailable from provider";
  if (input.metadata?.inceptionDate) {
    values.inceptionDate = input.metadata.inceptionDate;
    states.inceptionDate = "Available";
  } else states.inceptionDate = "Inception date unavailable from provider";

  return {
    ticker: input.ticker,
    values,
    states,
    holdings: held,
    source: SOURCE,
    currency: input.currency,
    observedAt: input.observedAt,
    lastAttemptAt: input.observedAt,
    lastError: null,
  };
}

export function weightedHoldingsOverlap(
  left: Array<{ symbol: string; weightPct: number }>,
  right: Array<{ symbol: string; weightPct: number }>,
): number | null {
  if (!left.length || !right.length) return null;
  const rightWeights = new Map(right.map((holding) => [holding.symbol.toUpperCase(), holding.weightPct]));
  const overlap = left.reduce((sum, holding) => {
    const other = rightWeights.get(holding.symbol.toUpperCase()) ?? 0;
    return sum + Math.min(holding.weightPct, other);
  }, 0);
  return round(overlap);
}
