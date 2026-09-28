import type { AnnualUsdIdrChange, UsdIdrPeriodSummary } from "@/lib/performanceReturns";

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatRate(value: number | null) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function changeTone(value: number | null) {
  return value == null ? "text-gray-400" : value > 0 ? "text-emerald-700" : value < 0 ? "text-red-600" : "text-gray-700";
}

function statusLabel(status: AnnualUsdIdrChange["status"]) {
  if (status === "complete") return "Complete";
  if (status === "provider unavailable") return "Provider unavailable";
  if (status === "no FX history") return "No FX history";
  if (status === "missing prior-year close") return "Missing prior-year close";
  return "Missing in-year close";
}

function SummaryCard({ label, value, detail, tone = "text-gray-900" }: { label: string; value: string; detail: string; tone?: string }) {
  return <div className="rounded-lg bg-gray-50 px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div><div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div><div className="mt-0.5 text-[10px] text-gray-500">{detail}</div></div>;
}

export default function PerformanceReturnsFxPanel({
  rows,
  summary,
  currentYear,
  fxAsOfDate,
  latestUsdIdr,
  fetchedAt,
  loading,
}: {
  rows: readonly AnnualUsdIdrChange[];
  summary: UsdIdrPeriodSummary;
  currentYear: number;
  fxAsOfDate: string | null;
  latestUsdIdr: number | null;
  fetchedAt: string | null;
  loading: boolean;
}) {
  return (
    <section className="surface-card overflow-hidden" aria-labelledby="usd-idr-strength-title">
      <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Currency context</p>
            <h2 id="usd-idr-strength-title" className="mt-1 text-base font-bold text-gray-900">USD/IDR strength <span className="font-medium text-gray-500">(IDR per USD)</span></h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">A rising IDR-per-USD rate means the US dollar strengthened against the rupiah. Annual change compares the prior year’s last close with the selected year’s last available close.</p>
          </div>
          <div className="text-right text-[10px] leading-4 text-gray-500">
            <div>Source: Yahoo Finance · IDR=X</div>
            <div>Latest FX close: {fxAsOfDate ?? "Unavailable"}{latestUsdIdr != null ? ` · ${formatRate(latestUsdIdr)} IDR/USD` : ""}</div>
            {fetchedAt ? <div>Fetched {new Date(fetchedAt).toLocaleString()}</div> : null}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SummaryCard
            label="Cumulative USD strengthening"
            value={formatPct(summary.cumulativeUsdStrengthPct)}
            detail={summary.startDate && summary.endDate ? `${summary.startDate} to ${summary.endDate}` : "Full selected-period endpoints required"}
            tone={changeTone(summary.cumulativeUsdStrengthPct)}
          />
          <SummaryCard
            label="Observed annualized change"
            value={formatPct(summary.annualizedUsdStrengthPct)}
            detail="Annualized from the actual elapsed dates; historical, not a forecast"
            tone={changeTone(summary.annualizedUsdStrengthPct)}
          />
          <SummaryCard
            label="Years with usable FX data"
            value={`${summary.completeYears} / ${summary.totalYears}`}
            detail="Missing observations remain unavailable"
          />
        </div>
      </div>

      {loading ? <p className="px-4 py-3 text-xs text-gray-500" role="status">Loading historical USD/IDR rates…</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <caption className="sr-only">Annual USD strengthening against the Indonesian rupiah, measured as the change in IDR per US dollar.</caption>
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500"><tr>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5">Year</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5">Beginning rate</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5">Ending rate</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5">USD strengthened</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => <tr key={row.year} className={`${row.year === currentYear ? "bg-blue-50/70" : ""} hover:bg-gray-50`}>
              <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">{row.year}{row.year === currentYear ? <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-700">YTD</span> : null}</th>
              <td className="whitespace-nowrap px-3 py-2.5 text-gray-700" title={row.startDate ?? undefined}>{formatRate(row.startUsdIdr)}{row.startDate ? <span className="ml-1 text-[10px] text-gray-400">({row.startDate})</span> : null}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-gray-700" title={row.endDate ?? undefined}>{formatRate(row.endUsdIdr)}{row.endDate ? <span className="ml-1 text-[10px] text-gray-400">({row.endDate})</span> : null}</td>
              <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${changeTone(row.usdStrengthPct)}`}>{formatPct(row.usdStrengthPct)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{statusLabel(row.status)}</td>
            </tr>)}
            {rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-5 text-center text-gray-500">Select a year range to view annual USD/IDR changes.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 px-4 py-2.5 text-[10px] leading-4 text-gray-500 sm:px-5">
        Formula: (ending IDR per USD ÷ beginning IDR per USD − 1) × 100. Positive means USD strengthened; this observed currency series is separate from the USD stock-return figures above.
      </div>
    </section>
  );
}
