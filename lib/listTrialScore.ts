export interface BottomCandidateScoreInput {
  eligibleAt40PctBelowAth: boolean;
  drawdownFromAthPct: number | null;
  pctAboveCurrentRollingLow: number | null;
  currentLowVsPriorLowPct: number | null;
  rsiDeltaCurrentVsPrior: number | null;
  macdHistPctDeltaCurrentVsPrior: number | null;
  diGapDeltaCurrentVsPrior: number | null;
  adxDeltaCurrentVsPrior: number | null;
  cmfDeltaCurrentVsPrior: number | null;
}

export interface BottomCandidateScoreResult {
  score: number | null;
  gates: {
    eligible: boolean;
    nearRollingLow: boolean;
    priorEpisode: boolean;
    completeEvidence: boolean;
    reasons: string[];
  };
  parts: {
    drawdownDepth: number;
    proximity: number;
    priceStructure: number;
    rsi: number;
    macd: number;
    directionalPressure: number;
    moneyFlow: number;
  };
}

export type PriceStructureBand =
  | "unavailable"
  | "severe_lower_low"
  | "deeper_lower_low"
  | "within_trial_range"
  | "higher_low"
  | "too_far_above";

export function getPriceStructureBand(value: number | null): PriceStructureBand {
  if (value == null) return "unavailable";
  if (value < -30) return "severe_lower_low";
  if (value < -20) return "deeper_lower_low";
  if (value <= 5) return "within_trial_range";
  if (value <= 15) return "higher_low";
  return "too_far_above";
}

export function getPriceStructurePoints(value: number | null): number {
  switch (getPriceStructureBand(value)) {
    case "deeper_lower_low": return 5;
    case "within_trial_range": return 15;
    case "higher_low": return 8;
    default: return 0;
  }
}

export type BottomScoreComponentStatus = "favorable" | "neutral" | "unfavorable" | "unavailable";

export interface BottomScoreExplanationInput {
  label: string;
  value: number | null;
  unit: "percent" | "percentagePoints" | "points" | "value";
}

export interface BottomScoreExplanationComponent {
  key: keyof BottomCandidateScoreResult["parts"];
  label: string;
  points: number;
  maxPoints: number;
  contributionPct: number;
  status: BottomScoreComponentStatus;
  inputs: BottomScoreExplanationInput[];
  explanation: string;
  rule: string;
}

export interface BottomScoreExplanationAnchors {
  allTimeHigh: number | null;
  currentRollingLow: { date: string; close: number } | null;
  priorSellingLow: { date: string; close: number } | null;
}

export interface BottomScoreExplanationGate {
  key: "eligible" | "nearRollingLow" | "priorEpisode" | "completeEvidence";
  label: string;
  passed: boolean;
  rule: string;
  reason: string | null;
}

