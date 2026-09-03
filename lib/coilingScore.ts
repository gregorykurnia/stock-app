// Stage 1 "coiling" tiered scoring for the Coiling Reversal screener.
// Mirrors the Python spec 1:1 — each rule is its own function so thresholds
// can be adjusted independently. Step 1 (hard eliminators) short-circuits
// Step 2 (soft scoring); Step 3 turns the sum into a Label.

export interface CoilingScoreInput {
  distFromAth: number | null;
  distFrom6moLow: number | null;
  roc1mo: number | null;
  roc3mo: number | null;
  priceVsMa30wk: number | null;
  ma30wkSlope: number | null;
  volRatio10_90: number | null;
  upDownVolRatio: number | null;
  bbw: number | null;
  atrPct: number | null;
  weeklyRsi: number | null;
  rsVsSpy3mo: number | null;
  lowerHighs: boolean | null;
}

export interface CoilingSubScores {
  distFrom6moLow: number;
  distFromAth: number;
  roc1mo: number;
  priceVsMa30wk: number;
  ma30wkSlope: number;
  volRatio10_90: number;
  weeklyRsi: number;
  bbw: number;
  atrPct: number;
  rsVsSpy3mo: number;
  upDownVolRatio: number;
}

export type CoilingLabel = "High Conviction" | "Interesting" | "Early / Incomplete" | "Weak" | "Poor";

export interface CoilingScoreResult {
  flagged: boolean;
  flagReasons: string[];
  subScores: CoilingSubScores;
  totalScore: number;
  label: CoilingLabel;
}

// --- Step 1 rules, now used as a soft "flag" rather than a hard eliminator:
// a row that trips one of these still gets scored and labeled normally, it
// just carries a warning tag listing every rule it tripped.

export function checkEliminators(row: CoilingScoreInput): string[] {
  const reasons: string[] = [];
  if (row.roc1mo != null && (row.roc1mo < -15 || row.roc1mo > 20)) reasons.push("ROC 1mo out of range (<-15 or >20)");
  if (row.roc3mo != null && (row.roc3mo < -30 || row.roc3mo > 30)) reasons.push("ROC 3mo out of range (<-30 or >30)");
  if (row.volRatio10_90 != null && row.volRatio10_90 > 1.2) reasons.push("Vol Ratio 10d/90d > 1.2");
  if (row.weeklyRsi != null && (row.weeklyRsi < 35 || row.weeklyRsi > 65)) reasons.push("Weekly RSI out of range (<35 or >65)");
  if (row.ma30wkSlope != null && row.ma30wkSlope < -0.5) reasons.push("30wk MA Slope < -0.5");
  if (row.lowerHighs === true) reasons.push("Lower Highs");
  // Not part of the original spec, added because names sitting within ~15% of their ATH (e.g.
  // already back near highs after a strong run) were scoring "Interesting"/"Early / Incomplete"
  // purely off calm short-term metrics (low ATR%, quiet ROC, low volume) despite never having
  // actually pulled back — the opposite of what a "Beaten Down > Coiling Reversal" setup means.
  if (row.distFromAth != null && row.distFromAth > -15) reasons.push("% from ATH > -15% (not beaten down)");
  return reasons;
}

// --- Step 2: tiered soft scoring (0-3 each) ---

function inRange(v: number, lo: number, hi: number) { return v >= lo && v <= hi; }

function scoreDistFrom6moLow(v: number | null): number {
  if (v == null) return 0;
  if (v < 15) return 3;
  if (v <= 25) return 2;
  if (v <= 35) return 1;
  return 0;
}

function scoreDistFromAth(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, -85, -65)) return 3;
  if (v > -65 && v <= -50) return 2;
  if (v > -50 && v <= -40) return 1;
  return 0; // includes > -40
}

function scoreRoc1mo(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, -3, 5)) return 3;
  if (inRange(v, -8, -3) || inRange(v, 5, 8)) return 2;
  if (inRange(v, -12, -8) || inRange(v, 8, 12)) return 1;
  return 0;
}

function scorePriceVsMa30wk(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 0.95, 1.02)) return 3;
  if (inRange(v, 0.90, 0.95) || inRange(v, 1.02, 1.08)) return 2;
  if (inRange(v, 0.85, 0.90) || inRange(v, 1.08, 1.15)) return 1;
  return 0;
}

function scoreMa30wkSlope(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, -0.1, 0.1)) return 3;
  if (inRange(v, -0.2, -0.1) || inRange(v, 0.1, 0.2)) return 2;
  if (inRange(v, -0.3, -0.2)) return 1;
  return 0; // includes < -0.3
}

