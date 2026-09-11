import type { ListTrialEvidence } from "./listTrialEvidence";
import type { ListTrialEpisode } from "./listTrialEpisodes";

// Fixed experiment assumptions. These are deliberately constants, not tuning inputs.
export const LIST_TRIAL_ENTRY_ATR_MULTIPLE = 1;
export const LIST_TRIAL_BUY_SLIPPAGE_BPS = 10;

export interface ListTrialEntryBar {
  date: string;
  open: number;
}

export interface ListTrialEntryPlanInput {
  triggerDate: string;
  triggerIndex: number;
  triggerClose: number;
  rollingLow: number | null;
  atr14: number | null;
}

export interface ListTrialEntryPlan {
  triggerDate: string;
  triggerIndex: number;
  triggerClose: number;
  rollingLow: number;
  atr14: number;
  zoneLow: number;
  zoneHigh: number;
}

export type ListTrialEntryPlanResult =
  | { status: "ready"; plan: ListTrialEntryPlan }
  | { status: "unavailable_missing_rolling_low" | "unavailable_missing_atr" | "unavailable_invalid_trigger"; plan: null };

export type ListTrialEntryExecution =
  | { status: "entered"; entryDate: string; entryIndex: number; entryOpen: number; assumedEntryPrice: number }
  | { status: "missed_zone"; entryDate: string; entryIndex: number; entryOpen: number }
  | { status: "not_entered_no_future_data" }
  | { status: "not_entered_invalid_open"; entryDate: string; entryIndex: number };

function validPositive(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

// This plan is constructed solely from trigger-day inputs. A missing ATR makes the plan
// unavailable rather than substituting a later ATR, which would leak hindsight.
export function createListTrialEntryPlan(input: ListTrialEntryPlanInput): ListTrialEntryPlanResult {
  if (!validPositive(input.triggerClose) || !Number.isInteger(input.triggerIndex) || input.triggerIndex < 0) {
    return { status: "unavailable_invalid_trigger", plan: null };
  }
  if (!validPositive(input.rollingLow)) return { status: "unavailable_missing_rolling_low", plan: null };
  if (!validPositive(input.atr14)) return { status: "unavailable_missing_atr", plan: null };

  const zoneLow = input.rollingLow;
  return {
    status: "ready",
    plan: {
      triggerDate: input.triggerDate,
      triggerIndex: input.triggerIndex,
      triggerClose: input.triggerClose,
      rollingLow: input.rollingLow,
      atr14: input.atr14,
      zoneLow,
      zoneHigh: Math.min(input.triggerClose, zoneLow + LIST_TRIAL_ENTRY_ATR_MULTIPLE * input.atr14),
    },
  };
}

// The episode contributes its frozen trigger anchor; evidence contributes the trigger-day
// close, index, and ATR. Callers must pass the evidence captured on the episode trigger day.
export function createListTrialEntryPlanForEpisode(
  episode: ListTrialEpisode,
  triggerEvidence: Pick<ListTrialEvidence, "date" | "index" | "close" | "atr14">
): ListTrialEntryPlanResult {
  if (episode.triggerDate !== triggerEvidence.date) {
    return { status: "unavailable_invalid_trigger", plan: null };
  }
  return createListTrialEntryPlan({
    triggerDate: episode.triggerDate,
    triggerIndex: triggerEvidence.index,
    triggerClose: triggerEvidence.close,
    rollingLow: episode.triggerAnchors.currentRollingLow?.close ?? null,
    atr14: triggerEvidence.atr14,
  });
}

// A trigger is known only after its close. The first executable session is therefore exactly
// triggerIndex + 1. A gap above zoneHigh is a missed zone; no following-day chase is modeled.
export function executeListTrialEntryPlan(bars: ListTrialEntryBar[], plan: ListTrialEntryPlan): ListTrialEntryExecution {
  const entryIndex = plan.triggerIndex + 1;
  const entryBar = bars[entryIndex];
  if (entryBar == null) return { status: "not_entered_no_future_data" };
  if (!validPositive(entryBar.open)) {
    return { status: "not_entered_invalid_open", entryDate: entryBar.date, entryIndex };
  }
  if (entryBar.open > plan.zoneHigh) {
    return { status: "missed_zone", entryDate: entryBar.date, entryIndex, entryOpen: entryBar.open };
  }
  return {
    status: "entered",
    entryDate: entryBar.date,
    entryIndex,
    entryOpen: entryBar.open,
    assumedEntryPrice: entryBar.open * (1 + LIST_TRIAL_BUY_SLIPPAGE_BPS / 10_000),
  };
}
