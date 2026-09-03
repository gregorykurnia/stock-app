// Column Group 3 — Combined Master Score = Grand Score + Proximity Score (gated) + Upside Score.
// Max possible = 33 + 15 + 18 = 66. See FIX 4: Proximity only counts toward Master Score once
// Grand Score >= 15; the raw Proximity Score is still shown for monitoring below that line.

export type MasterLabel =
  | "Tier 1: High Conviction Entry"
  | "Tier 2: Strong Candidate"
  | "Tier 3: Watch Closely"
  | "Tier 4: Too Early"
  | "Tier 5: Avoid";

export function labelForMaster(total: number): MasterLabel {
  if (total >= 50) return "Tier 1: High Conviction Entry";
  if (total >= 38) return "Tier 2: Strong Candidate";
  if (total >= 25) return "Tier 3: Watch Closely";
  if (total >= 12) return "Tier 4: Too Early";
  return "Tier 5: Avoid";
}

export interface MasterScoreResult {
  proximityActive: boolean;
  masterScore: number;
  masterLabel: MasterLabel;
}

export function computeMasterScore(grandScore: number, proximityScore: number, upsideScore: number): MasterScoreResult {
  const proximityActive = grandScore >= 15;
  const masterScore = grandScore + (proximityActive ? proximityScore : 0) + upsideScore;
  return { proximityActive, masterScore, masterLabel: labelForMaster(masterScore) };
}
