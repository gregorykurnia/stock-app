// Unified Coiling Reversal scoring — one Master Score (max 30) across three equal pillars.
// No hard eliminators: every row is scored, issues are surfaced in Flag Reasons only.
//
// Pillar 1: Setup Quality (max 10) — is this stock coiling / forming a base?
// Pillar 2: Accumulation Signal (max 10) — is smart money already buying?
// Pillar 3: Fundamental Health (max 10) — is the business worth owning?

export interface MasterV2Input {
  // Pillar 1
  distFrom2yHigh: number | null; // e.g. -60 for -60%
  distFrom6moLow: number | null; // e.g. 12 for +12% above the low
  ma30wkSlope: number | null;
  bbw: number | null;
  atrPct: number | null;

  // Pillar 2
  rsiDivDaily: number | null; // magnitude, rsi_low2 - rsi_low1
  rsiDivDailyConfirmed: boolean | null;
  rsiDivWeekly: number | null;
  rsiDivWeeklyConfirmed: boolean | null;
  obvDivergence: number | null;
  recoveryCandle: number | null;

  // Pillar 3
  gmChanges: number[] | null; // 3 sequential quarter-over-quarter gross margin point changes
  revenueGrowth: number[] | null; // 3 sequential quarter-over-quarter revenue growth rates
  avgQuarterlyFcf: number | null;
  cash: number | null;
  shortPercentOfFloat: number | null; // fraction, e.g. 0.12 for 12%
  insiderBuyCount: number | null;

  // Soft flags (informational only)
  weeklyRsi: number | null;
  roc1mo: number | null;
  lowerHighs: boolean | null;
}

export interface PillarSubScores {
  distFrom2yHigh: number;
  distFrom6moLow: number;
  ma30wkSlope: number;
  bbw: number;
  atrPct: number;
}

export interface AccumulationSubScores {
  rsiDivDaily: number;
  rsiDivWeekly: number;
  obvDivergence: number;
  recoveryCandle: number;
}

export interface FundamentalSubScores {
  grossMarginTrend: number;
  revenueTrend: number;
  fcfStatus: number;
  shortInterest: number;
  insiderBuying: number;
}

export type MasterV2Label =
  | "Tier 1: High Conviction"
  | "Tier 2: Strong Candidate"
  | "Tier 3: Watch Closely"
  | "Tier 4: Too Early"
  | "Tier 5: Avoid";

