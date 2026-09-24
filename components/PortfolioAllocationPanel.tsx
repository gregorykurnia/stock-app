"use client";

import { useMemo } from "react";
import {
  buildPortfolioAllocation,
  type PortfolioAllocation,
  type PortfolioAllocationBucket,
} from "@/lib/portfolioAllocation";
import type { LedgerTransaction } from "@/lib/portfolioLedger";
import type { PerformanceCurrency } from "@/components/PortfolioPerformanceChart";
import type { PortfolioBucket } from "@/lib/portfolioBuckets";

const BUCKET_COLORS: Record<PortfolioBucket, string> = {
  longterm: "#0ea5e9",
  index: "#8b5cf6",
  swing: "#f59e0b",
  treasury: "#10b981",
};

interface Props {
  transactions: readonly LedgerTransaction[] | undefined;
  currency: PerformanceCurrency;
  fxRateUsdIdr?: number | null;
  companyNames?: Record<string, string | null>;
  loading?: boolean;
}

function formatMoney(value: number, currency: PerformanceCurrency) {
  return new Intl.NumberFormat(currency === "idr" ? "id-ID" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency === "idr" ? 0 : 2,
  }).format(value);
}

function displayMoney(valueUsd: number, currency: PerformanceCurrency, fxRateUsdIdr?: number | null) {
  if (currency === "idr") {
    if (fxRateUsdIdr == null || !Number.isFinite(fxRateUsdIdr) || fxRateUsdIdr <= 0) return null;
    return formatMoney(valueUsd * fxRateUsdIdr, currency);
  }
  return formatMoney(valueUsd, currency);
}

function allocationLabel(bucket: PortfolioAllocationBucket, currency: PerformanceCurrency, fxRateUsdIdr?: number | null) {
  const value = displayMoney(bucket.costBasisUsd, currency, fxRateUsdIdr);
  return `${bucket.label}: ${value ?? formatMoney(bucket.costBasisUsd, "usd")} · ${bucket.percentage.toFixed(2)}% of entry value`;
}

function selectedCurrencyValue(valueUsd: number, currency: PerformanceCurrency, fxRateUsdIdr?: number | null) {
  if (currency === "usd") return valueUsd;
  if (fxRateUsdIdr == null || !Number.isFinite(fxRateUsdIdr) || fxRateUsdIdr <= 0) return null;
  return valueUsd * fxRateUsdIdr;
}

