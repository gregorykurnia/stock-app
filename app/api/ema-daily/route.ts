import { NextRequest, NextResponse } from "next/server";
import { calcIndicators } from "@/lib/indicators";
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

interface EMADailyResult {
  ema20: number | null;
  ema50: number | null;
  atrPct: number | null;
  rsi: number | null;
  emaCrossAbove: boolean | null; // true if EMA20 currently above EMA50
  crossPrice: number | null;     // close price on the day the most recent cross happened
  crossDate: string | null;      // date (YYYY-MM-DD) of the most recent cross
}

async function fetchDailyIndicators(ticker: string): Promise<EMADailyResult> {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: oneYearAgo, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result?.quotes ?? []).filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null);
  if (quotes.length === 0) {
    return { ema20: null, ema50: null, atrPct: null, rsi: null, emaCrossAbove: null, crossPrice: null, crossDate: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars = quotes.map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
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

    // Walk forward to find the most recent flip in sign of (ema20 - ema50)
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

  return { ema20, ema50, atrPct, rsi, emaCrossAbove, crossPrice, crossDate };
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

  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        const r = await fetchDailyIndicators(ticker);
        ema20[ticker] = r.ema20;
        ema50[ticker] = r.ema50;
        atrPct[ticker] = r.atrPct;
        rsi[ticker] = r.rsi;
        emaCrossAbove[ticker] = r.emaCrossAbove;
        crossPrice[ticker] = r.crossPrice;
        crossDate[ticker] = r.crossDate;
      } catch {
        ema20[ticker] = null;
        ema50[ticker] = null;
        atrPct[ticker] = null;
        rsi[ticker] = null;
        emaCrossAbove[ticker] = null;
        crossPrice[ticker] = null;
        crossDate[ticker] = null;
      }
    }));
  }

  return NextResponse.json({ ema20, ema50, atrPct, rsi, emaCrossAbove, crossPrice, crossDate });
}
