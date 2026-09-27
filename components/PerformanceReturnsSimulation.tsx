"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSimulationForecasts,
  runTenYearSimulation,
  SIMULATION_END_YEAR,
  SIMULATION_FX_CASES_PCT,
  SIMULATION_MONTHLY_DCA_IDR,
  SIMULATION_WITHHOLDING_CASES_PCT,
  type SimulationAnnualSnapshot,
  type SimulationForecast,
  type SimulationMarketQuote,
  type SimulationUniverseTicker,
} from "@/lib/performanceSimulation";
import { PORTFOLIO_BUCKETS, PORTFOLIO_BUCKET_LABELS, type PortfolioBucket } from "@/lib/portfolioBuckets";
import { reducePortfolioLedger, type LedgerTransaction } from "@/lib/portfolioLedger";
import { buildTickerAnnualReturns, type TickerHistory } from "@/lib/performanceReturns";

interface Props {
  universe: readonly SimulationUniverseTicker[];
  transactions: readonly LedgerTransaction[] | undefined;
  portfolioDataReady: boolean;
  portfolioError: string;
}

interface SimulationMarketData {
  quotes: Record<string, SimulationMarketQuote>;
  asOfDate: string | null;
  source: string;
  fetchedAt: string;
}

interface SimulationHistoryData {
  histories: TickerHistory[];
  source: string;
  asOfDate: string | null;
  fetchedAt: string;
}

function formatPct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatUsd(value: number | null | undefined, compact = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard", compactDisplay: "short",
  }).format(value);
}

