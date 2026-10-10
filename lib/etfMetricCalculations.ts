import type { ETFMetricResult, ETFMetricSnapshot, ETFMetricStatus, ETFMetricUnit } from "./etfCatalog";

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
const SOURCE_ID = "yahoo-finance2.chart";
const CALCULATION_VERSION = "etf-quantitative-v1";
const METHODOLOGY_ID = "usd-adjusted-market-price-monthly-v1";

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

function sinceInceptionReturn(bars: ETFPriceBar[], asOf: number): ETFMetricSnapshot["sinceInceptionReturn"] {
  const start = bars[0];
  const end = closestBeforeOrAt(bars, asOf);
  if (!start || !end || start.date >= end.date) return undefined;

  const periodYears = (dateMs(end.date) - dateMs(start.date)) / (YEAR_DAYS * DAY_MS);
  const factor = end.adjustedClose / start.adjustedClose;
  if (periodYears <= 0 || factor <= 0) return undefined;

  const annualized = periodYears >= 0.999;
  return {
    value: round((factor ** (annualized ? 1 / periodYears : 1) - 1) * 100),
    periodYears: round(periodYears, 3),
    startDate: start.date,
    endDate: end.date,
    annualized,
  };
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

function hasAtLeastYears(bars: ETFPriceBar[], years: number, asOf: number): boolean {
  return bars.length > 0 && asOf - dateMs(bars[0].date) >= (years - 0.04) * YEAR_DAYS * DAY_MS;
}

interface MonthlyLevel {
  month: string;
  date: string;
  adjustedClose: number;
}

function monthEndLevels(bars: ETFPriceBar[]): MonthlyLevel[] {
  const levels = new Map<string, MonthlyLevel>();
  const currentMonth = new Date().toISOString().slice(0, 7);
  for (const bar of bars) {
    if (!Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0) continue;
    const month = bar.date.slice(0, 7);
    if (month >= currentMonth) continue;
    const previous = levels.get(month);
    if (!previous || bar.date > previous.date) levels.set(month, { month, date: bar.date, adjustedClose: bar.adjustedClose });
  }
  return [...levels.values()].sort((left, right) => left.month.localeCompare(right.month));
}

function hasConsecutiveMonths(levels: MonthlyLevel[]): boolean {
  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];
    const expected = new Date(Date.UTC(Number(previous.month.slice(0, 4)), Number(previous.month.slice(5, 7)), 1)).toISOString().slice(0, 7);
    if (current.month !== expected) return false;
  }
  return true;
}

function monthlyWindow(levels: MonthlyLevel[], years: number): MonthlyLevel[] | null {
  const count = years * 12 + 1;
  if (levels.length < count) return null;
  const window = levels.slice(-count);
  return hasConsecutiveMonths(window) ? window : null;
}

function windowCagr(levels: MonthlyLevel[]): number | null {
  if (levels.length < 2) return null;
  const start = levels[0];
  const end = levels.at(-1)!;
  const elapsedYears = (dateMs(end.date) - dateMs(start.date)) / (YEAR_DAYS * DAY_MS);
  const factor = end.adjustedClose / start.adjustedClose;
  if (elapsedYears <= 0 || factor <= 0) return null;
  return (factor ** (1 / elapsedYears) - 1) * 100;
}

function returnsFromLevels(levels: MonthlyLevel[]): number[] {
  return levels.slice(1).map((level, index) => level.adjustedClose / levels[index].adjustedClose - 1);
}

