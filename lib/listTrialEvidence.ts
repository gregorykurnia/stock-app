import { calcIndicators, macdSeriesFull } from "./indicators";
import { calcBottomCandidateScore, type BottomCandidateScoreResult } from "./listTrialScore";
import type { OHLCVBar } from "./types";

export const LIST_TRIAL_CURRENT_LOW_WINDOW = 20;
export const LIST_TRIAL_PRIOR_LOW_START = 40;
export const LIST_TRIAL_PRIOR_LOW_END = 120;

export interface ListTrialEvidenceBar extends OHLCVBar {
  date: string;
}

export interface ListTrialEvidenceAnchors {
  allTimeHigh: number;
  currentRollingLow: { date: string; index: number; close: number } | null;
  priorSellingLow: { date: string; index: number; close: number } | null;
}

export interface ListTrialEvidence {
  date: string;
  index: number;
  close: number;
  score: BottomCandidateScoreResult;
  anchors: ListTrialEvidenceAnchors;
  // Wilder ATR(14) at this as-of date. It is exposed so an executable plan can
  // freeze the trigger-day volatility reference without inspecting later bars.
  atr14: number | null;
}

export interface ListTrialEvidenceContext {
  closes: number[];
  hist: number[];
  indicators: ReturnType<typeof calcIndicators>;
}

export function createListTrialEvidenceContext(bars: ListTrialEvidenceBar[]): ListTrialEvidenceContext {
  const closes = bars.map((bar) => bar.close);
  return { closes, hist: macdSeriesFull(closes).hist, indicators: calcIndicators(bars) };
}

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

// All array values used at index are causal; callers must only request an index in the supplied history.
export function calculateListTrialEvidenceAt(
  bars: ListTrialEvidenceBar[],
  index: number,
  context = createListTrialEvidenceContext(bars)
): ListTrialEvidence | null {
  if (index < LIST_TRIAL_PRIOR_LOW_END - 1 || index >= bars.length) return null;

  const { closes, indicators, hist } = context;
  const currentLowIndex = minIndex(closes, Math.max(0, index + 1 - LIST_TRIAL_CURRENT_LOW_WINDOW), index + 1);
  const priorLowIndex = minIndex(closes, index + 1 - LIST_TRIAL_PRIOR_LOW_END, index + 1 - LIST_TRIAL_PRIOR_LOW_START);
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

  const anchor = (anchorIndex: number | null) => anchorIndex == null ? null : {
    date: bars[anchorIndex].date,
    index: anchorIndex,
    close: bars[anchorIndex].close,
  };
  return {
    date: bars[index].date,
    index,
    close: bars[index].close,
    score,
    anchors: { allTimeHigh, currentRollingLow: anchor(currentLowIndex), priorSellingLow: anchor(priorLowIndex) },
    atr14: valueAt(indicators.atr, index),
  };
}
