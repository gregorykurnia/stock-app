import { buildTickerAnnualReturns, type TickerHistory } from "./performanceReturns";
import type { PortfolioBucket } from "./portfolioBuckets";

export const SIMULATION_START_YEAR = 2026;
export const SIMULATION_END_YEAR = 2036;
export const SIMULATION_MONTHLY_DCA_IDR = 13_000_000;
export const SIMULATION_STOCK_SHRINKAGE = 0.6;
export const SIMULATION_STOCK_TOTAL_RETURN_FLOOR_PCT = -20;
export const SIMULATION_STOCK_TOTAL_RETURN_CAP_PCT = 25;
export const SIMULATION_FX_CASES_PCT = [0, 3, 5] as const;
export const SIMULATION_WITHHOLDING_CASES_PCT = [0, 15, 30] as const;

export interface SimulationUniverseTicker {
  ticker: string;
  name: string | null;
  bucket: PortfolioBucket | "other";
}

export interface SimulationForecast {
  ticker: string;
  name: string | null;
  bucket: PortfolioBucket | "other";
  forecastPriceReturnPct: number | null;
  forecastDividendYieldPct: number | null;
  rawPriceEstimatePct: number | null;
  longWindowPriceCagrPct: number | null;
  recentPriceCagrPct: number | null;
  trimmedMeanPriceReturnPct: number | null;
  benchmarkTotalReturnPct: number | null;
  rawTotalReturnPct: number | null;
  forecastTotalReturnPct: number | null;
  observations: number;
  longWindowYears: number;
  recentWindowYears: number;
  dividendObservations: number;
  confidence: "high" | "medium" | "low" | "unavailable";
  shrunkTowardVoo: boolean;
  capped: boolean;
  dividendFallbackUsed: boolean;
  status: string;
}

export type SimulationForecastFallbacks = Readonly<Record<string, number | null | undefined>>;

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function priceCagr(rows: readonly { priceReturnPct: number | null }[]): number | null {
  if (rows.length === 0 || rows.some((row) => row.priceReturnPct == null || row.priceReturnPct < -100)) return null;
  const growth = rows.reduce((value, row) => value * (1 + (row.priceReturnPct as number) / 100), 1);
  return growth === 0 ? -100 : (growth ** (1 / rows.length) - 1) * 100;
}

function completePriceRows(history: TickerHistory, lastCompleteYear: number) {
  const firstYear = lastCompleteYear - 9;
  const annual = buildTickerAnnualReturns(history, firstYear, lastCompleteYear, `${lastCompleteYear}-12-31`);
  const byYear = new Map(annual.map((row) => [row.year, row]));
  const trailing = [];
  for (let year = lastCompleteYear; year >= firstYear; year -= 1) {
    const row = byYear.get(year);
    if (!row || row.priceReturnPct == null || row.startClose == null || row.endClose == null) break;
    trailing.unshift(row);
  }
  return { annual, trailing };
}

function estimateDividendYield(
  history: TickerHistory,
  annualRows: ReturnType<typeof buildTickerAnnualReturns>,
  fallback: number | null | undefined,
) {
  if (fallback != null && Number.isFinite(fallback) && fallback >= 0) {
    return { yieldPct: fallback, observations: 0, fallbackUsed: true, status: `Manual fallback ${fallback.toFixed(2)}%` };
  }
  if (!history.dividendDataAvailable) {
    return { yieldPct: null, observations: 0, fallbackUsed: false, status: "Dividend history unavailable; enter a fallback yield to run" };
  }
  const available = annualRows
    .filter((row) => row.dividendYieldPct != null && row.priceReturnPct != null)
    .slice(-5)
    .map((row) => row.dividendYieldPct as number);
  if (available.length === 0) {
    if (history.dividends.length === 0 && history.priceDataAvailable) {
      return { yieldPct: 0, observations: 0, fallbackUsed: false, status: "No dividend events in available provider history" };
    }
    return { yieldPct: null, observations: 0, fallbackUsed: false, status: "Insufficient dividend history; enter a fallback yield to run" };
  }
  return {
    yieldPct: median(available),
    observations: available.length,
    fallbackUsed: false,
    status: `${available.length}-year median${available.length < 5 ? " · limited history" : ""}`,
  };
}

/**
 * Builds transparent planning inputs from complete historical years only.
 * Returned rates are percentage points (for example, 8.5 means 8.5%).
 */
