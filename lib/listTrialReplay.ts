import { calculateListTrialEvidenceAt, createListTrialEvidenceContext, LIST_TRIAL_PRIOR_LOW_END, type ListTrialEvidence } from "./listTrialEvidence";
import { groupListTrialEpisodes, type ListTrialEpisode, type ListTrialEpisodeObservation } from "./listTrialEpisodes";
import { createListTrialEntryPlanForEpisode, executeListTrialEntryPlan, type ListTrialEntryExecution, type ListTrialEntryPlan, type ListTrialEntryPlanResult } from "./listTrialEntries";
import { calculateListTrialOutcomesFromEntry, type ListTrialOutcomeStatus, type ListTrialOutcomeBar } from "./listTrialOutcomes";
import type { OHLCVBar } from "./types";

export interface ListTrialReplayBar extends OHLCVBar, ListTrialOutcomeBar {}

export interface ListTrialReplaySignal {
  /** Backward-compatible aliases for the frozen episode trigger. */
  date: string;
  score: number;
  episodeId: string;
  triggerDate: string;
  triggerScore: number;
  triggerAnchors: ListTrialEpisode["triggerAnchors"];
  firstQualifyingDate: string;
  lastQualifyingDate: string;
  qualifyingDayCount: number;
  entryPlan: ListTrialEntryPlan | null;
  entryPlanStatus: ListTrialEntryPlanResult["status"];
  entry: ListTrialEntryExecution;
  primaryOutcome: ListTrialOutcomeStatus | "not_entered";
  daysToTarget: number | null;
  maxAdverseExcursionPct: number | null;
  return60d: number | null;
}

export interface ListTrialReplayRawQualifyingDay { date: string; score: number }

export interface ListTrialReplayBand {
  label: string;
  /** Entered episodes only. */
  total: number;
  targetFirst: number;
  breakdownFirst: number;
  open: number;
  targetFirstPct: number | null;
  missedZone: number;
  notEntered: number;
}

function outcomeForEntry(bars: ListTrialReplayBar[], entry: ListTrialEntryExecution) {
  if (entry.status !== "entered") return null;
  const outcomes = calculateListTrialOutcomesFromEntry(bars, entry.entryIndex, entry.assumedEntryPrice);
  const target20 = outcomes.targets.find((target) => target.targetPct === 20)!;
  const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
  return { outcomes, target20, breakdown12 };
}

export function calculateListTrialReplay(bars: ListTrialReplayBar[], startDate: string, endDate: string, minScore = 55) {
  const evidenceContext = createListTrialEvidenceContext(bars);
  const observations: ListTrialEpisodeObservation[] = [];
  const evidenceByDate = new Map<string, ListTrialEvidence>();
  const rawQualifyingDays: ListTrialReplayRawQualifyingDay[] = [];
  let eligibleDates = 0;

  // Observations are chronological trading sessions, so cooldown counts sessions and is causal.
  for (let index = LIST_TRIAL_PRIOR_LOW_END - 1; index < bars.length; index++) {
    const date = bars[index].date;
    if (date > endDate) break;
    const evidence = calculateListTrialEvidenceAt(bars, index, evidenceContext);
    const score = evidence?.score.score;
    const qualifyingDay = evidence != null && score != null && score >= minScore ? { date, score, anchors: evidence.anchors } : null;
    if (date >= startDate) {
      eligibleDates++;
      if (qualifyingDay != null) rawQualifyingDays.push({ date, score: qualifyingDay.score });
    }
    if (evidence != null) evidenceByDate.set(date, evidence);
    observations.push({ date, qualifyingDay });
  }

  const episodes = groupListTrialEpisodes(observations).filter((episode) => episode.triggerDate >= startDate && episode.triggerDate <= endDate);
  const signals: ListTrialReplaySignal[] = episodes.map((episode, episodeIndex) => {
    const triggerEvidence = evidenceByDate.get(episode.triggerDate);
    const planResult = triggerEvidence == null ? { status: "unavailable_invalid_trigger" as const, plan: null } : createListTrialEntryPlanForEpisode(episode, triggerEvidence);
    const entry = planResult.plan == null ? ({ status: "not_entered_invalid_open", entryDate: episode.triggerDate, entryIndex: triggerEvidence?.index ?? -1 } as const) : executeListTrialEntryPlan(bars, planResult.plan);
    const graded = outcomeForEntry(bars, entry);
    return {
      date: episode.triggerDate, score: episode.triggerScore,
      episodeId: `episode-${episodeIndex + 1}-${episode.triggerDate}`,
      triggerDate: episode.triggerDate, triggerScore: episode.triggerScore, triggerAnchors: episode.triggerAnchors,
      firstQualifyingDate: episode.firstQualifyingDate, lastQualifyingDate: episode.lastQualifyingDate, qualifyingDayCount: episode.qualifyingDayCount,
      entryPlan: planResult.plan, entryPlanStatus: planResult.status, entry,
      primaryOutcome: graded?.breakdown12.status ?? "not_entered", daysToTarget: graded?.target20.daysToTarget ?? null,
      maxAdverseExcursionPct: graded?.target20.maxAdverseExcursionPct ?? null, return60d: graded?.outcomes.returns[60] as number | null ?? null,
    };
  });

  const bandDefs = [{ label: "55–64.9", matches: (score: number) => score >= 55 && score < 65 }, { label: "65–74.9", matches: (score: number) => score >= 65 && score < 75 }, { label: "75–100", matches: (score: number) => score >= 75 }];
  const bands: ListTrialReplayBand[] = bandDefs.map((band) => {
    const matched = signals.filter((signal) => band.matches(signal.triggerScore));
    const entered = matched.filter((signal) => signal.entry.status === "entered");
    const targetFirst = entered.filter((signal) => signal.primaryOutcome === "target_first").length;
    const breakdownFirst = entered.filter((signal) => signal.primaryOutcome === "breakdown_first").length;
    const open = entered.filter((signal) => signal.primaryOutcome === "open" || signal.primaryOutcome === "insufficient_future").length;
    const missedZone = matched.filter((signal) => signal.entry.status === "missed_zone").length;
    const notEntered = matched.length - entered.length - missedZone;
    return { label: band.label, total: entered.length, targetFirst, breakdownFirst, open, targetFirstPct: entered.length > 0 ? targetFirst / entered.length * 100 : null, missedZone, notEntered };
  });

  return { eligibleDates, rawQualifyingDayCount: rawQualifyingDays.length, rawQualifyingDays, episodeCount: signals.length, episodes: signals, signals, bands };
}