export function dailyDrawdownForWindow(bars: ETFPriceBar[], startDate: string, endDate: string) {
  const window = bars.filter((bar) => bar.date >= startDate && bar.date <= endDate && Number.isFinite(bar.adjustedClose) && bar.adjustedClose > 0);
  if (window.length < 2) return { value: null, recovery: null, recoveryState: "Insufficient daily observations", peakDate: null, troughDate: null, recoveryDate: null, underwaterDays: null, elapsedUnderwaterTradingDays: null };

  let peak = window[0].adjustedClose;
  let peakDate = window[0].date;
  let worst = 0;
  let worstPeakDate: string | null = null;
  let worstTroughDate: string | null = null;
  let underwater = 0;
  for (const bar of window) {
    if (bar.adjustedClose > peak) {
      peak = bar.adjustedClose;
      peakDate = bar.date;
    }
    const decline = bar.adjustedClose / peak - 1;
    if (decline < 0) underwater += 1;
    if (decline < worst) {
      worst = decline;
      worstPeakDate = peakDate;
      worstTroughDate = bar.date;
    }
  }
  if (!worstTroughDate || !worstPeakDate) {
    return { value: 0, recovery: null, recoveryState: "No drawdown in window", peakDate: null, troughDate: null, recoveryDate: null, underwaterDays: underwater, elapsedUnderwaterTradingDays: null };
  }
  const peakBar = window.find((bar) => bar.date === worstPeakDate)!;
  const recovered = window.find((bar) => bar.date > worstTroughDate! && bar.adjustedClose >= peakBar.adjustedClose);
  const recovery = recovered ? window.filter((bar) => bar.date >= worstPeakDate! && bar.date <= recovered.date).length - 1 : null;
  const elapsedUnderwaterTradingDays = window.filter((bar) => bar.date >= worstPeakDate! && bar.date <= (recovered?.date ?? endDate)).length - 1;
  return {
    value: worst * 100,
    recovery,
    recoveryState: recovered ? "Available" : "Not yet recovered",
    peakDate: worstPeakDate,
    troughDate: worstTroughDate,
    recoveryDate: recovered?.date ?? null,
    underwaterDays: underwater,
    elapsedUnderwaterTradingDays,
  };
}

function quantile(values: number[], probability: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
}

function rollingFiveYearWindows(levels: MonthlyLevel[]) {
  const now = new Date();
  const firstEvaluationMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 180, 1));
  const evaluationStart = firstEvaluationMonth.toISOString().slice(0, 7);
  const windows: Array<{ startDate: string; endDate: string; cagr: number }> = [];
  for (let endIndex = 60; endIndex < levels.length; endIndex += 1) {
    const window = levels.slice(endIndex - 60, endIndex + 1);
    if (window[0].month < evaluationStart || !hasConsecutiveMonths(window)) continue;
    const cagr = windowCagr(window);
    if (cagr != null && Number.isFinite(cagr)) windows.push({ startDate: window[0].date, endDate: window.at(-1)!.date, cagr });
  }
  return windows;
}

function metricResult(input: {
  value: number | null;
  unit: ETFMetricUnit;
  status: ETFMetricStatus;
  reason?: string;
  startDate?: string | null;
  endDate?: string | null;
  observations?: number;
  methodologyId?: string;
  sourceIds?: string[];
  benchmarkId?: string;
  riskFreeSeriesId?: string;
}): ETFMetricResult {
  return {
    value: input.value,
    unit: input.unit,
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    observations: input.observations ?? 0,
    sourceIds: input.sourceIds ?? (input.status === "unavailable" || input.status === "notApplicable" ? [] : [SOURCE_ID]),
    ...(input.benchmarkId ? { benchmarkId: input.benchmarkId } : {}),
    ...(input.riskFreeSeriesId ? { riskFreeSeriesId: input.riskFreeSeriesId } : {}),
    methodologyId: input.methodologyId ?? METHODOLOGY_ID,
  };
}

