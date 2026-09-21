"use client";

import { useEffect, useMemo, useState } from "react";
import { getPortfolioDivisionStocks, getPortfolioLedgerTransactions, getPortfolioPerformanceSnapshots } from "@/lib/firestore";
import { buildPortfolioActivityRows, type PortfolioActivityRow } from "@/lib/portfolioActivity";
import type { LedgerTransaction } from "@/lib/portfolioLedger";
import {
  buildPerformancePoints,
  calculateXirr,
  calculateReturnStatistics,
  emptySnapshotBucket,
  findLedgerSnapshotImpact,
  snapshotBucketValueIdr,
  snapshotBucketValueUsd,
  snapshotTotalValueUsd,
  snapshotTotalValueIdr,
  type PortfolioBucket,
  type PortfolioSnapshot,
} from "@/lib/portfolioPerformance";
import PortfolioPerformanceChart, {
  type PerformanceCurrency,
  type PerformanceMetric,
  type PerformanceSeries,
} from "@/components/PortfolioPerformanceChart";
import PortfolioAccountingPanel from "@/components/PortfolioAccountingPanel";
import PortfolioAllocationPanel from "@/components/PortfolioAllocationPanel";
import { PORTFOLIO_BUCKET_DEFINITIONS } from "@/lib/portfolioBuckets";

type Range = "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";

const BUCKETS: { id: PortfolioBucket; label: string; color: string }[] = [
  ...PORTFOLIO_BUCKET_DEFINITIONS.map((bucket) => ({
    ...bucket,
    color: bucket.id === "longterm"
      ? "#0ea5e9"
      : bucket.id === "index"
        ? "#8b5cf6"
        : bucket.id === "swing"
          ? "#f59e0b"
          : "#10b981",
  })),
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

function snapshotComponentValue(
  bucket: PortfolioSnapshot["total"],
  component: "cash" | "invested",
  currency: PerformanceCurrency,
) {
  const value = component === "cash"
    ? currency === "idr" ? bucket.cashValueIdr : bucket.cashValueUsd
    : currency === "idr" ? bucket.investedValueIdr : bucket.investedValueUsd;
  return value == null ? null : formatMoney(value, currency);
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
    total: snapshot.buckets[bucket] ?? emptySnapshotBucket(),
    positions: snapshot.positions.filter((position) => position.bucket === bucket),
  };
}

async function loadPortfolioCompanyNames() {
  const pockets = await Promise.all(BUCKETS.map(({ id }) => getPortfolioDivisionStocks(id).catch(() => ({}))));
  const names: Record<string, string> = {};
  for (const pocket of pockets) {
    for (const [ticker, value] of Object.entries(pocket)) {
      const name = (value as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) names[ticker.toUpperCase()] = name.trim();
    }
  }
  return names;
}

