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

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

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
  // A lower/equal low is valid from -20% to +5% versus the prior selling episode. A large gap
  // higher is no longer a near-bottom attempt; a much deeper decline is left for trial evidence,
  // not rewarded by the first score.
  const priceStructure = input.currentLowVsPriorLowPct != null && input.currentLowVsPriorLowPct >= -20 && input.currentLowVsPriorLowPct <= 5 ? 15 : 0;
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
