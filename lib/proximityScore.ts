// Column Group 1 — Breakout Proximity Score. Only meaningful once a stock already
// clears Grand Score 15+ (see FIX 4 gating, applied by the caller / masterScore.ts).
// Max = 15 points across 5 sub-scores (0-3 each).

export interface ProximityInput {
  slopeNow: number | null;
  slope4wk: number | null;
  slope8wk: number | null;
  maTouchCount: number | null;
  rangeContractionRatio: number | null; // avg daily range last10 / avg daily range last40
  rsLineDiffPct: number | null; // (rs10dAvg - rs30dAvg) / rs30dAvg * 100
  volGreenRatio: number | null; // avg green-day volume last10 / avg green-day volume last40
}

export interface ProximitySubScores {
  slopeVelocity: number;
  maTouchCount: number;
  rangeContraction: number;
  rsLineDirection: number;
  volumeGreenDays: number;
}

export type ProximityLabel = "Imminent" | "Developing" | "Early" | "Not Ready";

export interface ProximityResult {
  subScores: ProximitySubScores;
  totalScore: number;
  label: ProximityLabel;
}

function scoreSlopeVelocity(now: number | null, w4: number | null, w8: number | null): number {
  if (now == null || w4 == null || w8 == null) return 0;
  if (now > w4 && w4 > w8) return 3;
  if (now > w4) return 2;
  if (now > w8) return 1;
  return 0;
}

function scoreMaTouchCount(v: number | null): number {
  if (v == null) return 0;
  if (v >= 4) return 3;
  if (v >= 2) return 2;
  if (v >= 1) return 1;
  return 0;
}

function scoreRangeContraction(v: number | null): number {
  if (v == null) return 0;
  if (v < 0.5) return 3;
  if (v <= 0.65) return 2;
  if (v <= 0.8) return 1;
  return 0;
}

function scoreRsLineDirection(v: number | null): number {
  if (v == null) return 0;
  if (v > 2) return 3;
  if (v > 0) return 2;
  if (v === 0) return 1;
  return 0;
}

function scoreVolumeGreenDays(v: number | null): number {
  if (v == null) return 0;
  if (v > 1.5) return 3;
  if (v >= 1.2) return 2;
  if (v >= 1.0) return 1;
  return 0;
}

export function labelForProximity(total: number): ProximityLabel {
  if (total >= 12) return "Imminent";
  if (total >= 8) return "Developing";
  if (total >= 4) return "Early";
  return "Not Ready";
}

export function scoreProximity(row: ProximityInput): ProximityResult {
  const subScores: ProximitySubScores = {
    slopeVelocity: scoreSlopeVelocity(row.slopeNow, row.slope4wk, row.slope8wk),
    maTouchCount: scoreMaTouchCount(row.maTouchCount),
    rangeContraction: scoreRangeContraction(row.rangeContractionRatio),
    rsLineDirection: scoreRsLineDirection(row.rsLineDiffPct),
    volumeGreenDays: scoreVolumeGreenDays(row.volGreenRatio),
  };
  const totalScore = Object.values(subScores).reduce((a, b) => a + b, 0);
  return { subScores, totalScore, label: labelForProximity(totalScore) };
}
