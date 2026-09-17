import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMacroAssessment,
  calculateCurveAssessment,
  calculateMacroTrend,
  type MacroSeries,
} from "../lib/macroContext";

function series(id: MacroSeries["id"], values: number[]): MacroSeries {
  return {
    id,
    label: id,
    unit: "Yield (%)",
    color: "#000",
    bars: values.map((value, index) => ({ date: `2026-01-${String(index + 1).padStart(2, "0")}`, value })),
  };
}

test("macro trend requires two comparison windows", () => {
  assert.equal(calculateMacroTrend(series("us10y", Array(41).fill(4))), "unavailable");
  assert.equal(calculateMacroTrend(series("us10y", [...Array(21).fill(4), ...Array(21).fill(4.2)])), "rising");
  assert.equal(calculateMacroTrend(series("us10y", [...Array(21).fill(4.2), ...Array(21).fill(4)])), "falling");
});

test("curve assessment identifies a normal, flat, and inverted curve", () => {
  const normal = calculateCurveAssessment([series("us3m", [4]), series("us10y", [4.5])]);
  const flat = calculateCurveAssessment([series("us3m", [4]), series("us10y", [4.05])]);
  const inverted = calculateCurveAssessment([series("us3m", [4.5]), series("us10y", [4])]);
  assert.equal(normal.status, "normal");
  assert.equal(flat.status, "flat");
  assert.equal(inverted.status, "inverted");
  assert.equal(inverted.spreadBp, -50);
});

test("macro assessment keeps unsupported inflation and growth inputs unavailable", () => {
  const assessment = buildMacroAssessment([
    series("us3m", [4.2]),
    series("us5y", [4.2]),
    series("us10y", [4]),
    series("us30y", [4.3]),
  ]);
  assert.equal(assessment.regime.inflationPressure, "unavailable");
  assert.equal(assessment.regime.growthMomentum, "unavailable");
  assert.equal(assessment.regime.yieldCurve, "inverted");
  assert.equal(assessment.shortCycle.phase, "late-cycle tightening");
  assert.match(assessment.shortCycle.explanation, /Educational heuristic/);
});

test("macro assessment does not invent a long-cycle position", () => {
  const assessment = buildMacroAssessment([]);
  assert.equal(assessment.longCycle.dataBacked, false);
  assert.equal(assessment.curve.status, "unavailable");
  assert.equal(assessment.regime.recessionRisk, "unavailable");
});
