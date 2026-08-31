import { NextRequest, NextResponse } from "next/server";
import { calcIndicators, calculateMACD, calculateATR, calculateBandarScore, type BandarScoreResult } from "@/lib/indicators";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function calcATRPct(quotes: { high: number; low: number; close: number }[], period = 14): number | null {
  if (quotes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < quotes.length; i++) {
    const { high, low } = quotes[i];
    const prevClose = quotes[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (trs.length < period) return null;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  const lastClose = quotes[quotes.length - 1].close;
  return lastClose > 0 ? (atr / lastClose) * 100 : null;
}

interface SwingDailyResult {
  ema20: number | null;
  ema50: number | null;
  atrPct: number | null;
  rsi: number | null;
  emaCrossAbove: boolean | null;
  crossPrice: number | null;
  crossDate: string | null;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  histDirection: "up" | "down" | "flat" | null;
  atr: number | null;
  stopLoss: number | null;
  stopLossPercent: number | null;
  bandar: BandarScoreResult | null;
  low6mo: number | null;
  distFromLow6mo: number | null;
  resistance: number | null;
  distFromResistance: number | null;
  relVolume: number | null;
}

const EMPTY: SwingDailyResult = {
  ema20: null, ema50: null, atrPct: null, rsi: null,
  emaCrossAbove: null, crossPrice: null, crossDate: null,
  macd: null, signal: null, histogram: null, histDirection: null,
  atr: null, stopLoss: null, stopLossPercent: null, bandar: null,
  low6mo: null, distFromLow6mo: null, resistance: null, distFromResistance: null, relVolume: null,
};

// Single 1-year daily chart fetch per ticker, powering every "Midterm/Swing" indicator
// (EMA20/50D, RSI, ATR%, EMA cross, MACD, ATR(14)+stop, Bandar score, resistance) instead of the
// several separate chart fetches this used to require.
async function fetchSwingDaily(ticker: string): Promise<SwingDailyResult> {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: oneYearAgo, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result?.quotes ?? []).filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null);
  if (quotes.length === 0) return EMPTY;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars = quotes.map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
  const closes = bars.map((b: { close: number }) => b.close);

  const ind = calcIndicators(bars);
  const atrPct = calcATRPct(bars, 14);

  const last = (arr: number[]) => {
    for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
    return null;
  };
  const ema20 = last(ind.ema20);
  const ema50 = last(ind.ema50);
  const rsi = last(ind.rsi);

  let emaCrossAbove: boolean | null = null;
  let crossPrice: number | null = null;
  let crossDate: string | null = null;

  if (ema20 != null && ema50 != null) {
    emaCrossAbove = ema20 > ema50;

    let prevSign: number | null = null;
    for (let i = 0; i < ind.ema20.length; i++) {
      const e20 = ind.ema20[i];
      const e50 = ind.ema50[i];
      if (isNaN(e20) || isNaN(e50)) continue;
      const sign = e20 - e50 >= 0 ? 1 : -1;
      if (prevSign !== null && sign !== prevSign) {
        crossPrice = bars[i].close;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = quotes[i] as any;
        const d: Date = q.date instanceof Date ? q.date : new Date(q.date);
        crossDate = d.toISOString().slice(0, 10);
      }
      prevSign = sign;
    }
  }

  const macdRes = calculateMACD(closes);
  const atrRes = calculateATR(bars, 14);
  const bandar = calculateBandarScore(bars.slice(-60));

  // "Lowest point" over the last ~6 months of trading (~126 sessions), using intraday lows.
  const last126 = bars.slice(-126);
  const low6mo = last126.length > 0 ? Math.min(...last126.map((b: { low: number }) => b.low)) : null;
  const lastClose = bars[bars.length - 1].close;
  const distFromLow6mo = low6mo != null && low6mo > 0 ? ((lastClose - low6mo) / low6mo) * 100 : null;

  // Resistance: the highest intraday high over the full ~1yr window, excluding the most recent
  // ~15 sessions. Excluding the recent cooldown avoids "resistance" trivially tracking today's
  // price when a stock is actively making new highs — this is meant to capture the last real
  // ceiling the stock pulled back from, not the current candle.
  const cooldown = 15;
  const resistanceWindow = bars.slice(0, Math.max(0, bars.length - cooldown));
  const resistance = resistanceWindow.length > 0 ? Math.max(...resistanceWindow.map((b: { high: number }) => b.high)) : null;
  const distFromResistance = resistance != null && resistance > 0 ? ((lastClose - resistance) / resistance) * 100 : null;

  // Relative volume: most recent session's volume vs its trailing 20-day average.
  const volumes = bars.map((b: { volume: number }) => b.volume);
  const last20Vol = volumes.slice(-21, -1);
  const avgVol20 = last20Vol.length > 0 ? last20Vol.reduce((a: number, b: number) => a + b, 0) / last20Vol.length : null;
  const lastVol = volumes[volumes.length - 1];
  const relVolume = avgVol20 != null && avgVol20 > 0 ? lastVol / avgVol20 : null;

  return {
    ema20, ema50, atrPct, rsi, emaCrossAbove, crossPrice, crossDate,
    macd: macdRes?.macd ?? null,
    signal: macdRes?.signal ?? null,
    histogram: macdRes?.histogram ?? null,
    histDirection: macdRes?.histDirection ?? null,
    atr: atrRes?.atr ?? null,
    stopLoss: atrRes?.stopLoss ?? null,
    stopLossPercent: atrRes?.stopLossPercent ?? null,
    bandar,
    low6mo, distFromLow6mo, resistance, distFromResistance, relVolume,
  };
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);

  const ema20: Record<string, number | null> = {};
  const ema50: Record<string, number | null> = {};
  const atrPct: Record<string, number | null> = {};
  const rsi: Record<string, number | null> = {};
  const emaCrossAbove: Record<string, boolean | null> = {};
  const crossPrice: Record<string, number | null> = {};
  const crossDate: Record<string, string | null> = {};
  const macd: Record<string, number | null> = {};
  const signal: Record<string, number | null> = {};
  const histogram: Record<string, number | null> = {};
  const histDirection: Record<string, "up" | "down" | "flat" | null> = {};
  const atr: Record<string, number | null> = {};
  const stopLoss: Record<string, number | null> = {};
  const stopLossPercent: Record<string, number | null> = {};
  const bandar: Record<string, BandarScoreResult | null> = {};
  const low6mo: Record<string, number | null> = {};
  const distFromLow6mo: Record<string, number | null> = {};
  const resistance: Record<string, number | null> = {};
  const distFromResistance: Record<string, number | null> = {};
  const relVolume: Record<string, number | null> = {};

  const chunkSize = 8;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      const r = await fetchSwingDaily(ticker).catch(() => EMPTY);
      ema20[ticker] = r.ema20;
      ema50[ticker] = r.ema50;
      atrPct[ticker] = r.atrPct;
      rsi[ticker] = r.rsi;
      emaCrossAbove[ticker] = r.emaCrossAbove;
      crossPrice[ticker] = r.crossPrice;
      crossDate[ticker] = r.crossDate;
      macd[ticker] = r.macd;
      signal[ticker] = r.signal;
      histogram[ticker] = r.histogram;
      histDirection[ticker] = r.histDirection;
      atr[ticker] = r.atr;
      stopLoss[ticker] = r.stopLoss;
      stopLossPercent[ticker] = r.stopLossPercent;
      bandar[ticker] = r.bandar;
      low6mo[ticker] = r.low6mo;
      distFromLow6mo[ticker] = r.distFromLow6mo;
      resistance[ticker] = r.resistance;
      distFromResistance[ticker] = r.distFromResistance;
      relVolume[ticker] = r.relVolume;
    }));
  }

  return NextResponse.json({
    ema20, ema50, atrPct, rsi, emaCrossAbove, crossPrice, crossDate,
    macd, signal, histogram, histDirection,
    atr, stopLoss, stopLossPercent, bandar,
    low6mo, distFromLow6mo, resistance, distFromResistance, relVolume,
  });
}
