"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";
import {
  ETF_METRIC_LABELS,
  type ETFCategoryMeta,
  type ETFMetricKey,
  type ETFMetricSnapshot,
  type ETFRecord,
  type ETFStrategy,
} from "@/lib/etfCatalog";
import { weightedHoldingsOverlap } from "@/lib/etfMetricCalculations";
import { preferredETFTableReturn } from "@/lib/etfReturnDisplay";

type View = "explore" | "compare" | "shortlist";
type Scope = "etf" | "etn" | "all";
type SortKey = "ticker" | "category" | "exposure" | `metric:${ETFMetricKey}` | "issuer" | "dataStatus";
type DataFilter = "all" | "identity-warning" | "source-located";

interface ETFCounts {
  etfLike: number;
  etns: number;
  exclusions: number;
  categories: number;
  tradabilityConfirmed: number;
}

interface ETFExplorerProps {
  catalogue: ETFRecord[];
  etns: ETFRecord[];
  exclusions: ETFRecord[];
  categoryMeta: ETFCategoryMeta[];
  counts: ETFCounts;
  snapshotDate: string;
  initialMetricSnapshots: Record<string, ETFMetricSnapshot>;
  initialMetricLoadError: boolean;
}

interface ShortlistEntry {
  ticker: string;
  role: string;
  reason: string;
  concerns: string;
  researchStatus: string;
}

const SHORTLIST_STORAGE_KEY = "stock-analysis-etf-shortlist-v1";

const STRATEGY_OPTIONS: Array<{ value: ETFStrategy; label: string }> = [
  { value: "core", label: "Core / broad" },
  { value: "income", label: "Income" },
  { value: "leveraged", label: "Leveraged / inverse" },
  { value: "trust", label: "Trust" },
  { value: "commodity", label: "Commodity" },
  { value: "digital", label: "Digital assets" },
  { value: "allocation", label: "Multi-asset" },
  { value: "etn", label: "ETN" },
];

const TABLE_METRICS: Array<{ key: ETFMetricKey; label: string }> = [
  { key: "cagr5Y", label: "Return" },
  { key: "cagr10Y", label: "10Y CAGR" },
  { key: "trailingDistributionYield", label: "TTM yield" },
  { key: "maxDrawdown5Y", label: "5Y drawdown" },
];

const DETAIL_METRICS: ETFMetricKey[] = [
  "totalReturn1Y",
  "calendarYearReturns",
  "cagr3Y",
  "cagr5Y",
  "cagr10Y",
  "trailingDistributionYield",
  "averageCashYield5Y",
  "maxDrawdown5Y",
  "volatility5Y",
  "recoveryTime",
  "topTenWeight",
  "overlap",
  "expenseRatio",
  "netAssets",
  "inceptionDate",
];

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatCategory(category: string) {
  return category.replace(" — separate from ETFs", "");
}

function formatStructure(structure: string) {
  if (structure === "physical-metal-trust") return "Physical-metal trust";
  if (structure === "spot-bitcoin-trust") return "Spot-bitcoin trust";
  if (structure === "ETF trust") return "ETF trust";
  if (structure.startsWith("commodity-pool")) return "Commodity pool / trust";
  if (structure === "ETN") return "Exchange-traded note";
  if (structure === "operating-company-stock") return "Operating-company stock";
  if (structure === "closed-end-fund") return "Closed-end fund";
  return "ETF · legal form review pending";
}

function strategyLabel(strategy: ETFStrategy) {
  return STRATEGY_OPTIONS.find((option) => option.value === strategy)?.label ?? "Core / broad";
}