export default function PortfolioPerformanceDashboard() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [activityRows, setActivityRows] = useState<PortfolioActivityRow[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[] | undefined>(undefined);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("ALL");
  const [currency, setCurrency] = useState<PerformanceCurrency>("idr");
  const [metric, setMetric] = useState<PerformanceMetric>("value");
  const [visibleSeries, setVisibleSeries] = useState<Set<PerformanceSeries>>(new Set(["total", "longterm", "index", "swing", "treasury"]));
  const [preview, setPreview] = useState<PortfolioSnapshot | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getPortfolioPerformanceSnapshots(),
      getPortfolioLedgerTransactions().catch(() => undefined),
      loadPortfolioCompanyNames(),
    ])
      .then(([data, transactions, names]) => { setSnapshots(data); setLedgerTransactions(transactions); setCompanyNames(names); setActivityRows(buildPortfolioActivityRows(transactions ?? [])); setError(""); })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load performance history"))
      .finally(() => setLoading(false));
  }, []);

  async function refreshPerformanceData() {
    const [data, transactions] = await Promise.all([
      getPortfolioPerformanceSnapshots(),
      getPortfolioLedgerTransactions().catch(() => undefined),
    ]);
    setSnapshots(data);
    setLedgerTransactions(transactions);
    setCompanyNames(await loadPortfolioCompanyNames());
    setActivityRows(buildPortfolioActivityRows(transactions ?? []));
  }

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

  const sortedSnapshots = useMemo(() => [...snapshots].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)), [snapshots]);
  const selectedStart = useMemo(() => {
    const latestDate = sortedSnapshots.at(-1)?.sessionDate;
    return latestDate ? rangeStart(range, latestDate) : null;
  }, [range, sortedSnapshots]);
  const openingSnapshot = useMemo(() => {
    if (!selectedStart) return null;
    for (let index = sortedSnapshots.length - 1; index >= 0; index -= 1) {
      if (sortedSnapshots[index].sessionDate < selectedStart) return sortedSnapshots[index];
    }
    return null;
  }, [selectedStart, sortedSnapshots]);
  const filtered = useMemo(() => (
    selectedStart ? sortedSnapshots.filter((snapshot) => snapshot.sessionDate >= selectedStart) : sortedSnapshots
  ), [selectedStart, sortedSnapshots]);
  const ledgerSnapshotImpact = useMemo(
    () => findLedgerSnapshotImpact(sortedSnapshots, ledgerTransactions ?? []),
    [ledgerTransactions, sortedSnapshots],
  );
  const points = useMemo(() => buildPerformancePoints(filtered, currency, {
    openingSnapshot: openingSnapshot ?? undefined,
    ledgerTransactions,
    invalidatedFromSessionDate: ledgerSnapshotImpact.firstAffectedSessionDate ?? undefined,
  }), [filtered, currency, openingSnapshot, ledgerSnapshotImpact.firstAffectedSessionDate, ledgerTransactions]);
  const stats = useMemo(() => calculateReturnStatistics(points), [points]);
  const xirr = useMemo(() => calculateXirr(sortedSnapshots, ledgerTransactions ?? []), [ledgerTransactions, sortedSnapshots]);
  const latest = points.at(-1);
  const latestValue = latest ? (currency === "idr" ? snapshotTotalValueIdr(latest) : snapshotTotalValueUsd(latest)) : 0;
  const latestChange = latest ? (currency === "idr" ? latest.dailyValueChangeIdr : latest.dailyValueChangeUsd) : null;
  const latestFlow = latest ? (currency === "idr" ? latest.inferredFlowIdr : latest.inferredFlowUsd) : null;
  const openingForMetrics = openingSnapshot ?? filtered[0] ?? null;
  const openingValue = openingForMetrics ? (currency === "idr" ? snapshotTotalValueIdr(openingForMetrics) : snapshotTotalValueUsd(openingForMetrics)) : null;
  const netContributions = points.length === 0 ? null : points.reduce((sum, point) => sum + (currency === "idr" ? point.inferredFlowIdr : point.inferredFlowUsd), 0);
  const investmentGain = latest && openingValue != null && netContributions != null ? latestValue - openingValue - netContributions : null;
  const hasEstimatedFlows = points.some((point) => point.flowSource === "estimated");
  const currentFxRateUsdIdr = sortedSnapshots.at(-1)?.fxRateUsdIdr ?? null;

  function toggleSeries(series: PerformanceSeries) {
    setVisibleSeries((current) => {
      const next = new Set(current);
      if (next.has(series)) next.delete(series); else next.add(series);
      return next.size === 0 ? current : next;
    });
  }

  const cards = [
    { label: "Current Equity", value: latest ? formatMoney(latestValue, currency) : "—", detail: latest ? (snapshotComponentValue(latest.total, "cash", currency) == null ? "Legacy snapshot · cash unavailable" : `Cash ${snapshotComponentValue(latest.total, "cash", currency)} · invested ${snapshotComponentValue(latest.total, "invested", currency)}`) : "No snapshot yet", tone: "text-gray-900" },
    { label: "Latest Equity Change", value: latestChange == null ? "—" : `${latestChange >= 0 ? "+" : ""}${formatMoney(latestChange, currency)}`, detail: "Raw cash + market-value change", tone: (latestChange ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Latest External Flow", value: latestFlow == null ? "—" : `${latestFlow >= 0 ? "+" : ""}${formatMoney(latestFlow, currency)}`, detail: latest?.flowSource === "ledger" ? "Ledger contribution / withdrawal" : "Estimated legacy flow", tone: (latestFlow ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Net Contributions", value: netContributions == null ? "—" : formatMoney(netContributions, currency), detail: range === "ALL" ? "Since first snapshot" : `Selected ${range} window`, tone: (netContributions ?? 0) >= 0 ? "text-gray-900" : "text-red-500" },
    { label: "Investment Gain/Loss", value: investmentGain == null ? "—" : `${investmentGain >= 0 ? "+" : ""}${formatMoney(investmentGain, currency)}`, detail: "Equity − opening − external flow", tone: (investmentGain ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Period Return (TWR)", value: formatPct(stats.periodReturnPct), detail: stats.quality === "partial" ? "Suppressed: partial snapshot" : (range === "ALL" ? "Since tracking began" : `Selected ${range} window`), tone: (stats.periodReturnPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Personal Return (XIRR)", value: xirr.annualizedPct == null ? "—" : formatPct(xirr.annualizedPct), detail: xirr.status === "valid" ? "USD annualized cash-timing return" : xirr.status === "unsupported_currency" ? "Unavailable: IDR flow needs historical FX" : xirr.status === "partial" ? "Suppressed: partial snapshot" : "Needs more ledger-backed history", tone: (xirr.annualizedPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Avg Daily TWR", value: formatPct(stats.averageDailyPct), detail: "Geometric average of valid days", tone: (stats.averageDailyPct ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
    { label: "Max Drawdown", value: formatPct(stats.maxDrawdownPct), detail: "From normalized TWR peak", tone: "text-red-500" },
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
            <strong>Live test passed:</strong> {preview.total.positionCount} positions valued at {formatMoney(snapshotTotalValueIdr(preview), "idr")} ({formatMoney(snapshotTotalValueUsd(preview), "usd")}) using Rp{preview.fxRateUsdIdr.toLocaleString("id-ID")}/USD. Nothing was saved.
            {preview.missingTickers.length > 0 && <span> Missing: {preview.missingTickers.join(", ")}.</span>}
          </div>
        )}
        {ledgerSnapshotImpact.firstAffectedSessionDate && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
            <strong>Historical recapture needed:</strong> ledger activity was entered after a schema-version-2 snapshot was captured. Returns from {ledgerSnapshotImpact.firstAffectedSessionDate} onward are suppressed until those snapshots are recaptured. The next authenticated snapshot capture will rebuild them from historical daily closes.
            {ledgerSnapshotImpact.transactionIds.length > 0 && <span> Affected entries: {ledgerSnapshotImpact.transactionIds.length}.</span>}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {cards.map((card) => (
          <div key={card.label} className="surface-card min-w-0 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className={`mt-1 truncate text-lg font-bold ${card.tone}`}>{card.value}</div>
            <div className="mt-0.5 truncate text-[10px] text-gray-400">{card.detail}</div>
          </div>
        ))}
      </section>

      <PortfolioAllocationPanel
        transactions={ledgerTransactions}
        currency={currency}
        fxRateUsdIdr={currentFxRateUsdIdr}
        companyNames={companyNames}
        loading={loading}
      />

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
          ) : <PortfolioPerformanceChart snapshots={filtered} openingSnapshot={openingSnapshot ?? undefined} activityRows={activityRows} ledgerTransactions={ledgerTransactions} currency={currency} metric={metric} visibleSeries={visibleSeries} />}
      </section>

      {latest && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BUCKETS.map((bucket) => {
            const summary = latest.buckets[bucket.id] ?? emptySnapshotBucket();
            const bucketPoints = buildPerformancePoints(
              filtered.map((snapshot) => bucketSnapshot(snapshot, bucket.id)),
              currency,
              {
                openingSnapshot: openingSnapshot ? bucketSnapshot(openingSnapshot, bucket.id) : undefined,
                ledgerTransactions,
                bucket: bucket.id,
              },
            );
            const bucketStats = calculateReturnStatistics(bucketPoints);
            const allocation = snapshotTotalValueUsd(latest) > 0 ? snapshotBucketValueUsd(summary) / snapshotTotalValueUsd(latest) * 100 : 0;
            return (
              <div key={bucket.id} className="surface-card p-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: bucket.color }} />{bucket.label}</div><span className="text-xs font-semibold text-gray-500">{allocation.toFixed(1)}%</span></div>
                <div className="mt-3 text-xl font-bold text-gray-900">{formatMoney(currency === "idr" ? snapshotBucketValueIdr(summary) : snapshotBucketValueUsd(summary), currency)}</div>
                <div className="mt-2 flex justify-between text-xs text-gray-500"><span>{summary.positionCount} positions</span><span className={(bucketStats.periodReturnPct ?? 0) >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>{formatPct(bucketStats.periodReturnPct)} period</span></div>
                {snapshotComponentValue(summary, "cash", currency) == null ? <div className="mt-2 text-[10px] text-gray-400">Legacy snapshot · cash unavailable</div> : <div className="mt-2 flex justify-between gap-2 text-[10px] text-gray-400"><span>Cash {snapshotComponentValue(summary, "cash", currency)}</span><span>Invested {snapshotComponentValue(summary, "invested", currency)}</span></div>}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${allocation}%`, background: bucket.color }} /></div>
              </div>
            );
          })}
        </section>
      )}

      <section className="surface-card overflow-hidden">
        <button onClick={() => setHistoryOpen((open) => !open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div><h3 className="text-sm font-bold">Snapshot history</h3><p className="mt-0.5 text-[11px] text-gray-500">Stored daily values, FX rates, data quality, and ledger or estimated flows</p></div>
          <span className="text-sm text-gray-400">{historyOpen ? "Hide ↑" : `Show ${snapshots.length} ↓`}</span>
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-[var(--border)]">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Session</th><th className="px-3 py-2">Total IDR</th><th className="px-3 py-2">Total USD</th><th className="px-3 py-2">TWR/day</th><th className="px-3 py-2">External flow</th><th className="px-3 py-2">USD/IDR</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{[...points].reverse().map((point) => <tr key={point.sessionDate} className="hover:bg-gray-50"><td className="px-3 py-2 font-semibold">{point.sessionDate}</td><td className="px-3 py-2">{formatMoney(snapshotTotalValueIdr(point), "idr")}</td><td className="px-3 py-2">{formatMoney(snapshotTotalValueUsd(point), "usd")}</td><td className={`px-3 py-2 font-semibold ${(point.dailyReturnPct ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>{point.needsRecapture ? "Needs recapture" : point.returnStatus === "suppressed" ? "Suppressed" : formatPct(point.dailyReturnPct)}</td><td className="px-3 py-2 text-gray-600"><div>{formatMoney(point.inferredFlowUsd, "usd")}</div><div className="text-[10px] uppercase text-gray-400">{point.flowSource}</div></td><td className="px-3 py-2">Rp{point.fxRateUsdIdr.toLocaleString("id-ID")}</td><td className="px-3 py-2"><span className={`badge ${point.needsRecapture ? "bg-amber-50 text-amber-700" : point.status === "complete" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{point.needsRecapture ? "recapture" : point.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <p className="px-1 text-[10px] leading-relaxed text-gray-400">{stats.quality === "partial" ? "TWR statistics are suppressed because the selected range includes a partial snapshot. Equity and external-flow values remain visible." : hasEstimatedFlows ? "Legacy snapshots use estimated flows from position quantity changes. Ledger-backed snapshots use recorded external flows and daily TWR conventions; mixed ranges remain visibly identified above." : "Ledger-backed snapshots use recorded external flows and daily TWR conventions. Equity and flow-neutralized return are shown as separate measures."}</p>

      <PortfolioAccountingPanel onLedgerChanged={() => { refreshPerformanceData().catch(() => undefined); }} />
    </div>
  );
}
