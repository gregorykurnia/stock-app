import Link from "next/link";
import type { Metadata } from "next";
import batchDocument from "@/data/etf-equity-index-validation-batch.json";
import {
  ETF_EQUITY_INDEX_BATCH_WEIGHTS,
  type ETFEquityIndexBatchSnapshot,
  type ETFEquityIndexResult,
} from "@/lib/etfEquityIndexValidationBatch";

export const runtime = "nodejs";
export const metadata: Metadata = { title: "Broad equity-index ETF validation batch" };

const batch = batchDocument as unknown as ETFEquityIndexBatchSnapshot;
const snapshot = batch;
const savedBatchPasses = snapshot.validation.batchReady
  && snapshot.validation.scoreReproducibility === "pass"
  && snapshot.validation.inRange === "pass"
  && snapshot.validation.commonScoresPassed === snapshot.validation.requiredCommonScores
  && snapshot.validation.historicalWindowsPassed === snapshot.validation.requiredHistoricalWindows;

function canDisplay(result: ETFEquityIndexResult | undefined): boolean {
  return savedBatchPasses
    && result?.status === "validated"
    && result.score != null
    && Number.isFinite(result.score)
    && result.score >= 0
    && result.score <= 100
    && Boolean(result.inputHash);
}

function score(result: ETFEquityIndexResult | undefined, places = 1): string {
  return canDisplay(result) && result?.score != null ? result.score.toFixed(places) : "—";
}

function scoreStatus(result: ETFEquityIndexResult): string {
  return canDisplay(result) ? "Validated" : "Blocked";
}

