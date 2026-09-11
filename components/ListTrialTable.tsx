"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { UsBreakoutListTrialCohort, UsBreakoutListTrialRecord } from "@/lib/firestore";

interface ListTrialTableProps {
  records: UsBreakoutListTrialRecord[];
  loading?: boolean;
  saving?: boolean;
  error?: string;
  onAdd: (record: Omit<UsBreakoutListTrialRecord, "id">) => void;
  onRemove: (id: string) => void;
}

const cohortLabel: Record<UsBreakoutListTrialCohort, string> = {
  benchmark: "Benchmark",
  control: "Control",
};

interface TrialEvidence {
  ticker: string;
  requestedDate: string;
  asOfDate: string;
  price: number | null;
  allTimeHighThroughDate: number | null;
  drawdownFromAthPct: number | null;
  eligibleAt40PctBelowAth: boolean;
  currentRollingLow: number | null;
  currentRollingLowDate: string | null;
  pctAboveCurrentRollingLow: number | null;
  priorSellingEpisodeLow: number | null;
  priorSellingEpisodeLowDate: string | null;
  currentLowVsPriorLowPct: number | null;
  indicators: {
    rsiAtCurrentLow: number | null;
    rsiAtPriorLow: number | null;
    rsiDeltaCurrentVsPrior: number | null;
    macdHistPctAtCurrentLow: number | null;
    macdHistPctAtPriorLow: number | null;
    macdHistPctDeltaCurrentVsPrior: number | null;
    diGapAtCurrentLow: number | null;
    diGapAtPriorLow: number | null;
    adxDeltaCurrentVsPrior: number | null;
    cmfDeltaCurrentVsPrior: number | null;
    atrPct: number | null;
    relativeVolume20: number | null;
  };
  dataQuality: {
    enoughHistoryForPriorEpisode: boolean;
    requestedDateWasTradingDay: boolean;
  };
}

type EvidenceState = { evidence?: TrialEvidence; error?: string };

const formatNumber = (value: number | null | undefined, digits = 1) => value == null ? "—" : value.toFixed(digits);
const formatPercent = (value: number | null | undefined, digits = 1) => value == null ? "—" : `${value.toFixed(digits)}%`;

