"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { UsBreakoutListTrialCohort, UsBreakoutListTrialLiveRecord, UsBreakoutListTrialRecord } from "@/lib/firestore";

interface ListTrialTableProps {
  records: UsBreakoutListTrialRecord[];
  loading?: boolean;
  saving?: boolean;
  error?: string;
  onAdd: (record: Omit<UsBreakoutListTrialRecord, "id">) => void;
  onRemove: (id: string) => void;
  liveRecords: UsBreakoutListTrialLiveRecord[];
  liveLoading?: boolean;
  liveSaving?: boolean;
  liveError?: string;
  onLiveAdd: (record: Omit<UsBreakoutListTrialLiveRecord, "id">) => void;
  onLiveRemove: (id: string) => void;
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
type LiveEvidenceState = { evidence?: TrialEvidence; error?: string };

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
  rawQualifyingDayCount?: number;
  episodeCount?: number;
  signalCount: number;
  rawQualifyingDays?: { date: string; score: number }[];
  truncated: boolean;
  bands: { label: string; total: number; targetFirst: number; breakdownFirst: number; open: number; targetFirstPct: number | null; missedZone?: number; notEntered?: number }[];
  episodes?: ReplayEpisode[];
  signals: ReplayEpisode[];
}

type ReplayEntry =
  | { status: "entered"; entryDate: string; entryIndex: number; entryOpen: number; assumedEntryPrice: number }
  | { status: "missed_zone"; entryDate: string; entryIndex: number; entryOpen: number }
  | { status: "not_entered_no_future_data" }
  | { status: "not_entered_invalid_open"; entryDate: string; entryIndex: number };

interface ReplayEpisode {
  date: string;
  score: number;
  episodeId?: string;
  triggerDate?: string;
  triggerScore?: number;
  firstQualifyingDate?: string;
  lastQualifyingDate?: string;
  qualifyingDayCount?: number;
  entryPlan?: { zoneLow: number; zoneHigh: number } | null;
  entryPlanStatus?: string;
  entry?: ReplayEntry;
  primaryOutcome: TrialOutcome["primaryOutcome"]["status"] | "not_entered";
  daysToTarget: number | null;
  maxAdverseExcursionPct: number | null;
  return60d: number | null;
}

const formatNumber = (value: number | null | undefined, digits = 1) => value == null ? "—" : value.toFixed(digits);
const formatPercent = (value: number | null | undefined, digits = 1) => value == null ? "—" : `${value.toFixed(digits)}%`;
const outcomeLabel: Record<TrialOutcome["primaryOutcome"]["status"], string> = {
  target_first: "Target first",
  breakdown_first: "Breakdown first",
  open: "Open",
  insufficient_future: "Too recent",
};
const entryLabel: Record<ReplayEntry["status"], string> = {
  entered: "Entered",
  missed_zone: "Missed zone",
  not_entered_no_future_data: "Insufficient future data",
  not_entered_invalid_open: "Invalid next open",
};

const csvCell = (value: string | number | boolean | null | undefined) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const evidenceCsvHeaders = [
  "record_id", "ticker", "candidate_date", "cohort", "as_of_date", "price", "all_time_high_through_date",
  "drawdown_from_ath_pct", "eligible_at_40_pct_below_ath", "current_rolling_low", "current_rolling_low_date",
  "pct_above_current_rolling_low", "prior_selling_episode_low", "prior_selling_episode_low_date",
  "current_low_vs_prior_low_pct", "rsi_at_current_low", "rsi_at_prior_low", "rsi_delta_current_vs_prior",
  "macd_hist_pct_at_current_low", "macd_hist_pct_at_prior_low", "macd_hist_pct_delta_current_vs_prior",
  "di_gap_at_current_low", "di_gap_at_prior_low", "di_gap_delta_current_vs_prior", "adx_delta_current_vs_prior",
  "cmf_delta_current_vs_prior", "atr_pct", "relative_volume_20", "bottom_score", "gate_status", "gate_reasons",
  "enough_history_for_prior_episode", "requested_date_was_trading_day", "evidence_status", "evidence_error",
  "note",
];

