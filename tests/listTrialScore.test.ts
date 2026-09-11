import test from "node:test";
import assert from "node:assert/strict";
import { calcBottomCandidateScore } from "../lib/listTrialScore";

const strongCandidate = {
  eligibleAt40PctBelowAth: true,
  drawdownFromAthPct: -70,
  pctAboveCurrentRollingLow: 2,
  currentLowVsPriorLowPct: -5,
  rsiDeltaCurrentVsPrior: 10,
  macdHistPctDeltaCurrentVsPrior: 0.5,
  diGapDeltaCurrentVsPrior: 10,
  adxDeltaCurrentVsPrior: -8,
  cmfDeltaCurrentVsPrior: 0.1,
};

test("scores a complete near-low candidate from causal evidence only", () => {
  const result = calcBottomCandidateScore(strongCandidate);
  assert.ok(Math.abs((result.score ?? 0) - 97.33333333333333) < 1e-9);
  assert.deepEqual(result.gates.reasons, []);
});

test("withholds a score when the candidate fails an eligibility gate", () => {
  const result = calcBottomCandidateScore({ ...strongCandidate, eligibleAt40PctBelowAth: false, drawdownFromAthPct: -35 });
  assert.equal(result.score, null);
  assert.equal(result.gates.eligible, false);
  assert.match(result.gates.reasons[0], /40%/);
});

test("withholds a score when a candidate is too far above its rolling low", () => {
  const result = calcBottomCandidateScore({ ...strongCandidate, pctAboveCurrentRollingLow: 15.1 });
  assert.equal(result.score, null);
  assert.equal(result.gates.nearRollingLow, false);
});
