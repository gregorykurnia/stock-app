// Column Group 2 — Upside Potential Score. Max = 18 points across 6 sub-scores (0-3 each).
// Every sub-score function returns { score, gap } — gap=true means the underlying data was
// missing and the score fell back to 0 (or 1 for EPS revision, see FIX 6) purely for scoring
// purposes; the caller collects gap=true fields into "Data Gaps" / "Data Gap Count".

export interface SubResult { score: number; gap: boolean }

// --- FIX 1: Gross Margin Trend ---
// gmChanges = [gm_q2-gm_q1, gm_q3-gm_q2, gm_q4-gm_q3], most recent last. Priority order, first match wins.
export function scoreGrossMarginTrend(gmChanges: number[] | null): SubResult {
  if (gmChanges == null || gmChanges.length < 3 || gmChanges.some((v) => v == null || Number.isNaN(v))) {
    return { score: 0, gap: true };
  }
  const [, c1, c2] = gmChanges; // c1 = second-to-last change, c2 = last change (gm_changes[-2], gm_changes[-1])
  if (c2 > 0 && c1 > 0) return { score: 3, gap: false };
  if (Math.max(...gmChanges) - Math.min(...gmChanges) <= 1.0) return { score: 2, gap: false };
  const avg = gmChanges.reduce((a, b) => a + b, 0) / gmChanges.length;
  if (avg > -0.5) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- FIX 2: Revenue Deceleration ---
// growth = QoQ revenue growth decimals for last 3 transitions, most recent last (growth[-1]).
export function scoreRevenueDeceleration(growth: number[] | null): SubResult {
  if (growth == null || growth.length < 3 || growth.some((v) => v == null || Number.isNaN(v))) {
    return { score: 0, gap: true };
  }
  const last = growth[growth.length - 1];
  const delta = [growth[1] - growth[0], growth[2] - growth[1]];
  const dLast = delta[delta.length - 1];
  const dPrev = delta[delta.length - 2];
  if (last > 0) return { score: 3, gap: false };
  if (last === 0 || Math.abs(last) < 0.01) return { score: 2, gap: false };
  if (dLast > 0 && dPrev > 0) return { score: 3, gap: false };
  if (dLast > 0) return { score: 2, gap: false };
  return { score: 0, gap: false };
}

// --- Cash Runway ---
export function scoreCashRunway(cash: number | null, avgQuarterlyFcf: number | null): SubResult {
  if (cash == null || avgQuarterlyFcf == null) return { score: 0, gap: true };
  if (avgQuarterlyFcf >= 0) return { score: 3, gap: false };
  const runwayQuarters = cash / Math.abs(avgQuarterlyFcf);
  if (runwayQuarters > 12) return { score: 3, gap: false };
  if (runwayQuarters >= 8) return { score: 2, gap: false };
  if (runwayQuarters >= 4) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- FIX 6: EPS Revision Trend (no price-target fallback; unavailable = neutral 1) ---
export function scoreEpsRevision(current: number | null, ninetyDaysAgo: number | null): SubResult {
  if (current == null || ninetyDaysAgo == null || ninetyDaysAgo === 0) return { score: 1, gap: true };
  const pctChange = ((current - ninetyDaysAgo) / Math.abs(ninetyDaysAgo)) * 100;
  if (pctChange > 5) return { score: 3, gap: false };
  if (pctChange > 0) return { score: 2, gap: false };
  if (pctChange === 0) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- FIX 5 REVISED: Short Interest (shortPercentOfFloat only, no fallback) ---
export function scoreShortInterest(shortPercentOfFloatDecimal: number | null): SubResult {
  if (shortPercentOfFloatDecimal == null) return { score: 0, gap: true };
  const pct = shortPercentOfFloatDecimal * 100;
  if (pct > 35) return { score: 1, gap: false };
  if (pct >= 20) return { score: 3, gap: false };
  if (pct >= 10) return { score: 2, gap: false };
  if (pct >= 5) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- FIX 5: Insider Buy Count (open-market Buy transactions only, last 180 days) ---
export function scoreInsiderBuyCount(count: number | null): SubResult {
  if (count == null) return { score: 0, gap: true };
  if (count >= 3) return { score: 3, gap: false };
  if (count === 2) return { score: 2, gap: false };
  if (count === 1) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

export interface UpsideSubScores {
  grossMarginTrend: number;
  revenueDeceleration: number;
  cashRunway: number;
  epsRevision: number;
  shortInterest: number;
  insiderBuyCount: number;
}

export type UpsideLabel = "High Upside Potential" | "Moderate Upside" | "Speculative" | "Low Conviction";

export interface UpsideResult {
  subScores: UpsideSubScores;
  totalScore: number;
  label: UpsideLabel;
  dataGaps: string[];
  dataGapCount: number;
}

export function labelForUpside(total: number): UpsideLabel {
  if (total >= 15) return "High Upside Potential";
  if (total >= 10) return "Moderate Upside";
  if (total >= 5) return "Speculative";
  return "Low Conviction";
}

export interface UpsideInput {
  gmChanges: number[] | null;
  revenueGrowth: number[] | null;
  cash: number | null;
  avgQuarterlyFcf: number | null;
  epsCurrent: number | null;
  epsNinetyDaysAgo: number | null;
  shortPercentOfFloat: number | null;
  insiderBuyCount: number | null;
}

export function scoreUpside(row: UpsideInput): UpsideResult {
  const gm = scoreGrossMarginTrend(row.gmChanges);
  const rev = scoreRevenueDeceleration(row.revenueGrowth);
  const cash = scoreCashRunway(row.cash, row.avgQuarterlyFcf);
  const eps = scoreEpsRevision(row.epsCurrent, row.epsNinetyDaysAgo);
  const short = scoreShortInterest(row.shortPercentOfFloat);
  const insider = scoreInsiderBuyCount(row.insiderBuyCount);

  const subScores: UpsideSubScores = {
    grossMarginTrend: gm.score,
    revenueDeceleration: rev.score,
    cashRunway: cash.score,
    epsRevision: eps.score,
    shortInterest: short.score,
    insiderBuyCount: insider.score,
  };
  const totalScore = Object.values(subScores).reduce((a, b) => a + b, 0);

  const gapMap: [boolean, string][] = [
    [gm.gap, "gross_margin_trend"],
    [rev.gap, "revenue_deceleration"],
    [cash.gap, "cash_runway"],
    [eps.gap, "eps_trend"],
    [short.gap, "short_interest"],
    [insider.gap, "insider_purchases"],
  ];
  const dataGaps = gapMap.filter(([g]) => g).map(([, name]) => name);

  return { subScores, totalScore, label: labelForUpside(totalScore), dataGaps, dataGapCount: dataGaps.length };
}
