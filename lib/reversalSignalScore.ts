// Reversal Signal Score — a standalone 0-12 score for the Coiling Reversal screener,
// separate from Grand Score / Proximity Score / Upside Score. Combines 4 sub-signals
// (0-3 each): daily RSI divergence, weekly RSI divergence, OBV slope, OBV divergence.
// Every sub-score function returns { score, gap } — gap=true means the underlying data
// was missing/insufficient and the score fell back to 0 purely for scoring purposes;
// the caller collects gap=true fields into "Data Gaps" / "Data Gap Count".

export interface SubResult { score: number; gap: boolean }

// --- Component 1: RSI Divergence Daily ---
// value = RSI at Low2 (last 20d low) - RSI at Low1 (40-20d-ago low), already computed upstream.
// confirmed = low2 price < low1 price AND rsi at low2 > rsi at low1 (i.e. a real bullish
// divergence, not just a positive RSI delta with no lower low in price).
export function scoreRsiDivDaily(value: number | null, confirmed: boolean | null): SubResult {
  if (value == null || confirmed == null) return { score: 0, gap: true };
  if (!confirmed) return { score: 0, gap: false };
  if (value > 15) return { score: 3, gap: false };
  if (value >= 8) return { score: 2, gap: false };
  if (value >= 3) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- Component 2: RSI Divergence Weekly ---
// Same shape as Component 1, but Low1/Low2 are drawn from weekly closes (16-8 weeks ago vs
// last 8 weeks) and weekly RSI.
export function scoreRsiDivWeekly(value: number | null, confirmed: boolean | null): SubResult {
  if (value == null || confirmed == null) return { score: 0, gap: true };
  if (!confirmed) return { score: 0, gap: false };
  if (value > 10) return { score: 3, gap: false };
  if (value >= 5) return { score: 2, gap: false };
  if (value >= 2) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- Component 3: OBV Slope ---
// Normalized 20-day OBV linear-regression slope, already computed upstream.
export function scoreObvSlope(value: number | null): SubResult {
  if (value == null) return { score: 0, gap: true };
  if (value > 0.05) return { score: 3, gap: false };
  if (value >= 0.02) return { score: 2, gap: false };
  if (value >= 0) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

// --- Component 4: OBV Divergence ---
// Normalized OBV slope minus normalized price slope, already computed upstream.
export function scoreObvDivergence(value: number | null): SubResult {
  if (value == null) return { score: 0, gap: true };
  if (value > 0.06) return { score: 3, gap: false };
  if (value >= 0.03) return { score: 2, gap: false };
  if (value >= 0.01) return { score: 1, gap: false };
  return { score: 0, gap: false };
}

export interface ReversalSignalSubScores {
  rsiDivDaily: number;
  rsiDivWeekly: number;
  obvSlope: number;
  obvDivergence: number;
}

export type ReversalSignalLabel = "Strong Accumulation" | "Developing" | "Weak Signal" | "No Signal";

export interface ReversalSignalResult {
  subScores: ReversalSignalSubScores;
  totalScore: number;
  label: ReversalSignalLabel;
  dataGaps: string[];
  dataGapCount: number;
}

export function labelForReversalSignal(total: number): ReversalSignalLabel {
  if (total >= 10) return "Strong Accumulation";
  if (total >= 7) return "Developing";
  if (total >= 4) return "Weak Signal";
  return "No Signal";
}

export interface ReversalSignalInput {
  rsiDivDaily: number | null;
  rsiDivDailyConfirmed: boolean | null;
  rsiDivWeekly: number | null;
  rsiDivWeeklyConfirmed: boolean | null;
  obvSlope: number | null;
  obvDivergence: number | null;
}

// Never throws and never returns NaN — every sub-score function has a defined fallback
// (score: 0) for missing/insufficient data, so a single ticker's bad data can't propagate.
export function scoreReversalSignal(row: ReversalSignalInput): ReversalSignalResult {
  const daily = scoreRsiDivDaily(row.rsiDivDaily, row.rsiDivDailyConfirmed);
  const weekly = scoreRsiDivWeekly(row.rsiDivWeekly, row.rsiDivWeeklyConfirmed);
  const slope = scoreObvSlope(row.obvSlope);
  const div = scoreObvDivergence(row.obvDivergence);

  const subScores: ReversalSignalSubScores = {
    rsiDivDaily: daily.score,
    rsiDivWeekly: weekly.score,
    obvSlope: slope.score,
    obvDivergence: div.score,
  };
  const totalScore = Object.values(subScores).reduce((a, b) => a + b, 0);

  const gapMap: [boolean, string][] = [
    [daily.gap, "rsi_div_daily"],
    [weekly.gap, "rsi_div_weekly"],
    [slope.gap, "obv_slope"],
    [div.gap, "obv_divergence"],
  ];
  const dataGaps = gapMap.filter(([g]) => g).map(([, name]) => name);

  return { subScores, totalScore, label: labelForReversalSignal(totalScore), dataGaps, dataGapCount: dataGaps.length };
}