export default function ListTrialTable({ records, loading = false, saving = false, error = "", onAdd, onRemove }: ListTrialTableProps) {
  const [ticker, setTicker] = useState("");
  const [candidateDate, setCandidateDate] = useState("");
  const [cohort, setCohort] = useState<UsBreakoutListTrialCohort>("benchmark");
  const [note, setNote] = useState("");
  const [evidenceByKey, setEvidenceByKey] = useState<Record<string, EvidenceState>>({});

  useEffect(() => {
    if (records.length === 0) return;
    let active = true;
    const uniqueRequests = [...new Map(records.map((record) => [`${record.ticker}:${record.candidateDate}`, record])).values()];
    void Promise.all(uniqueRequests.map(async (record) => {
      const key = `${record.ticker}:${record.candidateDate}`;
      try {
        const response = await fetch(`/api/breakout-list-trial?ticker=${encodeURIComponent(record.ticker)}&date=${encodeURIComponent(record.candidateDate)}`);
        const payload = await response.json() as TrialEvidence & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Evidence unavailable");
        return [key, { evidence: payload }] as const;
      } catch (reason) {
        return [key, { error: reason instanceof Error ? reason.message : "Evidence unavailable" }] as const;
      }
    })).then((entries) => {
      if (active) setEvidenceByKey(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [records]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker || !candidateDate) return;
    onAdd({ ticker: normalizedTicker, candidateDate, cohort, note: note.trim() });
    setTicker("");
    setCandidateDate("");
    setCohort("benchmark");
    setNote("");
  }

  return (
    <section className="space-y-4" aria-labelledby="list-trial-title">
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-5">
        <h2 id="list-trial-title" className="text-base font-semibold text-gray-800">List Trial</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Add historical candidate dates to compare known recoveries with false-bottom controls. Evidence below is calculated using only data available through each candidate date; no score is calculated yet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end">
          <label className="block text-xs font-medium text-gray-600">
            Ticker
            <input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="TEAM" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm uppercase" required />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Candidate date
            <input type="date" value={candidateDate} onChange={(event) => setCandidateDate(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" required />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Cohort
            <select value={cohort} onChange={(event) => setCohort(event.target.value as UsBreakoutListTrialCohort)} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm">
              <option value="benchmark">Benchmark</option>
              <option value="control">Control</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Note <span className="font-normal text-gray-400">(optional)</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this date is interesting" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" />
          </label>
          <button type="submit" disabled={saving || loading} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Adding…" : "Add trial"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[1500px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Ticker</th>
              <th className="px-3 py-2 font-semibold">Candidate date</th>
              <th className="px-3 py-2 font-semibold">Cohort</th>
              <th className="px-3 py-2 font-semibold">Drawdown from ATH</th>
              <th className="px-3 py-2 font-semibold">Eligible</th>
              <th className="px-3 py-2 font-semibold">Rolling low</th>
              <th className="px-3 py-2 font-semibold">Above low</th>
              <th className="px-3 py-2 font-semibold">Price vs prior low</th>
              <th className="px-3 py-2 font-semibold">RSI Δ</th>
              <th className="px-3 py-2 font-semibold">MACD hist Δ%</th>
              <th className="px-3 py-2 font-semibold">DI gap Δ</th>
              <th className="px-3 py-2 font-semibold">ADX Δ</th>
              <th className="px-3 py-2 font-semibold">CMF Δ</th>
              <th className="px-3 py-2 font-semibold">ATR%</th>
              <th className="px-3 py-2 font-semibold">Rel vol</th>
              <th className="px-3 py-2 font-semibold">Note</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={17} className="px-3 py-6 text-center text-gray-500">Loading trial rows…</td></tr>}
            {!loading && records.length === 0 && <tr><td colSpan={17} className="px-3 py-6 text-center text-gray-500">No trial rows yet. Add a benchmark or control candidate above.</td></tr>}
            {!loading && records.map((record) => (
              <tr key={record.id}>
                <td className="px-3 py-2 font-mono font-semibold text-gray-800">{record.ticker}</td>
                <td className="px-3 py-2 text-gray-700">{record.candidateDate}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${record.cohort === "benchmark" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{cohortLabel[record.cohort]}</span></td>
                {(() => {
                  const key = `${record.ticker}:${record.candidateDate}`;
                  const state = evidenceByKey[key];
                  const evidence = state?.evidence;
                  if (state?.error) return <td colSpan={12} className="px-3 py-2 text-red-600">{state.error}</td>;
                  if (!evidence) return <td colSpan={12} className="px-3 py-2 text-gray-400">Loading as-of-date evidence…</td>;
                  return <>
                    <td className="px-3 py-2">{formatPercent(evidence.drawdownFromAthPct)}</td>
                    <td className="px-3 py-2">{evidence.eligibleAt40PctBelowAth ? <span className="font-medium text-green-700">Yes</span> : <span className="text-gray-500">No</span>}</td>
                    <td className="px-3 py-2">{formatNumber(evidence.currentRollingLow, 2)} <span className="text-xs text-gray-400">({evidence.currentRollingLowDate ?? "—"})</span></td>
                    <td className="px-3 py-2">{formatPercent(evidence.pctAboveCurrentRollingLow)}</td>
                    <td className="px-3 py-2">{formatPercent(evidence.currentLowVsPriorLowPct)}</td>
                    <td className="px-3 py-2">{formatNumber(evidence.indicators.rsiDeltaCurrentVsPrior)}</td>
                    <td className="px-3 py-2">{formatPercent(evidence.indicators.macdHistPctDeltaCurrentVsPrior, 2)}</td>
                    <td className="px-3 py-2">{formatNumber(evidence.indicators.diGapAtCurrentLow != null && evidence.indicators.diGapAtPriorLow != null ? evidence.indicators.diGapAtCurrentLow - evidence.indicators.diGapAtPriorLow : null)}</td>
                    <td className="px-3 py-2">{formatNumber(evidence.indicators.adxDeltaCurrentVsPrior)}</td>
                    <td className="px-3 py-2">{formatNumber(evidence.indicators.cmfDeltaCurrentVsPrior, 3)}</td>
                    <td className="px-3 py-2">{formatPercent(evidence.indicators.atrPct)}</td>
                    <td className="px-3 py-2">{formatNumber(evidence.indicators.relativeVolume20, 2)}{!evidence.dataQuality.requestedDateWasTradingDay && <span className="ml-1 text-xs text-amber-600" title={`Nearest available trading date: ${evidence.asOfDate}`}>*</span>}</td>
                  </>;
                })()}
                <td className="max-w-sm px-3 py-2 text-gray-600">{record.note || <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2 text-right"><button type="button" onClick={() => onRemove(record.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
