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
  bottomCandidate: {
    score: number | null;
    gates: {
      reasons: string[];
    };
  };
}

type EvidenceState = { evidence?: TrialEvidence; error?: string };

interface TrialOutcome {
  asOfDate: string;
  entryPrice: number;
  outcomeBasis: "daily_close";
  primaryOutcome: {
    targetPct: number;
    breakdownPct: number;
    status: "target_first" | "breakdown_first" | "open" | "insufficient_future";
    targetHitDate: string | null;
    breakdownHitDate: string | null;
    daysToTarget: number | null;
    maxAdverseExcursionPct: number | null;
  };
  returns: Record<"60" | "120" | "250", number | null>;
}

type OutcomeState = { outcome?: TrialOutcome; error?: string };

interface ReplayResponse {
  ticker: string;
  start: string;
  end: string;
  minScore: number;
  scoreBasis: "as_of_date_only";
  outcomeBasis: string;
  eligibleDates: number;
  signalCount: number;
  truncated: boolean;
  bands: { label: string; total: number; targetFirst: number; breakdownFirst: number; open: number; targetFirstPct: number | null }[];
  signals: { date: string; score: number; primaryOutcome: TrialOutcome["primaryOutcome"]["status"]; daysToTarget: number | null; maxAdverseExcursionPct: number | null; return60d: number | null }[];
}

const formatNumber = (value: number | null | undefined, digits = 1) => value == null ? "—" : value.toFixed(digits);
const formatPercent = (value: number | null | undefined, digits = 1) => value == null ? "—" : `${value.toFixed(digits)}%`;
const outcomeLabel: Record<TrialOutcome["primaryOutcome"]["status"], string> = {
  target_first: "Target first",
  breakdown_first: "Breakdown first",
  open: "Open",
  insufficient_future: "Too recent",
};