export function buildSimulationForecasts(
  histories: Readonly<Record<string, TickerHistory>>,
  universe: readonly SimulationUniverseTicker[],
  asOfDate: string,
  fallbacks: SimulationForecastFallbacks = {},
): SimulationForecast[] {
  const year = Number(asOfDate.slice(0, 4));
  const lastCompleteYear = Number.isFinite(year) ? year - 1 : new Date().getFullYear() - 1;
  const raw = universe.map((item) => {
    const ticker = item.ticker.toUpperCase();
    const history = histories[ticker];
    if (!history?.providerAvailable || !history.priceDataAvailable) {
      return {
        item: { ...item, ticker }, history,
        annualRows: [], trailing: [], priceEstimate: null, longCagr: null, recentCagr: null,
        trimmedMean: null, observationCount: 0, dividend: { yieldPct: null, observations: 0, fallbackUsed: false, status: history?.error ?? "Price history unavailable" },
      };
    }

    const { annual, trailing } = completePriceRows(history, lastCompleteYear);
    const longRows = trailing.slice(-10);
    const recentRows = trailing.slice(-5);
    const returns = longRows.map((row) => row.priceReturnPct as number);
    const trimmed = returns.length >= 5
      ? mean(returns.filter((value, index) => index !== returns.indexOf(Math.min(...returns)) && index !== returns.lastIndexOf(Math.max(...returns))))
      : mean(returns);
    const longCagr = priceCagr(longRows);
    const recentCagr = priceCagr(recentRows);
    const estimates = [longCagr, recentCagr, trimmed];
    const priceEstimate = estimates.every((value) => value != null)
      ? (0.5 * (longCagr as number)) + (0.3 * (recentCagr as number)) + (0.2 * (trimmed as number))
      : null;
    const dividend = estimateDividendYield(history, annual, fallbacks[ticker]);
    return {
      item: { ...item, ticker }, history, annualRows: annual, trailing,
      priceEstimate, longCagr, recentCagr, trimmedMean: trimmed,
      observationCount: longRows.length, dividend,
    };
  });

  const vooRaw = raw.find((item) => item.item.ticker === "VOO");
  const vooTotal = vooRaw?.priceEstimate != null && vooRaw.dividend.yieldPct != null
    ? vooRaw.priceEstimate + vooRaw.dividend.yieldPct
    : null;

  return raw.map((item) => {
    const { ticker, name, bucket } = item.item;
    const yieldPct = item.dividend.yieldPct;
    const isSgov = ticker === "SGOV";
    const isFund = ticker === "VOO" || ticker === "VXUS";
    const confidence: SimulationForecast["confidence"] = item.observationCount >= 8
      ? "high"
      : item.observationCount >= 5 ? "medium" : item.observationCount > 0 ? "low" : "unavailable";
    let pricePct = item.priceEstimate;
    let rawTotal: number | null = null;
    let finalTotal: number | null = null;
    let benchmarkTotal: number | null = null;
    let shrunk = false;
    let capped = false;
    let status = `${item.observationCount} complete price years · ${item.dividend.status}`;

    if (isSgov) {
      pricePct = item.priceEstimate == null ? null : 0;
      finalTotal = yieldPct;
      rawTotal = finalTotal;
      status = `Interest-bearing sleeve · ${item.dividend.status}`;
    } else if (isFund) {
      if (pricePct != null && yieldPct != null) {
        rawTotal = pricePct + yieldPct;
        finalTotal = rawTotal;
      }
      status = `${status} · fund uses its own estimate`;
    } else if (pricePct != null && yieldPct != null && vooTotal != null) {
      rawTotal = pricePct + yieldPct;
      benchmarkTotal = vooTotal;
      const shrunkTotal = vooTotal + SIMULATION_STOCK_SHRINKAGE * (rawTotal - vooTotal);
      finalTotal = Math.max(SIMULATION_STOCK_TOTAL_RETURN_FLOOR_PCT, Math.min(SIMULATION_STOCK_TOTAL_RETURN_CAP_PCT, shrunkTotal));
      shrunk = Math.abs(finalTotal - rawTotal) > 1e-8;
      capped = finalTotal !== shrunkTotal;
      pricePct = finalTotal - yieldPct;
      status = `${status} · ${shrunk ? "60% VOO anchor" : "VOO anchor had no effect"}${capped ? " · guardrail applied" : ""}`;
    } else if (!isFund && pricePct != null && vooTotal == null) {
      status = `${status} · VOO benchmark estimate unavailable`;
    }

    if (yieldPct == null) status = `${status} · dividend yield required`;
    if (item.observationCount < 5 && item.observationCount > 0) status = `${status} · low confidence`;
    return {
      ticker,
      name,
      bucket,
      forecastPriceReturnPct: pricePct,
      forecastDividendYieldPct: yieldPct,
      rawPriceEstimatePct: item.priceEstimate,
      longWindowPriceCagrPct: item.longCagr,
      recentPriceCagrPct: item.recentCagr,
      trimmedMeanPriceReturnPct: item.trimmedMean,
      benchmarkTotalReturnPct: benchmarkTotal,
      rawTotalReturnPct: rawTotal,
      forecastTotalReturnPct: finalTotal,
      observations: item.observationCount,
      longWindowYears: Math.min(10, item.observationCount),
      recentWindowYears: Math.min(5, item.observationCount),
      dividendObservations: item.dividend.observations,
      confidence,
      shrunkTowardVoo: shrunk,
      capped,
      dividendFallbackUsed: item.dividend.fallbackUsed,
      status,
    };
  });
}

