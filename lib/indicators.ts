import {
  EMA,
  RSI,
  OBV,
  MFI,
  ADX,
} from "technicalindicators";
import type { OHLCVBar, Indicators, LatestIndicators, HistoricalArrays } from "./types";

function calcCMF(bars: OHLCVBar[], period = 20): number[] {
  const result: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sumMFV = 0, sumVol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const { high, low, close, volume } = bars[j];
      const range = high - low;
      const mfm = range === 0 ? 0 : ((close - low) - (high - close)) / range;
      sumMFV += mfm * volume;
      sumVol += volume;
    }
    result.push(sumVol === 0 ? 0 : sumMFV / sumVol);
  }
  return result;
}

function padLeft(arr: number[], targetLen: number): number[] {
  const padding = new Array(targetLen - arr.length).fill(NaN);
  return [...padding, ...arr];
}

export function calcIndicators(bars: OHLCVBar[]): Indicators {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  const ema20Raw = EMA.calculate({ period: 20, values: closes });
  const ema50Raw = EMA.calculate({ period: 50, values: closes });
  const rsiRaw = RSI.calculate({ period: 14, values: closes });
  const obvRaw = OBV.calculate({ close: closes, volume: volumes });
  const cmf = calcCMF(bars, 20);

  const adxRaw = ADX.calculate({ period: 14, high: highs, low: lows, close: closes });
  const diPlusRaw = adxRaw.map((v) => v.pdi);
  const diMinusRaw = adxRaw.map((v) => v.mdi);
  const adxValRaw = adxRaw.map((v) => v.adx);

  return {
    ema20: padLeft(ema20Raw, bars.length),
    ema50: padLeft(ema50Raw, bars.length),
    rsi: padLeft(rsiRaw, bars.length),
    obv: padLeft(obvRaw, bars.length),
    cmf,
    diPlus: padLeft(diPlusRaw, bars.length),
    diMinus: padLeft(diMinusRaw, bars.length),
    adx: padLeft(adxValRaw, bars.length),
  };
}

