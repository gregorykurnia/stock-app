export interface PriceObservation {
  date: string;
  close: number;
}

export interface DividendObservation {
  date: string;
  amount: number;
}

export interface TickerHistory {
  ticker: string;
  name: string | null;
  currency: string | null;
  bars: PriceObservation[];
  dividends: DividendObservation[];
  dividendDataAvailable: boolean;
  priceDataAvailable: boolean;
  providerAvailable: boolean;
  error: string | null;
}

export type AnnualUsdIdrChangeStatus =
  | "complete"
  | "provider unavailable"
  | "no FX history"
  | "missing prior-year close"
  | "missing in-year close";

export interface AnnualUsdIdrChange {
  year: number;
  startDate: string | null;
  endDate: string | null;
  startUsdIdr: number | null;
  endUsdIdr: number | null;
  usdStrengthPct: number | null;
  status: AnnualUsdIdrChangeStatus;
}

export interface UsdIdrPeriodSummary {
  startDate: string | null;
  endDate: string | null;
  startUsdIdr: number | null;
  endUsdIdr: number | null;
  cumulativeUsdStrengthPct: number | null;
  annualizedUsdStrengthPct: number | null;
  completeYears: number;
  totalYears: number;
}

export type AnnualReturnStatus =
  | "complete"
  | "dividend history unavailable"
  | "provider unavailable"
  | "no price history"
  | "missing prior-year close"
  | "missing in-year close";

export interface AnnualTickerReturn {
  ticker: string;
  year: number;
  startDate: string | null;
  firstDate: string | null;
  endDate: string | null;
  startClose: number | null;
  firstClose: number | null;
  endClose: number | null;
  dividendsPerShare: number | null;
  priceReturnPct: number | null;
  dividendYieldPct: number | null;
  cashTotalReturnPct: number | null;
  status: AnnualReturnStatus;
}

export interface DailyReturnStats {
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number | null;
  observations: number;
}

export interface TickerReturnSummary extends DailyReturnStats {
  averageAnnualPriceReturnPct: number | null;
  averageAnnualDividendYieldPct: number | null;
  averageAnnualCashTotalReturnPct: number | null;
  cumulativeCashTotalReturnPct: number | null;
  cashTotalReturnCagrPct: number | null;
  bestYear: { year: number; returnPct: number } | null;
  worstYear: { year: number; returnPct: number } | null;
  positiveYears: number;
  usableYears: number;
  dividendGrowthByYear: { year: number; growthPct: number }[];
  averageAnnualVooExcessPct: number | null;
  cumulativeVooExcessPct: number | null;
  cagrVooExcessPct: number | null;
}

export interface BasketAnnualReturn {
  year: number;
  startDate: string | null;
  endDate: string | null;
  priceReturnPct: number | null;
  dividendYieldPct: number | null;
  cashTotalReturnPct: number | null;
  dividendsPerShare: number | null;
  dividendsCurrency: string | null;
  holdingsWithUsableData: number;
  weightCoveragePct: number;
  partial: boolean;
  status: "complete" | "partial" | "no usable data";
}

export interface BasketReturnSummary extends DailyReturnStats {
  averageAnnualPriceReturnPct: number | null;
  averageAnnualDividendYieldPct: number | null;
  averageAnnualCashTotalReturnPct: number | null;
  cumulativeCashTotalReturnPct: number | null;
  cashTotalReturnCagrPct: number | null;
  bestYear: { year: number; returnPct: number } | null;
  worstYear: { year: number; returnPct: number } | null;
  positiveYears: number;
}

function isFinitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function mean(values: readonly (number | null)[]): number | null {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  return usable.length === 0 ? null : usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function normalizedBars(history: TickerHistory): PriceObservation[] {
  const byDate = new Map<string, number>();
  for (const bar of history.bars) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(bar.date) && isFinitePositive(bar.close)) byDate.set(bar.date, bar.close);
  }
  return [...byDate.entries()].map(([date, close]) => ({ date, close })).sort((a, b) => a.date.localeCompare(b.date));
}

