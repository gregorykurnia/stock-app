// Scoring for the "Potential Bagger Reversal" tab (Capitulation Reversal screen).
// Shared columns (% from ATH, ROC 1mo, RS vs SPY 3mo, Weekly RSI, Vol Ratio 10d/90d) reuse the
// same raw data the Coiling Reversal tab already fetches (2yr daily bars) — see
// app/api/coiling-daily/route.ts. Some of these columns use different tier thresholds than
// Coiling Reversal's own scoring even though the underlying raw value is identical, so this
// file defines its own scoring functions rather than importing coilingScore's.

export interface BaggerScoreInput {
  distFromAth: number | null; // reuses distFrom2yHigh
  roc1mo: number | null;
  rsVsSpy3mo: number | null;
  weeklyRsi: number | null;
  volRatio10_90: number | null;
  capVolRatio: number | null;
  rsiFloor52wk: number | null;
  priceVs20dLow: number | null;
  dropSpeed: number | null;
  recoveryCandle: number | null;
}

export interface BaggerSubScores {
  distFromAth: number;
  roc1mo: number;
  rsVsSpy3mo: number;
  weeklyRsi: number;
  volRatio10_90: number;
  capVolRatio: number;
  rsiFloor52wk: number;
  priceVs20dLow: number;
  dropSpeed: number;
  recoveryCandle: number;
}

export type BaggerLabel = "High Conviction Reversal" | "Developing Reversal" | "Early Signs Only" | "Not Ready";

export interface BaggerScoreResult {
  subScores: BaggerSubScores;
  totalScore: number;
  label: BaggerLabel;
  dataGaps: string[];
}

function inRange(v: number, lo: number, hi: number) { return v >= lo && v <= hi; }

function scoreDistFromAth(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, -85, -65)) return 3;
  if (v > -65 && v <= -50) return 2;
  if (v > -50 && v <= -40) return 1;
  return 0;
}

function scoreRoc1mo(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, -3, 5)) return 3;
  if (inRange(v, -8, -3) || inRange(v, 5, 8)) return 2;
  if (inRange(v, -12, -8) || inRange(v, 8, 12)) return 1;
  return 0;
}

function scoreRsVsSpy3mo(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 0.9, 1.1)) return 3;
  if (inRange(v, 0.8, 0.9) || inRange(v, 1.1, 1.3)) return 2;
  if (inRange(v, 0.7, 0.8)) return 1;
  return 0;
}

function scoreWeeklyRsi(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 35, 50)) return 3;
  if (inRange(v, 28, 35) || inRange(v, 50, 58)) return 2;
  if (inRange(v, 25, 28) || inRange(v, 58, 65)) return 1;
  return 0;
}

function scoreVolRatio(v: number | null): number {
  if (v == null) return 0;
  if (v < 0.55) return 3;
  if (v <= 0.70) return 2;
  if (v <= 0.80) return 1;
  return 0;
}

function scoreCapVolRatio(v: number | null): number {
  if (v == null) return 0;
  if (v > 4) return 3;
  if (v >= 3) return 2;
  if (v >= 2) return 1;
  return 0;
}

function scoreRsiFloor52wk(v: number | null): number {
  if (v == null) return 0;
  if (v < 25) return 3;
  if (v <= 28) return 2;
  if (v <= 33) return 1;
  return 0;
}

function scorePriceVs20dLow(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 10, 25)) return 3;
  if (inRange(v, 25, 35) || inRange(v, 5, 10)) return 2;
  if (inRange(v, 35, 50) || inRange(v, 3, 5)) return 1;
  return 0;
}

function scoreDropSpeed(v: number | null): number {
  if (v == null) return 0;
  if (v > 35) return 3;
  if (v >= 25) return 2;
  if (v >= 15) return 1;
  return 0;
}

function scoreRecoveryCandle(v: number | null): number {
  if (v == null) return 0;
  if (v > 0.70) return 3;
  if (v >= 0.60) return 2;
  if (v >= 0.45) return 1;
  return 0;
}

export function labelForScore(total: number): BaggerLabel {
  if (total >= 24) return "High Conviction Reversal";
  if (total >= 17) return "Developing Reversal";
  if (total >= 10) return "Early Signs Only";
  return "Not Ready";
}

const GAP_LABELS: Record<keyof BaggerScoreInput, string> = {
  distFromAth: "% from ATH",
  roc1mo: "ROC 1mo",
  rsVsSpy3mo: "RS vs SPY 3mo",
  weeklyRsi: "Weekly RSI",
  volRatio10_90: "Vol Ratio 10d/90d",
  capVolRatio: "Cap Vol Ratio",
  rsiFloor52wk: "RSI Floor 52wk",
  priceVs20dLow: "Price vs 20d Low",
  dropSpeed: "Drop Speed",
  recoveryCandle: "Recovery Candle",
};

export function scoreBaggerRow(row: BaggerScoreInput): BaggerScoreResult {
  const subScores: BaggerSubScores = {
    distFromAth: scoreDistFromAth(row.distFromAth),
    roc1mo: scoreRoc1mo(row.roc1mo),
    rsVsSpy3mo: scoreRsVsSpy3mo(row.rsVsSpy3mo),
    weeklyRsi: scoreWeeklyRsi(row.weeklyRsi),
    volRatio10_90: scoreVolRatio(row.volRatio10_90),
    capVolRatio: scoreCapVolRatio(row.capVolRatio),
    rsiFloor52wk: scoreRsiFloor52wk(row.rsiFloor52wk),
    priceVs20dLow: scorePriceVs20dLow(row.priceVs20dLow),
    dropSpeed: scoreDropSpeed(row.dropSpeed),
    recoveryCandle: scoreRecoveryCandle(row.recoveryCandle),
  };
  const totalScore = Object.values(subScores).reduce((a, b) => a + b, 0);
  const dataGaps = (Object.keys(row) as (keyof BaggerScoreInput)[])
    .filter((k) => row[k] == null)
    .map((k) => GAP_LABELS[k]);
  return { subScores, totalScore, label: labelForScore(totalScore), dataGaps };
}