function formatIdr(value: number | null | undefined, compact = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
    compactDisplay: "short",
  }).format(value)}`;
}

function formatShares(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 5 });
}

function bucketName(bucket: PortfolioBucket | "other") {
  return bucket === "other" ? "Other" : PORTFOLIO_BUCKET_LABELS[bucket];
}

function bucketColor(bucket: PortfolioBucket | "other") {
  return bucket === "longterm" ? "#0ea5e9" : bucket === "index" ? "#8b5cf6" : bucket === "treasury" ? "#10b981" : "#64748b";
}

function ProjectionLineChart({
  title,
  description,
  labels,
  series,
  formatValue,
}: {
  title: string;
  description: string;
  labels: readonly string[];
  series: readonly { label: string; color: string; values: readonly (number | null)[] }[];
  formatValue: (value: number) => string;
}) {
  const allValues = series.flatMap((item) => item.values.filter((value): value is number => value != null && Number.isFinite(value)));
  if (allValues.length === 0) return null;
  const width = 640;
  const height = 210;
  const left = 60;
  const right = 16;
  const top = 15;
  const bottom = 30;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(1, max - min);
  const x = (index: number) => left + (labels.length <= 1 ? 0 : index * (width - left - right) / (labels.length - 1));
  const y = (value: number) => top + (max - value) / span * (height - top - bottom);
  const ticks = [max, (max + min) / 2, min];
  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <p className="mt-1 text-[11px] text-gray-500">{description}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full" role="img" aria-label={`${title}. Exact values are listed in the annual simulation table.`}>
        <title>{title}</title>
        {ticks.map((tick, index) => <g key={index}>
          <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" />
          <text x={left - 7} y={y(tick) + 4} textAnchor="end" fill="#6b7280" fontSize="10">{formatValue(tick)}</text>
        </g>)}
        {series.map((item) => {
          const points = item.values.flatMap((value, index) => value == null ? [] : [`${x(index)},${y(value)}`]);
          return points.length > 0 ? <polyline key={item.label} points={points.join(" ")} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null;
        })}
        {labels.map((label, index) => labels.length <= 8 || index % 2 === 0 || index === labels.length - 1
          ? <text key={`${label}-${index}`} x={x(index)} y={height - 8} textAnchor="middle" fill="#6b7280" fontSize="10">{label}</text>
          : null)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600" aria-hidden="true">
        {series.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><i className="h-2 w-3 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}</span>)}
      </div>
    </section>
  );
}

function AllocationChart({ snapshots }: { snapshots: readonly SimulationAnnualSnapshot[] }) {
  const buckets: (PortfolioBucket | "other")[] = [...PORTFOLIO_BUCKETS, "other"];
  const maximum = Math.max(1, ...snapshots.map((snapshot) => snapshot.valueUsd));
  const width = 720;
  const height = 190;
  const left = 24;
  const right = 14;
  const top = 12;
  const bottom = 27;
  const plotHeight = height - top - bottom;
  const groupWidth = snapshots.length > 0 ? (width - left - right) / snapshots.length : 0;
  const barWidth = Math.max(7, Math.min(32, groupWidth * 0.62));
  if (snapshots.length === 0) return null;
  return <section className="surface-card p-4">
    <h3 className="text-sm font-bold text-gray-900">Projected allocation by portfolio bucket</h3>
    <p className="mt-1 text-[11px] text-gray-500">Year-end model estimate in USD. SGOV and current unallocated cash are grouped under Treasury.</p>
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full" role="img" aria-label="Projected portfolio allocation by bucket from 2026 through 2036. Exact bucket values are listed in the annual table.">
      <title>Projected allocation by portfolio bucket</title>
      {[0, 0.5, 1].map((portion) => {
        const yy = top + plotHeight * portion;
        return <line key={portion} x1={left} x2={width - right} y1={yy} y2={yy} stroke="#e5e7eb" />;
      })}
      {snapshots.map((snapshot, index) => {
        let used = 0;
        const x0 = left + groupWidth * index + (groupWidth - barWidth) / 2;
        return <g key={snapshot.year}>
          {buckets.map((bucket) => {
            const value = snapshot.bucketValuesUsd[bucket] ?? 0;
            const barHeight = Math.max(0, value / maximum * plotHeight);
            const y0 = top + plotHeight - used - barHeight;
            used += barHeight;
            return value > 0 ? <rect key={bucket} x={x0} y={y0} width={barWidth} height={barHeight} fill={bucketColor(bucket)}><title>{`${snapshot.year} ${bucketName(bucket)}: ${formatUsd(value)}`}</title></rect> : null;
          })}
          {index % 2 === 0 || index === snapshots.length - 1 ? <text x={x0 + barWidth / 2} y={height - 7} textAnchor="middle" fill="#6b7280" fontSize="10">{snapshot.year}</text> : null}
        </g>;
      })}
    </svg>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600" aria-hidden="true">
      {buckets.map((bucket) => <span key={bucket} className="inline-flex items-center gap-1.5"><i className="h-2 w-3 rounded-sm" style={{ backgroundColor: bucketColor(bucket) }} />{bucketName(bucket)}</span>)}
    </div>
  </section>;
}

function SummaryCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return <div className="surface-card min-w-0 p-3.5"><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 truncate text-lg font-bold text-gray-900">{value}</div>{subtext ? <div className="mt-0.5 text-[10px] leading-4 text-gray-400">{subtext}</div> : null}</div>;
}

function ForecastTable({
  universe,
  forecasts,
  histories,
  asOfDate,
  fallbacks,
  onFallbackChange,
}: {
  universe: readonly SimulationUniverseTicker[];
  forecasts: readonly SimulationForecast[];
  histories: Readonly<Record<string, TickerHistory>>;
  asOfDate: string;
  fallbacks: Readonly<Record<string, number | null | undefined>>;
  onFallbackChange: (ticker: string, value: string) => void;
}) {
  const forecastByTicker = new Map(forecasts.map((forecast) => [forecast.ticker, forecast]));
  const currentYear = Number(asOfDate.slice(0, 4));
  const ytdPriceByTicker = new Map(universe.map((item) => {
    const history = histories[item.ticker];
    const ytd = history ? buildTickerAnnualReturns(history, currentYear, currentYear, asOfDate)[0]?.priceReturnPct ?? null : null;
    return [item.ticker, ytd];
  }));
  return <div className="overflow-x-auto">
    <table className="min-w-full text-left text-[11px]">
      <thead className="bg-gray-50 text-[9px] uppercase tracking-wide text-gray-500"><tr>
        <th className="sticky left-0 z-10 min-w-44 bg-gray-50 px-3 py-2">Ticker / role</th><th className="whitespace-nowrap px-2 py-2">Data years</th><th className="whitespace-nowrap px-2 py-2">Long CAGR</th><th className="whitespace-nowrap px-2 py-2">Recent CAGR</th><th className="whitespace-nowrap px-2 py-2">Trimmed mean</th><th className="whitespace-nowrap px-2 py-2">VOO anchor</th><th className="whitespace-nowrap px-2 py-2">Actual 2026 YTD price</th><th className="whitespace-nowrap px-2 py-2">Forecast price</th><th className="whitespace-nowrap px-2 py-2">Gross dividend yield</th><th className="whitespace-nowrap px-2 py-2">Forecast total return</th><th className="min-w-56 px-3 py-2">Input status / fallback</th>
      </tr></thead>
      <tbody className="divide-y divide-gray-100">{universe.map((item) => {
        const forecast = forecastByTicker.get(item.ticker);
        const unavailable = forecast?.forecastDividendYieldPct == null;
        return <tr key={item.ticker} className="align-top hover:bg-gray-50">
          <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-2.5"><span className="font-mono font-bold text-gray-900">{item.ticker}</span><span className="block max-w-44 truncate text-[10px] font-normal text-gray-500">{item.name ?? bucketName(item.bucket)}</span></th>
          <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{forecast?.observations ?? 0} · {forecast?.confidence ?? "unavailable"}</td>
          <td className="whitespace-nowrap px-2 py-2.5">{formatPct(forecast?.longWindowPriceCagrPct)}</td>
          <td className="whitespace-nowrap px-2 py-2.5">{formatPct(forecast?.recentPriceCagrPct)}</td>
          <td className="whitespace-nowrap px-2 py-2.5">{formatPct(forecast?.trimmedMeanPriceReturnPct)}</td>
          <td className="whitespace-nowrap px-2 py-2.5">{forecast?.benchmarkTotalReturnPct == null ? (item.ticker === "VOO" ? "Self" : "—") : formatPct(forecast.benchmarkTotalReturnPct)}{forecast?.shrunkTowardVoo ? " · shrunk" : ""}{forecast?.capped ? " · capped" : ""}</td>
          <td className="whitespace-nowrap px-2 py-2.5 text-blue-700">{formatPct(ytdPriceByTicker.get(item.ticker))}</td>
          <td className="whitespace-nowrap px-2 py-2.5 font-semibold">{formatPct(forecast?.forecastPriceReturnPct)}</td>
          <td className="whitespace-nowrap px-2 py-2.5">{formatPct(forecast?.forecastDividendYieldPct)}</td>
          <td className="whitespace-nowrap px-2 py-2.5 font-semibold">{formatPct(forecast?.forecastTotalReturnPct)}</td>
          <td className="px-3 py-2.5 text-gray-600">
            <div>{forecast?.status ?? "Waiting for historical data"}</div>
            {unavailable ? <label className="mt-1.5 block text-[10px] font-semibold text-amber-800">Enter explicit fallback yield (% gross)
              <input type="number" min="0" max="100" step="0.01" value={fallbacks[item.ticker] ?? ""} onChange={(event) => onFallbackChange(item.ticker, event.target.value)} aria-label={`${item.ticker} fallback dividend yield percent`} className="mt-1 block w-28 rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-900" />
            </label> : null}
          </td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

export default function PerformanceReturnsSimulation({ universe, transactions, portfolioDataReady, portfolioError }: Props) {
  const [historyData, setHistoryData] = useState<SimulationHistoryData | null>(null);
  const [marketData, setMarketData] = useState<SimulationMarketData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [failedRequestKey, setFailedRequestKey] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [fxGrowthPct, setFxGrowthPct] = useState<number>(3);
  const [withholdingPct, setWithholdingPct] = useState<number>(0);
  const [monthlyDcaIdr, setMonthlyDcaIdr] = useState<number>(SIMULATION_MONTHLY_DCA_IDR);
  const [fallbacks, setFallbacks] = useState<Record<string, number | null>>({});

  const ledgerData = useMemo(() => {
    if (!transactions) return { state: null, error: "" };
    try {
      return { state: reducePortfolioLedger(transactions), error: "" };
    } catch (error) {
      return { state: null, error: error instanceof Error ? error.message : "Portfolio ledger could not be reduced." };
    }
  }, [transactions]);
  const ledgerPositions = useMemo(() => ledgerData.state == null ? [] : PORTFOLIO_BUCKETS.flatMap((bucket) =>
    Object.values(ledgerData.state!.buckets[bucket].positions).map((position) => ({
      ticker: position.ticker.toUpperCase(),
      bucket,
      quantity: position.quantity,
      costBasisUsd: position.costBasisUsd,
    })),
  ), [ledgerData.state]);
  const resolvedUniverse = useMemo(() => {
    const byTicker = new Map<string, SimulationUniverseTicker>();
    for (const item of universe) byTicker.set(item.ticker.toUpperCase(), { ...item, ticker: item.ticker.toUpperCase() });
    for (const position of ledgerPositions) {
      byTicker.set(position.ticker, byTicker.get(position.ticker) ?? { ticker: position.ticker, name: null, bucket: position.bucket });
    }
    const funds: SimulationUniverseTicker[] = [
      { ticker: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", bucket: "treasury" },
      { ticker: "VXUS", name: "Vanguard Total International Stock ETF", bucket: "index" },
      { ticker: "VOO", name: "Vanguard S&P 500 ETF", bucket: "index" },
    ];
    for (const fund of funds) byTicker.set(fund.ticker, byTicker.get(fund.ticker) ?? fund);
    return [...byTicker.values()].sort((left, right) => left.ticker.localeCompare(right.ticker));
  }, [ledgerPositions, universe]);
  const universeKey = resolvedUniverse.map((item) => item.ticker).join(",");
  const requestKey = `${universeKey}#${refreshToken}`;
  const universeTooLarge = resolvedUniverse.length > 39;
  const requestError = failedRequestKey === requestKey ? loadError : "";
  const dataReady = loadedRequestKey === requestKey;
  const loading = !portfolioDataReady || transactions == null || (!universeTooLarge && !dataReady && !requestError);

  useEffect(() => {
    if (!portfolioDataReady || transactions == null || !ledgerData.state || resolvedUniverse.length === 0) return;
    if (universeTooLarge) return;
    let cancelled = false;
    const controller = new AbortController();
    const tickers = resolvedUniverse.map((item) => item.ticker);
    const historyQuery = new URLSearchParams({ tickers: tickers.join(",") });
    const marketQuery = new URLSearchParams({ tickers: tickers.join(",") });
    if (refreshToken > 0) historyQuery.set("refresh", "1");
    void Promise.all([
      fetch(`/api/performance-returns?${historyQuery.toString()}`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/performance-simulation?${marketQuery.toString()}`, { cache: "no-store", signal: controller.signal }),
    ]).then(async ([historyResponse, marketResponse]) => {
      const [historyJson, marketJson] = await Promise.all([historyResponse.json(), marketResponse.json()]);
      if (!historyResponse.ok) throw new Error(historyJson.error ?? "Historical simulation inputs could not be loaded.");
      if (!marketResponse.ok) throw new Error(marketJson.error ?? "Current market closes could not be loaded.");
      if (cancelled) return;
      setHistoryData(historyJson as SimulationHistoryData);
      setMarketData(marketJson as SimulationMarketData);
      setLoadError("");
      setFailedRequestKey("");
      setLoadedRequestKey(requestKey);
    }).catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === "AbortError")) return;
      setLoadError(error instanceof Error ? error.message : "Simulation inputs could not be loaded.");
      setFailedRequestKey(requestKey);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [ledgerData.state, portfolioDataReady, refreshToken, requestKey, resolvedUniverse, transactions, universeTooLarge]);

  const historiesByTicker = useMemo(() => Object.fromEntries((historyData?.histories ?? []).map((history) => [history.ticker.toUpperCase(), history])), [historyData]);
  const forecastInputs = useMemo(() => buildSimulationForecasts(
    historiesByTicker,
    resolvedUniverse,
    marketData?.asOfDate ?? `${new Date().getFullYear()}-12-31`,
    fallbacks,
  ), [fallbacks, historiesByTicker, marketData?.asOfDate, resolvedUniverse]);
  const simulation = useMemo(() => {
    if (!dataReady || !marketData?.asOfDate || !ledgerData.state) return null;
    return runTenYearSimulation({
      asOfDate: marketData.asOfDate,
      endYear: SIMULATION_END_YEAR,
      startingPositions: ledgerPositions,
      quotes: marketData.quotes,
      fxSpotUsdIdr: marketData.quotes["IDR=X"]?.price ?? null,
      unallocatedCashUsd: ledgerData.state.total.cash.USD,
      unallocatedCashIdr: ledgerData.state.total.cash.IDR,
      forecasts: forecastInputs,
      requiredForecastTickers: resolvedUniverse.map((item) => item.ticker),
      monthlyDcaIdr,
      annualFxGrowthPct: fxGrowthPct,
      dividendWithholdingPct: withholdingPct,
    });
  }, [dataReady, forecastInputs, fxGrowthPct, ledgerData.state, ledgerPositions, marketData, monthlyDcaIdr, resolvedUniverse, withholdingPct]);
  const forecastByTicker = useMemo(() => new Map(forecastInputs.map((forecast) => [forecast.ticker, forecast])), [forecastInputs]);
  const actualStartingValueUsd = useMemo(() => {
    const fx = marketData?.quotes["IDR=X"]?.price;
    if (!ledgerData.state || fx == null || fx <= 0) return null;
    const positionValues = ledgerPositions.map((position) => {
      const price = marketData?.quotes[position.ticker]?.price;
      return price == null || price <= 0 ? null : price * position.quantity;
    });
    if (positionValues.some((value) => value == null)) return null;
    return positionValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      + ledgerData.state.total.cash.USD + ledgerData.state.total.cash.IDR / fx;
  }, [ledgerData.state, ledgerPositions, marketData]);
  const onFallbackChange = (ticker: string, rawValue: string) => {
    const value = rawValue === "" ? null : Number(rawValue);
    setFallbacks((current) => ({ ...current, [ticker]: value }));
  };

  if (!portfolioDataReady || transactions == null) {
    return <section className="surface-card p-5"><h2 className="text-lg font-bold text-gray-900">10-Year Simulation</h2><p className="mt-2 text-sm text-gray-600">{portfolioError || (loading ? "Loading the current portfolio ledger…" : "The current portfolio ledger could not be loaded.")}</p></section>;
  }
  if (ledgerData.error) return <section className="surface-card border border-red-200 p-5"><h2 className="text-lg font-bold text-gray-900">Portfolio ledger unavailable</h2><p className="mt-2 text-sm text-red-700">{ledgerData.error}</p></section>;
  if (!ledgerData.state) return <section className="surface-card p-5"><h2 className="text-lg font-bold text-gray-900">Portfolio ledger unavailable</h2><p className="mt-2 text-sm text-gray-600">The ledger has not loaded yet.</p></section>;
  const actualLedgerState = ledgerData.state;

  const endSnapshot = simulation?.annualSnapshots.at(-1);
  const chartLabels = simulation?.asOfSnapshot && endSnapshot
    ? ["As-of", ...simulation.annualSnapshots.map((snapshot) => `${snapshot.year}E`)]
    : [];
  const chartSnapshots = simulation?.asOfSnapshot && endSnapshot ? [simulation.asOfSnapshot, ...simulation.annualSnapshots] : [];
  const inputCount = resolvedUniverse.length;
  const unresolvedDividends = forecastInputs.filter((item) => item.forecastDividendYieldPct == null).length;

  return <div className="space-y-4">
    <section className="surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Planning model · not a prediction</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">10-Year Simulation</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">The as-of row uses ledger shares and latest completed closes. Forecasts begin after that value, so 2026 YTD is context only and is not applied again. Contributions are shown separately from investment growth.</p>
        </div>
        <button type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading} className="btn btn-secondary">{loading ? "Loading inputs…" : "Refresh inputs"}</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold text-gray-600">USD/IDR annual growth<select value={fxGrowthPct} onChange={(event) => setFxGrowthPct(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800">{SIMULATION_FX_CASES_PCT.map((value) => <option key={value} value={value}>{value}% per year</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-600">Dividend withholding<select value={withholdingPct} onChange={(event) => setWithholdingPct(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800">{SIMULATION_WITHHOLDING_CASES_PCT.map((value) => <option key={value} value={value}>{value === 0 ? "0% · gross cash" : `${value}%`}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-600">Monthly VOO contribution (IDR)<input type="number" min="0" step="100000" value={monthlyDcaIdr} onChange={(event) => setMonthlyDcaIdr(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800" /></label>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600"><span className="font-semibold text-gray-800">Market close</span><br />{marketData?.asOfDate ?? "Awaiting quotes"}<br />USD/IDR {formatShares(marketData?.quotes["IDR=X"]?.price)} · {marketData?.quotes["IDR=X"]?.marketDate ?? "—"}</div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600"><span className="font-semibold text-gray-800">Forecast coverage</span><br />{inputCount} symbols · {unresolvedDividends} dividend fallback(s) needed<br />{dataReady ? `${marketData?.source ?? "Yahoo Finance daily closes"} · ${historyData?.source ?? "Yahoo Finance history"}` : "Yahoo Finance history and daily closes"}</div>
      </div>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">The default 3% annual USD/IDR increase is a provisional planning assumption, not a prediction. At 0% withholding, the view shows a gross-cash scenario. Tax sensitivity applies to cash dividends from non-SGOV holdings; SGOV distributions stay in their separate compounding sleeve. Unallocated cash is explicitly mapped into that SGOV Treasury sleeve at the current USD/IDR rate.</p>
      {portfolioError ? <p role="status" className="mt-2 text-xs text-amber-800">{portfolioError}</p> : null}
      {universeTooLarge ? <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">The simulation is limited to 39 tickers. Reduce the current portfolio universe before loading forecasts.</p> : null}
      {requestError ? <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{requestError}</p> : null}
      <div className="mt-3 rounded-xl border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-bold text-gray-900">Resolved simulation universe</h2><p className="mt-0.5 text-xs text-gray-500">{inputCount} names from the current portfolio buckets, current ledger positions, and the three seeded funds. This list is read-only for this first simulation version.</p></div><span className="text-xs font-semibold text-gray-600">{inputCount} symbols</span></div>
        <div className="mt-3 flex flex-wrap gap-2">{resolvedUniverse.map((item) => <span key={item.ticker} title={`${item.name ?? item.ticker} · ${bucketName(item.bucket)}`} className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800"><span className="font-mono font-semibold">{item.ticker}</span><span className="text-indigo-500">{bucketName(item.bucket)}</span></span>)}</div>
      </div>
    </section>

    {loading ? <section className="surface-card p-5"><p className="text-sm text-gray-600">Loading historical prices, dividend events, and completed market closes for the resolved universe…</p></section> : null}

    {simulation?.status === "blocked" ? <section className="surface-card border border-amber-200 p-4 sm:p-5"><h2 className="text-sm font-bold text-gray-900">Simulation needs usable inputs</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">{simulation.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul><p className="mt-2 text-xs text-gray-600">For missing dividend history, enter an explicit gross yield fallback in the forecast table below. Missing market closes remain blocked until current quotes are available.</p></section> : null}

    {simulation?.warnings.length ? <section className="surface-card border border-amber-200 px-4 py-3 text-xs text-amber-900"><strong>Market data warnings:</strong> {simulation.warnings.join(" · ")}</section> : null}

    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Starting portfolio · actual ledger values</h2><p className="mt-1 text-xs text-gray-500">Current market value includes unrealized gains or losses. Cost basis covers securities in the ledger; cash has no security cost basis. Current cash is shown and mapped into SGOV for the model.</p></div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Starting market value" value={formatUsd(actualStartingValueUsd)} subtext={simulation?.asOfSnapshot ? `${formatIdr(simulation.asOfSnapshot.valueIdr, true)} at current FX` : "Current ledger value at latest close"} />
        <SummaryCard label="Ledger cost basis" value={formatUsd(simulation?.startingCostBasisUsd)} />
        <SummaryCard label="Current unrealized gain / loss" value={formatUsd(simulation?.startingUnrealizedUsd)} />
        <SummaryCard label="Unallocated cash" value={formatUsd(actualLedgerState.total.cash.USD + actualLedgerState.total.cash.IDR / (marketData?.quotes["IDR=X"]?.price ?? 1))} subtext={`${formatUsd(actualLedgerState.total.cash.USD)} + ${formatIdr(actualLedgerState.total.cash.IDR)}`} />
      </div>
      <div className="overflow-x-auto border-t border-gray-100"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Starting holding</th><th className="px-3 py-2">Bucket</th><th className="px-3 py-2">Shares</th><th className="px-3 py-2">Market close</th><th className="px-3 py-2">Market value</th><th className="px-3 py-2">Starting weight</th><th className="px-3 py-2">Cost basis</th><th className="px-3 py-2">Unrealized</th><th className="px-3 py-2">Quote date</th></tr></thead><tbody className="divide-y divide-gray-100">
        {ledgerPositions.map((position) => {
          const quote = marketData?.quotes[position.ticker];
          const marketValue = quote?.price != null ? quote.price * position.quantity : null;
          return <tr key={`${position.bucket}-${position.ticker}`}><th scope="row" className="px-3 py-2 font-mono font-semibold">{position.ticker}</th><td className="px-3 py-2">{PORTFOLIO_BUCKET_LABELS[position.bucket]}</td><td className="px-3 py-2">{formatShares(position.quantity)}</td><td className="px-3 py-2">{formatUsd(quote?.price)}</td><td className="px-3 py-2">{formatUsd(marketValue)}</td><td className="px-3 py-2">{actualStartingValueUsd && marketValue != null ? formatPct(marketValue / actualStartingValueUsd * 100) : "—"}</td><td className="px-3 py-2">{formatUsd(position.costBasisUsd)}</td><td className={`px-3 py-2 font-semibold ${marketValue == null ? "text-gray-400" : marketValue >= position.costBasisUsd ? "text-emerald-700" : "text-red-700"}`}>{formatUsd(marketValue == null ? null : marketValue - position.costBasisUsd)}</td><td className="px-3 py-2">{quote?.marketDate ?? "—"}</td></tr>;
        })}
        <tr className="bg-emerald-50/60"><th scope="row" className="px-3 py-2 font-semibold">Unallocated cash → SGOV</th><td className="px-3 py-2">Treasury model sleeve</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2">{formatUsd(actualLedgerState.total.cash.USD + actualLedgerState.total.cash.IDR / (marketData?.quotes["IDR=X"]?.price ?? 1))}</td><td className="px-3 py-2">{actualStartingValueUsd && marketData?.quotes["IDR=X"]?.price != null ? formatPct((actualLedgerState.total.cash.USD + actualLedgerState.total.cash.IDR / marketData.quotes["IDR=X"].price) / actualStartingValueUsd * 100) : "—"}</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2">{marketData?.quotes["IDR=X"]?.marketDate ?? "—"}</td></tr>
        </tbody></table></div>
    </section>

    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Historical forecast inputs and actual YTD context</h2><p className="mt-1 text-xs leading-5 text-gray-500">Uses complete years only: 50% long-window price CAGR + 30% recent price CAGR + 20% trimmed annual mean. Individual stock pre-tax total returns are shrunk 60% toward VOO then bounded from −20% to +25%. Funds use their own estimate; SGOV uses its dividend yield as the cash sleeve rate. Dividend yields are separate cash inputs and are not added to stock price returns twice.</p></div>
      {dataReady && historyData && marketData?.asOfDate ? <ForecastTable universe={resolvedUniverse} forecasts={forecastInputs} histories={historiesByTicker} asOfDate={marketData.asOfDate} fallbacks={fallbacks} onFallbackChange={onFallbackChange} /> : <p className="p-4 text-xs text-gray-500">Forecast inputs will appear after history and market data load.</p>}
      <p className="border-t border-gray-100 px-4 py-3 text-[10px] leading-5 text-gray-500">Annual windows use up to ten and five trailing complete calendar years. Dividend yield is the median of up to five complete annual yields. Forecast methods and guardrails are planning assumptions, not predictions; fees, inflation, and tax filing treatment are not modeled. The displayed forecast total return is pre-tax; selected withholding changes monthly cash flows from non-SGOV holdings. SGOV growth remains separate in the portfolio bridge.</p>
    </section>

    {simulation?.status === "ready" && endSnapshot ? <>
      <section aria-label="Simulation summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Current starting value" value={formatUsd(simulation.startingValueUsd)} subtext={simulation.asOfSnapshot?.date} />
        <SummaryCard label="2036 model value · USD" value={formatUsd(endSnapshot.valueUsd, true)} subtext="Forecast / model estimate" />
        <SummaryCard label="2036 model value · IDR" value={formatIdr(endSnapshot.valueIdr, true)} subtext={`USD/IDR ${formatShares(endSnapshot.fxUsdIdr)}`} />
        <SummaryCard label="DCA principal through 2036" value={formatIdr(simulation.totalDcaPrincipalIdr, true)} subtext={`${formatUsd(simulation.totalDcaPrincipalUsd, true)} converted contribution value`} />
        <SummaryCard label="Investment growth · excludes DCA" value={formatUsd(simulation.investmentGrowthExcludingDcaUsd, true)} />
        <SummaryCard label="Net dividends swept to SGOV" value={formatUsd(simulation.cumulativeNetDividendsUsd, true)} subtext={`Withholding case: ${withholdingPct}%`} />
        <SummaryCard label="2036 SGOV balance" value={formatUsd(simulation.endingSgovBalanceUsd, true)} subtext="Includes mapped starting cash and swept dividends" />
        <SummaryCard label="2036 VOO value from DCA" value={formatUsd(simulation.endingVooDcaValueUsd, true)} subtext="DCA shares tracked separately from existing VOO" />
        <SummaryCard label="Cumulative FX translation" value={formatIdr(simulation.cumulativeFxTranslationIdr, true)} subtext={`${fxGrowthPct}% annual USD/IDR planning assumption`} />
        <SummaryCard label="2036 USD/IDR estimate" value={formatShares(endSnapshot.fxUsdIdr)} subtext="Monthly interpolated planning path" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ProjectionLineChart title="Portfolio value and contributed capital" description="Ending portfolio value versus starting market value plus cumulative VOO contribution principal, in USD." labels={chartLabels} series={[
          { label: "Portfolio value", color: "#4f46e5", values: chartSnapshots.map((item) => item.valueUsd) },
          { label: "Starting value + DCA", color: "#94a3b8", values: chartSnapshots.map((item) => (simulation.startingValueUsd ?? 0) + item.cumulativeDcaUsd) },
        ]} formatValue={(value) => formatUsd(value, true)} />
        <ProjectionLineChart title="SGOV and cumulative net dividends" description="SGOV includes current unallocated cash, retained SGOV distributions, and net dividends swept from other holdings." labels={chartLabels} series={[
          { label: "SGOV balance", color: "#059669", values: chartSnapshots.map((item) => item.sgovBalanceUsd) },
          { label: "Cumulative swept dividends", color: "#f59e0b", values: chartSnapshots.map((item) => item.cumulativeNetDividendsUsd) },
        ]} formatValue={(value) => formatUsd(value, true)} />
        <AllocationChart snapshots={simulation.annualSnapshots} />
        <ProjectionLineChart title="USD vs IDR value path" description="Indexed to 100 at the as-of value. The difference shows the effect of the projected FX path while future contributions remain fixed in nominal rupiah." labels={chartLabels} series={[
          { label: "USD portfolio index", color: "#2563eb", values: chartSnapshots.map((item) => (simulation.startingValueUsd ? item.valueUsd / simulation.startingValueUsd * 100 : 100)) },
          { label: "IDR portfolio index", color: "#dc2626", values: chartSnapshots.map((item) => (simulation.asOfSnapshot?.valueIdr ? item.valueIdr / simulation.asOfSnapshot.valueIdr * 100 : 100)) },
        ]} formatValue={(value) => `${value.toFixed(0)}`} />
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Annual model bridge · 2026E–2036E</h2><p className="mt-1 text-xs text-gray-500">USD ending value reconciles to opening value + DCA + price growth + SGOV growth + net dividends. IDR FX translation is the residual after translating those USD changes at year-end FX.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-[11px]"><thead className="bg-gray-50 text-[9px] uppercase tracking-wide text-gray-500"><tr><th className="whitespace-nowrap px-3 py-2">Year</th><th className="whitespace-nowrap px-3 py-2">Beginning USD</th><th className="whitespace-nowrap px-3 py-2">DCA · IDR</th><th className="whitespace-nowrap px-3 py-2">DCA · USD</th><th className="whitespace-nowrap px-3 py-2">Price growth</th><th className="whitespace-nowrap px-3 py-2">Gross dividends</th><th className="whitespace-nowrap px-3 py-2">Tax withheld</th><th className="whitespace-nowrap px-3 py-2">Net dividends swept</th><th className="whitespace-nowrap px-3 py-2">SGOV growth</th><th className="whitespace-nowrap px-3 py-2">Investment growth</th><th className="whitespace-nowrap px-3 py-2">FX translation · IDR</th><th className="whitespace-nowrap px-3 py-2">Ending USD</th><th className="whitespace-nowrap px-3 py-2">Ending IDR</th><th className="whitespace-nowrap px-3 py-2">USD/IDR</th><th className="min-w-64 px-3 py-2">Ending allocation</th><th className="whitespace-nowrap px-3 py-2">Reconcile</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{simulation.annualSnapshots.map((row) => <tr key={row.year} className="align-top hover:bg-gray-50"><th scope="row" className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">{row.year}E</th><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.beginningValueUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatIdr(row.dcaContributionIdr)}</td><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.dcaContributionUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.priceGrowthUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.grossDividendsUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.taxWithheldUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.netDividendsSweptUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatUsd(row.sgovGrowthUsd)}</td><td className="whitespace-nowrap px-3 py-2 font-semibold">{formatUsd(row.investmentGrowthUsd)}</td><td className="whitespace-nowrap px-3 py-2">{formatIdr(row.fxTranslationIdr)}</td><td className="whitespace-nowrap px-3 py-2 font-semibold">{formatUsd(row.valueUsd)}</td><td className="whitespace-nowrap px-3 py-2 font-semibold">{formatIdr(row.valueIdr)}</td><td className="whitespace-nowrap px-3 py-2">{formatShares(row.fxUsdIdr)}</td><td className="min-w-64 px-3 py-2 text-[10px] text-gray-600">{Object.entries(row.bucketValuesUsd).map(([bucket, value]) => `${bucketName(bucket as PortfolioBucket | "other")} ${formatUsd(value)} (${row.valueUsd > 0 ? ((value ?? 0) / row.valueUsd * 100).toFixed(0) : 0}%)`).join(" · ")}</td><td className={`whitespace-nowrap px-3 py-2 ${Math.abs(row.reconciliationErrorUsd) < 0.01 ? "text-emerald-700" : "text-red-700"}`}>{formatUsd(row.reconciliationErrorUsd)}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Ticker model estimates and annual values</h2><p className="mt-1 text-xs text-gray-500">Starting shares come only from the ledger. Comparison tickers with no ledger position start at zero. VOO DCA shares are tracked separately and included in combined VOO value.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-[10px]"><thead className="sticky top-0 bg-gray-50 text-[9px] uppercase tracking-wide text-gray-500"><tr><th className="sticky left-0 z-10 min-w-36 bg-gray-50 px-3 py-2">Ticker / bucket</th><th className="whitespace-nowrap px-2 py-2">Starting value</th><th className="whitespace-nowrap px-2 py-2">Ledger shares</th><th className="whitespace-nowrap px-2 py-2">Forecast price</th><th className="whitespace-nowrap px-2 py-2">Gross yield</th><th className="whitespace-nowrap px-2 py-2">Net yield</th><th className="min-w-64 px-2 py-2">Annual dividends · gross / tax / net</th><th className="whitespace-nowrap px-2 py-2">DCA shares</th><th className="whitespace-nowrap px-2 py-2">DCA principal · IDR</th>{simulation.annualSnapshots.map((row) => <th key={row.year} className="whitespace-nowrap px-2 py-2">{row.year}E</th>)}<th className="min-w-56 px-3 py-2">Data quality</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{simulation.tickerSummaries.map((row) => {
            const forecast = forecastByTicker.get(row.ticker);
            const swept = Object.values(row.annualNetDividendsUsd).reduce((sum, value) => sum + value, 0);
            return <tr key={row.ticker} className="align-top hover:bg-gray-50"><th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-2"><span className="font-mono font-bold text-gray-900">{row.ticker}</span><span className="block max-w-36 truncate font-sans text-gray-500">{bucketName(row.bucket)}{row.name ? ` · ${row.name}` : ""}</span></th><td className="whitespace-nowrap px-2 py-2">{formatUsd(row.startingValueUsd)}</td><td className="whitespace-nowrap px-2 py-2">{formatShares(row.startingShares)}</td><td className="whitespace-nowrap px-2 py-2">{formatPct(row.forecastPriceReturnPct)}</td><td className="whitespace-nowrap px-2 py-2">{formatPct(row.grossDividendYieldPct)}</td><td className="whitespace-nowrap px-2 py-2">{formatPct(row.netDividendYieldPct)}</td><td className="px-2 py-2">{row.ticker === "SGOV" ? <span className="text-gray-500">Retained in SGOV growth</span> : <details><summary className="cursor-pointer whitespace-nowrap">Net: {formatUsd(swept)}</summary><div className="mt-1 space-y-1">{simulation.annualSnapshots.map((snapshot) => <div key={snapshot.year} className="whitespace-nowrap text-[9px] text-gray-600">{snapshot.year}E · {formatUsd(row.annualGrossDividendsUsd[snapshot.year] ?? 0)} / {formatUsd(row.annualTaxWithheldUsd[snapshot.year] ?? 0)} / {formatUsd(row.annualNetDividendsUsd[snapshot.year] ?? 0)}</div>)}</div></details>}</td><td className="whitespace-nowrap px-2 py-2">{formatShares(row.dcaShares)}</td><td className="whitespace-nowrap px-2 py-2">{formatIdr(row.dcaPrincipalIdr)}</td>{simulation.annualSnapshots.map((snapshot) => <td key={snapshot.year} className="whitespace-nowrap px-2 py-2">{formatUsd(row.annualEndingValueUsd[snapshot.year])}</td>)}<td className="min-w-56 px-3 py-2 text-gray-600">{row.ticker === "SGOV" ? "Distributions are retained in SGOV growth; not counted as swept cash." : row.status}{forecast?.dividendFallbackUsed ? " · manual dividend fallback" : ""}</td></tr>;
          })}
          <tr className="bg-gray-50 font-semibold"><th scope="row" className="sticky left-0 z-[1] bg-gray-50 px-3 py-2">Total portfolio</th><td className="px-2 py-2">{formatUsd(simulation.startingValueUsd)}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">{formatUsd(simulation.cumulativeNetDividendsUsd)}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">{formatIdr(simulation.totalDcaPrincipalIdr)}</td>{simulation.annualSnapshots.map((snapshot) => <td key={snapshot.year} className="whitespace-nowrap px-2 py-2">{formatUsd(snapshot.valueUsd)}</td>)}<td className="px-3 py-2">All ticker model estimates</td></tr>
          </tbody></table></div>
      </section>
      <p className="px-1 text-[10px] leading-5 text-gray-400">Source: Yahoo Finance daily closes and dividend events. Model estimates are nominal, use fractional VOO shares, fixed nominal monthly rupiah contributions, and no purchase fees or spread. 2026 is actual portfolio value through {simulation.asOfSnapshot?.date} plus forecast for the remaining dates. DCA begins at November 2026 month-end and continues through December 2036.</p>
    </> : null}
  </div>;
}