export interface MasterV2Result {
  pillar1Score: number;
  pillar2Score: number;
  pillar3Score: number;
  masterScore: number;
  masterLabel: MasterV2Label;
  setupSubScores: PillarSubScores;
  accumulationSubScores: AccumulationSubScores;
  fundamentalSubScores: FundamentalSubScores;
  flagReasons: string[];
  dataGaps: string[];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// --- Pillar 1: Setup Quality ---

function scoreDistFrom2yHigh(v: number | null): number {
  if (v == null) return 0;
  if (v < -60) return 3;
  if (v <= -40) return 2;
  if (v <= -25) return 1;
  return 0;
}

function scoreDistFrom6moLow(v: number | null): number {
  if (v == null) return 0;
  if (v < 15) return 2;
  if (v <= 30) return 1;
  return 0;
}

function scoreMa30wkSlope(v: number | null): number {
  if (v == null) return 0;
  if (v > -0.3) return 2;
  if (v >= -1.0) return 1;
  return 0;
}

function scoreBbw(v: number | null, p20: number | null, p40: number | null): number {
  if (v == null || p20 == null || p40 == null) return 0;
  if (v <= p20) return 2;
  if (v <= p40) return 1;
  return 0;
}

function scoreAtrPct(v: number | null): number {
  if (v == null) return 0;
  return v < 3 ? 1 : 0;
}

// --- Pillar 2: Accumulation Signal ---

function scoreRsiDivDaily(value: number | null, confirmed: boolean | null): number {
  if (value == null || confirmed == null || !confirmed) return 0;
  if (value > 10) return 3;
  if (value >= 5) return 2;
  if (value >= 2) return 1;
  return 0;
}

function scoreRsiDivWeekly(value: number | null, confirmed: boolean | null): number {
  if (value == null || confirmed == null || !confirmed) return 0;
  if (value > 7) return 3;
  if (value >= 3) return 2;
  if (value >= 1) return 1;
  return 0;
}

function scoreObvDivergence(v: number | null): number {
  if (v == null) return 0;
  if (v > 0.03) return 2;
  if (v >= 0.01) return 1;
  return 0;
}

function scoreRecoveryCandle(v: number | null): number {
  if (v == null) return 0;
  if (v > 0.70) return 2;
  if (v >= 0.50) return 1;
  return 0;
}

// --- Pillar 3: Fundamental Health ---

function scoreGrossMarginTrend(gmChanges: number[] | null): { score: number; gap: boolean } {
  if (gmChanges == null || gmChanges.length < 3) return { score: 0, gap: true };
  const [, d2, d3] = gmChanges;
  if (d2 > 0 && d3 > 0) return { score: 3, gap: false };
  if (Math.abs(d2) <= 1 && Math.abs(d3) <= 1) return { score: 2, gap: false };
  if (d3 < 0 && d3 > -2) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

function scoreRevenueTrend(revenueGrowth: number[] | null): { score: number; gap: boolean } {
  if (revenueGrowth == null || revenueGrowth.length < 3) return { score: 0, gap: true };
  const [g1, g2, g3] = revenueGrowth;
  if (g3 > 0) return { score: 3, gap: false };
  if (Math.abs(g3) <= 0.01) return { score: 2, gap: false };
  // "decline slowing 2 consecutive quarters" = each successive quarter's decline is less negative
  if (g3 < 0 && g2 < 0 && g3 > g2 && g2 >= g1) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

function scoreFcfStatus(avgQuarterlyFcf: number | null, cash: number | null): { score: number; gap: boolean } {
  if (avgQuarterlyFcf == null) return { score: 0, gap: true };
  if (avgQuarterlyFcf > 0) return { score: 2, gap: false };
  if (cash == null) return { score: 0, gap: true };
  const runwayQuarters = cash / Math.abs(avgQuarterlyFcf);
  return { score: runwayQuarters > 8 ? 1 : 0, gap: false };
}

function scoreShortInterest(shortPercentOfFloat: number | null): { score: number; gap: boolean } {
  if (shortPercentOfFloat == null) return { score: 0, gap: true };
  const pct = shortPercentOfFloat * 100;
  if (pct >= 15 && pct <= 35) return { score: 2, gap: false };
  if (pct >= 5 && pct < 15) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

function scoreInsiderBuying(insiderBuyCount: number | null): { score: number; gap: boolean } {
  if (insiderBuyCount == null) return { score: 0, gap: true };
  if (insiderBuyCount >= 2) return { score: 2, gap: false };
  if (insiderBuyCount === 1) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- Labels ---

export function labelForMasterV2(total: number): MasterV2Label {
  if (total >= 24) return "Tier 1: High Conviction";
  if (total >= 18) return "Tier 2: Strong Candidate";
  if (total >= 12) return "Tier 3: Watch Closely";
  if (total >= 6) return "Tier 4: Too Early";
  return "Tier 5: Avoid";
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function checkSoftFlags(row: MasterV2Input): string[] {
  const reasons: string[] = [];
  if (row.distFrom2yHigh != null && row.distFrom2yHigh > -15) reasons.push("% from 2Y High > -15% (not beaten down)");
  if (row.ma30wkSlope != null && row.ma30wkSlope < -1.0) reasons.push("30wk MA Slope < -1.0 (still falling hard)");
  if (row.weeklyRsi != null && (row.weeklyRsi < 35 || row.weeklyRsi > 65)) reasons.push("Weekly RSI extreme (<35 or >65)");
  if (row.roc1mo != null && (row.roc1mo < -15 || row.roc1mo > 20)) reasons.push("ROC 1mo extreme (<-15% or >20%)");
  if (row.lowerHighs === true) reasons.push("Lower Highs confirmed");
  if (row.shortPercentOfFloat != null && row.shortPercentOfFloat * 100 > 40) reasons.push("Short Interest > 40% (distress risk)");
  return reasons;
}

// BBW is scored against the dataset's own percentile spread — compute 20th/40th once across
// every row being scored, same shape as the old coilingScore.ts helper.
export function scoreMasterV2Rows<T extends MasterV2Input>(rows: T[]): MasterV2Result[] {
  const bbwValues = rows.map((r) => r.bbw).filter((v): v is number => v != null);
  const p20 = percentile(bbwValues, 20);
  const p40 = percentile(bbwValues, 40);

  return rows.map((row) => {
    const setupSubScores: PillarSubScores = {
      distFrom2yHigh: scoreDistFrom2yHigh(row.distFrom2yHigh),
      distFrom6moLow: scoreDistFrom6moLow(row.distFrom6moLow),
      ma30wkSlope: scoreMa30wkSlope(row.ma30wkSlope),
      bbw: scoreBbw(row.bbw, p20, p40),
      atrPct: scoreAtrPct(row.atrPct),
    };
    const pillar1Score = clamp(Object.values(setupSubScores).reduce((a, b) => a + b, 0), 0, 10);

    const accumulationSubScores: AccumulationSubScores = {
      rsiDivDaily: scoreRsiDivDaily(row.rsiDivDaily, row.rsiDivDailyConfirmed),
      rsiDivWeekly: scoreRsiDivWeekly(row.rsiDivWeekly, row.rsiDivWeeklyConfirmed),
      obvDivergence: scoreObvDivergence(row.obvDivergence),
      recoveryCandle: scoreRecoveryCandle(row.recoveryCandle),
    };
    const pillar2Score = clamp(Object.values(accumulationSubScores).reduce((a, b) => a + b, 0), 0, 10);

    const gm = scoreGrossMarginTrend(row.gmChanges);
    const rev = scoreRevenueTrend(row.revenueGrowth);
    const fcf = scoreFcfStatus(row.avgQuarterlyFcf, row.cash);
    const short = scoreShortInterest(row.shortPercentOfFloat);
    const insider = scoreInsiderBuying(row.insiderBuyCount);
    const fundamentalSubScores: FundamentalSubScores = {
      grossMarginTrend: gm.score,
      revenueTrend: rev.score,
      fcfStatus: fcf.score,
      shortInterest: short.score,
      insiderBuying: insider.score,
    };
    const pillar3Score = clamp(Object.values(fundamentalSubScores).reduce((a, b) => a + b, 0), 0, 10);

    const dataGapMap: [boolean, string][] = [
      [gm.gap, "gross_margin_trend"],
      [rev.gap, "revenue_trend"],
      [fcf.gap, "fcf_status"],
      [short.gap, "short_interest"],
      [insider.gap, "insider_buying"],
    ];
    const dataGaps = dataGapMap.filter(([g]) => g).map(([, name]) => name);

    const masterScore = pillar1Score + pillar2Score + pillar3Score;
    const flagReasons = checkSoftFlags(row);

    return {
      pillar1Score, pillar2Score, pillar3Score, masterScore,
      masterLabel: labelForMasterV2(masterScore),
      setupSubScores, accumulationSubScores, fundamentalSubScores,
      flagReasons, dataGaps,
    };
  });
}
