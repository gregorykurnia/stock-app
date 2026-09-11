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

function firstIndexAfter(bars: ListTrialOutcomeBar[], entryIndex: number, predicate: (bar: ListTrialOutcomeBar) => boolean): number | null {
  for (let i = entryIndex + 1; i < bars.length; i++) {
    if (predicate(bars[i])) return i;
  }
  return null;
}

function maxAdverseExcursionPct(bars: ListTrialOutcomeBar[], entryIndex: number, entryPrice: number, endIndex: number | null): number | null {
  if (endIndex == null || endIndex <= entryIndex) return null;
  let lowestClose = entryPrice;
  for (let i = entryIndex + 1; i <= endIndex; i++) lowestClose = Math.min(lowestClose, bars[i].close);
  return ((lowestClose - entryPrice) / entryPrice) * 100;
}

// Grades a recorded, executable entry. Prices and all event ordering begin strictly after the
// fill bar, while MAE and return horizons use the actual entry index and assumed entry price.
export function calculateListTrialOutcomesFromEntry(bars: ListTrialOutcomeBar[], entryIndex: number, entryPrice: number) {
  if (!Number.isInteger(entryIndex) || entryIndex < 0 || entryIndex >= bars.length || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new RangeError("entryIndex and entryPrice must identify a valid positive entry");
  }
  const hasFutureBars = entryIndex < bars.length - 1;

  const targets: TargetOutcome[] = LIST_TRIAL_TARGETS.map((targetPct) => {
    const targetPrice = entryPrice * (1 + targetPct / 100);
    const targetIndex = firstIndexAfter(bars, entryIndex, (bar) => bar.close >= targetPrice);
    const adverseEndIndex = targetIndex ?? (hasFutureBars ? bars.length - 1 : null);
    return {
      targetPct,
      targetPrice,
      targetHitDate: targetIndex == null ? null : bars[targetIndex].date,
      daysToTarget: targetIndex == null ? null : targetIndex - entryIndex,
      maxAdverseExcursionPct: maxAdverseExcursionPct(bars, entryIndex, entryPrice, adverseEndIndex),
      breakdowns: LIST_TRIAL_BREAKDOWNS.map((breakdownPct) => {
        const breakdownPrice = entryPrice * (1 + breakdownPct / 100);
        const breakdownIndex = firstIndexAfter(bars, entryIndex, (bar) => bar.close <= breakdownPrice);
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
    const bar = bars[entryIndex + horizon];
    return [horizon, bar ? ((bar.close - entryPrice) / entryPrice) * 100 : null];
  }));

  return { entryPrice, targets, returns, barsAfterEntry: Math.max(0, bars.length - entryIndex - 1) };
}

// Legacy close-on-candidate analysis retained for existing callers. New executable replay
// logic should use calculateListTrialOutcomesFromEntry after executeListTrialEntryPlan.
export function calculateListTrialOutcomes(bars: ListTrialOutcomeBar[], candidateIndex: number) {
  const candidate = bars[candidateIndex];
  if (candidate == null) throw new RangeError("candidateIndex must identify a bar");
  const { barsAfterEntry, ...outcomes } = calculateListTrialOutcomesFromEntry(bars, candidateIndex, candidate.close);
  return { ...outcomes, barsAfterCandidate: barsAfterEntry };
}
