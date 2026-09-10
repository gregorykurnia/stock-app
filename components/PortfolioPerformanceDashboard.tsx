"use client";

import { useEffect, useMemo, useState } from "react";
import { getPortfolioPerformanceSnapshots } from "@/lib/firestore";
import {
  buildPerformancePoints,
  calculateReturnStatistics,
  type PortfolioBucket,
  type PortfolioSnapshot,
} from "@/lib/portfolioPerformance";
import PortfolioPerformanceChart, {
  type PerformanceCurrency,
  type PerformanceMetric,
  type PerformanceSeries,
} from "@/components/PortfolioPerformanceChart";

type Range = "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";

const BUCKETS: { id: PortfolioBucket; label: string; color: string }[] = [
  { id: "longterm", label: "Long Term", color: "#0ea5e9" },
  { id: "index", label: "Index", color: "#8b5cf6" },
  { id: "swing", label: "Swing", color: "#f59e0b" },
];

function formatMoney(value: number, currency: PerformanceCurrency) {
  return new Intl.NumberFormat(currency === "idr" ? "id-ID" : "en-US", {
    style: "currency", currency: currency.toUpperCase(),
    maximumFractionDigits: currency === "idr" ? 0 : 2,
  }).format(value);
}

function formatPct(value: number | null) {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function rangeStart(range: Range, latestDate: string): string | null {
  if (range === "ALL") return null;
  const latest = new Date(`${latestDate}T12:00:00Z`);
  if (range === "YTD") return `${latest.getUTCFullYear()}-01-01`;
  const months = range === "1M" ? 1 : range === "3M" ? 3 : range === "6M" ? 6 : 12;
  latest.setUTCMonth(latest.getUTCMonth() - months);
  return latest.toISOString().slice(0, 10);
}

function bucketSnapshot(snapshot: PortfolioSnapshot, bucket: PortfolioBucket): PortfolioSnapshot {
  return {
    ...snapshot,
    total: snapshot.buckets[bucket],
    positions: snapshot.positions.filter((position) => position.bucket === bucket),
  };
}

export default function PortfolioPerformanceDashboard() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("ALL");
  const [currency, setCurrency] = useState<PerformanceCurrency>("idr");
  const [metric, setMetric] = useState<PerformanceMetric>("value");
  const [visibleSeries, setVisibleSeries] = useState<Set<PerformanceSeries>>(new Set(["total", "longterm", "index", "swing"]));
  const [preview, setPreview] = useState<PortfolioSnapshot | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    getPortfolioPerformanceSnapshots()
      .then((data) => { setSnapshots(data); setError(""); })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load performance history"))
      .finally(() => setLoading(false));
  }, []);

  async function runPreview() {
    setPreviewLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cron/portfolio-snapshot?preview=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Snapshot test failed");
      setPreview(data.snapshot);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Snapshot test failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const latestDate = snapshots.at(-1)?.sessionDate;
    if (!latestDate) return [];
    const start = rangeStart(range, latestDate);
    return start ? snapshots.filter((snapshot) => snapshot.sessionDate >= start) : snapshots;
  }, [snapshots, range]);
  const points = useMemo(() => buildPerformancePoints(filtered, currency), [filtered, currency]);
  const stats = useMemo(() => calculateReturnStatistics(points), [points]);
  const latest = points.at(-1);
  const latestValue = latest ? (currency === "idr" ? latest.total.valueIdr : latest.total.valueUsd) : 0;
  const latestChange = latest ? (currency === "idr" ? latest.dailyValueChangeIdr : latest.dailyValueChangeUsd) : null;

  function toggleSeries(series: PerformanceSeries) {
    setVisibleSeries((current) => {
      const next = new Set(current);
      if (next.has(series)) next.delete(series); else next.add(series);
      return next.size === 0 ? current : next;
    });
  }

  const cards = [
    { label: "Current Value", value: latest ? formatMoney(latestValue, currency) : "—", detail: latest ? formatMoney(latest.total.valueUsd, "usd") : "No snapshot yet", tone: "text-gray-900" },
    { label: "Latest Change", value: latestChange == null ? "—" : `${latestChange >= 0 ? "+" : ""}${formatMoney(latestChange, currency)}`, detail: formatPct(latest?.dailyReturnPct ?? null), tone: (latestChange ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Period Return", value: formatPct(stats.periodReturnPct), detail: range === "ALL" ? "Since tracking began" : `Selected ${range} window`, tone: (stats.periodReturnPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Avg Daily", value: formatPct(stats.averageDailyPct), detail: "Flow-adjusted estimate", tone: (stats.averageDailyPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Avg Weekly", value: formatPct(stats.averageWeeklyPct), detail: "Compounded by week", tone: (stats.averageWeeklyPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Avg Monthly", value: formatPct(stats.averageMonthlyPct), detail: "Compounded by month", tone: (stats.averageMonthlyPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Max Drawdown", value: formatPct(stats.maxDrawdownPct), detail: "From prior performance peak", tone: "text-red-500" },
  ];

  return (
    <div className="space-y-4">
      <section className="surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Portfolio Performance</h2>
              {latest && <span className={`badge ${latest.status === "complete" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{latest.status}</span>}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {latest ? `Last captured ${new Date(latest.capturedAt).toLocaleString("en-ID", { timeZone: "Asia/Jakarta" })} WIB · US session ${latest.sessionDate}` : "Daily history begins after the first successful market-close capture."}
            </p>
          </div>
          <button onClick={runPreview} disabled={previewLoading} className="btn btn-secondary" title="Runs the exact live capture pipeline without saving data">
            {previewLoading ? "Testing live data…" : "Test snapshot now"}
          </button>
        </div>
        {preview && (
          <div className={`mt-4 rounded-xl border px-3 py-2.5 text-xs ${preview.status === "complete" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <strong>Live test passed:</strong> {preview.total.positionCount} positions valued at {formatMoney(preview.total.valueIdr, "idr")} ({formatMoney(preview.total.valueUsd, "usd")}) using Rp{preview.fxRateUsdIdr.toLocaleString("id-ID")}/USD. Nothing was saved.
            {preview.missingTickers.length > 0 && <span> Missing: {preview.missingTickers.join(", ")}.</span>}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="surface-card min-w-0 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className={`mt-1 truncate text-lg font-bold ${card.tone}`}>{card.value}</div>
            <div className="mt-0.5 truncate text-[10px] text-gray-400">{card.detail}</div>
          </div>
        ))}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented">
              <button onClick={() => setMetric("value")} className={`segmented-btn ${metric === "value" ? "is-active" : ""}`}>Value</button>
              <button onClick={() => setMetric("return")} className={`segmented-btn ${metric === "return" ? "is-active" : ""}`}>Return</button>
            </div>
            <div className="segmented">
              <button onClick={() => setCurrency("idr")} className={`segmented-btn ${currency === "idr" ? "is-active" : ""}`}>IDR</button>
              <button onClick={() => setCurrency("usd")} className={`segmented-btn ${currency === "usd" ? "is-active" : ""}`}>USD</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["1M", "3M", "6M", "YTD", "1Y", "ALL"] as Range[]).map((item) => (
              <button key={item} onClick={() => setRange(item)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${range === item ? "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]" : "text-gray-500 hover:bg-gray-50"}`}>{item === "ALL" ? "All" : item}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {([{ id: "total", label: "Total", color: "#4f46e5" }, ...BUCKETS] as { id: PerformanceSeries; label: string; color: string }[]).map((item) => (
            <button key={item.id} onClick={() => toggleSeries(item.id)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity ${visibleSeries.has(item.id) ? "border-gray-200 bg-white text-gray-700" : "border-gray-100 bg-gray-50 text-gray-400 opacity-60"}`}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}
            </button>
          ))}
        </div>
        {loading ? <div className="flex h-[390px] items-center justify-center text-sm text-gray-400 animate-pulse">Loading performance history…</div>
          : filtered.length === 0 ? (
            <div className="flex h-[390px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-[var(--accent-soft)] px-4 py-3 text-xl text-[var(--accent)]">↗</div>
              <h3 className="mt-3 font-semibold text-gray-900">Your performance chart will appear here</h3>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">Use “Test snapshot now” to verify all holdings and the live FX rate today. The scheduled job saves the first point after the next US market close.</p>
            </div>
          ) : <PortfolioPerformanceChart snapshots={filtered} currency={currency} metric={metric} visibleSeries={visibleSeries} />}
      </section>

      {latest && (
        <section className="grid gap-3 md:grid-cols-3">
          {BUCKETS.map((bucket) => {
            const summary = latest.buckets[bucket.id];
            const bucketPoints = buildPerformancePoints(filtered.map((snapshot) => bucketSnapshot(snapshot, bucket.id)), currency);
            const bucketStats = calculateReturnStatistics(bucketPoints);
            const allocation = latest.total.valueUsd > 0 ? summary.valueUsd / latest.total.valueUsd * 100 : 0;
            return (
              <div key={bucket.id} className="surface-card p-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: bucket.color }} />{bucket.label}</div><span className="text-xs font-semibold text-gray-500">{allocation.toFixed(1)}%</span></div>
                <div className="mt-3 text-xl font-bold text-gray-900">{formatMoney(currency === "idr" ? summary.valueIdr : summary.valueUsd, currency)}</div>
                <div className="mt-2 flex justify-between text-xs text-gray-500"><span>{summary.positionCount} positions</span><span className={(bucketStats.periodReturnPct ?? 0) >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>{formatPct(bucketStats.periodReturnPct)} period</span></div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${allocation}%`, background: bucket.color }} /></div>
              </div>
            );
          })}
        </section>
      )}

      <section className="surface-card overflow-hidden">
        <button onClick={() => setHistoryOpen((open) => !open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div><h3 className="text-sm font-bold">Snapshot history</h3><p className="mt-0.5 text-[11px] text-gray-500">Stored daily values, FX rates, data quality, and inferred position flows</p></div>
          <span className="text-sm text-gray-400">{historyOpen ? "Hide ↑" : `Show ${snapshots.length} ↓`}</span>
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Session</th><th className="px-3 py-2">Total IDR</th><th className="px-3 py-2">Total USD</th><th className="px-3 py-2">Daily return</th><th className="px-3 py-2">Inferred flow</th><th className="px-3 py-2">USD/IDR</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{[...points].reverse().map((point) => <tr key={point.sessionDate} className="hover:bg-gray-50"><td className="px-3 py-2 font-semibold">{point.sessionDate}</td><td className="px-3 py-2">{formatMoney(point.total.valueIdr, "idr")}</td><td className="px-3 py-2">{formatMoney(point.total.valueUsd, "usd")}</td><td className={`px-3 py-2 font-semibold ${(point.dailyReturnPct ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>{formatPct(point.dailyReturnPct)}</td><td className="px-3 py-2 text-gray-600">{formatMoney(point.inferredFlowUsd, "usd")}</td><td className="px-3 py-2">Rp{point.fxRateUsdIdr.toLocaleString("id-ID")}</td><td className="px-3 py-2"><span className={`badge ${point.status === "complete" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{point.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <p className="px-1 text-[10px] leading-relaxed text-gray-400">Returns remove estimated flows caused by position quantity changes, valued at the ending close. This is more useful than raw balance change, but dividends, fees, cash, and intraday transaction prices require a future transaction ledger for exact time-weighted returns.</p>
    </div>
  );
}