function emptyAnnualUsdIdrChange(year: number, status: AnnualUsdIdrChangeStatus): AnnualUsdIdrChange {
  return {
    year,
    startDate: null,
    endDate: null,
    startUsdIdr: null,
    endUsdIdr: null,
    usdStrengthPct: null,
    status,
  };
}

/**
 * Calculates observed annual USD strengthening from Yahoo's IDR-per-USD quote.
 * Each year begins at the last available close in the prior calendar year and
 * ends at the last close in the requested year through the supplied as-of date.
 */
export function buildAnnualUsdIdrChanges(
  history: TickerHistory | null | undefined,
  startYear: number,
  endYear: number,
  asOfDate: string,
): AnnualUsdIdrChange[] {
  return Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, offset) => {
    const year = startYear + offset;
    if (!history?.providerAvailable) return emptyAnnualUsdIdrChange(year, "provider unavailable");
    const bars = normalizedBars(history).filter((bar) => bar.date <= asOfDate);
    if (bars.length === 0) return emptyAnnualUsdIdrChange(year, "no FX history");

    const yearStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31` < asOfDate ? `${year}-12-31` : asOfDate;
    const priorYearStart = `${year - 1}-01-01`;
    const prior = bars.filter((bar) => bar.date >= priorYearStart && bar.date < yearStart).at(-1);
    const last = bars.filter((bar) => bar.date >= yearStart && bar.date <= periodEnd).at(-1);

    if (!prior) return emptyAnnualUsdIdrChange(year, "missing prior-year close");
    if (!last) return emptyAnnualUsdIdrChange(year, "missing in-year close");

    return {
      year,
      startDate: prior.date,
      endDate: last.date,
      startUsdIdr: prior.close,
      endUsdIdr: last.close,
      usdStrengthPct: (last.close / prior.close - 1) * 100,
      status: "complete",
    };
  });
}

export function summarizeUsdIdrChanges(rows: readonly AnnualUsdIdrChange[]): UsdIdrPeriodSummary {
  const first = rows[0];
  const last = rows.at(-1);
  const startDate = first?.startDate ?? null;
  const endDate = last?.endDate ?? null;
  const startUsdIdr = first?.startUsdIdr ?? null;
  const endUsdIdr = last?.endUsdIdr ?? null;
  const hasEndpoints = startDate != null && endDate != null && startUsdIdr != null && endUsdIdr != null;
  const elapsedDays = hasEndpoints
    ? (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000
    : 0;
  const cumulativeUsdStrengthPct = hasEndpoints ? (endUsdIdr / startUsdIdr - 1) * 100 : null;

  return {
    startDate: hasEndpoints ? startDate : null,
    endDate: hasEndpoints ? endDate : null,
    startUsdIdr: hasEndpoints ? startUsdIdr : null,
    endUsdIdr: hasEndpoints ? endUsdIdr : null,
    cumulativeUsdStrengthPct,
    annualizedUsdStrengthPct: hasEndpoints && elapsedDays > 0
      ? ((endUsdIdr / startUsdIdr) ** (365.2425 / elapsedDays) - 1) * 100
      : null,
    completeYears: rows.filter((row) => row.status === "complete").length,
    totalYears: rows.length,
  };
}

function emptyAnnualReturn(ticker: string, year: number, status: AnnualReturnStatus): AnnualTickerReturn {
  return {
    ticker, year, startDate: null, firstDate: null, endDate: null,
    startClose: null, firstClose: null, endClose: null,
    dividendsPerShare: null, priceReturnPct: null, dividendYieldPct: null,
    cashTotalReturnPct: null, status,
  };
}

/**
 * Calculates calendar-year returns from split-adjusted closes and cash dividend events.
 * Price and cash total return use the final close before the year; dividend yield uses
 * the first trading close within the year, as specified for this view.
 */
export function buildTickerAnnualReturns(
  history: TickerHistory,
  startYear: number,
  endYear: number,
  asOfDate: string,
): AnnualTickerReturn[] {
  const bars = normalizedBars(history).filter((bar) => bar.date <= asOfDate);
  const dividends = [...history.dividends]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.amount) && item.amount >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, offset) => {
    const year = startYear + offset;
    if (!history.providerAvailable) return emptyAnnualReturn(history.ticker, year, "provider unavailable");
    if (bars.length === 0) return emptyAnnualReturn(history.ticker, year, "no price history");

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const periodEnd = yearEnd < asOfDate ? yearEnd : asOfDate;
    const prior = bars.filter((bar) => bar.date < yearStart).at(-1);
    const currentBars = bars.filter((bar) => bar.date >= yearStart && bar.date <= periodEnd);
    const first = currentBars[0];
    const last = currentBars.at(-1);
    const dividendsPerShare = history.dividendDataAvailable
      ? dividends.filter((event) => event.date >= yearStart && event.date <= periodEnd).reduce((sum, event) => sum + event.amount, 0)
      : null;
    const priceReturnPct = prior && last ? (last.close / prior.close - 1) * 100 : null;
    const dividendYieldPct = dividendsPerShare != null && first ? dividendsPerShare / first.close * 100 : null;
    const cashTotalReturnPct = dividendsPerShare != null && prior && last
      ? (last.close + dividendsPerShare - prior.close) / prior.close * 100
      : null;
    let status: AnnualReturnStatus;
    if (!prior) status = "missing prior-year close";
    else if (!last || !first) status = "missing in-year close";
    else if (!history.dividendDataAvailable) status = "dividend history unavailable";
    else status = "complete";

    return {
      ticker: history.ticker,
      year,
      startDate: prior?.date ?? null,
      firstDate: first?.date ?? null,
      endDate: last?.date ?? null,
      startClose: prior?.close ?? null,
      firstClose: first?.close ?? null,
      endClose: last?.close ?? null,
      dividendsPerShare,
      priceReturnPct,
      dividendYieldPct,
      cashTotalReturnPct,
      status,
    };
  });
}

export function calculateDailyCashReturns(history: TickerHistory, startDate: string, endDate: string) {
  if (!history.priceDataAvailable || !history.dividendDataAvailable) return [];
  const bars = normalizedBars(history).filter((bar) => bar.date <= endDate);
  let baselineIndex = -1;
  for (let index = 0; index < bars.length; index += 1) {
    if (bars[index].date > startDate) break;
    baselineIndex = index;
  }
  if (baselineIndex < 0) return [];
  const dividendsByDate = new Map<string, number>();
  for (const event of history.dividends) {
    dividendsByDate.set(event.date, (dividendsByDate.get(event.date) ?? 0) + event.amount);
  }
  const result: { date: string; returnPct: number }[] = [];
  let cashReceivedPerShare = 0;
  let previousPortfolioValue = bars[baselineIndex].close;
  for (let index = baselineIndex + 1; index < bars.length; index += 1) {
    const current = bars[index];
    if (current.date > endDate) break;
    cashReceivedPerShare += dividendsByDate.get(current.date) ?? 0;
    const currentPortfolioValue = current.close + cashReceivedPerShare;
    if (!isFinitePositive(previousPortfolioValue)) continue;
    result.push({
      date: current.date,
      returnPct: (currentPortfolioValue / previousPortfolioValue - 1) * 100,
    });
    previousPortfolioValue = currentPortfolioValue;
  }
  return result;
}

export function calculateDailyReturnStats(returns: readonly { returnPct: number }[]): DailyReturnStats {
  const usable = returns.map((item) => item.returnPct).filter(Number.isFinite);
  if (usable.length < 2) return { annualizedVolatilityPct: null, maxDrawdownPct: null, observations: usable.length };

  const average = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  const variance = usable.reduce((sum, value) => sum + (value - average) ** 2, 0) / (usable.length - 1);
  let wealth = 1;
  let peak = 1;
  let drawdown: number | null = 0;
  for (const value of usable) {
    const dailyFactor = 1 + value / 100;
    if (dailyFactor < 0) {
      drawdown = null;
      break;
    }
    wealth *= dailyFactor;
    peak = Math.max(peak, wealth);
    drawdown = Math.min(drawdown ?? 0, (wealth / peak - 1) * 100);
  }
  return {
    annualizedVolatilityPct: usable.length >= 30 ? Math.sqrt(variance) * Math.sqrt(252) : null,
    maxDrawdownPct: usable.length >= 30 ? drawdown : null,
    observations: usable.length,
  };
}

function compoundAnnualRows(rows: readonly { year: number; startDate: string | null; endDate: string | null; cashTotalReturnPct: number | null }[]) {
  const ordered = [...rows].sort((a, b) => a.year - b.year);
  const usable = rows.filter((row): row is typeof row & { cashTotalReturnPct: number } => row.cashTotalReturnPct != null)
    .sort((a, b) => a.year - b.year);
  if (usable.length === 0) return { cumulativePct: null, cagrPct: null, usable };
  const isContinuous = usable.every((row, index) => index === 0 || row.year === usable[index - 1].year + 1);
  // A missing leading year can be legitimate for a later-added ticker. A missing
  // year after the last usable point means the selected period has no known ending.
  if (!isContinuous || usable.at(-1)?.year !== ordered.at(-1)?.year) return { cumulativePct: null, cagrPct: null, usable };
  let growth = 1;
  for (const row of usable) {
    const factor = 1 + row.cashTotalReturnPct / 100;
    if (factor < 0) return { cumulativePct: null, cagrPct: null, usable };
    growth *= factor;
  }
  const startDate = usable[0].startDate;
  const endDate = usable.at(-1)?.endDate;
  const elapsedYears = startDate && endDate
    ? (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / (365.2425 * 86400000)
    : usable.length;
  const cagrPct = elapsedYears > 0 ? (growth === 0 ? -100 : (growth ** (1 / elapsedYears) - 1) * 100) : null;
  return { cumulativePct: (growth - 1) * 100, cagrPct, usable };
}

export function buildVooExcessReturns(
  tickerRows: readonly AnnualTickerReturn[],
  vooRows: readonly AnnualTickerReturn[],
) {
  const benchmarkByYear = new Map(vooRows.map((row) => [row.year, row]));
  return tickerRows.map((row) => {
    const benchmark = benchmarkByYear.get(row.year);
    return {
      year: row.year,
      excessReturnPct: row.cashTotalReturnPct != null && benchmark?.cashTotalReturnPct != null
        ? row.cashTotalReturnPct - benchmark.cashTotalReturnPct
        : null,
      benchmarkReturnPct: benchmark?.cashTotalReturnPct ?? null,
      benchmarkStartDate: benchmark?.startDate ?? null,
      benchmarkEndDate: benchmark?.endDate ?? null,
    };
  });
}

export function summarizeTickerReturns(
  rows: readonly AnnualTickerReturn[],
  history: TickerHistory,
  vooExcessByYear: readonly {
    year: number;
    excessReturnPct: number | null;
    benchmarkReturnPct?: number | null;
    benchmarkStartDate?: string | null;
    benchmarkEndDate?: string | null;
  }[] = [],
): TickerReturnSummary {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const cashRows = sorted.filter((row) => row.cashTotalReturnPct != null);
  const compounded = compoundAnnualRows(sorted);
  const best = cashRows.reduce<AnnualTickerReturn | null>((current, row) => current == null || row.cashTotalReturnPct! > current.cashTotalReturnPct! ? row : current, null);
  const worst = cashRows.reduce<AnnualTickerReturn | null>((current, row) => current == null || row.cashTotalReturnPct! < current.cashTotalReturnPct! ? row : current, null);
  const excessCashRows = vooExcessByYear.filter((row) => row.excessReturnPct != null);
  const tickerCashYears = new Set(cashRows.map((row) => row.year));
  const benchmarkRows = vooExcessByYear.flatMap((row) => !tickerCashYears.has(row.year) || row.benchmarkReturnPct == null ? [] : [{
    year: row.year,
    startDate: row.benchmarkStartDate ?? null,
    endDate: row.benchmarkEndDate ?? null,
    cashTotalReturnPct: row.benchmarkReturnPct,
  }]);
  const benchmarkCompounded = compoundAnnualRows(benchmarkRows);
  const dailyReturns = compounded.cumulativePct != null && compounded.usable[0]?.startDate && compounded.usable.at(-1)?.endDate
    ? calculateDailyCashReturns(history, compounded.usable[0].startDate, compounded.usable.at(-1)!.endDate!)
    : [];
  const dailyStats = calculateDailyReturnStats(dailyReturns);

  return {
    averageAnnualPriceReturnPct: mean(sorted.map((row) => row.priceReturnPct)),
    averageAnnualDividendYieldPct: mean(sorted.map((row) => row.dividendYieldPct)),
    averageAnnualCashTotalReturnPct: mean(sorted.map((row) => row.cashTotalReturnPct)),
    cumulativeCashTotalReturnPct: compounded.cumulativePct,
    cashTotalReturnCagrPct: compounded.cagrPct,
    bestYear: best?.cashTotalReturnPct == null ? null : { year: best.year, returnPct: best.cashTotalReturnPct },
    worstYear: worst?.cashTotalReturnPct == null ? null : { year: worst.year, returnPct: worst.cashTotalReturnPct },
    positiveYears: cashRows.filter((row) => row.cashTotalReturnPct! > 0).length,
    usableYears: cashRows.length,
    dividendGrowthByYear: sorted.slice(1).flatMap((row, index) => {
      const prior = sorted[index];
      return prior?.dividendsPerShare != null && prior.dividendsPerShare > 0 && row.dividendsPerShare != null
        ? [{ year: row.year, growthPct: (row.dividendsPerShare / prior.dividendsPerShare - 1) * 100 }]
        : [];
    }),
    averageAnnualVooExcessPct: mean(vooExcessByYear.map((row) => row.excessReturnPct)),
    cumulativeVooExcessPct: compounded.cumulativePct != null && benchmarkCompounded.cumulativePct != null && excessCashRows.length === cashRows.length
      ? compounded.cumulativePct - benchmarkCompounded.cumulativePct
      : null,
    cagrVooExcessPct: compounded.cagrPct != null && benchmarkCompounded.cagrPct != null && excessCashRows.length === cashRows.length
      ? compounded.cagrPct - benchmarkCompounded.cagrPct
      : null,
    ...dailyStats,
  };
}

export function buildEqualWeightBasketAnnualReturns(
  annualByTicker: Readonly<Record<string, readonly AnnualTickerReturn[]>>,
  selectedTickers: readonly string[],
  startYear: number,
  endYear: number,
  currencies: Readonly<Record<string, string | null>> = {},
): BasketAnnualReturn[] {
  const rowsByTicker = new Map(Object.entries(annualByTicker).map(([ticker, rows]) => [ticker, new Map(rows.map((row) => [row.year, row]))]));
  return Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, offset) => {
    const year = startYear + offset;
    const rows = selectedTickers.flatMap((ticker) => {
      const row = rowsByTicker.get(ticker)?.get(year);
      return row ? [{ ticker, row }] : [];
    });
    const contributors = rows.filter(({ row }) => row.cashTotalReturnPct != null);
    const currenciesWithDps = [...new Set(rows.filter(({ row }) => row.dividendsPerShare != null).map(({ ticker }) => currencies[ticker] ?? null))];
    const compatibleDps = currenciesWithDps.length === 1;
    const dpsRows = rows.filter(({ row }) => row.dividendsPerShare != null);
    const validRows = contributors.map(({ row }) => row);
    const startDates = validRows.flatMap((row) => row.startDate ? [row.startDate] : []);
    const endDates = validRows.flatMap((row) => row.endDate ? [row.endDate] : []);
    const holdingsWithUsableData = contributors.length;
    const partial = holdingsWithUsableData < selectedTickers.length;
    const status = holdingsWithUsableData === 0 ? "no usable data" : partial ? "partial" : "complete";
    return {
      year,
      startDate: startDates.length ? startDates.sort().at(-1)! : null,
      endDate: endDates.length ? endDates.sort()[0] : null,
      priceReturnPct: mean(rows.map(({ row }) => row.priceReturnPct)),
      dividendYieldPct: mean(rows.map(({ row }) => row.dividendYieldPct)),
      cashTotalReturnPct: mean(rows.map(({ row }) => row.cashTotalReturnPct)),
      dividendsPerShare: compatibleDps ? mean(dpsRows.map(({ row }) => row.dividendsPerShare)) : null,
      dividendsCurrency: compatibleDps ? currenciesWithDps[0] : null,
      holdingsWithUsableData,
      weightCoveragePct: selectedTickers.length === 0 ? 0 : holdingsWithUsableData / selectedTickers.length * 100,
      partial,
      status,
    };
  });
}

export function summarizeBasketReturns(
  rows: readonly BasketAnnualReturn[],
  histories: Readonly<Record<string, TickerHistory>>,
  selectedTickers: readonly string[],
): BasketReturnSummary {
  const compounded = compoundAnnualRows(rows);
  const cashRows = rows.filter((row) => row.cashTotalReturnPct != null);
  const best = cashRows.reduce<BasketAnnualReturn | null>((current, row) => current == null || row.cashTotalReturnPct! > current.cashTotalReturnPct! ? row : current, null);
  const worst = cashRows.reduce<BasketAnnualReturn | null>((current, row) => current == null || row.cashTotalReturnPct! < current.cashTotalReturnPct! ? row : current, null);
  const firstDate = compounded.usable[0]?.startDate;
  const lastDate = compounded.usable.at(-1)?.endDate;
  const dateReturns = new Map<string, number[]>();
  if (compounded.cumulativePct != null && firstDate && lastDate) {
    for (const ticker of selectedTickers) {
      const history = histories[ticker];
      if (!history) continue;
      for (const item of calculateDailyCashReturns(history, firstDate, lastDate)) {
        dateReturns.set(item.date, [...(dateReturns.get(item.date) ?? []), item.returnPct]);
      }
    }
  }
  const basketDaily = [...dateReturns.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([, values]) => ({ returnPct: values.reduce((sum, value) => sum + value, 0) / values.length }));
  const dailyStats = calculateDailyReturnStats(basketDaily);
  return {
    averageAnnualPriceReturnPct: mean(rows.map((row) => row.priceReturnPct)),
    averageAnnualDividendYieldPct: mean(rows.map((row) => row.dividendYieldPct)),
    averageAnnualCashTotalReturnPct: mean(rows.map((row) => row.cashTotalReturnPct)),
    cumulativeCashTotalReturnPct: compounded.cumulativePct,
    cashTotalReturnCagrPct: compounded.cagrPct,
    bestYear: best?.cashTotalReturnPct == null ? null : { year: best.year, returnPct: best.cashTotalReturnPct },
    worstYear: worst?.cashTotalReturnPct == null ? null : { year: worst.year, returnPct: worst.cashTotalReturnPct },
    positiveYears: cashRows.filter((row) => row.cashTotalReturnPct! > 0).length,
    ...dailyStats,
  };
}