export default function ETFEquityIndexValidationPage() {
  const commonFunds = snapshot.funds.map((fund) => ({
    ...fund,
    oneYear: fund.results.find((result) => result.cutoff === snapshot.commonCutoff && result.horizon === "1Y"),
    threeYear: fund.results.find((result) => result.cutoff === snapshot.commonCutoff && result.horizon === "3Y"),
  }));
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <Link href="/etf" className="text-sm text-blue-600 hover:underline">← ETF catalogue</Link>
    <header className="mb-7 mt-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Separate scoring validation · 8 equity-index ETFs</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Broad equity-index validation batch</h1>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">Yahoo Finance adjusted prices and dated issuer net expense ratios are evaluated with the VOO/VXUS Free Core trial formula. The method contributes {(ETF_EQUITY_INDEX_BATCH_WEIGHTS.fee * 100).toFixed(2)}% from fee efficiency and {(ETF_EQUITY_INDEX_BATCH_WEIGHTS.historical * 100).toFixed(2)}% from historical outcomes. No spread input is required. These dated candidate results remain outside the ETF Core and Full scorecards.</p>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600">Captured {snapshot.asOf.slice(0, 10)}. Common cutoff: <strong>{snapshot.commonCutoff}</strong>. The historical-cutoff grid holds each fund’s current dated fee constant; a fee date after a cutoff means that result is sensitivity analysis, not a point-in-time backtest. Different mandates are shown without a pooled ranking.</p>
    </header>

    <section aria-label="Batch validation results" className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Common-cutoff scores</p><p className="mt-1 text-xl font-semibold text-gray-900">{snapshot.validation.commonScoresPassed}/{snapshot.validation.requiredCommonScores}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Historical windows</p><p className="mt-1 text-xl font-semibold text-gray-900">{snapshot.validation.historicalWindowsPassed}/{snapshot.validation.requiredHistoricalWindows}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Saved-score reproduction</p><p className="mt-1 text-xl font-semibold text-gray-900">{savedBatchPasses ? "Passed" : "Blocked"}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Batch validation</p><p className="mt-1 text-xl font-semibold text-gray-900">{savedBatchPasses ? "Passed" : "Incomplete"}</p></div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      {commonFunds.map((fund) => <article key={fund.ticker} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-bold text-gray-900">{fund.ticker}</h2><p className="mt-1 text-xs text-gray-500">{fund.name} · {fund.role}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fund.coverage.blockers.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{fund.coverage.blockers.length ? "Source blocker" : "Sources validated"}</span>
        </div>
        <p className="mt-4 text-sm text-gray-700">Annual net expense ratio: <strong>{fund.expenseRatio.valuePct.toFixed(3)}%</strong> · dated {fund.expenseRatio.financialDate} · <a className="text-blue-600 hover:underline" href={fund.expenseRatio.sourceUrl} target="_blank" rel="noreferrer">issuer disclosure</a></p>
        <p className="mt-2 text-xs leading-5 text-gray-500">Yahoo adjusted history: {fund.history ? `${fund.history.observations.toLocaleString()} rows · ${fund.history.firstDate}–${fund.history.lastDate} · ${fund.history.currency}` : "unavailable"} · <a className="text-blue-600 hover:underline" href={fund.history?.sourceUrl ?? `https://finance.yahoo.com/quote/${fund.ticker}/history/`} target="_blank" rel="noreferrer">price source</a></p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {([fund.oneYear, fund.threeYear] as const).map((result) => <section key={result?.horizon ?? "missing"} className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{result?.horizon ?? "Window"} · {snapshot.commonCutoff}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{score(result)}<span className="ml-1 text-xs font-normal text-gray-400">/ 100</span></p>
            <p className="mt-2 text-xs text-gray-600">{canDisplay(result) ? `${result?.monthlyReturnCount} monthly returns · ${result?.dailyObservations}/${result?.expectedSessions} daily sessions · ${result?.missingSessionCount} missing` : "Result unavailable"}</p>
            {!canDisplay(result) && result?.reason && <p className="mt-2 text-xs leading-5 text-amber-800">{result.reason}</p>}
            {canDisplay(result) && <p className="mt-2 text-xs text-gray-600">CAGR {result?.annualizedReturnPct?.toFixed(2)}% · drawdown {result?.maxDrawdownMagnitudePct?.toFixed(2)}% · downside deviation {result?.downsideDeviationPct?.toFixed(2)}%</p>}
          </section>)}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
          <p>History SHA-256: <span className="break-all">{fund.history?.sha256 ?? "not available"}</span></p>
          {fund.coverage.blockers.map((blocker) => <p key={blocker} className="mt-1 text-amber-800">{blocker}</p>)}
        </div>
        <details className="mt-4 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">Historical cutoff sensitivity and validation details</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="text-gray-500"><tr><th className="py-2 pr-3">Cutoff</th><th className="pr-3">Horizon</th><th className="pr-3">Status</th><th className="pr-3">Score</th><th className="pr-3">Monthly returns</th><th>Daily / expected / missing</th></tr></thead>
              <tbody>{fund.results.map((result) => <tr key={`${result.cutoff}-${result.horizon}`} className="border-t border-gray-100 align-top">
                <td className="py-2 pr-3 tabular-nums">{result.cutoff}{result.feeDateAfterCutoff ? <span className="block text-[10px] text-amber-700">fee is later than cutoff</span> : null}</td>
                <td className="pr-3">{result.horizon}</td><td className="pr-3">{scoreStatus(result)}</td><td className="pr-3 tabular-nums">{score(result, 4)}</td>
                <td className="pr-3 tabular-nums">{result.monthlyReturnCount}</td><td className="tabular-nums">{result.dailyObservations} / {result.expectedSessions} / {result.missingSessionCount}{result.reason && <span className="mt-1 block max-w-md text-amber-800">{result.reason}</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">Fee score {canDisplay(fund.oneYear) ? fund.oneYear?.feePoints?.toFixed(4) ?? "—" : "—"} / 100 · historical outcomes {canDisplay(fund.oneYear) ? fund.oneYear?.historicalPoints?.toFixed(4) ?? "—" : "—"} / 100. Scores are displayed only when the saved batch records passing input validation, completeness, range and reproducibility checks.</p>
        </details>
      </article>)}
    </div>
    <p className="mt-6 text-xs leading-5 text-gray-500">Method {snapshot.methodologyVersion}. Dividends and splits are reflected in Yahoo adjusted closes and are not added again. Scores describe historical outcomes and current disclosed fees; they are not forecasts, recommendations, catalogue coverage or a methodology freeze.</p>
  </main>;
}
