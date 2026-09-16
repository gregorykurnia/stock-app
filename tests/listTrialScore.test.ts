import test from "node:test";
import assert from "node:assert/strict";
import { calcBottomCandidateScore, explainBottomCandidateScore } from "../lib/listTrialScore";

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

test("explains every score component and preserves the existing total", () => {
  const result = calcBottomCandidateScore(strongCandidate);
  const explanation = explainBottomCandidateScore(resultInput(), result, {
    allTimeHigh: 100,
    currentRollingLow: { date: "2024-01-10", close: 30 },
    priorSellingLow: { date: "2023-10-10", close: 31.5 },
  });

  assert.equal(explanation.scoreable, true);
  assert.equal(explanation.maxScore, 100);
  assert.equal(explanation.components.length, 7);
  assert.deepEqual(explanation.components.map((component) => component.key), [
    "drawdownDepth", "proximity", "priceStructure", "rsi", "macd", "directionalPressure", "moneyFlow",
  ]);
  assert.deepEqual(explanation.components.map((component) => component.maxPoints), [5, 20, 15, 15, 15, 15, 15]);
  assert.ok(Math.abs(explanation.components.reduce((sum, component) => sum + component.points, 0) - result.score!) < 1e-9);
  assert.equal(explanation.gates.every((gate) => gate.passed), true);
  assert.match(explanation.summary, /strongest contributions came from/);
  assert.match(explanation.warning, /not a probability/);
  assert.equal(explanation.anchors.currentRollingLow?.date, "2024-01-10");
});

test("explains failed gates and keeps an unscoreable result distinct from zero", () => {
  const input = resultInput({ eligibleAt40PctBelowAth: false, drawdownFromAthPct: -35, pctAboveCurrentRollingLow: 20 });
  const result = calcBottomCandidateScore(input);
  const explanation = explainBottomCandidateScore(input, result, {
    allTimeHigh: 100,
    currentRollingLow: { date: "2024-01-10", close: 30 },
    priorSellingLow: { date: "2023-10-10", close: 31.5 },
  });

  assert.equal(explanation.score, null);
  assert.equal(explanation.scoreable, false);
  assert.equal(explanation.gates.find((gate) => gate.key === "eligible")?.passed, false);
  assert.equal(explanation.gates.find((gate) => gate.key === "nearRollingLow")?.passed, false);
  assert.match(explanation.summary, /Not scoreable/);
  assert.match(explanation.summary, /40%/);
  assert.equal(explanation.components.find((component) => component.key === "drawdownDepth")?.points, 0);
  assert.equal(explanation.components.find((component) => component.key === "drawdownDepth")?.status, "unfavorable");
});

function resultInput(overrides: Partial<typeof strongCandidate> = {}) {
  return { ...strongCandidate, ...overrides };
}