function buildEvidenceCsv(records: UsBreakoutListTrialRecord[], evidenceByKey: Record<string, EvidenceState>) {
  const rows = records.map((record) => {
    const key = `${record.ticker}:${record.candidateDate}`;
    const state = evidenceByKey[key];
    const evidence = state?.evidence;
    const indicators = evidence?.indicators;
    const diGapDelta = indicators?.diGapAtCurrentLow != null && indicators.diGapAtPriorLow != null
      ? indicators.diGapAtCurrentLow - indicators.diGapAtPriorLow
      : null;
    return [
      record.id, record.ticker, record.candidateDate, cohortLabel[record.cohort], evidence?.asOfDate,
      evidence?.price, evidence?.allTimeHighThroughDate, evidence?.drawdownFromAthPct,
      evidence?.eligibleAt40PctBelowAth, evidence?.currentRollingLow, evidence?.currentRollingLowDate,
      evidence?.pctAboveCurrentRollingLow, evidence?.priorSellingEpisodeLow, evidence?.priorSellingEpisodeLowDate,
      evidence?.currentLowVsPriorLowPct, indicators?.rsiAtCurrentLow, indicators?.rsiAtPriorLow,
      indicators?.rsiDeltaCurrentVsPrior, indicators?.macdHistPctAtCurrentLow, indicators?.macdHistPctAtPriorLow,
      indicators?.macdHistPctDeltaCurrentVsPrior, indicators?.diGapAtCurrentLow, indicators?.diGapAtPriorLow,
      diGapDelta, indicators?.adxDeltaCurrentVsPrior, indicators?.cmfDeltaCurrentVsPrior, indicators?.atrPct,
      indicators?.relativeVolume20, evidence?.bottomCandidate.score,
      evidence ? (evidence.bottomCandidate.gates.reasons.length > 0 ? "failed" : "passed") : "unavailable",
      evidence?.bottomCandidate.gates.reasons.join("; "), evidence?.dataQuality.enoughHistoryForPriorEpisode,
      evidence?.dataQuality.requestedDateWasTradingDay, evidence ? "available" : state?.error ? "error" : "loading",
      state?.error, record.note,
    ].map(csvCell).join(",");
  });
  return [evidenceCsvHeaders.join(","), ...rows].join("\r\n");
}