// Algorithmic OBV trough analysis — avoids Claude being lenient on raw arrays
export function analyzeOBVTroughs(obvFull: number[]): {
  pattern: "clean_staircase" | "higher_low_forming" | "lower_low" | "sustained_downtrend" | "parabolic_rollover" | "flat_sideways";
  trough1: number | null;
  trough2: number | null;
  trough2_pct_above_trough1: number | null;
  summary: string;
} {
  // Work on last 26 bars (6 months weekly)
  const obv = obvFull.filter((v) => !isNaN(v)).slice(-26);
  if (obv.length < 6) return { pattern: "flat_sideways", trough1: null, trough2: null, trough2_pct_above_trough1: null, summary: "Insufficient data" };

  const range = Math.max(...obv) - Math.min(...obv);

  // Find local minima: must be lower than both neighbors, with min gap of 2 bars
  const troughs: { idx: number; val: number }[] = [];
  for (let i = 2; i < obv.length - 2; i++) {
    if (obv[i] < obv[i - 1] && obv[i] < obv[i - 2] && obv[i] < obv[i + 1] && obv[i] < obv[i + 2]) {
      // Suppress micro-troughs: must be at least 5% of range below neighbors
      const leftDip = Math.min(obv[i - 1], obv[i - 2]) - obv[i];
      const rightDip = Math.min(obv[i + 1], obv[i + 2]) - obv[i];
      if (leftDip > range * 0.05 || rightDip > range * 0.05) {
        troughs.push({ idx: i, val: obv[i] });
      }
    }
  }

  // Also check if the last value itself is a trough candidate (end of history)
  const last = obv[obv.length - 1];
  const prev2 = obv.slice(-4, -1);
  if (prev2.every((v) => v > last)) {
    troughs.push({ idx: obv.length - 1, val: last });
  }

  // Check parabolic rollover: sharp spike followed by steep drop
  const peak = Math.max(...obv);
  const peakIdx = obv.lastIndexOf(peak);
  const postPeakDrop = (peak - obv[obv.length - 1]) / (range || 1);
  const peakNearEnd = peakIdx > obv.length * 0.4;
  if (peakNearEnd && postPeakDrop > 0.4 && obv[obv.length - 1] < peak * 0.7) {
    return { pattern: "parabolic_rollover", trough1: null, trough2: null, trough2_pct_above_trough1: null, summary: `OBV peaked around bar ${peakIdx} then dropped ${(postPeakDrop * 100).toFixed(0)}% — distribution signal` };
  }

  // Overall trend via linear regression slope
  const n = obv.length;
  const meanX = (n - 1) / 2;
  const meanY = obv.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - meanX) * (obv[i] - meanY); den += (i - meanX) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  // Normalized slope: per-bar change as fraction of range
  const normSlope = range === 0 ? 0 : slope / range;

  if (troughs.length < 2) {
    // Can't compare troughs — use slope to classify
    if (normSlope > 0.015) return { pattern: "clean_staircase", trough1: null, trough2: null, trough2_pct_above_trough1: null, summary: "Rising OBV trend, no distinct troughs to compare" };
    if (normSlope < -0.015) return { pattern: "sustained_downtrend", trough1: null, trough2: null, trough2_pct_above_trough1: null, summary: "Falling OBV trend, no distinct recovery" };
    return { pattern: "flat_sideways", trough1: null, trough2: null, trough2_pct_above_trough1: null, summary: "OBV moving sideways with no clear trend" };
  }

  const t1 = troughs[troughs.length - 2];
  const t2 = troughs[troughs.length - 1];
  const pctAbove = range === 0 ? 0 : ((t2.val - t1.val) / Math.abs(range)) * 100;

  // Check if overall OBV is also making lower highs (sustained downtrend override)
  const firstHalf = obv.slice(0, Math.floor(n / 2));
  const secondHalf = obv.slice(Math.floor(n / 2));
  const firstMax = Math.max(...firstHalf);
  const secondMax = Math.max(...secondHalf);
  const lowerHighs = secondMax < firstMax * 0.97;

  if (pctAbove > 3 && !lowerHighs) {
    // Genuine structural higher low
    const pattern = normSlope > 0.01 ? "clean_staircase" : "higher_low_forming";
    return {
      pattern,
      trough1: t1.val,
      trough2: t2.val,
      trough2_pct_above_trough1: pctAbove,
      summary: `Trough 2 (${t2.val.toFixed(0)}) is ${pctAbove.toFixed(1)}% of OBV range above trough 1 (${t1.val.toFixed(0)}) — structural higher low`,
    };
  }

  if (pctAbove > 3 && lowerHighs) {
    // Trough is genuinely higher — classify as higher_low_forming even with lower highs.
    // For beaten-down stocks, lower highs are expected during the bottoming process;
    // the higher low is the key accumulation signal. Claude will contextualize the lower highs.
    return {
      pattern: "higher_low_forming",
      trough1: t1.val,
      trough2: t2.val,
      trough2_pct_above_trough1: pctAbove,
      summary: `Trough 2 (${t2.val.toFixed(0)}) is ${pctAbove.toFixed(1)}% of OBV range above trough 1 (${t1.val.toFixed(0)}) — higher low forming; OBV highs still declining (${firstMax.toFixed(0)} → ${secondMax.toFixed(0)}), watch for confirmation`,
    };
  }

  // t2 <= t1 — lower low
  const isSustained = Math.abs(normSlope) > 0.01 && lowerHighs;
  return {
    pattern: isSustained ? "sustained_downtrend" : "lower_low",
    trough1: t1.val,
    trough2: t2.val,
    trough2_pct_above_trough1: pctAbove,
    summary: `Trough 2 (${t2.val.toFixed(0)}) is below trough 1 (${t1.val.toFixed(0)}) by ${Math.abs(pctAbove).toFixed(1)}% of range — OBV making lower lows${isSustained ? ", sustained distribution" : ""}`,
  };
}

export function getHistoricalArrays(bars: OHLCVBar[], ind: Indicators, n = 20): HistoricalArrays {
  const lastN = <T>(arr: T[]) => arr.slice(-n);
  const validTail = (arr: number[]) => {
    const tail = lastN(arr);
    return tail.map((v) => (isNaN(v) ? 0 : v));
  };
  return {
    obv_history: validTail(ind.obv),
    rsi_history: validTail(ind.rsi),
    price_history: bars.slice(-n).map((b) => b.close),
    ema20_history: validTail(ind.ema20),
    obv_analysis: analyzeOBVTroughs(ind.obv),
  };
}

export function getLatest(bars: OHLCVBar[], ind: Indicators): LatestIndicators {
  const last = (arr: number[]) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) return arr[i];
    }
    return 0;
  };
  return {
    ema20: last(ind.ema20),
    ema50: last(ind.ema50),
    rsi: last(ind.rsi),
    obv: last(ind.obv),
    cmfVal: last(ind.cmf),
    diPlus: last(ind.diPlus),
    diMinus: last(ind.diMinus),
    adx: last(ind.adx),
    price: bars[bars.length - 1].close,
  };
}