export default function ListTrialTable({ records, loading = false, saving = false, error = "", onAdd, onRemove }: ListTrialTableProps) {
  const [ticker, setTicker] = useState("");
  const [candidateDate, setCandidateDate] = useState("");
  const [cohort, setCohort] = useState<UsBreakoutListTrialCohort>("benchmark");
  const [note, setNote] = useState("");
  const [evidenceByKey, setEvidenceByKey] = useState<Record<string, EvidenceState>>({});
  const [outcomesByKey, setOutcomesByKey] = useState<Record<string, OutcomeState>>({});
  const [replayTicker, setReplayTicker] = useState("");
  const [replayStart, setReplayStart] = useState("");
  const [replayEnd, setReplayEnd] = useState("");
  const [replayMinScore, setReplayMinScore] = useState("55");
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [replay, setReplay] = useState<ReplayResponse | null>(null);

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

  useEffect(() => {
    if (records.length === 0) return;
    let active = true;
    const uniqueRequests = [...new Map(records.map((record) => [`${record.ticker}:${record.candidateDate}`, record])).values()];
    void Promise.all(uniqueRequests.map(async (record) => {
      const key = `${record.ticker}:${record.candidateDate}`;
      try {
        const response = await fetch(`/api/breakout-list-trial-outcome?ticker=${encodeURIComponent(record.ticker)}&date=${encodeURIComponent(record.candidateDate)}`);
        const payload = await response.json() as TrialOutcome & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Outcome unavailable");
        return [key, { outcome: payload }] as const;
      } catch (reason) {
        return [key, { error: reason instanceof Error ? reason.message : "Outcome unavailable" }] as const;
      }
    })).then((entries) => {
      if (active) setOutcomesByKey(Object.fromEntries(entries));
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

  async function handleReplay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = replayTicker.trim().toUpperCase();
    if (!normalizedTicker || !replayStart || !replayEnd) return;
    setReplayLoading(true);
    setReplayError("");
    setReplay(null);
    try {
      const params = new URLSearchParams({ ticker: normalizedTicker, start: replayStart, end: replayEnd, minScore: replayMinScore });
      const response = await fetch(`/api/breakout-list-trial-replay?${params}`);
      const payload = await response.json() as ReplayResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Replay unavailable");
      setReplay(payload);
    } catch (reason) {
      setReplayError(reason instanceof Error ? reason.message : "Replay unavailable");
    } finally {
      setReplayLoading(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="list-trial-title">
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-5">
        <h2 id="list-trial-title" className="text-base font-semibold text-gray-800">List Trial</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Add historical candidate dates to compare known recoveries with false-bottom controls. Evidence and the provisional score use only data available through each candidate date; outcome labels are shown separately.
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

      <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4" aria-labelledby="list-trial-replay-title">
        <div>
          <h3 id="list-trial-replay-title" className="text-sm font-semibold text-gray-800">Causal historical replay</h3>
          <p className="mt-1 text-xs text-gray-600">Runs one selected ticker through the chosen range. Scores use only each day&apos;s available history; future daily closes only grade +20% before −12% outcomes.</p>
        </div>
        <form onSubmit={handleReplay} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_110px_auto] lg:items-end">
          <label className="block text-xs font-medium text-gray-600">Ticker<input value={replayTicker} onChange={(event) => setReplayTicker(event.target.value)} placeholder="TEAM" className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm uppercase" required /></label>
          <label className="block text-xs font-medium text-gray-600">Start date<input type="date" value={replayStart} onChange={(event) => setReplayStart(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm" required /></label>
          <label className="block text-xs font-medium text-gray-600">End date<input type="date" value={replayEnd} onChange={(event) => setReplayEnd(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm" required /></label>
          <label className="block text-xs font-medium text-gray-600">Min score<input type="number" min="0" max="100" step="1" value={replayMinScore} onChange={(event) => setReplayMinScore(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm" required /></label>
          <button type="submit" disabled={replayLoading} className="rounded bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">{replayLoading ? "Replaying…" : "Run replay"}</button>
        </form>
        {replayError && <p className="mt-3 text-sm text-red-600" role="alert">{replayError}</p>}
        {replay && <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-600">{replay.ticker} · {replay.start} to {replay.end} · {replay.signalCount} signals from {replay.eligibleDates} eligible dates · score ≥ {replay.minScore}</p>
          <div className="overflow-x-auto rounded border border-violet-100 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-violet-50 text-violet-900"><tr><th className="px-3 py-2">Score band</th><th className="px-3 py-2">Signals</th><th className="px-3 py-2">Target first</th><th className="px-3 py-2">Breakdown first</th><th className="px-3 py-2">Open</th><th className="px-3 py-2">Target-first rate</th></tr></thead>
              <tbody className="divide-y divide-violet-50">{replay.bands.map((band) => <tr key={band.label}><td className="px-3 py-2 font-medium">{band.label}</td><td className="px-3 py-2">{band.total}</td><td className="px-3 py-2 text-green-700">{band.targetFirst}</td><td className="px-3 py-2 text-red-700">{band.breakdownFirst}</td><td className="px-3 py-2">{band.open}</td><td className="px-3 py-2">{formatPercent(band.targetFirstPct)}</td></tr>)}</tbody>
            </table>
          </div>
          {replay.signals.length > 0 && <div className="overflow-x-auto rounded border border-violet-100 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-violet-50 text-violet-900"><tr><th className="px-3 py-2">Signal date</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">+20% / −12%</th><th className="px-3 py-2">Days to +20%</th><th className="px-3 py-2">Max adverse</th><th className="px-3 py-2">60d return</th></tr></thead>
              <tbody className="divide-y divide-violet-50">{replay.signals.map((signal) => <tr key={signal.date}><td className="px-3 py-2">{signal.date}</td><td className="px-3 py-2 font-semibold">{signal.score.toFixed(1)}</td><td className={`px-3 py-2 ${signal.primaryOutcome === "target_first" ? "text-green-700" : signal.primaryOutcome === "breakdown_first" ? "text-red-700" : "text-gray-600"}`}>{outcomeLabel[signal.primaryOutcome]}</td><td className="px-3 py-2">{formatNumber(signal.daysToTarget, 0)}</td><td className="px-3 py-2">{formatPercent(signal.maxAdverseExcursionPct)}</td><td className="px-3 py-2">{formatPercent(signal.return60d)}</td></tr>)}</tbody>
            </table>
          </div>}
          {replay.truncated && <p className="text-xs text-amber-700">Only the first 150 signals are shown; the band summary includes all signals.</p>}
        </div>}
      </section>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[2100px] text-left text-sm">
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
              <th className="border-l-2 border-blue-200 bg-blue-50/50 px-3 py-2 font-semibold">Bottom score</th>
              <th className="border-l-2 border-amber-200 bg-amber-50/50 px-3 py-2 font-semibold">+20% / −12% outcome</th>
              <th className="bg-amber-50/50 px-3 py-2 font-semibold">Days to +20%</th>
              <th className="bg-amber-50/50 px-3 py-2 font-semibold">Max adverse</th>
              <th className="bg-amber-50/50 px-3 py-2 font-semibold">60d return</th>
              <th className="bg-amber-50/50 px-3 py-2 font-semibold">120d return</th>
              <th className="bg-amber-50/50 px-3 py-2 font-semibold">250d return</th>
              <th className="px-3 py-2 font-semibold">Note</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={24} className="px-3 py-6 text-center text-gray-500">Loading trial rows…</td></tr>}
            {!loading && records.length === 0 && <tr><td colSpan={24} className="px-3 py-6 text-center text-gray-500">No trial rows yet. Add a benchmark or control candidate above.</td></tr>}
            {!loading && records.map((record) => (
              <tr key={record.id}>
                <td className="px-3 py-2 font-mono font-semibold text-gray-800">{record.ticker}</td>
                <td className="px-3 py-2 text-gray-700">{record.candidateDate}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${record.cohort === "benchmark" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{cohortLabel[record.cohort]}</span></td>
                {(() => {
                  const key = `${record.ticker}:${record.candidateDate}`;
                  const evidenceState = evidenceByKey[key];
                  const evidence = evidenceState?.evidence;
                  const outcomeState = outcomesByKey[key];
                  const outcome = outcomeState?.outcome;
                  if (evidenceState?.error) return <td colSpan={19} className="px-3 py-2 text-red-600">{evidenceState.error}</td>;
                  if (!evidence) return <td colSpan={19} className="px-3 py-2 text-gray-400">Loading as-of-date evidence…</td>;
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
                    <td className={`border-l-2 border-blue-200 bg-blue-50/50 px-3 py-2 font-semibold ${evidence.bottomCandidate.score == null ? "text-gray-500" : evidence.bottomCandidate.score >= 75 ? "text-green-700" : evidence.bottomCandidate.score >= 55 ? "text-amber-700" : "text-red-700"}`} title={evidence.bottomCandidate.gates.reasons.join("; ") || "All score gates passed"}>{evidence.bottomCandidate.score == null ? "Not scoreable" : evidence.bottomCandidate.score.toFixed(1)}</td>
                    {outcomeState?.error ? <td colSpan={6} className="border-l-2 border-amber-200 bg-amber-50/50 px-3 py-2 text-red-600">{outcomeState.error}</td> : !outcome ? <td colSpan={6} className="border-l-2 border-amber-200 bg-amber-50/50 px-3 py-2 text-gray-400">Loading future outcome…</td> : <>
                      <td className={`border-l-2 border-amber-200 bg-amber-50/50 px-3 py-2 font-medium ${outcome.primaryOutcome.status === "target_first" ? "text-green-700" : outcome.primaryOutcome.status === "breakdown_first" ? "text-red-700" : "text-gray-600"}`}>{outcomeLabel[outcome.primaryOutcome.status]}</td>
                      <td className="bg-amber-50/50 px-3 py-2">{formatNumber(outcome.primaryOutcome.daysToTarget, 0)}</td>
                      <td className="bg-amber-50/50 px-3 py-2">{formatPercent(outcome.primaryOutcome.maxAdverseExcursionPct)}</td>
                      <td className="bg-amber-50/50 px-3 py-2">{formatPercent(outcome.returns["60"])}</td>
                      <td className="bg-amber-50/50 px-3 py-2">{formatPercent(outcome.returns["120"])}</td>
                      <td className="bg-amber-50/50 px-3 py-2">{formatPercent(outcome.returns["250"])}</td>
                    </>}
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