function scoreVolRatio(v: number | null): number {
  if (v == null) return 0;
  if (v < 0.55) return 3;
  if (v <= 0.70) return 2;
  if (v <= 0.80) return 1;
  return 0;
}

function scoreWeeklyRsi(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 45, 55)) return 3;
  if (inRange(v, 40, 45) || inRange(v, 55, 58)) return 2;
  if (inRange(v, 37, 40) || inRange(v, 58, 62)) return 1;
  return 0;
}

// BBW is relative to the dataset — percentile thresholds are computed once
// across all passing rows and passed in.
function scoreBbw(v: number | null, p10: number | null, p20: number | null, p35: number | null): number {
  if (v == null || p10 == null || p20 == null || p35 == null) return 0;
  if (v <= p10) return 3;
  if (v <= p20) return 2;
  if (v <= p35) return 1;
  return 0;
}

function scoreAtrPct(v: number | null): number {
  if (v == null) return 0;
  if (v < 2.5) return 3;
  if (v <= 3.5) return 2;
  if (v <= 4.5) return 1;
  return 0;
}

function scoreRsVsSpy3mo(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 1.0, 1.2)) return 3;
  if (inRange(v, 0.9, 1.0) || inRange(v, 1.2, 1.3)) return 2;
  if (inRange(v, 0.8, 0.9)) return 1;
  return 0;
}

function scoreUpDownVolRatio(v: number | null): number {
  if (v == null) return 0;
  if (inRange(v, 1.3, 1.8)) return 3;
  if (inRange(v, 1.1, 1.3) || inRange(v, 1.8, 2.0)) return 2;
  if (inRange(v, 1.0, 1.1)) return 1;
  return 0; // includes < 1.0
}

// --- Step 3: labels ---

export function labelForScore(total: number): CoilingLabel {
  if (total >= 27) return "High Conviction";
  if (total >= 20) return "Interesting";
  if (total >= 13) return "Early / Incomplete";
  if (total >= 7) return "Weak";
  return "Poor";
}

// Worst-to-best order — used to cap a flagged row's label so a row that trips an eliminator
// rule can never read as promising just because its other, unrelated metrics look calm.
const LABEL_RANK: CoilingLabel[] = ["Poor", "Weak", "Early / Incomplete", "Interesting", "High Conviction"];
const MAX_FLAGGED_LABEL: CoilingLabel = "Weak";

function capLabelIfFlagged(label: CoilingLabel, flagged: boolean): CoilingLabel {
  if (!flagged) return label;
  return LABEL_RANK.indexOf(label) > LABEL_RANK.indexOf(MAX_FLAGGED_LABEL) ? MAX_FLAGGED_LABEL : label;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Computes eliminator status + tiered score for every row. BBW percentiles
// (10th/20th/35th) are derived from the BBW values across every row — nothing
// is dropped from scoring, the Step 1 rules are only a warning flag now.
export function scoreCoilingRows<T extends CoilingScoreInput>(rows: T[]): CoilingScoreResult[] {
  const bbwValues = rows.map((r) => r.bbw).filter((v): v is number => v != null);
  const p10 = percentile(bbwValues, 10);
  const p20 = percentile(bbwValues, 20);
  const p35 = percentile(bbwValues, 35);

  return rows.map((row) => {
    const flagReasons = checkEliminators(row);
    const subScores: CoilingSubScores = {
      distFrom6moLow: scoreDistFrom6moLow(row.distFrom6moLow),
      distFromAth: scoreDistFromAth(row.distFromAth),
      roc1mo: scoreRoc1mo(row.roc1mo),
      priceVsMa30wk: scorePriceVsMa30wk(row.priceVsMa30wk),
      ma30wkSlope: scoreMa30wkSlope(row.ma30wkSlope),
      volRatio10_90: scoreVolRatio(row.volRatio10_90),
      weeklyRsi: scoreWeeklyRsi(row.weeklyRsi),
      bbw: scoreBbw(row.bbw, p10, p20, p35),
      atrPct: scoreAtrPct(row.atrPct),
      rsVsSpy3mo: scoreRsVsSpy3mo(row.rsVsSpy3mo),
      upDownVolRatio: scoreUpDownVolRatio(row.upDownVolRatio),
    };
    const totalScore = Object.values(subScores).reduce((a, b) => a + b, 0);
    const flagged = flagReasons.length > 0;
    return { flagged, flagReasons, subScores, totalScore, label: capLabelIfFlagged(labelForScore(totalScore), flagged) };
  });
}
