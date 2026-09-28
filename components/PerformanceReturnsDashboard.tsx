"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import PerformanceReturnsFxPanel from "@/components/PerformanceReturnsFxPanel";
import PerformanceReturnsSimulation from "@/components/PerformanceReturnsSimulation";
import { getPortfolioDivisionStocks, getPortfolioLedgerTransactions, getPortfolioPerformanceSnapshots } from "@/lib/firestore";
import {
  buildEqualWeightBasketAnnualReturns,
  buildAnnualUsdIdrChanges,
  buildTickerAnnualReturns,
  buildVooExcessReturns,
  summarizeBasketReturns,
  summarizeUsdIdrChanges,
  summarizeTickerReturns,
  type AnnualUsdIdrChange,
  type AnnualTickerReturn,
  type BasketAnnualReturn,
  type TickerHistory,
  type TickerReturnSummary,
} from "@/lib/performanceReturns";
import {
  buildPerformancePoints,
  calculateXirr,
  findLedgerSnapshotImpact,
  type PerformancePoint,
  type PortfolioSnapshot,
} from "@/lib/portfolioPerformance";
import { PORTFOLIO_BUCKETS, PORTFOLIO_BUCKET_LABELS, type PortfolioBucket } from "@/lib/portfolioBuckets";
import type { LedgerTransaction } from "@/lib/portfolioLedger";
import type { SimulationUniverseTicker } from "@/lib/performanceSimulation";

type Scope = "all" | PortfolioBucket;
type ActualYear = { year: number; returnPct: number | null; observations: number; status: string };
type StockRecord = { ticker: string; name: string | null; bucket: PortfolioBucket | "other" };
type TickerSortKey = "averageAnnualPriceReturnPct" | "averageAnnualDividendYieldPct" | "averageAnnualCashTotalReturnPct" | "cumulativeCashTotalReturnPct" | "cashTotalReturnCagrPct" | "annualizedVolatilityPct";
type TickerSort = { key: TickerSortKey; direction: "asc" | "desc" } | null;

const SELECTION_STORAGE_KEY = "performance-returns.selected-tickers.v1";
const MAX_RETURN_TICKERS = 39;
const ETF_BUCKETS: Record<string, PortfolioBucket> = { SGOV: "treasury", VXUS: "index", VOO: "index" };

function safeStoredSelection(): string[] | null {
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (raw == null) return null;
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toUpperCase()).filter((item) => /^[A-Z0-9.^=_-]{1,20}$/.test(item)))]
      : null;
  } catch {
    return null;
  }
}

function formatPct(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function pctTone(value: number | null | undefined) {
  return value == null ? "text-gray-400" : value >= 0 ? "text-emerald-700" : "text-red-600";
}

function formatDps(value: number | null, currency: string | null) {
  if (value == null) return "—";
  return `${value.toFixed(3)}${currency ? ` ${currency}` : ""}`;
}

function summarizeCalendarTwr(points: readonly PerformancePoint[], startYear: number, endYear: number): ActualYear[] {
  return Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, offset) => {
    const year = startYear + offset;
    const yearPoints = points.filter((point) => point.sessionDate.startsWith(`${year}-`));
    const isComplete = yearPoints.length > 0 && yearPoints.every((point) => point.returnStatus === "valid" && point.dailyReturnPct != null);
    const returnPct = isComplete
      ? (yearPoints.reduce((growth, point) => growth * (1 + point.dailyReturnPct! / 100), 1) - 1) * 100
      : null;
    const status = yearPoints.length === 0
      ? "No snapshots"
      : isComplete
        ? year === new Date().getFullYear() ? "Complete through latest snapshot" : "Complete"
        : yearPoints.some((point) => point.returnStatus === "suppressed")
          ? "Suppressed: partial snapshot or recapture needed"
          : "Insufficient opening baseline";
    return { year, returnPct, observations: yearPoints.length, status };
  });
}

