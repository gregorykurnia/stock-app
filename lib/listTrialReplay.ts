import { calcIndicators, macdSeriesFull } from "./indicators";
import { calcBottomCandidateScore } from "./listTrialScore";
import { calculateListTrialOutcomes, type ListTrialOutcomeBar } from "./listTrialOutcomes";
import type { OHLCVBar } from "./types";

const CURRENT_LOW_WINDOW = 20;
const PRIOR_LOW_START = 40;
const PRIOR_LOW_END = 120;

export interface ListTrialReplayBar extends OHLCVBar, ListTrialOutcomeBar {}

function minIndex(values: number[], start: number, end: number): number | null {
  if (end <= start) return null;
  let result: number | null = null;
  for (let i = start; i < end; i++) if (result == null || values[i] < values[result]) result = i;
  return result;
}

function valueAt(values: number[], index: number | null): number | null {
  if (index == null || !Number.isFinite(values[index])) return null;
  return values[index];
}

function pctChange(current: number | null, prior: number | null): number | null {
  return current != null && prior != null && prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : null;
}

function difference(current: number | null, prior: number | null): number | null {
  return current != null && prior != null ? current - prior : null;
}

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
  const closes = bars.map((bar) => bar.close);
  const indicators = calcIndicators(bars);
  const { hist } = macdSeriesFull(closes);
  const signals: ListTrialReplaySignal[] = [];
  let eligibleDates = 0;

  for (let index = PRIOR_LOW_END - 1; index < bars.length; index++) {
    const date = bars[index].date;
    if (date < startDate || date > endDate) continue;
    eligibleDates++;

    const currentLowIndex = minIndex(closes, Math.max(0, index + 1 - CURRENT_LOW_WINDOW), index + 1);
    const priorLowIndex = minIndex(closes, index + 1 - PRIOR_LOW_END, index + 1 - PRIOR_LOW_START);
    const currentLow = valueAt(closes, currentLowIndex);
    const priorLow = valueAt(closes, priorLowIndex);
    const currentHistPct = currentLowIndex != null && currentLow != null && currentLow !== 0 ? (valueAt(hist, currentLowIndex) ?? 0) / currentLow * 100 : null;
    const priorHistPct = priorLowIndex != null && priorLow != null && priorLow !== 0 ? (valueAt(hist, priorLowIndex) ?? 0) / priorLow * 100 : null;
    const allTimeHigh = Math.max(...closes.slice(0, index + 1));
    const currentDiGap = difference(valueAt(indicators.diPlus, currentLowIndex), valueAt(indicators.diMinus, currentLowIndex));
    const priorDiGap = difference(valueAt(indicators.diPlus, priorLowIndex), valueAt(indicators.diMinus, priorLowIndex));
    const score = calcBottomCandidateScore({
      eligibleAt40PctBelowAth: bars[index].close <= allTimeHigh * 0.6,
      drawdownFromAthPct: pctChange(bars[index].close, allTimeHigh),
      pctAboveCurrentRollingLow: pctChange(bars[index].close, currentLow),
      currentLowVsPriorLowPct: pctChange(currentLow, priorLow),
      rsiDeltaCurrentVsPrior: difference(valueAt(indicators.rsi, currentLowIndex), valueAt(indicators.rsi, priorLowIndex)),
      macdHistPctDeltaCurrentVsPrior: difference(currentHistPct, priorHistPct),
      diGapDeltaCurrentVsPrior: difference(currentDiGap, priorDiGap),
      adxDeltaCurrentVsPrior: difference(valueAt(indicators.adx, currentLowIndex), valueAt(indicators.adx, priorLowIndex)),
      cmfDeltaCurrentVsPrior: difference(valueAt(indicators.cmf, currentLowIndex), valueAt(indicators.cmf, priorLowIndex)),
    });
    if (score.score == null || score.score < minScore) continue;

    const outcomes = calculateListTrialOutcomes(bars, index);
    const target20 = outcomes.targets.find((target) => target.targetPct === 20)!;
    const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
    signals.push({
      date,
      score: score.score,
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