export interface SimulationLedgerPosition {
  ticker: string;
  bucket: PortfolioBucket;
  quantity: number;
  costBasisUsd: number;
}

export interface SimulationMarketQuote {
  price: number | null;
  marketDate: string | null;
}

export interface TenYearSimulationInput {
  asOfDate: string;
  endYear?: number;
  startingPositions: readonly SimulationLedgerPosition[];
  quotes: Readonly<Record<string, SimulationMarketQuote>>;
  fxSpotUsdIdr: number | null;
  unallocatedCashUsd: number;
  unallocatedCashIdr: number;
  forecasts: readonly SimulationForecast[];
  requiredForecastTickers?: readonly string[];
  monthlyDcaIdr?: number;
  annualFxGrowthPct?: number;
  dividendWithholdingPct?: number;
}

export interface SimulationSnapshot {
  date: string;
  estimated: boolean;
  valueUsd: number;
  fxUsdIdr: number;
  valueIdr: number;
  tickerValuesUsd: Record<string, number>;
  bucketValuesUsd: Partial<Record<PortfolioBucket | "other", number>>;
  vooDcaValueUsd: number;
  sgovBalanceUsd: number;
  cumulativeDcaUsd: number;
  cumulativeDcaIdr: number;
  cumulativeNetDividendsUsd: number;
}

export interface SimulationAnnualSnapshot extends SimulationSnapshot {
  year: number;
  beginningValueUsd: number;
  beginningValueIdr: number;
  dcaContributionUsd: number;
  dcaContributionIdr: number;
  grossDividendsUsd: number;
  taxWithheldUsd: number;
  netDividendsSweptUsd: number;
  cumulativeNetDividendsUsd: number;
  priceGrowthUsd: number;
  sgovGrowthUsd: number;
  investmentGrowthUsd: number;
  fxTranslationIdr: number;
  reconciliationErrorUsd: number;
  netDividendsByTickerUsd: Record<string, number>;
  grossDividendsByTickerUsd: Record<string, number>;
  taxWithheldByTickerUsd: Record<string, number>;
  tickerDcaShares: number;
}

export interface SimulationTickerSummary {
  ticker: string;
  bucket: PortfolioBucket | "other";
  name: string | null;
  startingValueUsd: number;
  startingShares: number;
  costBasisUsd: number;
  forecastPriceReturnPct: number | null;
  grossDividendYieldPct: number | null;
  netDividendYieldPct: number | null;
  annualEndingValueUsd: Record<number, number>;
  annualNetDividendsUsd: Record<number, number>;
  annualGrossDividendsUsd: Record<number, number>;
  annualTaxWithheldUsd: Record<number, number>;
  dcaShares: number;
  dcaPrincipalUsd: number;
  dcaPrincipalIdr: number;
  status: string;
}

