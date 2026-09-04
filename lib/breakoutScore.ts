// Breakout Score — a 0-10 composite that measures how closely a ticker's divergence/confirmation
// profile matches the historical "benchmark" pattern (names that printed this setup and later ran):
// strong RSI divergence off a genuinely oversold anchor, MACD momentum compressing into the low
// (not still worsening), a fast MACD-cross confirmation, and a cross that lands early relative to
// EMA50D rather than after the trend has already been reclaimed.
//
// Weights and thresholds were fit against a benchmark set of confirmed historical breakouts
// (see conversation / stock-app CLAUDE.md "US BREAKOUT TAB" spec) — not a statistically rigorous
// model, just a first-pass heuristic to flag weak setups (shallow anchor + negative compression)
// before they're added as "New".
export interface BreakoutScoreInput {
  rsiDivergencePct: number | null;
  rsiBandDepthPct: number | null;
  histCompression: number | null;
  status: "no_divergence" | "watching" | "confirmed" | "failed" | null;
  daysLowToCross: number | null;
  pctAboveLowAtCross: number | null;
  distEma50AtCross: number | null;
  relVolumeAtCross: number | null;
}

export interface BreakoutScoreResult {
  score: number | null;
  parts: {
    divergence: number;
    bandDepth: number;
    histComp: number;
    speed: number;
    entryCost: number;
    trendStage: number;
    volume: number;
  } | null;
}

const WEIGHTS = {
  divergence: 0.25,
  bandDepth: 0.20,
  histComp: 0.25,
  speed: 0.10,
  entryCost: 0.10,
  trendStage: 0.05,
  volume: 0.05,
};

export function calcBreakoutScore(d: BreakoutScoreInput): BreakoutScoreResult {
  // No divergence at all yet — nothing to score.
  if (d.status == null || d.status === "no_divergence") return { score: null, parts: null };

  const divergence = d.rsiDivergencePct != null ? Math.min(Math.max(d.rsiDivergencePct, 0), 60) / 60 * 10 : 0;
  const bandDepth = d.rsiBandDepthPct != null ? Math.min(Math.max(d.rsiBandDepthPct, 0), 40) / 40 * 10 : 0;

  let histComp: number;
  if (d.histCompression == null) histComp = 0;
  else if (d.histCompression < 0) histComp = Math.max(0, 3 + d.histCompression);
  else histComp = Math.min(d.histCompression, 3) / 3 * 10;

  const confirmed = d.status === "confirmed";

  let speed: number, entryCost: number, trendStage: number, volume: number;
  if (!confirmed) {
    // "Watching" or "Failed" — no cross-based data yet (or the cross never happened cleanly).
    // Neutral partial credit rather than penalizing/rewarding on missing fields.
    speed = 5; entryCost = 5; trendStage = 5; volume = 5;
  } else {
    speed = d.daysLowToCross != null ? Math.max(0, 10 - Math.max(0, d.daysLowToCross - 3) * 0.4) : 5;
    entryCost = d.pctAboveLowAtCross != null ? Math.max(0, 10 - Math.max(0, d.pctAboveLowAtCross - 10) * 0.5) : 5;
    if (d.distEma50AtCross == null) trendStage = 5;
    else if (d.distEma50AtCross <= 0) trendStage = Math.min(Math.abs(d.distEma50AtCross), 25) / 25 * 10;
    else trendStage = Math.max(0, 10 - d.distEma50AtCross * 2);
    volume = d.relVolumeAtCross != null ? Math.min(d.relVolumeAtCross, 1.0) / 1.0 * 10 : 5;
  }

  const parts = { divergence, bandDepth, histComp, speed, entryCost, trendStage, volume };
  const score =
    parts.divergence * WEIGHTS.divergence +
    parts.bandDepth * WEIGHTS.bandDepth +
    parts.histComp * WEIGHTS.histComp +
    parts.speed * WEIGHTS.speed +
    parts.entryCost * WEIGHTS.entryCost +
    parts.trendStage * WEIGHTS.trendStage +
    parts.volume * WEIGHTS.volume;

  return { score, parts };
}