function badgeClass(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("inverse") || lower.includes("etn") || lower.includes("identity")) return "bg-red-50 text-red-700 border-red-200";
  if (lower.includes("leveraged") || lower.includes("daily") || lower.includes("single-stock") || lower.includes("0dte")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (lower.includes("income") || lower.includes("weekly")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (lower.includes("trust") || lower.includes("metal") || lower.includes("bitcoin") || lower.includes("commodity")) return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function isComplex(record: ETFRecord) {
  return record.strategy === "leveraged" || record.category === "Options income and distribution strategies" || record.kind === "etn" || record.badges.some((badge) => ["Single-stock", "0DTE"].includes(badge));
}

function roleExplanation(record: ETFRecord) {
  if (record.kind === "etn") return "This is an unsecured exchange-traded note. Its outcome depends on the reference strategy and the issuer's ability to meet its obligations.";
  if (record.strategy === "leveraged") return "This product targets a multiple or inverse of a reference exposure over a daily reset period. Holding-period results can differ materially from the headline multiple.";
  if (record.strategy === "income") return "This product emphasizes distributions through dividends, option income, or another income mechanism. Cash yield should be read with total return and the strategy's upside tradeoff.";
  if (record.strategy === "trust") return "This is an exchange-traded trust structure intended to provide direct or near-direct exposure to the named physical or digital asset.";
  if (record.strategy === "commodity" || record.strategy === "digital") return "This product uses commodity or digital-asset exposure that may be futures-based, trust-based, or otherwise derivative-based. The structure badge shows the current research classification.";
  if (record.category === "Fixed income and preferred securities") return "This fund provides fixed-income or preferred-security exposure. Duration, credit quality, and distribution history still need validated enrichment before comparing outcomes.";
  if (record.category === "Multi-asset allocation") return "This fund combines multiple sleeves in one portfolio. Its actual allocation and rebalance rules should be checked against the issuer source.";
  return "This fund provides a defined equity, international, sector, or thematic exposure. The description is descriptive and does not create an investment recommendation.";
}

function candidateMetricLabel(key: string) {
  const labels: Record<string, string> = {
    expenseRatio: "Expense ratio",
    inceptionDate: "Inception date",
    distributionFrequency: "Distribution frequency",
    netAssets: "Issuer-reported net assets",
    cusip: "CUSIP",
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function displayMetricState(state?: string) {
  return state?.toLowerCase().includes("insufficient") ? "NA" : state;
}

function metricText(key: ETFMetricKey, value: number | string | undefined, state?: string, currency?: string | null) {
  const displayState = displayMetricState(state);
  if (value === undefined || value === "") {
    if (!displayState || displayState.toLowerCase().includes("not collected") || displayState.toLowerCase().includes("not validated") || displayState.toLowerCase().includes("no snapshot")) return "No data";
    if (displayState === "NA") return displayState;
    if (displayState.toLowerCase().includes("not yet recovered")) return "Not yet recovered";
    if (displayState.toLowerCase().includes("no distributions")) return "0.00%";
    if (displayState.toLowerCase().includes("compare")) return "Select funds to compare";
    if (displayState.toLowerCase().includes("unavailable")) return "Unavailable";
    if (displayState.toLowerCase().includes("price history")) return "Price history unavailable";
    return displayState;
  }
  if (typeof value === "string") return value;
  if (["totalReturn1Y", "cagr3Y", "cagr5Y", "cagr10Y", "trailingDistributionYield", "averageCashYield5Y", "maxDrawdown5Y", "volatility5Y", "topTenWeight", "expenseRatio"].includes(key)) {
    const signedReturn = value > 0 && ["totalReturn1Y", "cagr3Y", "cagr5Y", "cagr10Y"].includes(key);
    return `${signedReturn ? "+" : ""}${value.toFixed(key === "expenseRatio" ? 4 : 2)}%`;
  }
  if (key === "recoveryTime") return `${Math.round(value).toLocaleString()} trading days`;
  if (key === "netAssets") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  }
  return value.toLocaleString();
}

function FundMetric({ record, metricKey, valueOverride, stateOverride }: {
  record: ETFRecord;
  metricKey: ETFMetricKey;
  valueOverride?: number;
  stateOverride?: string;
}) {
  const snapshot = record.metricSnapshot;
  const state = record.identityWarning ? `Identity review: ${record.identityWarning}` : stateOverride ?? snapshot?.states[metricKey] ?? record.metricStates[metricKey];
  const value = record.identityWarning ? undefined : valueOverride ?? snapshot?.values[metricKey];
  const label = [snapshot?.source, snapshot?.observedAt ? `Observed ${snapshot.observedAt}` : null, displayMetricState(state)].filter(Boolean).join(" · ");
  return <span className={value === undefined ? "text-gray-400" : "font-semibold text-gray-800"} title={label || state}>{metricText(metricKey, value, state, snapshot?.currency)}</span>;
}

function formatHistoryPeriod(history: NonNullable<ETFMetricSnapshot["sinceInceptionReturn"]>) {
  if (history.annualized) return `${history.periodYears.toFixed(2)} years`;
  const start = new Date(`${history.startDate}T00:00:00Z`);
  const end = new Date(`${history.endDate}T00:00:00Z`);
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return `${Math.max(1, months)} months`;
}

function FundReturn({ record }: { record: ETFRecord }) {
  const snapshot = record.metricSnapshot;
  const tableReturn = preferredETFTableReturn(snapshot, record.identityWarning);
  const periodLabel = typeof tableReturn.valueOverride === "number" && snapshot?.sinceInceptionReturn
    ? `${tableReturn.periodLabel} · ${formatHistoryPeriod(snapshot.sinceInceptionReturn)}`
    : tableReturn.periodLabel;

  return (
    <span className="block leading-tight">
      <FundMetric record={record} metricKey={tableReturn.metricKey} valueOverride={tableReturn.valueOverride} stateOverride={tableReturn.stateOverride} />
      <span className="mt-0.5 block text-[10px] font-normal leading-3 text-gray-400">{periodLabel}</span>
    </span>
  );
}

function DataStatus({ record }: { record: ETFRecord }) {
  if (record.identityWarning) return <span className="badge border bg-amber-50 text-amber-800 border-amber-200">Identity review</span>;
  const snapshot = record.metricSnapshot;
  if (!snapshot?.observedAt) return <span className="badge border bg-gray-50 text-gray-600 border-gray-200" title="No stored market-data snapshot is available for this fund.">No snapshot</span>;
  if (snapshot.lastError) return <span className="badge border bg-amber-50 text-amber-800 border-amber-200" title={snapshot.lastError}>Refresh issue · last values kept</span>;
  const tracked = Object.keys(ETF_METRIC_LABELS).filter((key) => key !== "overlap") as ETFMetricKey[];
  const resolved = tracked.filter((key) => {
    const state = (snapshot.states[key] ?? "").toLowerCase();
    return state.startsWith("available") || state.includes("no distributions") || state === "not yet recovered" || state === "no drawdown in available history";
  }).length;
  if (snapshot.stale) return <span className="badge border bg-amber-50 text-amber-800 border-amber-200" title={`Last successful market data: ${snapshot.observedAt}`}>Stale · {resolved}/{tracked.length}</span>;
  return <span className="badge border bg-gray-50 text-gray-600 border-gray-200" title={`${resolved} of ${tracked.length} fields sourced or explicitly resolved`}>{resolved === tracked.length ? "Ready" : `Partial · ${resolved}/${tracked.length}`}</span>;
}

function dataStatusSortValue(record: ETFRecord) {
  if (record.identityWarning) return "Identity review";
  const snapshot = record.metricSnapshot;
  if (!snapshot?.observedAt) return "No snapshot";
  if (snapshot.lastError) return "Refresh issue";
  if (snapshot.stale) return "Stale";
  const tracked = Object.keys(ETF_METRIC_LABELS).filter((key) => key !== "overlap") as ETFMetricKey[];
  const resolved = tracked.filter((key) => {
    const state = (snapshot.states[key] ?? "").toLowerCase();
    return state.startsWith("available") || state.includes("no distributions") || state === "not yet recovered" || state === "no drawdown in available history";
  }).length;
  return resolved === tracked.length ? "Ready" : "Partial";
}

function sortValue(record: ETFRecord, key: SortKey): string | number | null {
  if (key.startsWith("metric:")) {
    const metricKey = key.slice("metric:".length) as ETFMetricKey;
    if (record.identityWarning) return null;
    if (metricKey === "cagr5Y") {
      const tableReturn = preferredETFTableReturn(record.metricSnapshot, record.identityWarning);
      const value = tableReturn.valueOverride ?? record.metricSnapshot?.values[tableReturn.metricKey];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    }
    const value = record.metricSnapshot?.values[metricKey];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  if (key === "ticker") return record.ticker;
  if (key === "category") return `${record.category} ${strategyLabel(record.strategy)}`;
  if (key === "exposure") return record.exposure;
  if (key === "issuer") return record.issuer;
  return dataStatusSortValue(record);
}

function SummaryCard({ label, value, note, tone = "text-gray-900" }: { label: string; value: string | number; note: string; tone?: string }) {
  return (
    <div className="surface-card min-w-0 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold tracking-tight ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-gray-400">{note}</div>
    </div>
  );
}

function CategoryCard({ category, count, active, onClick }: { category: ETFCategoryMeta; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface-card min-w-0 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transform-none ${active ? "border-indigo-300 bg-indigo-50/50" : ""}`}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-5 text-gray-900">{formatCategory(category.key)}</span>
        <span className="shrink-0 font-mono text-lg font-bold text-indigo-600">{count}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-gray-500">{category.description}</p>
    </button>
  );
}

function SortButton({ label, sortKey, currentSort, descending, onChange }: { label: string; sortKey: SortKey; currentSort: SortKey; descending: boolean; onChange: (key: SortKey) => void }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => onChange(sortKey)}>
      {label}<span aria-hidden="true" className="text-[9px]">{currentSort === sortKey ? (descending ? "▼" : "▲") : "↕"}</span>
    </button>
  );
}

function ETFTable({ records, shortlist, compareTickers, onSelect, onToggleShortlist, onToggleCompare, sortKey, descending, onSort }: {
  records: ETFRecord[];
  shortlist: Record<string, ShortlistEntry>;
  compareTickers: string[];
  onSelect: (record: ETFRecord) => void;
  onToggleShortlist: (record: ETFRecord) => void;
  onToggleCompare: (record: ETFRecord) => void;
  sortKey: SortKey;
  descending: boolean;
  onSort: (key: SortKey) => void;
}) {
  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, record: ETFRecord) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(record);
    }
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-b-2xl lg:block">
        <table className="w-full min-w-[1700px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            {TABLE_METRICS.map((metric) => <col key={metric.key} className="w-[6%]" />)}
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--border)] bg-gray-50/80 text-[11px] uppercase tracking-wide text-gray-500">
              <th scope="col" aria-sort={sortKey === "ticker" ? (descending ? "descending" : "ascending") : "none"} className="sticky left-0 z-20 min-w-56 bg-gray-50 px-4 py-3 text-left font-semibold"><SortButton label="Fund" sortKey="ticker" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "category" ? (descending ? "descending" : "ascending") : "none"} className="min-w-56 px-4 py-3 text-left font-semibold"><SortButton label="Category / strategy" sortKey="category" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "exposure" ? (descending ? "descending" : "ascending") : "none"} className="min-w-64 px-4 py-3 text-left font-semibold"><SortButton label="Exposure" sortKey="exposure" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              {TABLE_METRICS.map((metric) => <th key={metric.key} scope="col" aria-sort={sortKey === `metric:${metric.key}` ? (descending ? "descending" : "ascending") : "none"} className="whitespace-nowrap px-4 py-3 text-right font-semibold"><SortButton label={metric.label} sortKey={`metric:${metric.key}`} currentSort={sortKey} descending={descending} onChange={onSort} /></th>)}
              <th scope="col" aria-sort={sortKey === "issuer" ? (descending ? "descending" : "ascending") : "none"} className="min-w-32 px-4 py-3 text-left font-semibold"><SortButton label="Issuer" sortKey="issuer" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "dataStatus" ? (descending ? "descending" : "ascending") : "none"} className="min-w-36 px-4 py-3 text-left font-semibold"><SortButton label="Data status" sortKey="dataStatus" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const compared = compareTickers.includes(record.ticker);
              const saved = Boolean(shortlist[record.ticker]);
              return (
                <tr
                  key={record.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelect(record)}
                  onKeyDown={(event) => handleRowKeyDown(event, record)}
                  className="group cursor-pointer border-b border-gray-100 last:border-0 hover:bg-indigo-50/40 focus:outline-none focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <th scope="row" className="sticky left-0 z-[1] bg-white px-4 py-3 text-left group-hover:bg-[#f8f8ff] group-focus-visible:bg-indigo-50">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-mono text-[10px] font-bold text-indigo-700">{record.ticker.slice(0, 2)}</span>
                      <span className="min-w-0"><span className="block font-mono font-bold text-gray-900">{record.ticker}</span><span className="mt-0.5 block max-w-44 truncate text-[11px] font-normal text-gray-500" title={record.name}>{record.name}</span></span>
                    </div>
                  </th>
                  <td className="px-4 py-3 align-top"><span className="block max-w-52 text-xs font-semibold text-gray-800">{formatCategory(record.category)}</span><span className="mt-1 flex flex-wrap gap-1">{record.badges.slice(0, 2).map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</span></td>
                  <td className="max-w-72 px-4 py-3 align-top text-xs leading-5 text-gray-600">{record.exposure}</td>
                  {TABLE_METRICS.map((metric) => <td key={metric.key} className={`px-4 py-3 text-right text-xs ${metric.key === "cagr5Y" ? "" : "whitespace-nowrap"}`}>{metric.key === "cagr5Y" ? <FundReturn record={record} /> : <FundMetric record={record} metricKey={metric.key} />}</td>)}
                  <td className="px-4 py-3 align-top text-xs text-gray-600">{record.issuer}</td>
                  <td className="px-4 py-3 align-top"><DataStatus record={record} /></td>
                  <td className="px-4 py-3 align-top"><div className="flex justify-end gap-1.5"><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${compared ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-700"}`} onClick={(event) => { event.stopPropagation(); onToggleCompare(record); }} disabled={!compared && compareTickers.length >= 4} aria-label={`${compared ? "Remove" : "Add"} ${record.ticker} ${compared ? "from" : "to"} comparison`}>{compared ? "Compared" : "Compare"}</button><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${saved ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-600 hover:border-amber-200 hover:text-amber-800"}`} onClick={(event) => { event.stopPropagation(); onToggleShortlist(record); }} aria-label={`${saved ? "Remove" : "Save"} ${record.ticker} ${saved ? "from" : "to"} shortlist`}>{saved ? "Saved" : "Save"}</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 lg:hidden">
        {records.map((record) => {
          const compared = compareTickers.includes(record.ticker);
          const saved = Boolean(shortlist[record.ticker]);
          return (
            <article key={record.id} className="p-4">
              <button type="button" onClick={() => onSelect(record)} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-mono text-[10px] font-bold text-indigo-700">{record.ticker.slice(0, 2)}</span><div className="min-w-0"><div className="font-mono font-bold text-gray-900">{record.ticker}</div><div className="truncate text-xs text-gray-500">{record.name}</div></div></div><DataStatus record={record} /></div>
                <p className="mt-3 text-xs leading-5 text-gray-600">{record.exposure}</p>
                <div className="mt-3 flex flex-wrap gap-1.5"><span className="badge border bg-indigo-50 text-indigo-700 border-indigo-200">{formatCategory(record.category)}</span>{record.badges.map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-4">{TABLE_METRICS.map((metric) => <div key={metric.key}><div className="text-[10px] uppercase tracking-wide text-gray-400">{metric.label}</div><div className="mt-1 text-xs">{metric.key === "cagr5Y" ? <FundReturn record={record} /> : <FundMetric record={record} metricKey={metric.key} />}</div></div>)}</div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[11px] text-gray-400">{record.issuer}</span><div className="flex gap-1.5"><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${compared ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => onToggleCompare(record)} disabled={!compared && compareTickers.length >= 4}>{compared ? "Compared" : "Compare"}</button><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${saved ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => onToggleShortlist(record)}>{saved ? "Saved" : "Save"}</button></div></div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CompareView({ records, onSelect, onRemove }: { records: ETFRecord[]; onSelect: (record: ETFRecord) => void; onRemove: (record: ETFRecord) => void }) {
  return (
    <section className="space-y-4" aria-labelledby="compare-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="compare-heading" className="text-lg font-bold text-gray-900">Compare selected funds</h2><p className="mt-1 text-xs text-gray-500">Compare sourced return, yield, drawdown, and holdings coverage for two to four funds.</p></div>
        <span className="text-xs font-semibold text-gray-500">{records.length}/4 selected</span>
      </div>
      {records.length === 0 ? (
        <div className="surface-card flex min-h-56 flex-col items-center justify-center p-8 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg text-indigo-600">↔</div><h3 className="mt-3 text-sm font-bold text-gray-900">Choose funds to compare</h3><p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Use the Compare action in Explore, then return here for a side-by-side view of exposure, structure, and data coverage.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {records.map((record) => (
            <article key={record.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onSelect(record)} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><div className="font-mono text-lg font-bold text-gray-900">{record.ticker}</div><div className="mt-0.5 line-clamp-2 text-xs text-gray-500">{record.name}</div></button><button type="button" onClick={() => onRemove(record)} className="text-xs text-gray-400 hover:text-red-600" aria-label={`Remove ${record.ticker} from comparison`}>Remove</button></div>
              <div className="mt-3 flex flex-wrap gap-1">{record.badges.map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</div>
              <dl className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Category</dt><dd className="text-right font-semibold text-gray-700">{formatCategory(record.category)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Issuer</dt><dd className="text-right text-gray-700">{record.issuer}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">5Y CAGR</dt><dd><FundMetric record={record} metricKey="cagr5Y" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">TTM yield</dt><dd><FundMetric record={record} metricKey="trailingDistributionYield" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">5Y drawdown</dt><dd><FundMetric record={record} metricKey="maxDrawdown5Y" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Top-ten overlap</dt><dd className="text-right">{records.length < 2 ? "Select another fund" : records.filter((peer) => peer.ticker !== record.ticker).map((peer) => { const value = weightedHoldingsOverlap(record.metricSnapshot?.holdings ?? [], peer.metricSnapshot?.holdings ?? []); return <span key={peer.ticker} className="block">{peer.ticker}: {value == null ? "Holdings unavailable" : `≥${value.toFixed(2)}%`}</span>; })}</dd></div>
              </dl>
              <p className="mt-4 text-[11px] leading-4 text-gray-500">{record.exposure}</p>
            </article>
          ))}
        </div>
      )}
      {records.length > 0 && <p className="text-[11px] leading-5 text-gray-500">Top-ten overlap is a minimum: it sums shared symbols’ smaller reported weights across the providers’ top-ten lists and does not capture holdings outside those lists.</p>}
      <div className="surface-card border border-amber-200 bg-amber-50/70 p-4 text-xs leading-5 text-amber-900"><strong>Comparison rule:</strong> return history uses adjusted prices over the same date windows, while trailing cash yield uses reported distribution events. The source date and coverage state are shown with every fund.</div>
    </section>
  );
}

function ShortlistView({ records, shortlist, onSelect, onRemove, onUpdate }: { records: ETFRecord[]; shortlist: Record<string, ShortlistEntry>; onSelect: (record: ETFRecord) => void; onRemove: (record: ETFRecord) => void; onUpdate: (ticker: string, field: keyof Omit<ShortlistEntry, "ticker">, value: string) => void }) {
  return (
    <section className="space-y-4" aria-labelledby="shortlist-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="shortlist-heading" className="text-lg font-bold text-gray-900">Shortlist and decision notes</h2><p className="mt-1 text-xs text-gray-500">Save funds and record the role, reason, concerns, and research state that matter to you.</p></div><span className="text-xs text-gray-400">Saved in this browser</span></div>
      {records.length === 0 ? <div className="surface-card flex min-h-56 flex-col items-center justify-center p-8 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-lg text-amber-700">☆</div><h3 className="mt-3 text-sm font-bold text-gray-900">Your shortlist is empty</h3><p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Use Save in Explore to keep a fund here. Notes stay separate from sourced catalogue facts.</p></div> : <div className="space-y-3">{records.map((record) => { const entry = shortlist[record.ticker]; return <article key={record.id} className="surface-card p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onSelect(record)} className="font-mono text-lg font-bold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{record.ticker}</button><DataStatus record={record} /></div><p className="mt-1 text-xs text-gray-500">{record.name}</p><p className="mt-2 text-xs leading-5 text-gray-600">{record.exposure}</p></div><button type="button" onClick={() => onRemove(record)} className="self-start text-xs font-semibold text-red-500 hover:text-red-700">Remove</button></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Intended role<input className="input-field mt-1 w-full" placeholder="e.g. core US equity" value={entry.role} onChange={(event) => onUpdate(record.ticker, "role", event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Research status<input className="input-field mt-1 w-full" placeholder="e.g. waiting for drawdown history" value={entry.researchStatus} onChange={(event) => onUpdate(record.ticker, "researchStatus", event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Why am I interested?<textarea className="input-field mt-1 min-h-20 w-full resize-y" placeholder="What would this add?" value={entry.reason} onChange={(event) => onUpdate(record.ticker, "reason", event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Concerns to resolve<textarea className="input-field mt-1 min-h-20 w-full resize-y" placeholder="Costs, overlap, structure, or risk questions" value={entry.concerns} onChange={(event) => onUpdate(record.ticker, "concerns", event.target.value)} /></label></div></article>; })}</div>}
    </section>
  );
}

function ETFDetailDrawer({ record, saved, compared, onClose, onToggleShortlist, onToggleCompare }: { record: ETFRecord; saved: boolean; compared: boolean; onClose: () => void; onToggleShortlist: (record: ETFRecord) => void; onToggleCompare: (record: ETFRecord) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="etf-detail-heading" className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-white/95 p-5 backdrop-blur sm:p-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-indigo-600">{record.ticker}</span><span className="badge border bg-indigo-50 text-indigo-700 border-indigo-200">{record.kind === "etn" ? "ETN" : "ETF / ETF-like"}</span><DataStatus record={record} /></div><h2 id="etf-detail-heading" className="mt-2 text-xl font-bold tracking-tight text-gray-900">{record.name}</h2><p className="mt-1 text-xs text-gray-500">{record.issuer} · {formatCategory(record.category)}</p></div><button type="button" className="btn btn-ghost shrink-0" onClick={onClose} aria-label="Close ETF details">Close</button></div>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2"><button type="button" className={`btn ${compared ? "btn-primary" : "btn-secondary"}`} onClick={() => onToggleCompare(record)}>{compared ? "Remove from compare" : "Add to compare"}</button><button type="button" className={`btn ${saved ? "btn-secondary" : "btn-ghost"}`} onClick={() => onToggleShortlist(record)}>{saved ? "Saved to shortlist" : "Save to shortlist"}</button></div>

          {record.identityWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Identity review required.</strong> {record.identityWarning}</div>}

          <section aria-labelledby="what-buying-heading"><h3 id="what-buying-heading" className="text-sm font-bold text-gray-900">What am I buying?</h3><p className="mt-2 text-sm leading-6 text-gray-600">{record.exposure}</p><p className="mt-2 text-xs leading-5 text-gray-500">{roleExplanation(record)}</p><div className="mt-3 flex flex-wrap gap-1.5">{record.badges.map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</div></section>

          <section aria-labelledby="fund-overview-heading"><h3 id="fund-overview-heading" className="text-sm font-bold text-gray-900">Fund overview</h3><dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 text-xs sm:grid-cols-2">{[["Issuer", record.issuer], ["Catalogue category", formatCategory(record.category)], ["Structure", formatStructure(record.structure)], ["Platform asset ID", String(record.assetId)], ["Catalogue listing", "Public listing observed"], ["Tradability", "Authenticated tradability not checked"], ["Catalogue page", record.cataloguePage ? String(record.cataloguePage) : "US catalogue addition"], ["Source observed", formatSnapshotDate(record.observedAt)], ["Inception date", metricText("inceptionDate", record.metricSnapshot?.values.inceptionDate, record.metricSnapshot?.states.inceptionDate)], ["Expense ratio", metricText("expenseRatio", record.metricSnapshot?.values.expenseRatio, record.metricSnapshot?.states.expenseRatio)], ["Fund net assets", metricText("netAssets", record.metricSnapshot?.values.netAssets, record.metricSnapshot?.states.netAssets, record.metricSnapshot?.currency)]].map(([label, value]) => <div key={label}><dt className="text-gray-400">{label}</dt><dd className="mt-1 font-semibold text-gray-700">{value}</dd></div>)}</dl>{(record.leverageTarget || record.resetInterval) && <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600"><strong className="text-gray-800">Reset and leverage:</strong> {record.leverageTarget ? `${record.leverageTarget} target` : "Target not recorded"}{record.resetInterval ? ` · ${record.resetInterval} reset` : ""}. This is a property of the underlying product, separate from any account-level financing.</div>}</section>

          <section aria-labelledby="metric-status-heading"><div className="flex items-end justify-between gap-3"><div><h3 id="metric-status-heading" className="text-sm font-bold text-gray-900">Analysis coverage</h3><p className="mt-1 text-xs text-gray-500">Values come from the provider history and are calculated with the date and source shown below.</p></div><span className="badge border bg-gray-50 text-gray-600 border-gray-200">Market data {record.metricSnapshot?.observedAt ?? "no stored snapshot"}</span></div><div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2">{DETAIL_METRICS.map((key) => <div key={key} className="flex items-center justify-between gap-3 text-xs"><span className="text-gray-500">{ETF_METRIC_LABELS[key]}</span><FundMetric record={record} metricKey={key} /></div>)}</div><p className="mt-3 text-[11px] leading-5 text-gray-400">{record.metricSnapshot?.source ?? "Yahoo Finance via yahoo-finance2"}. NA indicates short price history; missing provider fields and open recovery periods keep their own status instead of receiving estimated values.</p></section>

          {Object.keys(record.candidateMetrics).length > 0 && <details className="rounded-xl border border-gray-200"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Issuer research leads · unvalidated</summary><div className="border-t border-gray-100 px-4 py-3"><p className="text-[11px] leading-5 text-amber-800">These observations come from issuer research and are shown for review only. They are not production comparison values.</p><dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">{Object.entries(record.candidateMetrics).map(([key, value]) => <div key={key}><dt className="text-gray-400">{candidateMetricLabel(key)}</dt><dd className="mt-1 font-semibold text-gray-700">{value}</dd></div>)}</dl></div></details>}

          <section aria-labelledby="sources-heading"><h3 id="sources-heading" className="text-sm font-bold text-gray-900">Source trail</h3><div className="mt-3 space-y-2 text-xs">{record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-indigo-700 hover:bg-indigo-50"><span>{record.sourceTitle}</span><span aria-hidden="true">↗</span></a> : <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-gray-400">Issuer source URL not recorded.</p>}<a href={record.pluangUrl} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-indigo-700 hover:bg-indigo-50"><span>Pluang public profile · catalogue evidence</span><span aria-hidden="true">↗</span></a></div><p className="mt-3 text-[11px] leading-5 text-gray-400">Availability is catalogue-listed evidence from the {formatSnapshotDate(record.observedAt)} snapshot. It does not confirm account-specific access or authenticated tradability.</p></section>
        </div>
      </aside>
    </div>
  );
}

export default function ETFExplorer({ catalogue, etns, exclusions, categoryMeta, counts, snapshotDate, initialMetricSnapshots, initialMetricLoadError }: ETFExplorerProps) {
  const [view, setView] = useState<View>("explore");
  const [scope, setScope] = useState<Scope>("etf");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [strategy, setStrategy] = useState<ETFStrategy | "all">("all");
  const [issuer, setIssuer] = useState("all");
  const [dataFilter, setDataFilter] = useState<DataFilter>("all");
  const [includeComplex, setIncludeComplex] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState<ETFRecord | null>(null);
  const [compareTickers, setCompareTickers] = useState<string[]>([]);
  const [shortlist, setShortlist] = useState<Record<string, ShortlistEntry>>({});
  const [shortlistHydrated, setShortlistHydrated] = useState(false);
  const [metricSnapshots, setMetricSnapshots] = useState<Record<string, ETFMetricSnapshot>>(initialMetricSnapshots);
  const [metricLoadError, setMetricLoadError] = useState(initialMetricLoadError);
  const [metricRetrying, setMetricRetrying] = useState(false);

  const allRecords = useMemo<ETFRecord[]>(
    () => [...catalogue, ...etns].map((record): ETFRecord => ({ ...record, metricSnapshot: metricSnapshots[record.ticker] })),
    [catalogue, etns, metricSnapshots],
  );
  const recordByTicker = useMemo(() => new Map(allRecords.map((record) => [record.ticker, record])), [allRecords]);

  const reloadMetricSnapshots = useCallback(async () => {
    setMetricRetrying(true);
    try {
      const response = await fetch("/api/etf-metrics", { cache: "no-store" });
      if (!response.ok) throw new Error("Stored market-data snapshots are unavailable");
      const payload = await response.json() as { snapshots?: Record<string, ETFMetricSnapshot> };
      setMetricSnapshots(payload.snapshots ?? {});
      setMetricLoadError(false);
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") console.warn("[etf-metrics] snapshot load failed", error.message);
      setMetricLoadError(true);
    } finally {
      setMetricRetrying(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
        if (stored) setShortlist(JSON.parse(stored) as Record<string, ShortlistEntry>);
      } catch {
        // A blocked or malformed local-storage value should not prevent catalogue browsing.
      }
      setShortlistHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (shortlistHydrated) window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(shortlist));
  }, [shortlist, shortlistHydrated]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [selected]);

  const scopedRecords = useMemo(
    () => allRecords.filter((record) => scope === "all" || record.kind === scope),
    [scope, allRecords],
  );
  const issuers = useMemo(() => [...new Set(scopedRecords.map((record) => record.issuer))].sort((a, b) => a.localeCompare(b)), [scopedRecords]);
  const categoryCounts = useMemo(() => {
    const countsByCategory = new Map<string, number>();
    catalogue.forEach((record) => countsByCategory.set(record.category, (countsByCategory.get(record.category) ?? 0) + 1));
    return countsByCategory;
  }, [catalogue]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = scopedRecords.filter((record) => {
      const matchesSearch = !query || [record.ticker, record.name, record.issuer, record.exposure, record.category, ...record.badges].join(" ").toLowerCase().includes(query);
      const matchesCategory = category === "all" || record.category === category;
      const matchesStrategy = strategy === "all" || record.strategy === strategy;
      const matchesIssuer = issuer === "all" || record.issuer === issuer;
      const matchesData = dataFilter === "all" || (dataFilter === "identity-warning" ? Boolean(record.identityWarning) : !record.identityWarning);
      const matchesComplexity = includeComplex || !isComplex(record);
      return matchesSearch && matchesCategory && matchesStrategy && matchesIssuer && matchesData && matchesComplexity;
    });
    return rows.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === null) return bv === null ? a.ticker.localeCompare(b.ticker) : 1;
      if (bv === null) return -1;
      const comparison = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      if (comparison !== 0) return descending ? -comparison : comparison;
      return a.ticker.localeCompare(b.ticker);
    });
  }, [scopedRecords, search, category, strategy, issuer, dataFilter, includeComplex, sortKey, descending]);

  const compareRecords = compareTickers.map((ticker) => recordByTicker.get(ticker)).filter((record): record is ETFRecord => Boolean(record));
  const shortlistRecords = Object.keys(shortlist).map((ticker) => recordByTicker.get(ticker)).filter((record): record is ETFRecord => Boolean(record));
  const activeFilterCount = [search.trim(), category !== "all" ? category : "", strategy !== "all" ? strategy : "", issuer !== "all" ? issuer : "", dataFilter !== "all" ? dataFilter : "", !includeComplex ? "simple" : ""].filter(Boolean).length;

  function toggleCompare(record: ETFRecord) {
    setCompareTickers((current) => current.includes(record.ticker) ? current.filter((ticker) => ticker !== record.ticker) : current.length < 4 ? [...current, record.ticker] : current);
  }

  function toggleShortlist(record: ETFRecord) {
    setShortlist((current) => {
      if (current[record.ticker]) {
        const next = { ...current };
        delete next[record.ticker];
        return next;
      }
      return { ...current, [record.ticker]: { ticker: record.ticker, role: "", reason: "", concerns: "", researchStatus: "Needs more research" } };
    });
  }

  function updateShortlist(ticker: string, field: keyof Omit<ShortlistEntry, "ticker">, value: string) {
    setShortlist((current) => ({ ...current, [ticker]: { ...current[ticker], [field]: value } }));
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) setDescending((value) => !value);
    else { setSortKey(key); setDescending(false); }
  }

  function clearFilters() {
    setSearch(""); setCategory("all"); setStrategy("all"); setIssuer("all"); setDataFilter("all"); setIncludeComplex(true);
  }

  function changeScope(nextScope: Scope) {
    setScope(nextScope);
    setCategory("all");
  }

  function exportCsv() {
    const headers = ["Ticker", "Name", "Issuer", "Exposure", "Category", "Strategy", "Structure", "Instrument", "Asset ID", "Catalogue page", "Availability", "Research status", "Identity warning", "Issuer source", "Issuer source URL", "Snapshot date", "Candidate metrics (unvalidated)", ...Object.values(ETF_METRIC_LABELS).flatMap((label) => [`${label} value`, `${label} state`])];
    const rows = filteredRecords.map((record) => [
      record.ticker, record.name, record.issuer, record.exposure, record.category, strategyLabel(record.strategy), formatStructure(record.structure), record.kind === "etn" ? "ETN" : "ETF / ETF-like", record.assetId, record.cataloguePage ?? "", record.availabilityStatus, record.researchStatus, record.identityWarning ?? "", record.sourceTitle, record.sourceUrl, record.observedAt, Object.entries(record.candidateMetrics).map(([key, value]) => `${candidateMetricLabel(key)}: ${value}`).join("; "),
      ...Object.keys(ETF_METRIC_LABELS).flatMap((key) => [
        record.metricSnapshot?.values[key as ETFMetricKey] ?? "",
        record.metricSnapshot?.states[key as ETFMetricKey] ?? record.metricStates[key as ETFMetricKey],
      ]),
    ]);
    downloadCsv(`etf-catalogue-${snapshotDate}.csv`, headers, rows);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">ETF catalogue</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Explore the fund universe</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Browse what the public Pluang catalogue lists, understand the exposure and structure, then compare or shortlist funds without hiding missing research.</p></div>
        <div className="text-left text-[11px] text-gray-500 sm:text-right"><div className="font-semibold text-gray-700">Public snapshot · {formatSnapshotDate(snapshotDate)}</div><div>Catalogue evidence only · tradability not confirmed</div></div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ETF catalogue coverage"><SummaryCard label="ETF / ETF-like" value={counts.etfLike} note="Retained candidates in the reviewed public catalogue" tone="text-indigo-700" /><SummaryCard label="Separate ETNs" value={counts.etns} note="Shown separately because issuer-credit risk differs" tone="text-red-700" /><SummaryCard label="Excluded discoveries" value={counts.exclusions} note="2 company stocks and 1 closed-end fund" /><SummaryCard label="Tradability confirmed" value={counts.tradabilityConfirmed} note="Authenticated account access was not checked" tone="text-amber-700" /></section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 sm:p-5" aria-label="Data coverage notice"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">i</span><div><h2 className="text-sm font-bold text-sky-950">Fund metrics are refreshed automatically</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-sky-900">{metricLoadError ? "Saved market data could not be loaded." : `${Object.keys(metricSnapshots).length} funds have stored market-data snapshots.`} Returns, drawdown, volatility, and cash yield are calculated from Yahoo Finance daily prices and distribution events. Fund size, expense ratio, inception date, and top holdings are shown when Yahoo Finance reports them. Each row keeps its source date and tells you when history is short or a provider field is missing. Listing evidence still does not confirm account-specific tradability.</p>{metricLoadError && <button type="button" onClick={() => void reloadMetricSnapshots()} disabled={metricRetrying} className="mt-2 text-xs font-semibold text-sky-800 underline disabled:opacity-60">{metricRetrying ? "Retrying…" : "Retry loading saved data"}</button>}</div></div></section>

      <nav className="segmented w-full overflow-x-auto sm:w-fit" aria-label="ETF page views"><button type="button" className={`segmented-btn flex-1 sm:flex-none ${view === "explore" ? "is-active" : ""}`} onClick={() => setView("explore")}>Explore <span className="ml-1 text-[10px] text-gray-400">{filteredRecords.length}</span></button><button type="button" className={`segmented-btn flex-1 sm:flex-none ${view === "compare" ? "is-active" : ""}`} onClick={() => setView("compare")}>Compare <span className="ml-1 text-[10px] text-gray-400">{compareRecords.length}</span></button><button type="button" className={`segmented-btn flex-1 sm:flex-none ${view === "shortlist" ? "is-active" : ""}`} onClick={() => setView("shortlist")}>Shortlist <span className="ml-1 text-[10px] text-gray-400">{shortlistRecords.length}</span></button></nav>

      {view === "explore" && <>
        <section className="space-y-4" aria-labelledby="catalogue-heading"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="catalogue-heading" className="text-lg font-bold text-gray-900">Catalogue overview</h2><p className="mt-1 text-xs text-gray-500">Choose a category or search across ticker, name, issuer, exposure, and strategy tags.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={`btn ${scope === "etf" ? "btn-primary" : "btn-secondary"}`} onClick={() => changeScope("etf")}>ETF / ETF-like · {catalogue.length}</button><button type="button" className={`btn ${scope === "etn" ? "btn-primary" : "btn-secondary"}`} onClick={() => changeScope("etn")}>ETNs · {etns.length}</button><button type="button" className={`btn ${scope === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => changeScope("all")}>All · {allRecords.length}</button></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{categoryMeta.map((item) => <CategoryCard key={item.key} category={item} count={categoryCounts.get(item.key) ?? 0} active={category === item.key} onClick={() => { setCategory(category === item.key ? "all" : item.key); setScope("etf"); }} />)}</div>
        </section>

        <section className="surface-card p-4 sm:p-5" aria-label="ETF catalogue filters"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="text-xs font-semibold text-gray-600 xl:col-span-2">Search<input type="search" className="input-field mt-1 w-full" placeholder="Ticker, name, issuer, exposure…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Category<select className="input-field mt-1 w-full" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categoryMeta.map((item) => <option key={item.key} value={item.key}>{formatCategory(item.key)}</option>)}</select></label><label className="text-xs font-semibold text-gray-600">Strategy<select className="input-field mt-1 w-full" value={strategy} onChange={(event) => setStrategy(event.target.value as ETFStrategy | "all")}><option value="all">All strategies</option>{STRATEGY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs font-semibold text-gray-600">Issuer<select className="input-field mt-1 w-full" value={issuer} onChange={(event) => setIssuer(event.target.value)}><option value="all">All issuers</option>{issuers.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3"><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={includeComplex} onChange={(event) => setIncludeComplex(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />Include leveraged, inverse, and option-income products</label><label className="flex items-center gap-2 text-xs text-gray-600">Data state<select className="input-field py-1" value={dataFilter} onChange={(event) => setDataFilter(event.target.value as DataFilter)}><option value="all">All rows</option><option value="identity-warning">Identity review</option><option value="source-located">Source located</option></select></label><span className="text-[11px] text-gray-400">Numeric filters unlock after validated enrichment.</span>{activeFilterCount > 0 && <button type="button" className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800" onClick={clearFilters}>Clear filters ({activeFilterCount})</button>}</div></section>

        <section className="surface-card overflow-hidden" aria-labelledby="comparison-table-heading"><div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5"><div><h2 id="comparison-table-heading" className="text-lg font-bold text-gray-900">Browse funds</h2><p className="mt-1 text-xs text-gray-500">{filteredRecords.length} of {scopedRecords.length} records · alphabetical by default · select a row for the research panel</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>{compareRecords.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => setView("compare")}>Review compare · {compareRecords.length}</button>}</div></div>{filteredRecords.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">No catalogue rows match these filters.</div> : <ETFTable records={filteredRecords} shortlist={shortlist} compareTickers={compareTickers} onSelect={setSelected} onToggleShortlist={toggleShortlist} onToggleCompare={toggleCompare} sortKey={sortKey} descending={descending} onSort={changeSort} />}</section>
        <p className="text-[11px] leading-5 text-gray-400">Metric columns show stored values on the initial page render. If a value is unavailable, the row gives its reason (NA for short history or missing provider data); missing values are never replaced with zero or an estimate.</p>
      </>}

      {view === "compare" && <CompareView records={compareRecords} onSelect={setSelected} onRemove={toggleCompare} />}
      {view === "shortlist" && <ShortlistView records={shortlistRecords} shortlist={shortlist} onSelect={setSelected} onRemove={toggleShortlist} onUpdate={updateShortlist} />}

      {selected && <ETFDetailDrawer record={recordByTicker.get(selected.ticker) ?? selected} saved={Boolean(shortlist[selected.ticker])} compared={compareTickers.includes(selected.ticker)} onClose={() => setSelected(null)} onToggleShortlist={toggleShortlist} onToggleCompare={toggleCompare} />}

      <details className="surface-card overflow-hidden"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Audit boundary · {exclusions.length} discoveries excluded from the fund table</summary><div className="border-t border-gray-100 px-4 py-3"><p className="text-[11px] leading-5 text-gray-500">The public audit also found labels that resolve to operating-company stocks or a closed-end fund. They remain accounted for here and are excluded from ETF / ETN comparisons.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{exclusions.map((record) => <div key={record.id} className="rounded-lg bg-gray-50 p-3"><div className="font-mono text-xs font-bold text-gray-800">{record.ticker}</div><div className="mt-1 text-[11px] text-gray-500">{formatStructure(record.structure)} · {record.name}</div></div>)}</div></div></details>

      <footer className="border-t border-[var(--border)] pt-4 text-[11px] leading-5 text-gray-400">Catalogue snapshot observed {formatSnapshotDate(snapshotDate)}. Financial figures are sourced from Yahoo Finance, calculated from daily adjusted prices and distribution events, and refreshed by the scheduled data job. Provider coverage differs by fund; the displayed status and observation date apply to each row. Review current issuer documents and customer terms before acting.</footer>
    </div>
  );
}