export interface TenYearSimulationResult {
  status: "ready" | "blocked";
  issues: string[];
  warnings: string[];
  asOfSnapshot: SimulationSnapshot | null;
  annualSnapshots: SimulationAnnualSnapshot[];
  tickerSummaries: SimulationTickerSummary[];
  startingValueUsd: number | null;
  startingCostBasisUsd: number | null;
  startingUnrealizedUsd: number | null;
  unallocatedCashUsd: number | null;
  unallocatedCashIdr: number | null;
  totalDcaPrincipalIdr: number;
  totalDcaPrincipalUsd: number;
  investmentGrowthExcludingDcaUsd: number | null;
  cumulativeNetDividendsUsd: number;
  endingSgovBalanceUsd: number | null;
  endingVooDcaValueUsd: number | null;
  cumulativeFxTranslationIdr: number;
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fxAtDate(spot: number, annualGrowthPct: number, startDate: string, targetDate: string) {
  const days = (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
  return spot * (1 + annualGrowthPct / 100) ** (days / 365.2425);
}

function emptyBlockedResult(issues: string[], warnings: string[] = []): TenYearSimulationResult {
  return {
    status: "blocked", issues, warnings, asOfSnapshot: null, annualSnapshots: [], tickerSummaries: [],
    startingValueUsd: null, startingCostBasisUsd: null, startingUnrealizedUsd: null,
    unallocatedCashUsd: null, unallocatedCashIdr: null, totalDcaPrincipalIdr: 0,
    totalDcaPrincipalUsd: 0, investmentGrowthExcludingDcaUsd: null, cumulativeNetDividendsUsd: 0,
    endingSgovBalanceUsd: null, endingVooDcaValueUsd: null, cumulativeFxTranslationIdr: 0,
  };
}

/**
 * Runs the monthly planning model from a current ledger valuation. Price growth,
 * cash dividends, SGOV growth, DCA principal, and FX translation stay separate.
 */
export function runTenYearSimulation(input: TenYearSimulationInput): TenYearSimulationResult {
  const endYear = input.endYear ?? SIMULATION_END_YEAR;
  const monthlyDcaIdr = input.monthlyDcaIdr ?? SIMULATION_MONTHLY_DCA_IDR;
  const fxGrowthPct = input.annualFxGrowthPct ?? 3;
  const taxPct = input.dividendWithholdingPct ?? 0;
  const issues: string[] = [];
  const warnings: string[] = [];
  const asOfYear = Number(input.asOfDate.slice(0, 4));
  const fxSpot = input.fxSpotUsdIdr;
  const forecasts = new Map(input.forecasts.map((forecast) => [forecast.ticker.toUpperCase(), forecast]));
  const requiredTickers = new Set([
    ...(input.requiredForecastTickers ?? input.forecasts.map((item) => item.ticker)),
    ...input.startingPositions.map((position) => position.ticker),
    "VOO",
    "SGOV",
  ].map((ticker) => ticker.toUpperCase()));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOfDate) || !Number.isFinite(Date.parse(`${input.asOfDate}T00:00:00Z`))) issues.push("A valid market as-of date is required.");
  if (fxSpot == null || !Number.isFinite(fxSpot) || fxSpot <= 0) issues.push("USD/IDR spot rate is unavailable.");
  if (!Number.isFinite(monthlyDcaIdr) || monthlyDcaIdr < 0) issues.push("Monthly IDR contribution must be zero or a positive number.");
  if (!Number.isFinite(fxGrowthPct) || fxGrowthPct < -100) issues.push("Annual USD/IDR growth assumption is invalid.");
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) issues.push("Dividend withholding assumption must be between 0% and 100%.");
  if (!Number.isFinite(endYear) || endYear < asOfYear) issues.push("Simulation end year must not precede the as-of year.");
  for (const ticker of requiredTickers) {
    const forecast = forecasts.get(ticker);
    if (!forecast) {
      issues.push(`${ticker} has no forecast input.`);
    } else if (forecast.forecastPriceReturnPct == null || forecast.forecastDividendYieldPct == null) {
      issues.push(`${ticker} needs usable price and dividend assumptions before the simulation can run.`);
    }
  }

  const positionQuoteByTicker = new Map<string, SimulationMarketQuote>();
  for (const position of input.startingPositions) {
    const ticker = position.ticker.toUpperCase();
    const quote = input.quotes[ticker];
    if (quote?.price == null || !Number.isFinite(quote.price) || quote.price <= 0) {
      issues.push(`${ticker} has no current market close; its ledger holding cannot be valued.`);
      continue;
    }
    positionQuoteByTicker.set(ticker, quote);
    if (quote.marketDate && quote.marketDate < input.asOfDate) warnings.push(`${ticker} close is stale as of ${quote.marketDate}.`);
    if (!quote.marketDate) warnings.push(`${ticker} quote date is unavailable.`);
    if (!Number.isFinite(position.quantity) || position.quantity < 0) issues.push(`${ticker} has an invalid ledger share quantity.`);
  }
  const vooQuote = input.quotes.VOO;
  if (vooQuote?.price == null || !Number.isFinite(vooQuote.price) || vooQuote.price <= 0) issues.push("VOO has no current market close for the monthly DCA price path.");

  if (issues.length > 0 || fxSpot == null) return emptyBlockedResult([...new Set(issues)], [...new Set(warnings)]);

  const positionStates = input.startingPositions.map((position) => {
    const ticker = position.ticker.toUpperCase();
    const quote = positionQuoteByTicker.get(ticker) as SimulationMarketQuote;
    return {
      ticker,
      bucket: position.bucket,
      quantity: position.quantity,
      costBasisUsd: Number.isFinite(position.costBasisUsd) ? position.costBasisUsd : 0,
      valueUsd: position.quantity * (quote.price as number),
    };
  });
  const startingPositionsValueUsd = positionStates.reduce((sum, position) => sum + position.valueUsd, 0);
  const startingCashIdr = input.unallocatedCashIdr;
  const startingCashUsd = input.unallocatedCashUsd + startingCashIdr / fxSpot;
  const sgovPositionValue = positionStates.filter((position) => position.ticker === "SGOV").reduce((sum, position) => sum + position.valueUsd, 0);
  const sgovBalance = { valueUsd: sgovPositionValue + startingCashUsd };
  const ordinaryPositions = positionStates.filter((position) => position.ticker !== "SGOV");
  const startingValueUsd = startingPositionsValueUsd + startingCashUsd;
  const startingCostBasisUsd = positionStates.reduce((sum, position) => sum + position.costBasisUsd, 0);
  const startingUnrealizedUsd = startingPositionsValueUsd - startingCostBasisUsd;
  let vooDcaShares = 0;
  let vooDcaValueUsd = 0;
  let projectedVooPrice = vooQuote.price as number;
  let cumulativeDcaUsd = 0;
  let cumulativeDcaIdr = 0;
  let cumulativeNetDividendsUsd = 0;
  let cumulativeFxTranslationIdr = 0;
  let totalDcaPrincipalIdr = 0;
  let totalDcaPrincipalUsd = 0;

  const forecastByTicker = forecasts;
  const currentTickerValues = () => {
    const values: Record<string, number> = {};
    for (const position of ordinaryPositions) values[position.ticker] = (values[position.ticker] ?? 0) + position.valueUsd;
    values.SGOV = sgovBalance.valueUsd;
    values.VOO = (values.VOO ?? 0) + vooDcaValueUsd;
    return values;
  };
  const currentBucketValues = () => {
    const values: Partial<Record<PortfolioBucket | "other", number>> = {};
    for (const position of ordinaryPositions) values[position.bucket] = (values[position.bucket] ?? 0) + position.valueUsd;
    // SGOV and unallocated cash are modelled together in the Treasury sleeve.
    values.treasury = (values.treasury ?? 0) + sgovBalance.valueUsd;
    const vooBucket = forecasts.get("VOO")?.bucket ?? "index";
    values[vooBucket] = (values[vooBucket] ?? 0) + vooDcaValueUsd;
    return values;
  };
  const makeSnapshot = (date: string, fx: number, estimated: boolean): SimulationSnapshot => {
    const tickerValuesUsd = currentTickerValues();
    const bucketValuesUsd = currentBucketValues();
    return {
      date,
      estimated,
      valueUsd: Object.values(tickerValuesUsd).reduce((sum, value) => sum + value, 0),
      fxUsdIdr: fx,
      valueIdr: Object.values(tickerValuesUsd).reduce((sum, value) => sum + value, 0) * fx,
      tickerValuesUsd,
      bucketValuesUsd,
      vooDcaValueUsd,
      sgovBalanceUsd: sgovBalance.valueUsd,
      cumulativeDcaUsd,
      cumulativeDcaIdr,
      cumulativeNetDividendsUsd,
    };
  };

  const asOfSnapshot = makeSnapshot(input.asOfDate, fxSpot, false);
  const annualSnapshots: SimulationAnnualSnapshot[] = [];
  let cursor = new Date(`${input.asOfDate}T00:00:00Z`);
  let yearBeginningValueUsd = startingValueUsd;
  let yearBeginningValueIdr = startingValueUsd * fxSpot;
  let yearDcaUsd = 0;
  let yearDcaIdr = 0;
  let yearGrossDividends = 0;
  let yearTaxWithheld = 0;
  let yearNetDividends = 0;
  let yearPriceGrowth = 0;
  let yearSgovGrowth = 0;
  let yearFxTranslation = 0;
  let yearTickerDcaShares = 0;
  let yearNetByTicker: Record<string, number> = {};
  let yearGrossByTicker: Record<string, number> = {};
  let yearTaxByTicker: Record<string, number> = {};
  let partialYearFractionUsed = 0;

  while (cursor.getUTCFullYear() <= endYear) {
    let stepEnd = endOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth());
    if (stepEnd.getTime() <= cursor.getTime()) stepEnd = endOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
    const yearEnd = new Date(Date.UTC(endYear, 11, 31));
    if (stepEnd > yearEnd) stepEnd = yearEnd;
    if (stepEnd.getTime() <= cursor.getTime()) break;
    const stepDate = isoDate(stepEnd);
    let years: number;
    if (stepEnd.getUTCFullYear() === asOfYear) {
      const yearEndDate = new Date(Date.UTC(asOfYear, 11, 31));
      if (stepEnd.getUTCMonth() === 11) {
        const remainingYearFraction = (yearEndDate.getTime() - Date.parse(`${input.asOfDate}T00:00:00Z`)) / (365.2425 * 86_400_000);
        years = Math.max(0, remainingYearFraction - partialYearFractionUsed);
      } else if (cursor.getUTCFullYear() === stepEnd.getUTCFullYear() && cursor.getUTCMonth() === stepEnd.getUTCMonth()) {
        years = (stepEnd.getTime() - cursor.getTime()) / (365.2425 * 86_400_000);
      } else {
        years = 1 / 12;
      }
      partialYearFractionUsed += years;
    } else {
      years = 1 / 12;
    }
    const fxEnd = fxAtDate(fxSpot, fxGrowthPct, input.asOfDate, stepDate);
    let stepPriceGrowth = 0;
    let grossDividends = 0;
    let taxWithheld = 0;
    let netDividends = 0;
    const netByTicker: Record<string, number> = {};
    const grossByTicker: Record<string, number> = {};
    const taxByTicker: Record<string, number> = {};

    for (const position of ordinaryPositions) {
      const forecast = forecastByTicker.get(position.ticker);
      if (!forecast || forecast.forecastPriceReturnPct == null || forecast.forecastDividendYieldPct == null) continue;
      const priceFactor = (1 + forecast.forecastPriceReturnPct / 100) ** years;
      const growth = position.valueUsd * (priceFactor - 1);
      stepPriceGrowth += growth;
      const gross = position.valueUsd * (forecast.forecastDividendYieldPct / 100) * years;
      const withheld = gross * taxPct / 100;
      const net = gross - withheld;
      grossDividends += gross;
      taxWithheld += withheld;
      netDividends += net;
      grossByTicker[position.ticker] = (grossByTicker[position.ticker] ?? 0) + gross;
      netByTicker[position.ticker] = (netByTicker[position.ticker] ?? 0) + net;
      taxByTicker[position.ticker] = (taxByTicker[position.ticker] ?? 0) + withheld;
      position.valueUsd *= priceFactor;
    }

    const vooForecast = forecastByTicker.get("VOO");
    const vooYieldPct = vooForecast?.forecastDividendYieldPct ?? 0;
    const vooGrossDividends = vooDcaValueUsd * (vooYieldPct / 100) * years;
    const vooTaxWithheld = vooGrossDividends * taxPct / 100;
    const vooNetDividends = vooGrossDividends - vooTaxWithheld;
    if (vooGrossDividends > 0) {
      grossDividends += vooGrossDividends;
      taxWithheld += vooTaxWithheld;
      netDividends += vooNetDividends;
      grossByTicker.VOO = (grossByTicker.VOO ?? 0) + vooGrossDividends;
      netByTicker.VOO = (netByTicker.VOO ?? 0) + vooNetDividends;
      taxByTicker.VOO = (taxByTicker.VOO ?? 0) + vooTaxWithheld;
    }

    const oldDcaValue = vooDcaValueUsd;
    const vooFactor = (1 + (vooForecast?.forecastPriceReturnPct ?? 0) / 100) ** years;
    projectedVooPrice *= vooFactor;
    vooDcaValueUsd *= vooFactor;
    stepPriceGrowth += vooDcaValueUsd - oldDcaValue;

    const sgovForecast = forecastByTicker.get("SGOV");
    const sgovYieldPct = sgovForecast?.forecastDividendYieldPct ?? 0;
    const sgovGrowth = sgovBalance.valueUsd * ((1 + sgovYieldPct / 100) ** years - 1);
    sgovBalance.valueUsd += sgovGrowth + netDividends;

    yearPriceGrowth += stepPriceGrowth;
    yearGrossDividends += grossDividends;
    yearTaxWithheld += taxWithheld;
    yearNetDividends += netDividends;
    yearSgovGrowth += sgovGrowth;
    for (const [ticker, value] of Object.entries(grossByTicker)) yearGrossByTicker[ticker] = (yearGrossByTicker[ticker] ?? 0) + value;
    for (const [ticker, value] of Object.entries(netByTicker)) yearNetByTicker[ticker] = (yearNetByTicker[ticker] ?? 0) + value;
    for (const [ticker, value] of Object.entries(taxByTicker)) yearTaxByTicker[ticker] = (yearTaxByTicker[ticker] ?? 0) + value;
    cumulativeNetDividendsUsd += netDividends;

    const month = stepEnd.getUTCMonth();
    const stepYear = stepEnd.getUTCFullYear();
    if (stepYear > 2026 || (stepYear === 2026 && month >= 10)) {
      const contributionUsd = monthlyDcaIdr / fxEnd;
      const addedShares = contributionUsd / projectedVooPrice;
      vooDcaShares += addedShares;
      vooDcaValueUsd += contributionUsd;
      cumulativeDcaUsd += contributionUsd;
      cumulativeDcaIdr += monthlyDcaIdr;
      totalDcaPrincipalUsd += contributionUsd;
      totalDcaPrincipalIdr += monthlyDcaIdr;
      yearDcaUsd += contributionUsd;
      yearDcaIdr += monthlyDcaIdr;
      yearTickerDcaShares += addedShares;
    }

    const endingValueUsd = ordinaryPositions.reduce((sum, position) => sum + position.valueUsd, 0) + sgovBalance.valueUsd + vooDcaValueUsd;
    const investmentGrowthUsd = yearPriceGrowth + yearSgovGrowth + yearNetDividends;
    const annualIdrBeginning = yearBeginningValueIdr;
    const endingValueIdr = endingValueUsd * fxEnd;
    if (stepEnd.getUTCMonth() === 11) {
      const fxTranslationIdr = endingValueIdr - (annualIdrBeginning + yearDcaIdr + investmentGrowthUsd * fxEnd);
      yearFxTranslation += fxTranslationIdr;
      const snapshot = makeSnapshot(stepDate, fxEnd, true);
      const reconciliationErrorUsd = endingValueUsd - (yearBeginningValueUsd + yearDcaUsd + yearPriceGrowth + yearSgovGrowth + yearNetDividends);
      annualSnapshots.push({
        ...snapshot,
        year: stepYear,
        beginningValueUsd: yearBeginningValueUsd,
        beginningValueIdr: annualIdrBeginning,
        dcaContributionUsd: yearDcaUsd,
        dcaContributionIdr: yearDcaIdr,
        grossDividendsUsd: yearGrossDividends,
        taxWithheldUsd: yearTaxWithheld,
        netDividendsSweptUsd: yearNetDividends,
        cumulativeNetDividendsUsd,
        priceGrowthUsd: yearPriceGrowth,
        sgovGrowthUsd: yearSgovGrowth,
        investmentGrowthUsd,
        fxTranslationIdr: yearFxTranslation,
        reconciliationErrorUsd,
        netDividendsByTickerUsd: yearNetByTicker,
        grossDividendsByTickerUsd: yearGrossByTicker,
        taxWithheldByTickerUsd: yearTaxByTicker,
        tickerDcaShares: yearTickerDcaShares,
      });
      cumulativeFxTranslationIdr += yearFxTranslation;
      yearBeginningValueUsd = endingValueUsd;
      yearBeginningValueIdr = endingValueIdr;
      yearDcaUsd = 0;
      yearDcaIdr = 0;
      yearGrossDividends = 0;
      yearTaxWithheld = 0;
      yearNetDividends = 0;
      yearPriceGrowth = 0;
      yearSgovGrowth = 0;
      yearFxTranslation = 0;
      yearTickerDcaShares = 0;
      yearNetByTicker = {};
      yearGrossByTicker = {};
      yearTaxByTicker = {};
    }

    cursor = stepEnd;
    if (cursor.getTime() >= yearEnd.getTime()) break;
  }

  const finalSnapshot = annualSnapshots.at(-1);
  if (!finalSnapshot || finalSnapshot.year !== endYear) return emptyBlockedResult([`The model did not produce a ${endYear} year-end snapshot.`], warnings);
  const startingByTicker = new Map<string, { value: number; shares: number; costBasis: number; bucket: PortfolioBucket | "other" }>();
  for (const position of positionStates) {
    const current = startingByTicker.get(position.ticker) ?? { value: 0, shares: 0, costBasis: 0, bucket: position.bucket };
    current.value += position.valueUsd;
    current.shares += position.quantity;
    current.costBasis += position.costBasisUsd;
    startingByTicker.set(position.ticker, current);
  }
  const tickers = new Set<string>([
    ...forecasts.keys(),
    ...startingByTicker.keys(),
    "SGOV",
    "VOO",
  ]);
  const tickerSummaries = [...tickers].sort().map((ticker) => {
    const forecast = forecastByTicker.get(ticker);
    const starting = startingByTicker.get(ticker);
    const annualEndingValueUsd: Record<number, number> = {};
    const annualNetDividendsUsd: Record<number, number> = {};
    const annualGrossDividendsUsd: Record<number, number> = {};
    const annualTaxWithheldUsd: Record<number, number> = {};
    for (const snapshot of annualSnapshots) {
      annualEndingValueUsd[snapshot.year] = snapshot.tickerValuesUsd[ticker] ?? 0;
      annualNetDividendsUsd[snapshot.year] = snapshot.netDividendsByTickerUsd[ticker] ?? 0;
      annualGrossDividendsUsd[snapshot.year] = snapshot.grossDividendsByTickerUsd[ticker] ?? 0;
      annualTaxWithheldUsd[snapshot.year] = snapshot.taxWithheldByTickerUsd[ticker] ?? 0;
    }
    const quoteWarning = warnings.find((warning) => warning.startsWith(`${ticker} `));
    return {
      ticker,
      bucket: forecast?.bucket ?? starting?.bucket ?? "other",
      name: forecast?.name ?? null,
      startingValueUsd: ticker === "SGOV" ? sgovPositionValue + startingCashUsd : starting?.value ?? 0,
      startingShares: starting?.shares ?? 0,
      costBasisUsd: starting?.costBasis ?? 0,
      forecastPriceReturnPct: forecast?.forecastPriceReturnPct ?? null,
      grossDividendYieldPct: forecast?.forecastDividendYieldPct ?? null,
      netDividendYieldPct: forecast?.forecastDividendYieldPct == null ? null : forecast.forecastDividendYieldPct * (1 - taxPct / 100),
      annualEndingValueUsd,
      annualNetDividendsUsd,
      annualGrossDividendsUsd,
      annualTaxWithheldUsd,
      dcaShares: ticker === "VOO" ? vooDcaShares : 0,
      dcaPrincipalUsd: ticker === "VOO" ? totalDcaPrincipalUsd : 0,
      dcaPrincipalIdr: ticker === "VOO" ? totalDcaPrincipalIdr : 0,
      status: [forecast?.status ?? "No historical forecast input", quoteWarning].filter(Boolean).join(" · "),
    } satisfies SimulationTickerSummary;
  });

  return {
    status: "ready",
    issues: [],
    warnings: [...new Set(warnings)],
    asOfSnapshot,
    annualSnapshots,
    tickerSummaries,
    startingValueUsd,
    startingCostBasisUsd,
    startingUnrealizedUsd,
    unallocatedCashUsd: input.unallocatedCashUsd,
    unallocatedCashIdr: startingCashIdr,
    totalDcaPrincipalIdr,
    totalDcaPrincipalUsd,
    investmentGrowthExcludingDcaUsd: finalSnapshot.valueUsd - startingValueUsd - totalDcaPrincipalUsd,
    cumulativeNetDividendsUsd,
    endingSgovBalanceUsd: finalSnapshot.sgovBalanceUsd,
    endingVooDcaValueUsd: finalSnapshot.vooDcaValueUsd,
    cumulativeFxTranslationIdr,
  };
}