export default function ListTrialTable({ records, loading = false, saving = false, error = "", onAdd, onRemove, liveRecords, liveLoading = false, liveSaving = false, liveError = "", onLiveAdd, onLiveRemove }: ListTrialTableProps) {
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
  const [liveTicker, setLiveTicker] = useState("");
  const [liveNote, setLiveNote] = useState("");
  const [liveEvidenceById, setLiveEvidenceById] = useState<Record<string, LiveEvidenceState>>({});

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
    if (liveRecords.length === 0) return;
    let active = true;
    const date = new Date().toISOString().slice(0, 10);
    void Promise.all(liveRecords.map(async (record) => {
      try {
        const response = await fetch(`/api/breakout-list-trial?ticker=${encodeURIComponent(record.ticker)}&date=${date}`);
        const payload = await response.json() as TrialEvidence & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Snapshot unavailable");
        return [record.id, { evidence: payload }] as const;
      } catch (reason) {
        return [record.id, { error: reason instanceof Error ? reason.message : "Snapshot unavailable" }] as const;
      }
    })).then((entries) => {
      if (active) setLiveEvidenceById(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [liveRecords]);

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

  function handleLiveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = liveTicker.trim().toUpperCase();
    if (!normalizedTicker) return;
    onLiveAdd({ ticker: normalizedTicker, addedAt: new Date().toISOString(), note: liveNote.trim() });
    setLiveTicker("");
    setLiveNote("");
  }

  function handleExportEvidence() {
    if (records.length === 0 || loading) return;
    const blob = new Blob([buildEvidenceCsv(records, evidenceByKey)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `list-trial-evidence-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
          <p className="text-xs text-gray-600">{replay.ticker} · {replay.start} to {replay.end} · {replay.rawQualifyingDayCount ?? replay.signalCount} qualifying days grouped into {replay.episodeCount ?? replay.signalCount} episodes from {replay.eligibleDates} eligible dates · score ≥ {replay.minScore}</p>
          <p className="rounded border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
            Episodes open on the first qualifying day, then re-arm after 10 consecutive non-qualifying trading sessions. The trigger score and entry zone stay frozen; execution is attempted only on the next session&apos;s open, so a gap above the zone is recorded as missed rather than chased.
          </p>
          <div className="overflow-x-auto rounded border border-violet-100 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-violet-50 text-violet-900"><tr><th className="px-3 py-2">Score band</th><th className="px-3 py-2">Entered episodes</th><th className="px-3 py-2">Target first</th><th className="px-3 py-2">Breakdown first</th><th className="px-3 py-2">Open / insufficient</th><th className="px-3 py-2">Missed zone</th><th className="px-3 py-2">Not entered</th><th className="px-3 py-2">Target-first rate</th></tr></thead>
              <tbody className="divide-y divide-violet-50">{replay.bands.map((band) => <tr key={band.label}><td className="px-3 py-2 font-medium">{band.label}</td><td className="px-3 py-2">{band.total}</td><td className="px-3 py-2 text-green-700">{band.targetFirst}</td><td className="px-3 py-2 text-red-700">{band.breakdownFirst}</td><td className="px-3 py-2">{band.open}</td><td className="px-3 py-2 text-amber-700">{band.missedZone ?? 0}</td><td className="px-3 py-2 text-gray-600">{band.notEntered ?? 0}</td><td className="px-3 py-2">{formatPercent(band.targetFirstPct)}</td></tr>)}</tbody>
            </table>
          </div>
          {(replay.episodes ?? replay.signals).length > 0 && <div className="overflow-x-auto rounded border border-violet-100 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-violet-50 text-violet-900"><tr><th className="px-3 py-2">Trigger / qualifying span</th><th className="px-3 py-2">Frozen score</th><th className="px-3 py-2">Zone</th><th className="px-3 py-2">Entry</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Days to +20%</th><th className="px-3 py-2">Max adverse</th><th className="px-3 py-2">60d return</th></tr></thead>
              <tbody className="divide-y divide-violet-50">{(replay.episodes ?? replay.signals).map((episode) => {
                const entry = episode.entry;
                const entryStatus = entry?.status;
                const outcome = episode.primaryOutcome;
                const isActive = episode.lastQualifyingDate != null && episode.lastQualifyingDate === replay.rawQualifyingDays?.at(-1)?.date;
                return <tr key={episode.episodeId ?? episode.date}>
                  <td className="px-3 py-2"><div className="font-medium">{episode.triggerDate ?? episode.date}</div><div className="text-gray-500">{episode.firstQualifyingDate ?? episode.date} → {episode.lastQualifyingDate ?? episode.date} · {episode.qualifyingDayCount ?? 1} day{(episode.qualifyingDayCount ?? 1) === 1 ? "" : "s"}{isActive && <span className="ml-1 rounded bg-blue-100 px-1 text-blue-700">Active</span>}</div></td>
                  <td className="px-3 py-2 font-semibold">{(episode.triggerScore ?? episode.score).toFixed(1)}</td>
                  <td className="px-3 py-2">{episode.entryPlan ? <>{formatNumber(episode.entryPlan.zoneLow, 2)}–{formatNumber(episode.entryPlan.zoneHigh, 2)}</> : <span className="text-gray-500">Unavailable</span>}</td>
                  <td className="px-3 py-2"><div className={entryStatus === "entered" ? "font-medium text-green-700" : entryStatus === "missed_zone" ? "font-medium text-amber-700" : "text-gray-600"}>{entryStatus ? entryLabel[entryStatus] : "Not entered"}</div>{entry?.status === "entered" && <div className="text-gray-500">{entry.entryDate} · {formatNumber(entry.assumedEntryPrice, 2)} assumed fill · next open + 10 bps</div>}{entry?.status === "missed_zone" && <div className="text-gray-500">{entry.entryDate} · open {formatNumber(entry.entryOpen, 2)}</div>}{entry?.status === "not_entered_invalid_open" && <div className="text-gray-500">{entry.entryDate}</div>}</td>
                  <td className={`px-3 py-2 ${outcome === "target_first" ? "text-green-700" : outcome === "breakdown_first" ? "text-red-700" : "text-gray-600"}`}>{outcome === "not_entered" ? (entryStatus === "missed_zone" ? "Missed zone" : "Insufficient / not entered") : outcomeLabel[outcome]}</td>
                  <td className="px-3 py-2">{formatNumber(episode.daysToTarget, 0)}</td><td className="px-3 py-2">{formatPercent(episode.maxAdverseExcursionPct)}</td><td className="px-3 py-2">{formatPercent(episode.return60d)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
          {(replay.episodes ?? replay.signals).length === 0 && <p className="rounded border border-violet-100 bg-white px-3 py-5 text-center text-xs text-gray-500">No qualifying episodes in this range.</p>}
          {replay.truncated && <p className="text-xs text-amber-700">Only the first 150 signals are shown; the band summary includes all signals.</p>}
        </div>}
      </section>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4" aria-labelledby="list-trial-live-title">
        <div>
          <h3 id="list-trial-live-title" className="text-sm font-semibold text-gray-800">Live candidates</h3>
          <p className="mt-1 text-xs text-gray-600">Manually add beaten-down names from your Finviz run. This shows a causal snapshot as of today (or the latest trading day), without future outcome labels or automatic imports.</p>
        </div>
        <form onSubmit={handleLiveSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="block text-xs font-medium text-gray-600">Ticker<input value={liveTicker} onChange={(event) => setLiveTicker(event.target.value)} placeholder="TEAM" className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm uppercase" required /></label>
          <label className="block text-xs font-medium text-gray-600">Note <span className="font-normal text-gray-400">(optional)</span><input value={liveNote} onChange={(event) => setLiveNote(event.target.value)} placeholder="Why it entered the live trial" className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm" /></label>
          <button type="submit" disabled={liveSaving || liveLoading} className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{liveSaving ? "Adding…" : "Add live candidate"}</button>
        </form>
        {liveError && <p className="mt-2 text-sm text-red-600" role="alert">{liveError}</p>}
        <div className="mt-4 overflow-x-auto rounded border border-emerald-100 bg-white">
          <table className="min-w-[1100px] text-left text-xs">
            <thead className="bg-emerald-50 text-emerald-900"><tr><th className="px-3 py-2">Ticker</th><th className="px-3 py-2">Added</th><th className="px-3 py-2">As of</th><th className="px-3 py-2">Drawdown</th><th className="px-3 py-2">Above low</th><th className="px-3 py-2">Bottom score</th><th className="px-3 py-2">Gate notes</th><th className="px-3 py-2">Note</th><th className="px-3 py-2"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-emerald-50">
              {liveLoading && <tr><td colSpan={9} className="px-3 py-5 text-center text-gray-500">Loading live candidates…</td></tr>}
              {!liveLoading && liveRecords.length === 0 && <tr><td colSpan={9} className="px-3 py-5 text-center text-gray-500">No live candidates yet.</td></tr>}
              {!liveLoading && liveRecords.map((record) => {
                const state = liveEvidenceById[record.id];
                const evidence = state?.evidence;
                return <tr key={record.id}>
                  <td className="px-3 py-2 font-mono font-semibold">{record.ticker}</td>
                  <td className="px-3 py-2 text-gray-600">{record.addedAt.slice(0, 10)}</td>
                  {!evidence ? <td colSpan={5} className="px-3 py-2 text-gray-400">{state?.error ?? "Loading today’s causal snapshot…"}</td> : <>
                    <td className="px-3 py-2">{evidence.asOfDate}{!evidence.dataQuality.requestedDateWasTradingDay && <span className="ml-1 text-amber-600">*</span>}</td>
                    <td className="px-3 py-2">{formatPercent(evidence.drawdownFromAthPct)}</td>
                    <td className="px-3 py-2">{formatPercent(evidence.pctAboveCurrentRollingLow)}</td>
                    <td className={`px-3 py-2 font-semibold ${evidence.bottomCandidate.score == null ? "text-gray-500" : evidence.bottomCandidate.score >= 75 ? "text-green-700" : evidence.bottomCandidate.score >= 55 ? "text-amber-700" : "text-red-700"}`}>{evidence.bottomCandidate.score == null ? "Not scoreable" : evidence.bottomCandidate.score.toFixed(1)}</td>
                    <td className="max-w-sm px-3 py-2 text-gray-600" title={evidence.bottomCandidate.gates.reasons.join("; ")}>{evidence.bottomCandidate.gates.reasons.length > 0 ? evidence.bottomCandidate.gates.reasons.join("; ") : "All gates passed"}</td>
                  </>}
                  <td className="max-w-xs px-3 py-2 text-gray-600">{record.note || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => onLiveRemove(record.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Remove</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">Historical evidence only; future outcome labels and returns are excluded.</p>
          <button type="button" onClick={handleExportEvidence} disabled={loading || records.length === 0} className="shrink-0 rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
            Export Evidence CSV
          </button>
        </div>
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
