export const LIST_TRIAL_TARGETS = [15, 20, 30] as const;
export const LIST_TRIAL_BREAKDOWNS = [-8, -12, -15] as const;
export const LIST_TRIAL_HORIZONS = [60, 120, 250] as const;

export type ListTrialOutcomeStatus = "target_first" | "breakdown_first" | "open" | "insufficient_future";

export interface ListTrialOutcomeBar {
  date: string;
  close: number;
}

export interface BreakdownOutcome {
  breakdownPct: number;
  breakdownPrice: number;
  breakdownHitDate: string | null;
  status: ListTrialOutcomeStatus;
}

export interface TargetOutcome {
  targetPct: number;
  targetPrice: number;
  targetHitDate: string | null;
  daysToTarget: number | null;
  maxAdverseExcursionPct: number | null;
  breakdowns: BreakdownOutcome[];
}

function firstIndexAfter(bars: ListTrialOutcomeBar[], candidateIndex: number, predicate: (bar: ListTrialOutcomeBar) => boolean): number | null {
  for (let i = candidateIndex + 1; i < bars.length; i++) {
    if (predicate(bars[i])) return i;
  }
  return null;
}

function maxAdverseExcursionPct(bars: ListTrialOutcomeBar[], candidateIndex: number, endIndex: number | null): number | null {
  if (endIndex == null || endIndex <= candidateIndex) return null;
  const entryPrice = bars[candidateIndex].close;
  let lowestClose = entryPrice;
  for (let i = candidateIndex + 1; i <= endIndex; i++) lowestClose = Math.min(lowestClose, bars[i].close);
  return ((lowestClose - entryPrice) / entryPrice) * 100;
}

export function calculateListTrialOutcomes(bars: ListTrialOutcomeBar[], candidateIndex: number) {
  const candidate = bars[candidateIndex];
  const entryPrice = candidate.close;
  const hasFutureBars = candidateIndex < bars.length - 1;

  const targets: TargetOutcome[] = LIST_TRIAL_TARGETS.map((targetPct) => {
    const targetPrice = entryPrice * (1 + targetPct / 100);
    const targetIndex = firstIndexAfter(bars, candidateIndex, (bar) => bar.close >= targetPrice);
    const adverseEndIndex = targetIndex ?? (hasFutureBars ? bars.length - 1 : null);
    return {
      targetPct,
      targetPrice,
      targetHitDate: targetIndex == null ? null : bars[targetIndex].date,
      daysToTarget: targetIndex == null ? null : targetIndex - candidateIndex,
      maxAdverseExcursionPct: maxAdverseExcursionPct(bars, candidateIndex, adverseEndIndex),
      breakdowns: LIST_TRIAL_BREAKDOWNS.map((breakdownPct) => {
        const breakdownPrice = entryPrice * (1 + breakdownPct / 100);
        const breakdownIndex = firstIndexAfter(bars, candidateIndex, (bar) => bar.close <= breakdownPrice);
        let status: ListTrialOutcomeStatus;
        if (!hasFutureBars) status = "insufficient_future";
        else if (targetIndex != null && (breakdownIndex == null || targetIndex < breakdownIndex)) status = "target_first";
        else if (breakdownIndex != null && (targetIndex == null || breakdownIndex < targetIndex)) status = "breakdown_first";
        else status = "open";
        return {
          breakdownPct,
          breakdownPrice,
          breakdownHitDate: breakdownIndex == null ? null : bars[breakdownIndex].date,
          status,
        };
      }),
    };
  });

  const returns = Object.fromEntries(LIST_TRIAL_HORIZONS.map((horizon) => {
    const bar = bars[candidateIndex + horizon];
    return [horizon, bar ? ((bar.close - entryPrice) / entryPrice) * 100 : null];
  }));

  return { entryPrice, targets, returns, barsAfterCandidate: Math.max(0, bars.length - candidateIndex - 1) };
}