function AnnualReturnChart({ rows, benchmark }: { rows: readonly BasketAnnualReturn[]; benchmark: ReadonlyMap<number, AnnualTickerReturn> }) {
  const series = [
    { key: "priceReturnPct", label: "Basket price", color: "#2563eb" },
    { key: "dividendYieldPct", label: "Cash dividend yield", color: "#8b5cf6" },
    { key: "cashTotalReturnPct", label: "Basket cash total", color: "#059669" },
  ] as const;
  const values = rows.flatMap((row) => [row.priceReturnPct, row.dividendYieldPct, row.cashTotalReturnPct, benchmark.get(row.year)?.cashTotalReturnPct])
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) return <p className="p-5 text-sm text-gray-500">Chart will appear when return data is available.</p>;

  const width = 1040;
  const height = 320;
  const left = 52;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const plotHeight = height - top - bottom;
  const minimum = Math.min(-5, ...values);
  const maximum = Math.max(5, ...values);
  const span = Math.max(1, maximum - minimum);
  const y = (value: number) => top + (maximum - value) / span * plotHeight;
  const zeroY = y(0);
  const groupWidth = (width - left - right) / rows.length;
  const barWidth = Math.min(13, Math.max(5, (groupWidth - 12) / 4 - 2));
  const labelTicks = [maximum, (maximum + minimum) / 2, minimum];

  return (
    <div className="p-3 sm:p-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Annual equal-weight basket price return, cash dividend yield, cash total return, and VOO benchmark return. Exact values are available in the annual table below.">
        <title>Annual returns for the equal-weight historical basket and VOO</title>
        {labelTicks.map((tick, index) => (
          <g key={`tick-${index}`}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#6b7280" : "#e5e7eb"} strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#6b7280" fontSize="11">{tick.toFixed(0)}%</text>
          </g>
        ))}
        {rows.map((row, index) => {
          const xCenter = left + groupWidth * (index + 0.5);
          const valuesForYear = [row.priceReturnPct, row.dividendYieldPct, row.cashTotalReturnPct, benchmark.get(row.year)?.cashTotalReturnPct];
          const colors = [...series.map((item) => item.color), "#64748b"];
          const labels = [...series.map((item) => item.label), "VOO cash total"];
          return (
            <g key={row.year}>
              {valuesForYear.map((value, valueIndex) => {
                if (value == null || !Number.isFinite(value)) return null;
                const x = xCenter + (valueIndex - 1.5) * (barWidth + 2) - barWidth / 2;
                const valueY = y(value);
                const barY = Math.min(valueY, zeroY);
                const barHeight = Math.max(1, Math.abs(zeroY - valueY));
                return <rect key={labels[valueIndex]} x={x} y={barY} width={barWidth} height={barHeight} rx="2" fill={value < 0 ? "#dc2626" : colors[valueIndex]}><title>{`${row.year}${row.year === new Date().getFullYear() ? " YTD" : ""} · ${labels[valueIndex]}: ${formatPct(value)}`}</title></rect>;
              })}
              <text x={xCenter} y={height - 12} textAnchor="middle" fill="#6b7280" fontSize="11">{row.year}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600" aria-hidden="true">
        {[...series, { key: "voo", label: "VOO cash total", color: "#64748b" }].map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}</span>)}
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-600" />Negative return</span>
      </div>
    </div>
  );
}

function AnnualTable({
  rows,
  benchmark,
  actual,
  currentYear,
}: {
  rows: readonly BasketAnnualReturn[];
  benchmark: ReadonlyMap<number, AnnualTickerReturn>;
  actual: ReadonlyMap<number, ActualYear>;
  currentYear: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr>
          <th className="whitespace-nowrap px-3 py-2.5">Year</th><th className="whitespace-nowrap px-3 py-2.5">Price return</th><th className="whitespace-nowrap px-3 py-2.5">Cash dividend yield</th><th className="whitespace-nowrap px-3 py-2.5">Cash total return</th><th className="whitespace-nowrap px-3 py-2.5">Mean DPS</th><th className="whitespace-nowrap px-3 py-2.5">Holdings</th><th className="whitespace-nowrap px-3 py-2.5">Coverage</th><th className="whitespace-nowrap px-3 py-2.5">VOO total return</th><th className="whitespace-nowrap px-3 py-2.5">Actual portfolio TWR</th><th className="whitespace-nowrap px-3 py-2.5">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">{rows.map((row) => {
          const voo = benchmark.get(row.year);
          const actualYear = actual.get(row.year);
          return <tr key={row.year} className={`${row.year === currentYear ? "bg-blue-50/70" : ""} hover:bg-gray-50`}>
            <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">{row.year}{row.year === currentYear ? <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-700">YTD</span> : null}</th>
            <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${pctTone(row.priceReturnPct)}`}>{formatPct(row.priceReturnPct)}</td>
            <td className={`whitespace-nowrap px-3 py-2.5 ${pctTone(row.dividendYieldPct)}`}>{formatPct(row.dividendYieldPct)}</td>
            <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${pctTone(row.cashTotalReturnPct)}`}>{formatPct(row.cashTotalReturnPct)}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{formatDps(row.dividendsPerShare, row.dividendsCurrency)}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{row.holdingsWithUsableData}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{row.weightCoveragePct.toFixed(0)}%</td>
            <td className={`whitespace-nowrap px-3 py-2.5 ${pctTone(voo?.cashTotalReturnPct)}`}>{formatPct(voo?.cashTotalReturnPct)}</td>
            <td className={`whitespace-nowrap px-3 py-2.5 ${pctTone(actualYear?.returnPct)}`} title={actualYear?.status}>{formatPct(actualYear?.returnPct)}{actualYear?.observations ? <span className="ml-1 text-[10px] text-gray-400">({actualYear.observations})</span> : null}</td>
            <td className="whitespace-nowrap px-3 py-2.5"><span className={`badge ${row.status === "complete" ? "bg-emerald-50 text-emerald-700" : row.status === "partial" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{row.status}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function TickerMatrix({
  tickers,
  stockByTicker,
  annualByTicker,
  vooRows,
  summaryByTicker,
  histories,
  years,
  equalWeight,
  sort,
  onSort,
}: {
  tickers: readonly string[];
  stockByTicker: Readonly<Record<string, StockRecord>>;
  annualByTicker: Readonly<Record<string, readonly AnnualTickerReturn[]>>;
  vooRows: readonly AnnualTickerReturn[];
  summaryByTicker: Readonly<Record<string, TickerReturnSummary | undefined>>;
  histories: Readonly<Record<string, TickerHistory>>;
  years: readonly number[];
  equalWeight: number;
  sort: TickerSort;
  onSort: (key: TickerSortKey) => void;
}) {
  if (tickers.length === 0) return <p className="p-5 text-sm text-gray-500">No tickers match this scope. Select another scope or add a ticker above.</p>;

  const sortableHeader = (label: string, key: TickerSortKey, className = "", rowSpan = 1) => (
    <th rowSpan={rowSpan} aria-sort={sort?.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap text-inherit hover:text-gray-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {label}<span aria-hidden="true" className="text-gray-400">{sort?.key === key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  const sortedTickers = sort ? [...tickers].sort((left, right) => {
    const leftValue = summaryByTicker[left]?.[sort.key] ?? null;
    const rightValue = summaryByTicker[right]?.[sort.key] ?? null;
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return (leftValue - rightValue) * (sort.direction === "asc" ? 1 : -1);
  }) : tickers;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[11px]">
        <thead className="sticky top-0 z-10 bg-gray-50 text-[9px] uppercase tracking-wide text-gray-500">
          <tr>
            <th rowSpan={2} className="sticky left-0 z-20 min-w-36 bg-gray-50 px-3 py-2">Ticker / name</th>
            <th rowSpan={2} className="whitespace-nowrap px-2 py-2">Bucket</th><th rowSpan={2} className="whitespace-nowrap px-2 py-2">Equal weight</th>
            {years.map((year) => <th key={year} className="border-l border-gray-200 px-2 py-2 text-center">{year}{year === new Date().getFullYear() ? " YTD" : ""}</th>)}
            <th colSpan={5} className="border-l border-gray-200 px-2 py-2 text-center">Period summary</th>
            {sortableHeader("Volatility", "annualizedVolatilityPct", "whitespace-nowrap px-2 py-2", 2)}<th rowSpan={2} className="whitespace-nowrap px-2 py-2">Max drawdown</th>
            <th rowSpan={2} className="whitespace-nowrap px-2 py-2">Best / worst</th><th rowSpan={2} className="whitespace-nowrap px-2 py-2">Positive / usable</th>
            <th rowSpan={2} className="min-w-32 px-2 py-2">Dividend growth</th><th rowSpan={2} className="whitespace-nowrap px-2 py-2">VOO excess</th><th rowSpan={2} className="min-w-40 px-2 py-2">Data status</th>
          </tr>
          <tr>
            {years.map((year) => <th key={`${year}-metrics`} className="border-l border-gray-200 px-2 py-1.5 text-right">Price / yield / total / DPS / VOO excess</th>)}
            {sortableHeader("Average price", "averageAnnualPriceReturnPct", "border-l border-gray-200 px-2 py-1.5 text-right")}{sortableHeader("Average dividend yield", "averageAnnualDividendYieldPct", "px-2 py-1.5 text-right")}{sortableHeader("Average cash total", "averageAnnualCashTotalReturnPct", "px-2 py-1.5 text-right")}{sortableHeader("Cumulative cash total", "cumulativeCashTotalReturnPct", "px-2 py-1.5 text-right")}{sortableHeader("Cash total CAGR", "cashTotalReturnCagrPct", "px-2 py-1.5 text-right")}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{sortedTickers.map((ticker) => {
          const stock = stockByTicker[ticker];
          const history = histories[ticker];
          const returns = annualByTicker[ticker] ?? [];
          const byYear = new Map(returns.map((row) => [row.year, row]));
          const excessByYear = new Map(buildVooExcessReturns(returns, vooRows).map((row) => [row.year, row.excessReturnPct]));
          const summary = summaryByTicker[ticker];
          const growth = summary?.dividendGrowthByYear ?? [];
          const growthText = growth.map((item) => `${item.year} ${formatPct(item.growthPct)}`).join(" · ") || "—";
          const excess = summary?.averageAnnualVooExcessPct;
          const status = history?.error ?? (summary?.usableYears ? `${summary.usableYears} usable years · ${returns.filter((row) => row.status !== "complete").length} missing or partial` : returns.find((row) => row.status !== "complete")?.status ?? "No usable price and dividend history");
          return <tr key={ticker} className="hover:bg-gray-50">
            <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-2 text-left"><div className="font-bold text-gray-900">{ticker}</div><div className="max-w-52 truncate font-normal text-gray-500" title={history?.name ?? stock?.name ?? ""}>{history?.name ?? stock?.name ?? ""}</div></th>
            <td className="whitespace-nowrap px-2 py-2 text-gray-600">{stock?.bucket === "other" ? "Other" : PORTFOLIO_BUCKET_LABELS[stock?.bucket as PortfolioBucket] ?? "—"}</td>
            <td className="whitespace-nowrap px-2 py-2 text-gray-600">{equalWeight.toFixed(2)}%</td>
            {years.map((year) => {
              const row = byYear.get(year);
              return <td key={`${ticker}-${year}`} className="whitespace-nowrap border-l border-gray-100 px-2 py-2 text-right tabular-nums" title={row?.status ?? "No row"}>
                <span className={pctTone(row?.priceReturnPct)}>{formatPct(row?.priceReturnPct)}</span><span className="text-gray-300"> / </span><span className={pctTone(row?.dividendYieldPct)}>{formatPct(row?.dividendYieldPct)}</span><span className="text-gray-300"> / </span><span className={`font-semibold ${pctTone(row?.cashTotalReturnPct)}`}>{formatPct(row?.cashTotalReturnPct)}</span><span className="text-gray-300"> / </span><span className="text-gray-500">{formatDps(row?.dividendsPerShare ?? null, history?.currency ?? null)}</span><span className="text-gray-300"> / </span><span className={pctTone(excessByYear.get(year))}>{formatPct(excessByYear.get(year))}</span>
              </td>;
            })}
            <td className={`whitespace-nowrap border-l border-gray-100 px-2 py-2 text-right ${pctTone(summary?.averageAnnualPriceReturnPct)}`}>{formatPct(summary?.averageAnnualPriceReturnPct)}</td>
            <td className={`whitespace-nowrap px-2 py-2 text-right ${pctTone(summary?.averageAnnualDividendYieldPct)}`}>{formatPct(summary?.averageAnnualDividendYieldPct)}</td>
            <td className={`whitespace-nowrap px-2 py-2 text-right ${pctTone(summary?.averageAnnualCashTotalReturnPct)}`}>{formatPct(summary?.averageAnnualCashTotalReturnPct)}</td>
            <td className={`whitespace-nowrap px-2 py-2 text-right ${pctTone(summary?.cumulativeCashTotalReturnPct)}`}>{formatPct(summary?.cumulativeCashTotalReturnPct)}</td>
            <td className={`whitespace-nowrap px-2 py-2 text-right ${pctTone(summary?.cashTotalReturnCagrPct)}`}>{formatPct(summary?.cashTotalReturnCagrPct)}</td>
            <td className="whitespace-nowrap px-2 py-2 text-right text-gray-700">{formatPct(summary?.annualizedVolatilityPct)}</td><td className="whitespace-nowrap px-2 py-2 text-right text-red-600">{formatPct(summary?.maxDrawdownPct)}</td>
            <td className="whitespace-nowrap px-2 py-2"><span className="text-emerald-700">{summary?.bestYear ? `${summary.bestYear.year} ${formatPct(summary.bestYear.returnPct)}` : "—"}</span><br /><span className="text-red-600">{summary?.worstYear ? `${summary.worstYear.year} ${formatPct(summary.worstYear.returnPct)}` : "—"}</span></td>
            <td className="whitespace-nowrap px-2 py-2 text-gray-700">{summary ? `${summary.positiveYears} / ${summary.usableYears}` : "0 / 0"}</td>
            <td className="max-w-40 px-2 py-2 text-gray-600" title={growthText}>{growth.length > 2 ? `${growth.slice(-2).map((item) => `${item.year} ${formatPct(item.growthPct)}`).join(" · ")} · …` : growthText}</td>
            <td className="whitespace-nowrap px-2 py-2 text-gray-700" title={`Cumulative excess ${formatPct(summary?.cumulativeVooExcessPct)} · CAGR excess ${formatPct(summary?.cagrVooExcessPct)}`}>{formatPct(excess)}</td>
            <td className="px-2 py-2 text-gray-600">{status}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

export default function PerformanceReturnsDashboard() {
  const currentYear = new Date().getFullYear();
  const [activeView, setActiveView] = useState<"historical" | "simulation">("historical");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");
  const [stockByTicker, setStockByTicker] = useState<Record<string, StockRecord>>({});
  const [scope, setScope] = useState<Scope>("all");
  const [startYear, setStartYear] = useState(2016);
  const [endYear, setEndYear] = useState(currentYear);
  const [newTicker, setNewTicker] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [histories, setHistories] = useState<Record<string, TickerHistory>>({});
  const [fxHistory, setFxHistory] = useState<TickerHistory | null>(null);
  const [fxAsOfDate, setFxAsOfDate] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [settledHistoryKey, setSettledHistoryKey] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [performanceSnapshots, setPerformanceSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[] | undefined>(undefined);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState("");
  const [tickerSort, setTickerSort] = useState<TickerSort>(null);

  const simulationUniverse = useMemo<SimulationUniverseTicker[]>(() => Object.values(stockByTicker)
    .filter((stock) => stock.bucket !== "other")
    .sort((left, right) => left.ticker.localeCompare(right.ticker)), [stockByTicker]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const bucketResults = await Promise.allSettled(PORTFOLIO_BUCKETS.map((bucket) => getPortfolioDivisionStocks(bucket)));
      if (cancelled) return;
      const records: Record<string, StockRecord> = {};
      bucketResults.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const bucket = PORTFOLIO_BUCKETS[index];
        for (const [rawTicker, value] of Object.entries(result.value)) {
          const ticker = rawTicker.toUpperCase();
          const name = (value as { name?: unknown }).name;
          records[ticker] = { ticker, name: typeof name === "string" && name.trim() ? name.trim() : null, bucket };
        }
      });
      for (const [ticker, bucket] of Object.entries(ETF_BUCKETS)) {
        records[ticker] ??= { ticker, name: ticker === "SGOV" ? "iShares 0-3 Month Treasury Bond ETF" : ticker === "VXUS" ? "Vanguard Total International Stock ETF" : "Vanguard S&P 500 ETF", bucket };
      }
      setStockByTicker(records);
      if (bucketResults.some((result) => result.status === "rejected")) setPortfolioError("Some portfolio buckets could not be read. The initial ticker list may be incomplete; retry the Portfolio page connection before relying on its default selection.");
      const initial = [...new Set([...bucketResults.flatMap((result) => result.status === "fulfilled" ? Object.keys(result.value).map((ticker) => ticker.toUpperCase()) : []), ...Object.keys(ETF_BUCKETS)])];
      setSelectedTickers(safeStoredSelection() ?? initial);
      setPortfolioLoaded(true);

      const [snapshotsResult, transactionsResult] = await Promise.allSettled([
        getPortfolioPerformanceSnapshots(),
        getPortfolioLedgerTransactions(),
      ]);
      if (cancelled) return;
      if (snapshotsResult.status === "fulfilled") setPerformanceSnapshots(snapshotsResult.value);
      if (transactionsResult.status === "fulfilled") setLedgerTransactions(transactionsResult.value);
      if (snapshotsResult.status === "rejected" || transactionsResult.status === "rejected") setPerformanceError("Actual ledger-backed performance could not be fully loaded.");
      setPerformanceLoading(false);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setPortfolioError(error instanceof Error ? error.message : "Portfolio data could not be loaded.");
      setPortfolioLoaded(true);
      setSelectedTickers(safeStoredSelection() ?? Object.keys(ETF_BUCKETS));
      setPerformanceLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!portfolioLoaded) return;
    try {
      window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedTickers));
    } catch {
      // The selected list remains usable for this session when browser storage is unavailable.
    }
  }, [portfolioLoaded, selectedTickers]);

  const visibleTickers = useMemo(() => selectedTickers.filter((ticker) => scope === "all" || stockByTicker[ticker]?.bucket === scope), [scope, selectedTickers, stockByTicker]);
  const years = useMemo(() => Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index), [endYear, startYear]);
  const requestTickers = useMemo(() => [...new Set([...visibleTickers, "VOO"])].sort(), [visibleTickers]);
  const requestKey = `${requestTickers.join(",")}#${refreshToken}`;
  const historyLoading = !portfolioLoaded || settledHistoryKey !== requestKey;

  useEffect(() => {
    if (!portfolioLoaded) return;
    let cancelled = false;
    const controller = new AbortController();
    const query = new URLSearchParams({ tickers: requestTickers.join(",") });
    if (refreshToken > 0) query.set("refresh", "1");
    void fetch(`/api/performance-returns?${query.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Historical returns could not be loaded.");
        return data as {
          histories?: TickerHistory[];
          fxHistory?: TickerHistory;
          fxAsOfDate?: string | null;
          fetchedAt?: string;
          asOfDate?: string | null;
        };
      })
      .then((data) => {
        if (cancelled) return;
        const byTicker = Object.fromEntries((data.histories ?? []).map((history) => [history.ticker, history]));
        setHistories(byTicker);
        setFxHistory(data.fxHistory ?? null);
        setFxAsOfDate(data.fxAsOfDate ?? null);
        setFetchedAt(data.fetchedAt ?? null);
        setAsOfDate(data.asOfDate ?? null);
        setHistoryError("");
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return;
        setHistoryError(error instanceof Error ? error.message : "Historical returns could not be loaded.");
      })
      .finally(() => { if (!cancelled) setSettledHistoryKey(requestKey); });
    return () => { cancelled = true; controller.abort(); };
  }, [portfolioLoaded, refreshToken, requestKey, requestTickers]);

  const annualByTicker = useMemo(() => Object.fromEntries(requestTickers.map((ticker) => {
    const history = histories[ticker];
    return [ticker, history ? buildTickerAnnualReturns(history, startYear, endYear, asOfDate ?? `${currentYear}-12-31`) : []];
  })), [asOfDate, currentYear, endYear, histories, requestTickers, startYear]);
  const vooRows = useMemo(() => (annualByTicker.VOO ?? []) as AnnualTickerReturn[], [annualByTicker]);
  const benchmarkByYear = useMemo(() => new Map(vooRows.map((row) => [row.year, row])), [vooRows]);
  const basketAnnualRows = useMemo(() => buildEqualWeightBasketAnnualReturns(
    annualByTicker,
    visibleTickers,
    startYear,
    endYear,
    Object.fromEntries(requestTickers.map((ticker) => [ticker, histories[ticker]?.currency ?? null])),
  ), [annualByTicker, endYear, histories, requestTickers, startYear, visibleTickers]);
  const basketSummary = useMemo(() => summarizeBasketReturns(basketAnnualRows, histories, visibleTickers), [basketAnnualRows, histories, visibleTickers]);
  const fxAnnualRows = useMemo<AnnualUsdIdrChange[]>(() => buildAnnualUsdIdrChanges(
    fxHistory,
    startYear,
    endYear,
    fxAsOfDate ?? `${currentYear}-12-31`,
  ), [currentYear, endYear, fxAsOfDate, fxHistory, startYear]);
  const fxSummary = useMemo(() => summarizeUsdIdrChanges(fxAnnualRows), [fxAnnualRows]);
  const summaryByTicker = useMemo(() => Object.fromEntries(visibleTickers.map((ticker) => {
    const rows = (annualByTicker[ticker] ?? []) as AnnualTickerReturn[];
    const vooExcess = buildVooExcessReturns(rows, vooRows);
    return [ticker, histories[ticker] ? summarizeTickerReturns(rows, histories[ticker], vooExcess) : undefined];
  })), [annualByTicker, histories, visibleTickers, vooRows]);

  const actualPoints = useMemo(() => {
    const snapshots = [...performanceSnapshots].sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
    if (!snapshots.length) return [];
    const impact = findLedgerSnapshotImpact(snapshots, ledgerTransactions ?? []);
    return buildPerformancePoints(snapshots, "usd", {
      ledgerTransactions,
      invalidatedFromSessionDate: impact.firstAffectedSessionDate ?? undefined,
    });
  }, [ledgerTransactions, performanceSnapshots]);
  const actualByYear = useMemo(() => new Map(summarizeCalendarTwr(actualPoints, startYear, endYear).map((row) => [row.year, row])), [actualPoints, endYear, startYear]);
  const xirr = useMemo(() => calculateXirr(performanceSnapshots, ledgerTransactions ?? []), [ledgerTransactions, performanceSnapshots]);

  const cards = [
    { label: "Average annual price return", value: formatPct(basketSummary.averageAnnualPriceReturnPct), tone: pctTone(basketSummary.averageAnnualPriceReturnPct) },
    { label: "Average annual dividend yield", value: formatPct(basketSummary.averageAnnualDividendYieldPct), tone: pctTone(basketSummary.averageAnnualDividendYieldPct) },
    { label: "Average annual cash total return", value: formatPct(basketSummary.averageAnnualCashTotalReturnPct), tone: pctTone(basketSummary.averageAnnualCashTotalReturnPct) },
    { label: "Cash total return CAGR", value: formatPct(basketSummary.cashTotalReturnCagrPct), tone: pctTone(basketSummary.cashTotalReturnCagrPct) },
    { label: "Cumulative cash total return", value: formatPct(basketSummary.cumulativeCashTotalReturnPct), tone: pctTone(basketSummary.cumulativeCashTotalReturnPct) },
    { label: "Best year", value: basketSummary.bestYear ? `${basketSummary.bestYear.year} · ${formatPct(basketSummary.bestYear.returnPct)}` : "—", tone: "text-emerald-700" },
    { label: "Worst year", value: basketSummary.worstYear ? `${basketSummary.worstYear.year} · ${formatPct(basketSummary.worstYear.returnPct)}` : "—", tone: "text-red-600" },
    { label: "Positive years", value: `${basketSummary.positiveYears} / ${basketAnnualRows.filter((row) => row.cashTotalReturnPct != null).length}`, tone: "text-gray-900" },
  ];

  function addTicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    if (!/^[A-Z0-9.^=_-]{1,20}$/.test(ticker)) {
      setSelectionError("Use a valid Yahoo Finance ticker symbol.");
      return;
    }
    if (selectedTickers.includes(ticker)) {
      setSelectionError(`${ticker} is already in the return basket.`);
      return;
    }
    if (selectedTickers.length >= MAX_RETURN_TICKERS) {
      setSelectionError(`The return basket is limited to ${MAX_RETURN_TICKERS} tickers per request.`);
      return;
    }
    setStockByTicker((current) => ({ ...current, [ticker]: current[ticker] ?? { ticker, name: null, bucket: ETF_BUCKETS[ticker] ?? "other" } }));
    setSelectedTickers((current) => [...current, ticker]);
    setNewTicker("");
    setSelectionError("");
  }

  function removeTicker(ticker: string) {
    setSelectedTickers((current) => current.filter((item) => item !== ticker));
    setSelectionError("");
  }

  function sortTickersBy(key: TickerSortKey) {
    setTickerSort((current) => current?.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Performance Returns views" className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1">
        <button type="button" role="tab" aria-selected={activeView === "historical"} onClick={() => setActiveView("historical")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeView === "historical" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>Historical Returns</button>
        <button type="button" role="tab" aria-selected={activeView === "simulation"} onClick={() => setActiveView("simulation")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeView === "simulation" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>10-Year Simulation</button>
      </div>
      {activeView === "simulation" ? <PerformanceReturnsSimulation universe={simulationUniverse} transactions={ledgerTransactions} portfolioDataReady={!performanceLoading} portfolioError={portfolioError || performanceError} /> : <div className="space-y-4">
      <section className="surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Historical comparison</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Performance Returns</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Cash received is included in total return. The equal-weight historical basket applies today’s selection to prior years; it does not represent past ownership. Actual portfolio TWR and XIRR remain ledger-backed below.</p>
          </div>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={historyLoading || !portfolioLoaded} className="btn btn-secondary">{historyLoading ? "Loading history…" : "Refresh data"}</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-gray-600">Portfolio scope<select value={scope} onChange={(event) => setScope(event.target.value as Scope)} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800"><option value="all">All active holdings</option>{PORTFOLIO_BUCKETS.map((bucket) => <option key={bucket} value={bucket}>{PORTFOLIO_BUCKET_LABELS[bucket]}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-600">Start year<select value={startYear} onChange={(event) => setStartYear(Math.min(endYear, Number(event.target.value)))} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800">{Array.from({ length: currentYear - 2016 + 1 }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-600">End period<select value={endYear} onChange={(event) => setEndYear(Math.max(startYear, Number(event.target.value)))} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800">{Array.from({ length: currentYear - 2016 + 1 }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}{year === currentYear ? " YTD" : ""}</option>)}</select></label>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600"><span className="font-semibold text-gray-800">Data source & coverage</span><br />Yahoo Finance · {asOfDate ? `latest close ${asOfDate}` : "awaiting latest close"}<br />{historyLoading ? "Fetching selected history…" : `${visibleTickers.length} selected · ${basketAnnualRows.at(-1)?.holdingsWithUsableData ?? 0} ${endYear} contributors`}</div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-gray-900">Return basket selection</h2><p className="mt-0.5 text-xs text-gray-500">Selection is saved in this browser and stays separate from the transaction ledger.</p></div><span className="text-xs text-gray-500">{visibleTickers.length} included in this scope · {selectedTickers.length}/{MAX_RETURN_TICKERS} selected</span></div>
          <form onSubmit={addTicker} className="mt-3 flex flex-wrap gap-2"><label className="sr-only" htmlFor="add-return-ticker">Add ticker to return basket</label><input id="add-return-ticker" value={newTicker} onChange={(event) => setNewTicker(event.target.value)} placeholder="Add ticker, e.g. AAPL" className="min-w-48 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" /><button type="submit" className="btn btn-primary">Add ticker</button>{selectionError && <p role="alert" className="w-full text-xs text-red-600">{selectionError}</p>}</form>
          {portfolioError && <p role="status" className="mt-2 text-xs text-amber-700">{portfolioError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{selectedTickers.length === 0 ? <span className="text-xs text-gray-500">No tickers selected.</span> : selectedTickers.map((ticker) => {
            const stock = stockByTicker[ticker];
            const isVisible = visibleTickers.includes(ticker);
            return <span key={ticker} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${isVisible ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 bg-gray-50 text-gray-500"}`} title={`${stock?.name ?? ticker} · ${stock?.bucket === "other" ? "Other" : PORTFOLIO_BUCKET_LABELS[stock?.bucket as PortfolioBucket] ?? "Unassigned"}`}>
              {ticker}<button type="button" onClick={() => removeTicker(ticker)} aria-label={`Remove ${ticker} from return basket`} className="ml-0.5 rounded-full px-1 text-current hover:bg-black/10">×</button>
            </span>;
          })}</div>
        </div>
        {(historyError || performanceError) && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{historyError || performanceError}</div>}
        <p className="mt-3 text-[11px] leading-5 text-gray-500">Price return uses split-adjusted closes. Yahoo dividend events are dated on the ex-dividend date and treated as cash in that return period. Cash dividend yield is dividends per share divided by the first trading close of each year; cash total return uses the prior-year final close as its beginning-price denominator. Dividends remain in each ticker’s source currency. Missing observations stay unavailable.</p>
        {fetchedAt && <p className="mt-1 text-[10px] text-gray-400">Yahoo Finance history fetched {new Date(fetchedAt).toLocaleString()} · server cache 15 minutes</p>}
      </section>

      <section aria-label="Equal-weight historical basket summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => <div key={card.label} className="surface-card min-w-0 p-3.5"><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</div><div className={`mt-1 truncate text-lg font-bold ${card.tone}`}>{card.value}</div><div className="mt-0.5 truncate text-[10px] text-gray-400">{startYear}–{endYear === currentYear ? `${endYear} YTD` : endYear} · equal-weight basket</div></div>)}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Annual equal-weight historical basket</h2><p className="mt-1 text-xs text-gray-500">Usable constituents are reweighted equally each year. Coverage shows the share of selected tickers with usable cash total-return data.</p></div>
        <AnnualTable rows={basketAnnualRows} benchmark={benchmarkByYear} actual={actualByYear} currentYear={currentYear} />
      </section>

      <PerformanceReturnsFxPanel
        rows={fxAnnualRows}
        summary={fxSummary}
        currentYear={currentYear}
        fxAsOfDate={fxAsOfDate}
        latestUsdIdr={fxHistory?.bars.at(-1)?.close ?? null}
        fetchedAt={fetchedAt}
        loading={historyLoading}
      />

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Annual return comparison</h2><p className="mt-1 text-xs text-gray-500">Red bars are negative. VOO is shown as the S&amp;P 500 benchmark, whether or not it is in the selected basket.</p></div>
        <AnnualReturnChart rows={basketAnnualRows} benchmark={benchmarkByYear} />
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-bold text-gray-900">Per-stock annual returns</h2><p className="mt-1 text-xs text-gray-500">Each year shows price return, cash dividend yield, cash total return, and dividend dollars per share. Period averages are arithmetic; cumulative return compounds annual cash total returns.</p></div>
        <TickerMatrix tickers={visibleTickers} stockByTicker={stockByTicker} annualByTicker={annualByTicker} vooRows={vooRows} summaryByTicker={summaryByTicker} histories={histories} years={years} equalWeight={visibleTickers.length === 0 ? 0 : 100 / visibleTickers.length} sort={tickerSort} onSort={sortTickersBy} />
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div><h2 className="text-sm font-bold text-gray-900">Actual portfolio performance</h2><p className="mt-1 text-xs text-gray-500">Calendar-year TWR uses stored portfolio snapshots and recorded external flows. Years before snapshot coverage remain unavailable.</p></div>
          <div className="text-right"><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Personal return (XIRR)</div><div className={`text-lg font-bold ${pctTone(xirr.annualizedPct)}`}>{formatPct(xirr.annualizedPct)}</div><div className="text-[10px] text-gray-400">{xirr.status === "valid" ? "Ledger-backed cash timing" : xirr.status.replaceAll("_", " ")}</div></div>
        </div>
        {performanceLoading ? <p className="p-4 text-sm text-gray-500">Loading ledger snapshots…</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2.5">Year</th><th className="px-3 py-2.5">Calendar-year TWR</th><th className="px-3 py-2.5">Snapshots</th><th className="px-3 py-2.5">Data status</th></tr></thead><tbody className="divide-y divide-gray-100">{summarizeCalendarTwr(actualPoints, startYear, endYear).map((row) => <tr key={row.year} className={row.year === currentYear ? "bg-blue-50/70" : ""}><th scope="row" className="whitespace-nowrap px-3 py-2.5 font-semibold">{row.year}{row.year === currentYear ? " YTD" : ""}</th><td className={`px-3 py-2.5 font-semibold ${pctTone(row.returnPct)}`}>{formatPct(row.returnPct)}</td><td className="px-3 py-2.5 text-gray-600">{row.observations || "—"}</td><td className="px-3 py-2.5 text-gray-600">{row.status}</td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-xs text-gray-500"><span>{actualPoints.length ? `${actualPoints.length} stored snapshot points${performanceError ? " · partial load" : ""}` : "No actual snapshot history available"}</span><Link href="/performance" className="font-semibold text-blue-700 hover:underline">Open Performance for TWR, XIRR, accounting, and allocation →</Link></div>
      </section>

      <p className="px-1 text-[10px] leading-5 text-gray-400">Source: Yahoo Finance via yahoo-finance2. Volatility is annualized from daily cash total returns when at least 30 observations are available; drawdown uses that daily total-return path. Stock and ETF returns exclude fees and taxes.</p>
      </div>}
    </div>
  );
}
