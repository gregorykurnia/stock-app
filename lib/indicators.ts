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

export function getHistoricalArrays(bars: OHLCVBar[], ind: Indicators, n = 10): HistoricalArrays {
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