function csvCell(value: string | number | null | undefined) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);

  const safeValue = /^[\s\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function buildAllocationCsv(
  allocation: PortfolioAllocation,
  currency: PerformanceCurrency,
  fxRateUsdIdr: number | null | undefined,
  companyNames: Record<string, string | null>,
) {
  const headers = [
    "section",
    "metric",
    "metric_value",
    "metric_unit",
    "rank",
    "ticker",
    "company_name",
    "bucket",
    "bucket_label",
    "quantity",
    "entry_value_usd",
    "selected_currency",
    "entry_value_selected_currency",
    "share_of_total_percent",
    "cost_basis_status",
  ];
  const rows: (string | number | null | undefined)[][] = [
    headers,
    ["portfolio_summary", "allocation_status", allocation.status, "status"],
    [
      "portfolio_summary",
      "total_entry_value",
      allocation.totalEntryValueUsd,
      "USD",
      null,
      null,
      null,
      null,
      null,
      null,
      allocation.totalEntryValueUsd,
      currency.toUpperCase(),
      selectedCurrencyValue(allocation.totalEntryValueUsd, currency, fxRateUsdIdr),
      allocation.totalEntryValueUsd > 0 ? 100 : 0,
      "recorded_cost_basis",
    ],
    ["portfolio_summary", "position_count", allocation.positionCount, "positions"],
    ["portfolio_summary", "missing_cost_basis_tickers", allocation.missingCostBasisTickers.join("; "), "tickers"],
  ];

  for (const bucket of Object.values(allocation.buckets)) {
    rows.push([
      "bucket_allocation",
      "entry_value",
      null,
      null,
      null,
      null,
      null,
      bucket.bucket,
      bucket.label,
      null,
      bucket.costBasisUsd,
      currency.toUpperCase(),
      selectedCurrencyValue(bucket.costBasisUsd, currency, fxRateUsdIdr),
      bucket.percentage,
      "recorded_cost_basis",
    ]);
  }

  allocation.holdings.forEach((holding, index) => {
    rows.push([
      "holdings",
      "position_entry_value",
      null,
      null,
      index + 1,
      holding.ticker,
      companyNames[holding.ticker]?.trim() || "",
      holding.bucket,
      holding.bucketLabel,
      holding.quantity,
      holding.costBasisUsd,
      currency.toUpperCase(),
      holding.hasCostBasis ? selectedCurrencyValue(holding.costBasisUsd, currency, fxRateUsdIdr) : null,
      holding.percentage,
      holding.hasCostBasis ? "available" : "missing",
    ]);
  });

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function DonutChart({ allocation, currency, fxRateUsdIdr }: { allocation: PortfolioAllocation; currency: PerformanceCurrency; fxRateUsdIdr?: number | null }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const totalLabel = displayMoney(allocation.totalEntryValueUsd, currency, fxRateUsdIdr);

  return (
    <div className="relative h-56 w-56 shrink-0" aria-label={`Portfolio entry value allocation: ${totalLabel ?? formatMoney(allocation.totalEntryValueUsd, "usd")}`}>
      <svg viewBox="0 0 180 180" className="h-full w-full" role="img" aria-labelledby="allocation-donut-title allocation-donut-description">
        <title id="allocation-donut-title">Portfolio allocation by entry value</title>
        <desc id="allocation-donut-description">The four portfolio buckets are sized by their share of open-position cost basis. Cash is excluded.</desc>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef0f5" strokeWidth="18" />
        {Object.values(allocation.buckets).map((bucket) => {
          const segmentLength = circumference * bucket.percentage / 100;
          const segment = (
            <circle
              key={bucket.bucket}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={BUCKET_COLORS[bucket.bucket]}
              strokeWidth="18"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
              className="transition-[stroke-dasharray] duration-300"
            >
              <title>{allocationLabel(bucket, currency, fxRateUsdIdr)}</title>
            </circle>
          );
          offset += segmentLength;
          return segment;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <div className="text-xl font-bold tracking-tight text-gray-900">{totalLabel ?? "FX unavailable"}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Entry value</div>
      </div>
    </div>
  );
}

function Legend({ allocation, currency, fxRateUsdIdr }: { allocation: PortfolioAllocation; currency: PerformanceCurrency; fxRateUsdIdr?: number | null }) {
  return (
    <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2" aria-label="Allocation legend">
      {Object.values(allocation.buckets).map((bucket) => (
        <div key={bucket.bucket} className="min-w-0" title={allocationLabel(bucket, currency, fxRateUsdIdr)}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BUCKET_COLORS[bucket.bucket] }} aria-hidden="true" />
            <span className="truncate">{bucket.label}</span>
          </div>
          <div className="ml-4 mt-0.5 text-[10px] text-gray-400">{bucket.percentage.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return <div className="flex min-h-64 items-center justify-center text-sm text-gray-400 animate-pulse">Loading ledger allocation…</div>;
}

function EmptyState({ incomplete, missingCostBasisTickers }: { incomplete: boolean; missingCostBasisTickers: string[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
      <h3 className="font-semibold">{incomplete ? "Entry value data is incomplete" : "No open positions yet"}</h3>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-amber-800">
        {incomplete
          ? "Allocation percentages require a positive ledger cost basis for every open position. No market value has been substituted."
          : "Add open positions to the portfolio ledger to see their original allocation."}
      </p>
      {missingCostBasisTickers.length > 0 && (
        <p className="mt-2 text-[11px] font-medium text-amber-800">Missing cost basis: {missingCostBasisTickers.join(", ")}</p>
      )}
    </div>
  );
}

export default function PortfolioAllocationPanel({ transactions, currency, fxRateUsdIdr, companyNames = {}, loading = false }: Props) {
  const allocation = useMemo(
    () => transactions ? buildPortfolioAllocation(transactions) : null,
    [transactions],
  );

  function exportAllocationCsv() {
    if (!allocation) return;

    const blob = new Blob([buildAllocationCsv(allocation, currency, fxRateUsdIdr, companyNames)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `portfolio-allocation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="portfolio-allocation-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="portfolio-allocation-heading" className="text-base font-bold tracking-tight text-gray-900">Portfolio Allocation</h2>
            {allocation && <span className={`badge ${allocation.status === "ready" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{allocation.status}</span>}
          </div>
          <p className="mt-1 text-xs text-gray-500">Original allocation by open-position entry value</p>
        </div>
        {allocation && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportAllocationCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              aria-label="Export portfolio allocation as CSV"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M10 3.5v8m0 0 3-3m-3 3-3-3M4.5 13v2.5h11V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export CSV
            </button>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Positions</div>
              <div className="text-lg font-bold text-gray-900">{allocation.positionCount}</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {loading && !allocation ? <LoadingState /> : !transactions ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800">
            <h3 className="font-semibold">Allocation data unavailable</h3>
            <p className="mt-1 text-xs leading-5">The current portfolio ledger could not be loaded. No market value has been used as a fallback.</p>
          </div>
        ) : !allocation ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800">
            <h3 className="font-semibold">Allocation data unavailable</h3>
            <p className="mt-1 text-xs leading-5">The current portfolio ledger could not be reduced. No market value has been used as a fallback.</p>
          </div>
        ) : allocation.status === "empty" || allocation.totalEntryValueUsd <= 0 ? (
          <EmptyState incomplete={allocation.status === "incomplete"} missingCostBasisTickers={allocation.missingCostBasisTickers} />
        ) : (
          <>
            {allocation.status === "incomplete" && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                <strong>Incomplete cost basis:</strong> recorded percentages use ledger cost basis only; positions without cost basis remain visible but are not assigned an entry-value share.
              </div>
            )}
            <div className="grid gap-7 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.8fr)] lg:items-start">
              <div className="flex flex-col items-center gap-5 lg:sticky lg:top-4">
                <DonutChart allocation={allocation} currency={currency} fxRateUsdIdr={fxRateUsdIdr} />
                <div className="w-full max-w-xs">
                  <Legend allocation={allocation} currency={currency} fxRateUsdIdr={fxRateUsdIdr} />
                  <p className="mt-4 text-center text-[11px] leading-5 text-gray-400">Based on ledger cost basis · excludes cash.</p>
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Holdings by entry value</h3>
                    <p className="mt-0.5 text-[11px] text-gray-400">Largest positions first · percentages stay in USD cost basis</p>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400">{allocation.positionCount} positions</span>
                </div>
                <ol className="grid gap-1.5 xl:grid-cols-2" aria-label="Holdings ranked by entry value">
                  {allocation.holdings.map((holding, index) => {
                    const companyName = companyNames[holding.ticker]?.trim() || null;
                    const entryValue = holding.hasCostBasis
                      ? displayMoney(holding.costBasisUsd, currency, fxRateUsdIdr) ?? `${formatMoney(holding.costBasisUsd, "usd")} · FX unavailable`
                      : "Cost basis unavailable";
                    const percentage = holding.hasCostBasis ? `${holding.percentage.toFixed(2)}%` : "—";
                    return (
                      <li
                        key={`${holding.bucket}:${holding.ticker}`}
                        className="group rounded-xl border border-transparent p-2.5 transition-colors hover:border-[var(--border)] hover:bg-gray-50"
                        title={`${holding.ticker} · ${holding.bucketLabel} · ${entryValue} · ${percentage} of entry value`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">{index + 1}</span>
                              <span className="font-mono text-sm font-bold text-gray-900">{holding.ticker}</span>
                              <span className="truncate text-[10px] text-gray-400">{companyName ?? ""}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 pl-7 text-[10px] font-semibold text-gray-500">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BUCKET_COLORS[holding.bucket] }} aria-hidden="true" />
                              <span>{holding.bucketLabel}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-bold text-gray-900">{entryValue}</div>
                            <div className="mt-0.5 text-[10px] font-semibold text-gray-500">{percentage}</div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label={`${holding.ticker} share of total entry value`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={holding.percentage}>
                          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, holding.percentage))}%`, backgroundColor: BUCKET_COLORS[holding.bucket] }} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
