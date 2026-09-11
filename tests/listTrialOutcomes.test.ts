import test from "node:test";
import assert from "node:assert/strict";
import { calculateListTrialOutcomes } from "../lib/listTrialOutcomes";

const bars = (closes: number[]) => closes.map((close, index) => ({ date: `2024-01-${String(index + 1).padStart(2, "0")}`, close }));

test("labels target-first when +20% closes before the -12% breakdown", () => {
  const result = calculateListTrialOutcomes(bars([100, 95, 121, 80]), 0);
  const target20 = result.targets.find((target) => target.targetPct === 20)!;
  const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
  assert.equal(breakdown12.status, "target_first");
  assert.equal(target20.targetHitDate, "2024-01-03");
  assert.equal(breakdown12.breakdownHitDate, "2024-01-04");
  assert.equal(target20.maxAdverseExcursionPct, -5);
});

test("labels breakdown-first when the -12% close happens before +20%", () => {
  const result = calculateListTrialOutcomes(bars([100, 87, 121]), 0);
  const target20 = result.targets.find((target) => target.targetPct === 20)!;
  const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
  assert.equal(breakdown12.status, "breakdown_first");
  assert.equal(target20.targetHitDate, "2024-01-03");
  assert.equal(breakdown12.breakdownHitDate, "2024-01-02");
});

test("keeps an unresolved outcome open when neither level has been reached", () => {
  const result = calculateListTrialOutcomes(bars([100, 98, 105]), 0);
  const target20 = result.targets.find((target) => target.targetPct === 20)!;
  const breakdown12 = target20.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;
  assert.equal(breakdown12.status, "open");
  assert.equal(target20.maxAdverseExcursionPct, -2);
});
