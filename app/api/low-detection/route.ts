import { NextRequest, NextResponse } from "next/server";
import { calcIndicators, macdSeriesFull } from "@/lib/indicators";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface TroughEvent {
  date: string;
  price: number;
  ema20: number | null;
  ema50: number | null;
  rsi: number;
  diPlus: number | null;
  diMinus: number | null;
  adx: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
  cmf: number | null;
}

function buildTroughAt(
  idx: number,
  dates: string[],
  closes: number[],
  rsi: number[],
  ema20: number[],
  ema50: number[],
  diPlus: number[],
  diMinus: number[],
  adx: number[],
  macd: number[],
  signal: number[],
  hist: number[],
  cmf: number[]
): TroughEvent {
  const v = (arr: number[]) => (isNaN(arr[idx]) ? null : arr[idx]);
  return {
    date: dates[idx],
    price: closes[idx],
    ema20: v(ema20),
    ema50: v(ema50),
    rsi: rsi[idx],
    diPlus: v(diPlus),
    diMinus: v(diMinus),
    adx: v(adx),
    macd: v(macd),
    signal: v(signal),
    hist: v(hist),
    cmf: v(cmf),
  };
}

const RSI_THRESHOLD = 30;
// Trading days: two RSI<30 dips within this many bars of each other are treated as the same
// trough episode rather than two separate ones.
const CLUSTER_GAP_DAYS = 10;

// Scans the full daily history for RSI(14) < 30 dips, clusters consecutive/nearby dips into
// distinct trough episodes, and picks the local price minimum within each cluster as the trough
// date — mirrors the manual "find the RSI<30 low, read off every indicator at that date" process.
function detectTroughs(
  dates: string[],
  closes: number[],
  rsi: number[],
  ema20: number[],
  ema50: number[],
  diPlus: number[],
  diMinus: number[],
  adx: number[],
  macd: number[],
  signal: number[],
  hist: number[],
  cmf: number[]
): TroughEvent[] {
  const n = closes.length;
  const oversoldIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isNaN(rsi[i]) && rsi[i] < RSI_THRESHOLD) oversoldIdx.push(i);
  }
  if (oversoldIdx.length === 0) return [];

  const clusters: number[][] = [];
  let current: number[] = [oversoldIdx[0]];
  for (let k = 1; k < oversoldIdx.length; k++) {
    const idx = oversoldIdx[k];
    if (idx - current[current.length - 1] <= CLUSTER_GAP_DAYS) {
      current.push(idx);
    } else {
      clusters.push(current);
      current = [idx];
    }
  }
  clusters.push(current);

  return clusters.map((cluster) => {
    let lowIdx = cluster[0];
    for (const idx of cluster) {
      if (closes[idx] < closes[lowIdx]) lowIdx = idx;
    }
    return buildTroughAt(lowIdx, dates, closes, rsi, ema20, ema50, diPlus, diMinus, adx, macd, signal, hist, cmf);
  });
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const monthsParam = req.nextUrl.searchParams.get("months");
  const months = monthsParam ? Math.max(6, Math.min(60, parseInt(monthsParam, 10) || 24)) : 24;

  const now = new Date();
  const fetchStart = new Date(now.getTime());
  fetchStart.setMonth(fetchStart.getMonth() - months);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.chart(ticker, { period1: fetchStart, period2: now, interval: "1d" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (result?.quotes ?? []).filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null);
    if (quotes.length < 60) return NextResponse.json({ error: "insufficient data" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bars = quotes.map((q: any) => ({ open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dates = quotes.map((q: any) => {
      const d: Date = q.date instanceof Date ? q.date : new Date(q.date);
      return d.toISOString().slice(0, 10);
    });
    const closes = bars.map((b: { close: number }) => b.close);

    const ind = calcIndicators(bars);
    const { macd, signal, hist } = macdSeriesFull(closes);

    const troughs = detectTroughs(
      dates, closes, ind.rsi, ind.ema20, ind.ema50, ind.diPlus, ind.diMinus, ind.adx, macd, signal, hist, ind.cmf
    );

    // Actual trailing-1Y price low (lowest close in the last ~252 trading days), regardless of
    // whether RSI dipped below 30 there — always surfaced as the reference "current" trough.
    const oneYearWindow = Math.min(252, closes.length);
    const windowStart = closes.length - oneYearWindow;
    let oneYearLowIdx = windowStart;
    for (let i = windowStart; i < closes.length; i++) {
      if (closes[i] < closes[oneYearLowIdx]) oneYearLowIdx = i;
    }
    const oneYearLow = buildTroughAt(
      oneYearLowIdx, dates, closes, ind.rsi, ind.ema20, ind.ema50, ind.diPlus, ind.diMinus, ind.adx, macd, signal, hist, ind.cmf
    );

    return NextResponse.json({ ticker, troughs, oneYearLow });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
