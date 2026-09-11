import { calculateListTrialOutcomes, type ListTrialOutcomeBar } from "./listTrialOutcomes";
import { calculateListTrialEvidenceAt, createListTrialEvidenceContext, LIST_TRIAL_PRIOR_LOW_END } from "./listTrialEvidence";
import type { OHLCVBar } from "./types";

export interface ListTrialReplayBar extends OHLCVBar, ListTrialOutcomeBar {}

export interface ListTrialReplaySignal {
  date: string;
  score: number;
  primaryOutcome: "target_first" | "breakdown_first" | "open" | "insufficient_future";
  daysToTarget: number | null;
  maxAdverseExcursionPct: number | null;
  return60d: number | null;
}

export interface ListTrialReplayBand {
  label: string;
  total: number;
  targetFirst: number;
  breakdownFirst: number;
  open: number;
  targetFirstPct: number | null;
}

export function calculateListTrialReplay(bars: ListTrialReplayBar[], startDate: string, endDate: string, minScore = 55) {
  const evidenceContext = createListTrialEvidenceContext(bars);
  const signals: ListTrialReplaySignal[] = [];
  let eligibleDates = 0;

  for (let index = LIST_TRIAL_PRIOR_LOW_END - 1; index < bars.length; index++) {
    const date = bars[index].date;
    if (date < startDate || date > endDate) continue;
    eligibleDates++;
    const evidence = calculateListTrialEvidenceAt(bars, index, evidenceContext);
    if (evidence?.score.score == null || evidence.score.score < minScore) continue;

    const outcomes = calculateListTrialOutcomes(bars, index);
    const target20 = outcomes.targets.find((target) => target.targetPct === 20)!;
    const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
    signals.push({
      date,
      score: evidence.score.score,
      primaryOutcome: breakdown12.status,
      daysToTarget: target20.daysToTarget,
      maxAdverseExcursionPct: target20.maxAdverseExcursionPct,
      return60d: outcomes.returns[60] as number | null,
    });
  }

  const bandDefs = [
    { label: "55–64.9", matches: (score: number) => score >= 55 && score < 65 },
    { label: "65–74.9", matches: (score: number) => score >= 65 && score < 75 },
    { label: "75–100", matches: (score: number) => score >= 75 },
  ];
  const bands: ListTrialReplayBand[] = bandDefs.map((band) => {
    const matched = signals.filter((signal) => band.matches(signal.score));
    const targetFirst = matched.filter((signal) => signal.primaryOutcome === "target_first").length;
    const breakdownFirst = matched.filter((signal) => signal.primaryOutcome === "breakdown_first").length;
    const open = matched.length - targetFirst - breakdownFirst;
    return { label: band.label, total: matched.length, targetFirst, breakdownFirst, open, targetFirstPct: matched.length > 0 ? targetFirst / matched.length * 100 : null };
  });

  return { eligibleDates, signals, bands };
}
