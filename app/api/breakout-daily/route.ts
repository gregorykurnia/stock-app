import { NextRequest, NextResponse } from "next/server";
import { calcIndicators } from "@/lib/indicators";
import { calcBreakoutScore } from "@/lib/breakoutScore";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Full-series EMA (NaN until warmed up), used to build a full-series MACD (calculateMACD in
// lib/indicators.ts only returns the latest point — this needs the whole history to walk forward
// from the swing low looking for the first bullish MACD/signal crossover).
function emaSeriesFull(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  out[period - 1] = ema;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function macdSeriesFull(closes: number[]): { macd: number[]; signal: number[]; hist: number[] } {
  const ema12 = emaSeriesFull(closes, 12);
  const ema26 = emaSeriesFull(closes, 26);
  const macd = closes.map((_, i) => (isNaN(ema12[i]) || isNaN(ema26[i]) ? NaN : ema12[i] - ema26[i]));
  const signal = emaSeriesFull(macd.map((v) => (isNaN(v) ? 0 : v)), 9).map((v, i) => (isNaN(macd[i]) ? NaN : v));
  // signal is NaN until macd itself has 9 valid points warmed up
  let validCount = 0;
  for (let i = 0; i < macd.length; i++) {
    if (!isNaN(macd[i])) validCount++;
    if (validCount < 9) signal[i] = NaN;
  }
  const hist = closes.map((_, i) => (isNaN(macd[i]) || isNaN(signal[i]) ? NaN : macd[i] - signal[i]));
  return { macd, signal, hist };
}

interface BreakoutResult {
  swingLow: number | null;
  swingLowDate: string | null;
  preLowHigh: number | null;
  preLowHighDate: string | null;
  declineFromHighPct: number | null;
  rsiAtLow: number | null;
  rsiAnchor: number | null;
  rsiAnchorDate: string | null;
  rsiAnchorPrice: number | null;
  priceDeclinePct: number | null;
  rsiDivergencePct: number | null;
  rsiBandDepthPct: number | null;
  histAtAnchor: number | null;
  histAtLow: number | null;
  histCompression: number | null;
  crossDate: string | null;
  crossPrice: number | null;
  pctAboveLowAtCross: number | null;
  daysLowToCross: number | null;
  distEma20AtCross: number | null;
  distEma50AtCross: number | null;
  relVolumeAtCross: number | null;
  status: "no_divergence" | "watching" | "confirmed" | "failed" | null;
  ema20d: number | null;
  ema50d: number | null;
  rsiCurrent: number | null;
  macdHistCurrent: number | null;
  breakoutScore: number | null;
}

const EMPTY: BreakoutResult = {
  swingLow: null, swingLowDate: null, preLowHigh: null, preLowHighDate: null, declineFromHighPct: null,
  rsiAtLow: null, rsiAnchor: null, rsiAnchorDate: null, rsiAnchorPrice: null, priceDeclinePct: null,
  rsiDivergencePct: null, rsiBandDepthPct: null, histAtAnchor: null, histAtLow: null, histCompression: null,
  crossDate: null, crossPrice: null, pctAboveLowAtCross: null, daysLowToCross: null,
  distEma20AtCross: null, distEma50AtCross: null, relVolumeAtCross: null, status: null,
  ema20d: null, ema50d: null, rsiCurrent: null, macdHistCurrent: null, breakoutScore: null,
};

// Single 20-month daily chart fetch per ticker: the full fetched window is scanned for the swing
// low, and the RSI-divergence anchor is searched for anywhere before it in that same history.
async function fetchBreakoutDaily(ticker: string): Promise<BreakoutResult> {
  const now = new Date();
  const fetchStart = new Date(now.getTime());
  fetchStart.setMonth(fetchStart.getMonth() - 20);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: fetchStart, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result?.quotes ?? []).filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null);
  if (quotes.length < 60) return EMPTY;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars = quotes.map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dateStr = (i: number) => {
    const q = quotes[i] as any;
    const d: Date = q.date instanceof Date ? q.date : new Date(q.date);
    return d.toISOString().slice(0, 10);
  };
  const closes = bars.map((b: { close: number }) => b.close);
  const volumes = bars.map((b: { volume: number }) => b.volume);

  const ind = calcIndicators(bars);
  const rsis = ind.rsi;
  const ema20s = ind.ema20;
  const ema50s = ind.ema50;
  const { hist } = macdSeriesFull(closes);

  const n = bars.length;

  // Full trailing 20mo window (the entire fetched history) — where the swing low is scanned for.
  const windowStart = 0;
  let swingLowIdx = windowStart;
  for (let i = windowStart; i < n; i++) {
    if (closes[i] < closes[swingLowIdx]) swingLowIdx = i;
  }
  const swingLow = closes[swingLowIdx];
  const swingLowDate = dateStr(swingLowIdx);

  // Highest close anywhere before the swing low, in the same fetched window — how far the stock
  // fell before bottoming. Not a strict calendar 2Y high (the window is 20mo), just the pre-low peak.
  let preLowHighIdx: number | null = null;
  for (let i = 0; i < swingLowIdx; i++) {
    if (preLowHighIdx == null || closes[i] > closes[preLowHighIdx]) preLowHighIdx = i;
  }
  const preLowHigh = preLowHighIdx != null ? closes[preLowHighIdx] : null;
  const preLowHighDate = preLowHighIdx != null ? dateStr(preLowHighIdx) : null;
  const declineFromHighPct = preLowHigh != null && preLowHigh > 0 ? ((swingLow - preLowHigh) / preLowHigh) * 100 : null;

  // Lowest RSI point strictly before the swing low, anywhere in the fetched history.
  let anchorIdx: number | null = null;
  for (let i = 0; i < swingLowIdx; i++) {
    if (isNaN(rsis[i])) continue;
    if (anchorIdx == null || rsis[i] < rsis[anchorIdx]) anchorIdx = i;
  }

  const rsiAtLow = isNaN(rsis[swingLowIdx]) ? null : rsis[swingLowIdx];
  const rsiAnchor = anchorIdx != null ? rsis[anchorIdx] : null;
  const rsiAnchorDate = anchorIdx != null ? dateStr(anchorIdx) : null;
  const rsiAnchorPrice = anchorIdx != null ? closes[anchorIdx] : null;
  const priceDeclinePct = rsiAnchorPrice != null && rsiAnchorPrice > 0 ? ((swingLow - rsiAnchorPrice) / rsiAnchorPrice) * 100 : null;

  const rsiDivergencePct = rsiAtLow != null && rsiAnchor != null && rsiAnchor !== 0 ? ((rsiAtLow - rsiAnchor) / rsiAnchor) * 100 : null;
  const rsiBandDepthPct = rsiAnchor != null ? ((30 - rsiAnchor) / 30) * 100 : null;

  const histAtAnchor = anchorIdx != null && !isNaN(hist[anchorIdx]) ? hist[anchorIdx] : null;
  const histAtLow = !isNaN(hist[swingLowIdx]) ? hist[swingLowIdx] : null;
  const histCompression = histAtAnchor != null && histAtLow != null ? histAtLow - histAtAnchor : null;

  const divergenceConfirmed = rsiAtLow != null && rsiAnchor != null && rsiAtLow > rsiAnchor;

  let status: BreakoutResult["status"] = divergenceConfirmed ? "watching" : "no_divergence";
  let crossIdx: number | null = null;
  let failed = false;

  if (divergenceConfirmed) {
    for (let i = swingLowIdx + 1; i < n; i++) {
      if (closes[i] < swingLow) { failed = true; break; }
      if (!isNaN(hist[i]) && !isNaN(hist[i - 1]) && hist[i - 1] <= 0 && hist[i] > 0) { crossIdx = i; break; }
    }
    status = crossIdx != null ? "confirmed" : failed ? "failed" : "watching";
  }

  const crossDate = crossIdx != null ? dateStr(crossIdx) : null;
  const crossPrice = crossIdx != null ? closes[crossIdx] : null;
  const pctAboveLowAtCross = crossPrice != null && swingLow > 0 ? ((crossPrice - swingLow) / swingLow) * 100 : null;
  const daysLowToCross = crossIdx != null ? crossIdx - swingLowIdx : null;
  const distEma20AtCross = crossIdx != null && !isNaN(ema20s[crossIdx]) ? ((closes[crossIdx] - ema20s[crossIdx]) / ema20s[crossIdx]) * 100 : null;
  const distEma50AtCross = crossIdx != null && !isNaN(ema50s[crossIdx]) ? ((closes[crossIdx] - ema50s[crossIdx]) / ema50s[crossIdx]) * 100 : null;
  let relVolumeAtCross: number | null = null;
  if (crossIdx != null && crossIdx >= 20) {
    const prior20 = volumes.slice(crossIdx - 20, crossIdx);
    const avg = prior20.reduce((a: number, b: number) => a + b, 0) / prior20.length;
    relVolumeAtCross = avg > 0 ? volumes[crossIdx] / avg : null;
  }

  const lastEma20 = ema20s[n - 1];
  const lastEma50 = ema50s[n - 1];
  const lastRsi = rsis[n - 1];
  const lastHist = hist[n - 1];

  const { score: breakoutScore } = calcBreakoutScore({
    rsiDivergencePct, rsiBandDepthPct, histCompression, status,
    daysLowToCross, pctAboveLowAtCross, distEma50AtCross, relVolumeAtCross,
  });

  return {
    swingLow, swingLowDate, preLowHigh, preLowHighDate, declineFromHighPct,
    rsiAtLow, rsiAnchor, rsiAnchorDate, rsiAnchorPrice, priceDeclinePct,
    rsiDivergencePct, rsiBandDepthPct, histAtAnchor, histAtLow, histCompression,
    crossDate, crossPrice, pctAboveLowAtCross, daysLowToCross,
    distEma20AtCross, distEma50AtCross, relVolumeAtCross, status,
    ema20d: isNaN(lastEma20) ? null : lastEma20,
    ema50d: isNaN(lastEma50) ? null : lastEma50,
    rsiCurrent: isNaN(lastRsi) ? null : lastRsi,
    macdHistCurrent: isNaN(lastHist) ? null : lastHist,
    breakoutScore,
  };
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });
  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);

  const out: Record<keyof BreakoutResult, Record<string, unknown>> = {
    swingLow: {}, swingLowDate: {}, preLowHigh: {}, preLowHighDate: {}, declineFromHighPct: {},
    rsiAtLow: {}, rsiAnchor: {}, rsiAnchorDate: {}, rsiAnchorPrice: {}, priceDeclinePct: {},
    rsiDivergencePct: {}, rsiBandDepthPct: {}, histAtAnchor: {}, histAtLow: {}, histCompression: {},
    crossDate: {}, crossPrice: {}, pctAboveLowAtCross: {}, daysLowToCross: {},
    distEma20AtCross: {}, distEma50AtCross: {}, relVolumeAtCross: {}, status: {},
    ema20d: {}, ema50d: {}, rsiCurrent: {}, macdHistCurrent: {}, breakoutScore: {},
  };

  const chunkSize = 8;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      const r = await fetchBreakoutDaily(ticker).catch(() => EMPTY);
      (Object.keys(EMPTY) as (keyof BreakoutResult)[]).forEach((k) => {
        out[k][ticker] = r[k];
      });
    }));
  }

  return NextResponse.json(out);
}
