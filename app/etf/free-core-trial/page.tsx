import Link from "next/link";
import type { Metadata } from "next";
import { getETFFreeCoreTrialSnapshots } from "@/lib/etfFreeCoreTrialStore";
import { ETF_FREE_CORE_TRIAL_WEIGHTS } from "@/lib/etfFreeCoreTrial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "VOO / VXUS · Free Core trial" };

export default async function ETFFreeCoreTrialPage() {
  const snapshots = await getETFFreeCoreTrialSnapshots().catch(() => []);
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <Link href="/etf" className="text-sm text-blue-600 hover:underline">← ETF catalogue</Link>
    <header className="mb-6 mt-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Two-fund scoring trial</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Free Core · VOO &amp; VXUS</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">Annual-fee efficiency contributes {(ETF_FREE_CORE_TRIAL_WEIGHTS.fee * 100).toFixed(2)}% and historical outcomes contribute {(ETF_FREE_CORE_TRIAL_WEIGHTS.historical * 100).toFixed(2)}%. Historical outcomes combine growth, drawdown resilience and downside risk. Spreads are excluded from this trial.</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">These are experimental, dated assessments of costs and historical outcomes. VOO covers US large-cap equities; VXUS covers international equities outside the US. Each serves a different investment role and retains separate 1Y and 3Y results.</p>
    </header>
    {!snapshots.length && <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">The saved trial results are currently unavailable.</p>}
    <div className="grid gap-5 md:grid-cols-2">{snapshots.map((snapshot) => <article key={snapshot.ticker} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900">{snapshot.ticker}</h2>
      <p className="mt-1 text-xs text-gray-500">{snapshot.ticker === "VOO" ? "US large-cap index equities" : "International index equities · ex-US"}</p>
      <p className="mt-3 text-sm text-gray-700">Annual net fee: <strong>{snapshot.fee.valuePct.toFixed(2)}%</strong> · dated {snapshot.fee.financialDate}</p>
      {snapshot.results.map((result) => <section key={result.horizon} className="mt-5 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-gray-900">Trial {result.horizon}{result.horizon === "1Y" ? " · Limited history" : ""}</h3><span className="text-3xl font-bold tabular-nums text-gray-900">{result.score?.toFixed(1) ?? "—"}<span className="text-xs font-normal text-gray-400"> / 100</span></span></div>
        <p className="mt-1 text-xs text-gray-500">{result.window.startDate} → {result.window.cutoff}</p>
        {result.reason && <p className="mt-2 text-sm text-amber-800">{result.reason}</p>}
        {result.score != null && <>
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-xs"><div><dt className="text-gray-500">Fee efficiency · 42.86%</dt><dd className="mt-1 font-semibold tabular-nums">{result.feePoints?.toFixed(2)} / 100</dd></div><div><dt className="text-gray-500">Historical outcomes · 57.14%</dt><dd className="mt-1 font-semibold tabular-nums">{result.historicalPoints?.toFixed(2)} / 100</dd></div></dl>
          <table className="mt-3 w-full text-left text-xs"><thead className="text-gray-500"><tr><th className="py-2">Historical component</th><th>Input</th><th className="text-right">Points</th></tr></thead><tbody>{(["growth", "drawdown", "downside"] as const).map((key) => { const component = result.historicalComponents[key]; return <tr key={key} className="border-t border-gray-100"><th className="py-2 font-medium text-gray-700">{key === "growth" ? "Annualized return" : key === "drawdown" ? "Maximum drawdown" : "Downside deviation"}<span className="block text-[10px] font-normal text-gray-400">{(component.weight * 100).toFixed(0)}% of historical outcomes</span></th><td className="tabular-nums text-gray-600">{component.inputValue?.toFixed(3)}%</td><td className="text-right tabular-nums">{component.points.toFixed(2)}</td></tr>; })}</tbody></table>
        </>}
        <p className="mt-2 text-xs text-gray-500">{result.window.monthlyReturns.length} monthly returns · {result.window.dailyObservations} daily sessions · {result.window.missingSessionDates.length} missing</p>
      </section>)}
      <footer className="mt-5 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
        <p>Calculated {snapshot.asOf.slice(0, 10)} · prices from <a className="text-blue-600 hover:underline" href={snapshot.source.sourceUrl}>{snapshot.source.provider}</a> · <a className="text-blue-600 hover:underline" href={snapshot.fee.sourceUrl}>Vanguard fee disclosure</a></p>
        <p>{snapshot.historyObservations} retained daily rows · {snapshot.dividendEvents} dividend events · {snapshot.splitEvents} splits. Distributions are already reflected in adjusted prices.</p>
        {snapshot.sourceNotes.map((note) => <p key={note} className="mt-2 text-amber-700">{note}</p>)}
        <details className="mt-2"><summary className="cursor-pointer">Formula and source validation</summary><p className="mt-2">(0.30 × FeePoints + 0.40 × HistoricalOutcomes) ÷ 0.70. Historical outcomes use a geometric blend of 40% growth, 35% drawdown resilience and 25% downside risk. This excludes trading costs and index-tracking quality.</p><p className="mt-2 break-all">{snapshot.results[0]?.methodologyVersion} · input hash {snapshot.historyHash}</p>{snapshot.referenceCheck?.differences.map((difference) => <p key={difference.horizon} className="mt-2">{difference.horizon} Yahoo − retained Tiingo: score {difference.score.toFixed(6)} points; annualized return {difference.cagrPct.toFixed(6)} percentage points; drawdown {difference.maxDrawdownPct.toFixed(6)} percentage points.</p>)}</details>
      </footer>
    </article>)}</div>
  </main>;
}