export function calculateETFMetrics(input: {
  ticker: string;
  bars: ETFPriceBar[];
  distributions: ETFDistribution[];
  distributionEventsAvailable: boolean;
  currency: string | null;
  observedAt: string;
  retrievedAt?: string;
  runId?: string;
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
  const metricResults: NonNullable<ETFMetricSnapshot["metricResults"]> = {};
  const now = dateMs(input.observedAt);
  const latest = bars.at(-1);
  let drawdownDetails: ETFMetricSnapshot["drawdownDetails"];
  let trailingDistributionYieldRaw: number | null = null;
  let averageCashYield5YRaw: number | null = null;
  const sinceInception = sinceInceptionReturn(bars, now);
  const completedMonths = monthEndLevels(bars);
  const monthWindows = new Map<number, MonthlyLevel[] | null>([3, 5, 10].map((years) => [years, monthlyWindow(completedMonths, years)]));

  const setHistory = (key: "totalReturn1Y" | "cagr3Y" | "cagr5Y" | "cagr10Y", years: number) => {
    const window = years === 1 ? monthlyWindow(completedMonths, 1) : monthWindows.get(years);
    const rawValue = !window ? null : years === 1
      ? (window.at(-1)!.adjustedClose / window[0].adjustedClose - 1) * 100
      : windowCagr(window);
    const value = rawValue == null ? null : round(rawValue);
    if (value != null) values[key] = value;
    states[key] = value == null ? `Insufficient ${years}Y complete monthly history` : "Available";
    const unit: ETFMetricUnit = key === "totalReturn1Y" ? "percent" : "percent";
    metricResults[key] = metricResult({
      value: rawValue,
      unit,
      status: value == null ? "insufficientHistory" : "available",
      reason: value == null ? `Requires ${years * 12} consecutive complete monthly returns and the prior month-end level.` : undefined,
      startDate: window?.[0].date,
      endDate: window?.at(-1)?.date,
      observations: window ? window.length - 1 : 0,
    });
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
    trailingDistributionYieldRaw = (ttmCash / latest.close) * 100;
    values.trailingDistributionYield = round(trailingDistributionYieldRaw);
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
        averageCashYield5YRaw = mean(annualYields)!;
        values.averageCashYield5Y = round(averageCashYield5YRaw);
        states.averageCashYield5Y = "Available";
      } else states.averageCashYield5Y = "Insufficient complete calendar years";
    }
  }

  const fiveYear = monthWindows.get(5);
  if (!fiveYear) {
    states.maxDrawdown5Y = "Insufficient 5Y complete monthly history";
    states.volatility5Y = "Insufficient 5Y complete monthly history";
    states.recoveryTime = "Insufficient 5Y complete monthly history";
    metricResults.maxDrawdown5Y = metricResult({ value: null, unit: "percent", status: "insufficientHistory", reason: "Requires 60 consecutive complete monthly returns and the prior month-end level." });
    metricResults.volatility5Y = metricResult({ value: null, unit: "percent", status: "insufficientHistory", reason: "Requires 60 complete monthly returns." });
    metricResults.recoveryTime = metricResult({ value: null, unit: "tradingDays", status: "insufficientHistory", reason: "Requires a complete five-year observation window." });
  } else {
    const risk = dailyDrawdownForWindow(bars, fiveYear[0].date, fiveYear.at(-1)!.date);
    if (risk.value != null) values.maxDrawdown5Y = round(risk.value);
    states.maxDrawdown5Y = risk.value == null ? risk.recoveryState : risk.recoveryState === "No drawdown in window" ? "No drawdown in window" : "Available";
    if (risk.recovery != null) values.recoveryTime = risk.recovery;
    states.recoveryTime = risk.recoveryState;
    const monthly = returnsFromLevels(fiveYear);
    const volatility = standardDeviation(monthly);
    if (volatility != null) values.volatility5Y = round(volatility * Math.sqrt(12) * 100);
    states.volatility5Y = volatility == null ? "Insufficient monthly observations" : "Available";
    metricResults.maxDrawdown5Y = metricResult({
      value: risk.value,
      unit: "percent",
      status: risk.value == null ? "insufficientHistory" : "available",
      reason: risk.value == null ? risk.recoveryState : undefined,
      startDate: fiveYear[0].date,
      endDate: fiveYear.at(-1)!.date,
      observations: bars.filter((bar) => bar.date >= fiveYear[0].date && bar.date <= fiveYear.at(-1)!.date).length,
    });
    metricResults.volatility5Y = metricResult({
      value: volatility == null ? null : volatility * Math.sqrt(12) * 100,
      unit: "percent",
      status: volatility == null ? "insufficientHistory" : "available",
      reason: volatility == null ? "At least two valid monthly returns are required." : undefined,
      startDate: fiveYear[0].date,
      endDate: fiveYear.at(-1)!.date,
      observations: monthly.length,
    });
    metricResults.recoveryTime = metricResult({
      value: risk.recovery,
      unit: "tradingDays",
      status: risk.recovery != null ? "available" : risk.recoveryState === "Not yet recovered" ? "unrecovered" : risk.recoveryState === "No drawdown in window" ? "notApplicable" : "unavailable",
      reason: risk.recoveryState === "Not yet recovered" ? "The maximum drawdown peak has not been regained by the observation end date." : risk.recoveryState === "No drawdown in window" ? "No drawdown occurred in this window." : undefined,
      startDate: risk.peakDate ?? fiveYear[0].date,
      endDate: risk.recoveryDate ?? risk.troughDate ?? fiveYear.at(-1)!.date,
      observations: risk.recovery ?? risk.elapsedUnderwaterTradingDays ?? 0,
    });

    const cagr = windowCagr(fiveYear);
    const calmar = risk.value == null || risk.value === 0 || cagr == null ? null : cagr / Math.abs(risk.value);
    if (calmar != null) values.calmar5Y = round(calmar, 4);
    states.calmar5Y = risk.value == null ? "Unavailable · daily drawdown could not be calculated" : risk.value === 0 ? "Undefined · no drawdown in window" : calmar == null ? "Unavailable · CAGR is missing" : "Available";
    metricResults.calmar5Y = metricResult({
      value: calmar,
      unit: "ratio",
      status: calmar != null ? "available" : risk.value == null ? "unavailable" : "undefined",
      reason: risk.value === 0 ? "Calmar is undefined when maximum drawdown is zero." : calmar == null ? "A complete five-year CAGR and daily maximum drawdown are required." : undefined,
      startDate: fiveYear[0].date,
      endDate: fiveYear.at(-1)!.date,
      observations: monthly.length,
    });
    const underwaterRate = risk.underwaterDays == null ? null : risk.underwaterDays / Math.max(1, bars.filter((bar) => bar.date >= fiveYear[0].date && bar.date <= fiveYear.at(-1)!.date).length) * 100;
    if (underwaterRate != null) values.underwaterObservationRate = round(underwaterRate);
    states.underwaterObservationRate = underwaterRate == null ? "Unavailable · daily history is incomplete" : "Available";
    drawdownDetails = { peakDate: risk.peakDate, troughDate: risk.troughDate, recoveryDate: risk.recoveryDate, underwaterObservationRate: underwaterRate, elapsedUnderwaterTradingDays: risk.elapsedUnderwaterTradingDays };
    metricResults.underwaterObservationRate = metricResult({
      value: underwaterRate,
      unit: "percent",
      status: underwaterRate == null ? "unavailable" : "available",
      reason: underwaterRate == null ? "No daily observation count is available." : undefined,
      startDate: fiveYear[0].date,
      endDate: fiveYear.at(-1)!.date,
      observations: bars.filter((bar) => bar.date >= fiveYear[0].date && bar.date <= fiveYear.at(-1)!.date).length,
    });
  }

  const sharpeUnavailable = "Matched monthly risk-free holding returns have not been sourced.";
  for (const key of ["sharpe5Y", "sortino5Y"] as const) {
    states[key] = `Unavailable · ${sharpeUnavailable}`;
    metricResults[key] = metricResult({ value: null, unit: "ratio", status: "unavailable", reason: sharpeUnavailable, startDate: fiveYear?.[0].date, endDate: fiveYear?.at(-1)?.date, observations: fiveYear ? fiveYear.length - 1 : 0, sourceIds: fiveYear ? [SOURCE_ID] : [] });
  }

  const rolling = rollingFiveYearWindows(completedMonths);
  const rollingKeys = ["rolling5YMedianCagr", "rolling5YP10Cagr", "rolling5YWorstCagr", "rolling5YBestCagr", "rolling5YPositiveRate"] as const;
  const rollingSummary = rolling.length >= 12 ? {
    rolling5YMedianCagr: quantile(rolling.map((window) => window.cagr), 0.5),
    rolling5YP10Cagr: quantile(rolling.map((window) => window.cagr), 0.1),
    rolling5YWorstCagr: Math.min(...rolling.map((window) => window.cagr)),
    rolling5YBestCagr: Math.max(...rolling.map((window) => window.cagr)),
    rolling5YPositiveRate: rolling.filter((window) => window.cagr > 0).length / rolling.length * 100,
  } : null;
  for (const key of rollingKeys) {
    const summaryValue = rollingSummary?.[key] ?? null;
    if (summaryValue != null) values[key] = round(summaryValue);
    const reason = rolling.length < 12 ? `Only ${rolling.length} valid five-year windows are available; at least 12 are required.` : undefined;
    states[key] = summaryValue == null ? `Insufficient rolling history · ${reason}` : `Available · ${rolling.length} overlapping windows`;
    metricResults[key] = metricResult({
      value: summaryValue,
      unit: key === "rolling5YPositiveRate" ? "percent" : "percent",
      status: summaryValue == null ? "insufficientHistory" : "available",
      reason,
      startDate: rolling[0]?.endDate,
      endDate: rolling.at(-1)?.endDate,
      observations: rolling.length,
    });
  }

  const blockedMetrics: Array<{ key: "rolling5YBenchmarkWinRate" | "benchmarkExcessCagr5Y" | "trackingDifference5Y" | "trackingError5Y" | "medianSpread30D" | "premiumDiscount" | "effectiveHoldingsCount" | "largestHoldingWeight" | "largestSectorWeight" | "overallScore" | "fundQualityScore" | "historicalPerformanceScore" | "scoreCoverage"; unit: ETFMetricUnit; reason: string }> = [
    { key: "rolling5YBenchmarkWinRate", unit: "percent", reason: "No verified comparison reference is configured." },
    { key: "benchmarkExcessCagr5Y", unit: "percentagePoints", reason: "Select a comparison reference with stored history; no default benchmark is assigned." },
    { key: "trackingDifference5Y", unit: "percentagePoints", reason: "Verified ETF NAV total returns and official benchmark total returns are unavailable." },
    { key: "trackingError5Y", unit: "percent", reason: "Verified ETF NAV total returns and official benchmark total returns are unavailable." },
    { key: "medianSpread30D", unit: "basisPoints", reason: "A historical issuer-reported or licensed 30-day median spread feed is unavailable." },
    { key: "premiumDiscount", unit: "percent", reason: "Matched dated market-price and NAV observations are unavailable." },
    { key: "effectiveHoldingsCount", unit: "count", reason: "The provider returns partial top holdings, not a verified complete portfolio." },
    { key: "largestHoldingWeight", unit: "percent", reason: "A verified complete and dated holdings file is unavailable." },
    { key: "largestSectorWeight", unit: "percent", reason: "A complete dated holdings file and common sector taxonomy are unavailable." },
    { key: "overallScore", unit: "score", reason: "Verified peer groups and all weighted, fresh inputs are not ready." },
    { key: "fundQualityScore", unit: "score", reason: "Verified peer groups and complete cost, implementation, and holdings inputs are not ready." },
    { key: "historicalPerformanceScore", unit: "score", reason: "A verified eligible peer cohort and matched risk-free history are not ready." },
    { key: "scoreCoverage", unit: "percent", reason: "The scoring input set and verified cohort are not ready." },
  ];
  for (const blocked of blockedMetrics) {
    states[blocked.key] = `Unavailable · ${blocked.reason}`;
    metricResults[blocked.key] = metricResult({ value: null, unit: blocked.unit, status: "unavailable", reason: blocked.reason });
  }

  const held = [...(input.holdings ?? [])]
    .filter((holding) => holding.symbol && Number.isFinite(holding.weightPct) && holding.weightPct > 0)
    .sort((left, right) => right.weightPct - left.weightPct);
  if (held.length > 0) {
    const topTenWeightRaw = held.slice(0, 10).reduce((sum, holding) => sum + holding.weightPct, 0);
    values.topTenWeight = round(topTenWeightRaw);
    states.topTenWeight = "Available · provider top holdings only; full portfolio coverage not confirmed";
    metricResults.topTenWeight = metricResult({ value: topTenWeightRaw, unit: "percent", status: "available", reason: "Partial provider top-holdings coverage; this is not a complete-portfolio concentration measure.", observations: Math.min(10, held.length), methodologyId: "provider-top-holdings-subset-v1", sourceIds: ["yahoo-finance2.quoteSummary"] });
  } else states.topTenWeight = "Holdings unavailable from provider";
  states.overlap = "Calculated for two or more funds in Compare";

  if (input.metadata?.expenseRatio != null && Number.isFinite(input.metadata.expenseRatio)) {
    const expenseRatioRaw = input.metadata.expenseRatio * 100;
    values.expenseRatio = round(expenseRatioRaw, 4);
    states.expenseRatio = `Available (${input.metadata.expenseRatioType ?? "provider expense ratio"})`;
    metricResults.expenseRatio = metricResult({ value: expenseRatioRaw, unit: "percent", status: "available", reason: "Provider-reported; not yet issuer-verified.", observations: 1, methodologyId: "provider-reported-metadata-v1", sourceIds: ["yahoo-finance2.quoteSummary"] });
  } else states.expenseRatio = "Expense ratio unavailable from provider";
  if (input.metadata?.netAssets != null && Number.isFinite(input.metadata.netAssets)) {
    values.netAssets = input.metadata.netAssets;
    states.netAssets = "Available";
  } else states.netAssets = "Net assets unavailable from provider";
  if (input.metadata?.inceptionDate) {
    values.inceptionDate = input.metadata.inceptionDate;
    states.inceptionDate = "Available";
  } else states.inceptionDate = "Inception date unavailable from provider";

  if (typeof trailingDistributionYieldRaw === "number") {
    const trailingCutoff = new Date(now - YEAR_DAYS * DAY_MS).toISOString().slice(0, 10);
    metricResults.trailingDistributionYield = metricResult({
      value: trailingDistributionYieldRaw,
      unit: "percent",
      status: "available",
      startDate: trailingCutoff,
      endDate: latest?.date,
      observations: distributions.filter((event) => dateMs(event.date) > now - YEAR_DAYS * DAY_MS && dateMs(event.date) <= now).length,
    });
  }
  if (typeof averageCashYield5YRaw === "number") {
    const endYear = new Date(now).getUTCFullYear() - 1;
    metricResults.averageCashYield5Y = metricResult({
      value: averageCashYield5YRaw,
      unit: "percent",
      status: "available",
      startDate: `${endYear - 4}-01-01`,
      endDate: `${endYear}-12-31`,
      observations: 5,
    });
  }

  const metricUnits: Partial<Record<keyof ETFMetricSnapshot["values"], ETFMetricUnit>> = {
    totalReturn1Y: "percent", cagr3Y: "percent", cagr5Y: "percent", cagr10Y: "percent",
    trailingDistributionYield: "percent", averageCashYield5Y: "percent", maxDrawdown5Y: "percent",
    volatility5Y: "percent", recoveryTime: "tradingDays", topTenWeight: "percent", overlap: "percent",
    expenseRatio: "percent", netAssets: "currency",
  };
  for (const [rawKey, unit] of Object.entries(metricUnits)) {
    const key = rawKey as keyof ETFMetricSnapshot["values"];
    if (metricResults[key as keyof typeof metricResults]) continue;
    const rawValue = values[key];
    const state = states[key as keyof typeof states] ?? "Unavailable";
    const lowerState = state.toLowerCase();
    const numeric = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null;
    const status: ETFMetricStatus = numeric != null
      ? "available"
      : lowerState.includes("insufficient") ? "insufficientHistory"
        : lowerState.includes("not yet recovered") ? "unrecovered"
          : lowerState.includes("not applicable") || lowerState.includes("no drawdown") ? "notApplicable" : "unavailable";
    metricResults[key as keyof typeof metricResults] = metricResult({
      value: numeric,
      unit,
      status,
      reason: numeric == null ? state : undefined,
      startDate: key === "cagr5Y" || key === "maxDrawdown5Y" || key === "volatility5Y" ? fiveYear?.[0].date : null,
      endDate: key === "cagr5Y" || key === "maxDrawdown5Y" || key === "volatility5Y" ? fiveYear?.at(-1)?.date : latest?.date,
      observations: key === "cagr5Y" || key === "maxDrawdown5Y" || key === "volatility5Y" ? (fiveYear?.length ?? 0) - (fiveYear ? 1 : 0) : 0,
      methodologyId: key === "expenseRatio" || key === "netAssets" || key === "inceptionDate" ? "provider-reported-metadata-v1" : METHODOLOGY_ID,
      sourceIds: key === "expenseRatio" || key === "netAssets" || key === "inceptionDate" ? ["yahoo-finance2.quoteSummary"] : [SOURCE_ID],
    });
  }

  return {
    ticker: input.ticker,
    values,
    states,
    metricResults,
    schemaVersion: 2,
    calculationVersion: CALCULATION_VERSION,
    runId: input.runId ?? input.observedAt,
    historyStartDate: bars[0]?.date ?? null,
    historyEndDate: bars.at(-1)?.date ?? null,
    historyObservations: bars.length,
    officialBenchmarkId: null,
    comparisonBenchmarkId: null,
    metadataProvenance: {
      sourceId: "yahoo-finance2.quoteSummary",
      status: "fetchedUnverified",
      retrievedAt: input.retrievedAt ?? input.observedAt,
      expenseRatioLabel: input.metadata?.expenseRatioType ?? null,
      holdingsCoverage: held.length ? "partialTopHoldings" : "unavailable",
    },
    ...(drawdownDetails ? { drawdownDetails } : {}),
    ...(sinceInception ? { sinceInceptionReturn: sinceInception } : {}),
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