export interface BottomScoreExplanation {
  score: number | null;
  maxScore: number;
  scoreable: boolean;
  summary: string;
  interpretation: string;
  warning: string;
  components: BottomScoreExplanationComponent[];
  gates: BottomScoreExplanationGate[];
  anchors: BottomScoreExplanationAnchors;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const scoreStatus = (points: number, maxPoints: number, inputs: BottomScoreExplanationInput[]): BottomScoreComponentStatus => {
  if (inputs.some((input) => input.value == null)) return "unavailable";
  if (points >= maxPoints) return "favorable";
  if (points <= 0) return "unfavorable";
  return "neutral";
};

const scoreExplanation = (points: number, maxPoints: number) => Number(((points / maxPoints) * 100).toFixed(1));

function describeDrawdown(input: BottomCandidateScoreInput, points: number): string {
  if (input.drawdownFromAthPct == null) return "Drawdown from the then-known all-time high is unavailable.";
  const drawdown = Math.abs(input.drawdownFromAthPct);
  if (points >= 5) return `The price is ${drawdown.toFixed(1)}% below the then-known all-time high, earning the full 5 points capped at 70% drawdown.`;
  if (points > 0) return `The price is ${drawdown.toFixed(1)}% below the then-known all-time high, earning partial credit between the 40% gate and the 70% cap.`;
  return `The price is only ${drawdown.toFixed(1)}% below the then-known all-time high, so this factor earns no points.`;
}

function describeProximity(input: BottomCandidateScoreInput, points: number): string {
  if (input.pctAboveCurrentRollingLow == null) return "Distance above the current 20-day rolling low is unavailable.";
  if (points >= 20) return "The price is at the current 20-day rolling low, earning the full proximity allocation.";
  if (points > 0) return `The price is ${input.pctAboveCurrentRollingLow.toFixed(1)}% above the current 20-day rolling low; closer prices earn more points.`;
  return `The price is ${input.pctAboveCurrentRollingLow.toFixed(1)}% above the current 20-day rolling low, beyond the 15% proximity gate.`;
}

function describePriceStructure(input: BottomCandidateScoreInput, points: number): string {
  if (input.currentLowVsPriorLowPct == null) return "The current low cannot be compared with a prior selling-episode low.";
  const value = input.currentLowVsPriorLowPct;
  if (points >= 15) return `The current low is ${value.toFixed(1)}% versus the prior selling-episode low, inside the full-credit -20% to +5% range and earning 15 points.`;
  if (value < -30) return `The current low is ${Math.abs(value).toFixed(1)}% below the prior selling-episode low, beyond the -30% limit, so this factor earns no points.`;
  if (value < -20) return `The current low is ${Math.abs(value).toFixed(1)}% below the prior selling-episode low, in the -30% to -20% partial-credit range and earning 5 points.`;
  if (value <= 15) return `The current low is ${value.toFixed(1)}% above the prior selling-episode low, in the +5% to +15% higher-low range and earning 8 points.`;
  return `The current low is ${value.toFixed(1)}% above the prior selling-episode low, beyond the +15% limit, so this factor earns no points.`;
}

function describeSingleImprovement(value: number | null, label: string, cap: number, unit: string): string {
  if (value == null) return `${label} comparison is unavailable.`;
  if (value <= 0) return `${label} changed by ${value.toFixed(2)}${unit} versus the prior selling episode, so this factor earns no points.`;
  if (value >= cap) return `${label} improved by ${value.toFixed(2)}${unit}, reaching the full credit cap of +${cap}${unit}.`;
  return `${label} improved by ${value.toFixed(2)}${unit} versus the prior selling episode, earning partial credit up to +${cap}${unit}.`;
}

function describeDirectionalPressure(input: BottomCandidateScoreInput, points: number): string {
  if (input.diGapDeltaCurrentVsPrior == null || input.adxDeltaCurrentVsPrior == null) return "DI gap and ADX comparisons are not both available.";
  const diText = input.diGapDeltaCurrentVsPrior >= 0
    ? `DI gap improved by ${input.diGapDeltaCurrentVsPrior.toFixed(2)} points`
    : `DI gap weakened by ${Math.abs(input.diGapDeltaCurrentVsPrior).toFixed(2)} points`;
  const adxText = input.adxDeltaCurrentVsPrior <= 0
    ? `ADX fell by ${Math.abs(input.adxDeltaCurrentVsPrior).toFixed(2)} points`
    : `ADX rose by ${input.adxDeltaCurrentVsPrior.toFixed(2)} points`;
  return `${diText} and ${adxText}; together they contribute ${points.toFixed(1)} of 15 points under the current selling-pressure rule.`;
}

function strongestComponentLabels(components: BottomScoreExplanationComponent[]): string {
  const positive = components.filter((component) => component.points > 0).sort((a, b) => b.points - a.points);
  if (positive.length === 0) return "no positive component contributions";
  if (positive.length === 1) return positive[0].label;
  return `${positive[0].label} and ${positive[1].label}`;
}

export function explainBottomCandidateScore(
  input: BottomCandidateScoreInput,
  result: BottomCandidateScoreResult,
  anchors: BottomScoreExplanationAnchors,
): BottomScoreExplanation {
  const components: BottomScoreExplanationComponent[] = [
    {
      key: "drawdownDepth",
      label: "Drawdown depth",
      points: result.parts.drawdownDepth,
      maxPoints: 5,
      contributionPct: scoreExplanation(result.parts.drawdownDepth, 5),
      status: scoreStatus(result.parts.drawdownDepth, 5, [{ label: "Drawdown from ATH", value: input.drawdownFromAthPct, unit: "percent" }]),
      inputs: [{ label: "Drawdown from then-known ATH", value: input.drawdownFromAthPct, unit: "percent" }],
      explanation: describeDrawdown(input, result.parts.drawdownDepth),
      rule: "5 points, linearly scaled from 40% to 70% below the then-known ATH, capped at 5.",
    },
    {
      key: "proximity",
      label: "Proximity to rolling low",
      points: result.parts.proximity,
      maxPoints: 20,
      contributionPct: scoreExplanation(result.parts.proximity, 20),
      status: scoreStatus(result.parts.proximity, 20, [{ label: "Percent above current rolling low", value: input.pctAboveCurrentRollingLow, unit: "percent" }]),
      inputs: [{ label: "Above current 20-day rolling low", value: input.pctAboveCurrentRollingLow, unit: "percent" }],
      explanation: describeProximity(input, result.parts.proximity),
      rule: "20 points, linearly scaled from 15% above the rolling low down to 0%, capped at 20.",
    },
    {
      key: "priceStructure",
      label: "Price structure",
      points: result.parts.priceStructure,
      maxPoints: 15,
      contributionPct: scoreExplanation(result.parts.priceStructure, 15),
      status: scoreStatus(result.parts.priceStructure, 15, [{ label: "Current low versus prior low", value: input.currentLowVsPriorLowPct, unit: "percent" }]),
      inputs: [{ label: "Current low versus prior selling-episode low", value: input.currentLowVsPriorLowPct, unit: "percent" }],
      explanation: describePriceStructure(input, result.parts.priceStructure),
      rule: "15 points when the current low is between 20% below and 5% above the prior selling-episode low; otherwise 0.",
    },
    {
      key: "rsi",
      label: "RSI improvement",
      points: result.parts.rsi,
      maxPoints: 15,
      contributionPct: scoreExplanation(result.parts.rsi, 15),
      status: scoreStatus(result.parts.rsi, 15, [{ label: "RSI change versus prior low", value: input.rsiDeltaCurrentVsPrior, unit: "points" }]),
      inputs: [{ label: "RSI change versus prior selling low", value: input.rsiDeltaCurrentVsPrior, unit: "points" }],
      explanation: describeSingleImprovement(input.rsiDeltaCurrentVsPrior, "RSI", 10, " points"),
      rule: "15 points, linearly scaled from 0 to +10 RSI points of improvement, capped at 15.",
    },
    {
      key: "macd",
      label: "MACD histogram improvement",
      points: result.parts.macd,
      maxPoints: 15,
      contributionPct: scoreExplanation(result.parts.macd, 15),
      status: scoreStatus(result.parts.macd, 15, [{ label: "MACD histogram change", value: input.macdHistPctDeltaCurrentVsPrior, unit: "percentagePoints" }]),
      inputs: [{ label: "MACD histogram % of price change", value: input.macdHistPctDeltaCurrentVsPrior, unit: "percentagePoints" }],
      explanation: describeSingleImprovement(input.macdHistPctDeltaCurrentVsPrior, "MACD histogram", 0.5, " percentage points"),
      rule: "15 points, linearly scaled from 0 to +0.5 percentage points of histogram improvement, capped at 15.",
    },
    {
      key: "directionalPressure",
      label: "DI/ADX selling-pressure improvement",
      points: result.parts.directionalPressure,
      maxPoints: 15,
      contributionPct: scoreExplanation(result.parts.directionalPressure, 15),
      status: scoreStatus(result.parts.directionalPressure, 15, [
        { label: "DI gap change", value: input.diGapDeltaCurrentVsPrior, unit: "points" },
        { label: "ADX change", value: input.adxDeltaCurrentVsPrior, unit: "points" },
      ]),
      inputs: [
        { label: "DI gap change", value: input.diGapDeltaCurrentVsPrior, unit: "points" },
        { label: "ADX change", value: input.adxDeltaCurrentVsPrior, unit: "points" },
      ],
      explanation: describeDirectionalPressure(input, result.parts.directionalPressure),
      rule: "Up to 10 points for a DI gap improvement of +10, plus up to 5 points for an ADX decline of -8.",
    },
    {
      key: "moneyFlow",
      label: "CMF money-flow improvement",
      points: result.parts.moneyFlow,
      maxPoints: 15,
      contributionPct: scoreExplanation(result.parts.moneyFlow, 15),
      status: scoreStatus(result.parts.moneyFlow, 15, [{ label: "CMF change versus prior low", value: input.cmfDeltaCurrentVsPrior, unit: "value" }]),
      inputs: [{ label: "CMF change versus prior selling low", value: input.cmfDeltaCurrentVsPrior, unit: "value" }],
      explanation: describeSingleImprovement(input.cmfDeltaCurrentVsPrior, "CMF", 0.1, ""),
      rule: "15 points, linearly scaled from 0 to +0.1 CMF improvement, capped at 15.",
    },
  ];

  const gates: BottomScoreExplanationGate[] = [
    {
      key: "eligible",
      label: "Drawdown eligibility",
      passed: result.gates.eligible,
      rule: "At least 40% below the then-known all-time high.",
      reason: result.gates.eligible ? null : result.gates.reasons.find((reason) => reason.includes("40%")) ?? "less than 40% below the then-known ATH",
    },
    {
      key: "nearRollingLow",
      label: "Near the current rolling low",
      passed: result.gates.nearRollingLow,
      rule: "No more than 15% above the 20-day rolling low.",
      reason: result.gates.nearRollingLow ? null : result.gates.reasons.find((reason) => reason.includes("15%")) ?? "more than 15% above the 20-day rolling low",
    },
    {
      key: "priorEpisode",
      label: "Comparable prior selling episode",
      passed: result.gates.priorEpisode,
      rule: "A prior selling-episode low is available for comparison.",
      reason: result.gates.priorEpisode ? null : result.gates.reasons.find((reason) => reason.includes("prior selling")) ?? "no comparable prior selling episode",
    },
    {
      key: "completeEvidence",
      label: "Complete indicator evidence",
      passed: result.gates.completeEvidence,
      rule: "RSI, normalized MACD histogram, DI gap, ADX, and CMF comparisons are all available.",
      reason: result.gates.completeEvidence ? null : result.gates.reasons.find((reason) => reason.includes("incomplete")) ?? "incomplete RSI/MACD/DI/ADX/CMF evidence",
    },
  ];

  const scoreable = result.score != null;
  const summary = scoreable
    ? `${result.score!.toFixed(1)}/100 — strongest contributions came from ${strongestComponentLabels(components)}. The score is scoreable because all hard gates passed.`
    : `Not scoreable — ${result.gates.reasons.join("; ") || "one or more hard gates did not pass"}. A failed gate prevents the composite score from being interpreted.`;

  return {
    score: result.score,
    maxScore: components.reduce((sum, component) => sum + component.maxPoints, 0),
    scoreable,
    summary,
    interpretation: "This is a fixed 0–100 heuristic for the strength of alignment with the experimental early-bottom rules. Higher scores mean more favorable evidence under this formula when all hard gates pass.",
    warning: "This score is not a probability, prediction, expected return, confidence percentage, or trading recommendation.",
    components,
    gates,
    anchors,
  };
}

// First-pass, deliberately fixed score. It is not fitted to benchmark names: the trial data and
// controls must earn any later calibration. All inputs are available on the candidate date.
export function calcBottomCandidateScore(input: BottomCandidateScoreInput): BottomCandidateScoreResult {
  const nearRollingLow = input.pctAboveCurrentRollingLow != null && input.pctAboveCurrentRollingLow <= 15;
  const priorEpisode = input.currentLowVsPriorLowPct != null;
  const completeEvidence = [
    input.rsiDeltaCurrentVsPrior,
    input.macdHistPctDeltaCurrentVsPrior,
    input.diGapDeltaCurrentVsPrior,
    input.adxDeltaCurrentVsPrior,
    input.cmfDeltaCurrentVsPrior,
  ].every((value) => value != null);

  const reasons: string[] = [];
  if (!input.eligibleAt40PctBelowAth) reasons.push("less than 40% below the then-known ATH");
  if (!nearRollingLow) reasons.push("more than 15% above the 20-day rolling low");
  if (!priorEpisode) reasons.push("no comparable prior selling episode");
  if (!completeEvidence) reasons.push("incomplete RSI/MACD/DI/ADX/CMF evidence");

  const drawdownDepth = input.drawdownFromAthPct != null
    ? clamp((-input.drawdownFromAthPct - 40) / 30) * 5
    : 0;
  const proximity = input.pctAboveCurrentRollingLow != null
    ? clamp(1 - input.pctAboveCurrentRollingLow / 15) * 20
    : 0;
  // Keep the original -20% to +5% band as the full-credit core, while giving limited credit to
  // moderately deeper and higher-low structures. Extreme gaps remain evidence-only and score 0.
  const priceStructure = getPriceStructurePoints(input.currentLowVsPriorLowPct);
  const rsi = input.rsiDeltaCurrentVsPrior != null ? clamp(input.rsiDeltaCurrentVsPrior / 10) * 15 : 0;
  const macd = input.macdHistPctDeltaCurrentVsPrior != null ? clamp(input.macdHistPctDeltaCurrentVsPrior / 0.5) * 15 : 0;
  const directionalPressure = input.diGapDeltaCurrentVsPrior != null && input.adxDeltaCurrentVsPrior != null
    ? clamp(input.diGapDeltaCurrentVsPrior / 10) * 10 + clamp(-input.adxDeltaCurrentVsPrior / 8) * 5
    : 0;
  const moneyFlow = input.cmfDeltaCurrentVsPrior != null ? clamp(input.cmfDeltaCurrentVsPrior / 0.1) * 15 : 0;
  const parts = { drawdownDepth, proximity, priceStructure, rsi, macd, directionalPressure, moneyFlow };

  return {
    score: reasons.length === 0 ? Object.values(parts).reduce((sum, value) => sum + value, 0) : null,
    gates: {
      eligible: input.eligibleAt40PctBelowAth,
      nearRollingLow,
      priorEpisode,
      completeEvidence,
      reasons,
    },
    parts,
  };
}
