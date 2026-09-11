import test from "node:test";
import assert from "node:assert/strict";
import {
  LIST_TRIAL_BUY_SLIPPAGE_BPS,
  createListTrialEntryPlan,
  createListTrialEntryPlanForEpisode,
  executeListTrialEntryPlan,
} from "../lib/listTrialEntries";
import { calculateListTrialEvidenceAt } from "../lib/listTrialEvidence";
import { groupListTrialEpisodes } from "../lib/listTrialEpisodes";
import { calculateListTrialOutcomesFromEntry } from "../lib/listTrialOutcomes";
import type { ListTrialReplayBar } from "../lib/listTrialReplay";

function plan(triggerIndex = 0, zoneHigh = 90) {
  const result = createListTrialEntryPlan({
    triggerDate: "2024-01-01",
    triggerIndex,
    triggerClose: zoneHigh,
    rollingLow: 80,
    atr14: 15,
  });
  assert.equal(result.status, "ready");
  return result.plan;
}

test("entry zone is frozen from the trigger rolling low, ATR, and close", () => {
  const cappedAtClose = plan();
  assert.deepEqual(
    { zoneLow: cappedAtClose.zoneLow, zoneHigh: cappedAtClose.zoneHigh },
    { zoneLow: 80, zoneHigh: 90 }
  );
  const atrCapped = createListTrialEntryPlan({
    triggerDate: "2024-01-01", triggerIndex: 0, triggerClose: 100, rollingLow: 80, atr14: 15,
  });
  assert.equal(atrCapped.status, "ready");
  assert.equal(atrCapped.plan.zoneHigh, 95);
  assert.equal(LIST_TRIAL_BUY_SLIPPAGE_BPS, 10);
});

test("does not substitute a later ATR when trigger ATR is unavailable", () => {
  const result = createListTrialEntryPlan({
    triggerDate: "2024-01-01", triggerIndex: 0, triggerClose: 90, rollingLow: 80, atr14: null,
  });
  assert.deepEqual(result, { status: "unavailable_missing_atr", plan: null });
});

test("entry is eligible only at the next session open and applies fixed buy slippage", () => {
  const result = executeListTrialEntryPlan([
    { date: "2024-01-01", open: 80 },
    { date: "2024-01-02", open: 85 },
  ], plan());
  assert.deepEqual(result, {
    status: "entered", entryDate: "2024-01-02", entryIndex: 1, entryOpen: 85, assumedEntryPrice: 85.085,
  });
});

test("a next-session gap above the frozen zone is missed rather than chased", () => {
  const result = executeListTrialEntryPlan([
    { date: "2024-01-01", open: 80 },
    { date: "2024-01-02", open: 91 },
    { date: "2024-01-03", open: 70 },
  ], plan());
  assert.deepEqual(result, { status: "missed_zone", entryDate: "2024-01-02", entryIndex: 1, entryOpen: 91 });
});

test("no future session is not entered and is distinct from a missed zone", () => {
  assert.deepEqual(
    executeListTrialEntryPlan([{ date: "2024-01-01", open: 80 }], plan()),
    { status: "not_entered_no_future_data" }
  );
});

function evidenceBars(length: number): ListTrialReplayBar[] {
  const start = new Date("2024-01-01T00:00:00.000Z");
  return Array.from({ length }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    const close = index < 100 ? 100 + index * 0.1 : index < 120 ? 70 - (index - 100) * 0.5 : 58 - (index - 120) * 0.2;
    return { date, time: Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000), open: close, high: close + 1, low: close - 1, close, volume: 1_000_000 };
  });
}

test("episode entry plan remains prefix-stable when future bars are appended", () => {
  const base = evidenceBars(150);
  const extended = [...base, ...evidenceBars(20).map((bar, index) => ({
    ...bar, date: `2024-06-${String(index + 1).padStart(2, "0")}`, time: 1_717_200_000 + index * 86_400,
    open: 150, high: 151, low: 149, close: 150,
  }))];
  const index = 140;
  const baseEvidence = calculateListTrialEvidenceAt(base, index)!;
  const extendedEvidence = calculateListTrialEvidenceAt(extended, index)!;
  const episodeFrom = (evidence: typeof baseEvidence) => groupListTrialEpisodes([{
    date: evidence.date,
    qualifyingDay: { date: evidence.date, score: evidence.score.score!, anchors: evidence.anchors },
  }])[0];
  assert.deepEqual(
    createListTrialEntryPlanForEpisode(episodeFrom(extendedEvidence), extendedEvidence),
    createListTrialEntryPlanForEpisode(episodeFrom(baseEvidence), baseEvidence)
  );
});

test("entry-based outcomes order target and breakdowns and measure MAE from the fill", () => {
  const result = calculateListTrialOutcomesFromEntry([
    { date: "2024-01-01", close: 100 },
    { date: "2024-01-02", close: 90 },
    { date: "2024-01-03", close: 75 },
    { date: "2024-01-04", close: 110 },
  ], 1, 90);
  const target20 = result.targets.find((target) => target.targetPct === 20)!;
  const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
  assert.equal(target20.targetPrice, 108);
  assert.equal(target20.daysToTarget, 2);
  assert.equal(breakdown12.status, "breakdown_first");
  assert.equal(target20.maxAdverseExcursionPct, -16.666666666666664);
  assert.equal(result.barsAfterEntry, 2);
});
