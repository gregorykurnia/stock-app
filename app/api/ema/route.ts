import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function calcEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

interface EMAResult {
  ema20: number | null;
  ema50: number | null;
  ath: number | null;
  supportLow: number | null;
  atrPct: number | null;
}

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

async function fetchEMAs(ticker: string): Promise<EMAResult> {
  const now = new Date();
  const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: threeYearsAgo, period2: now, interval: "1wk" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result?.quotes ?? []).filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closes = quotes.map((q: any) => q.close as number);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ath = quotes.length > 0 ? Math.max(...quotes.map((q: any) => q.high as number)) : null;
  const last52 = quotes.slice(-52);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supportLow = last52.length > 0 ? Math.min(...last52.map((q: any) => q.close as number)) : null;
  const atrPct = calcATRPct(quotes, 14);
  return { ema20: calcEMA(closes, 20), ema50: calcEMA(closes, 50), ath, supportLow, atrPct };
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const ema20: Record<string, number | null> = {};
  const ema50: Record<string, number | null> = {};
  const ath: Record<string, number | null> = {};
  const supportLow: Record<string, number | null> = {};
  const atrPct: Record<string, number | null> = {};

  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        const r = await fetchEMAs(ticker);
        ema20[ticker] = r.ema20;
        ema50[ticker] = r.ema50;
        ath[ticker] = r.ath;
        supportLow[ticker] = r.supportLow;
        atrPct[ticker] = r.atrPct;
      } catch {
        ema20[ticker] = null;
        ema50[ticker] = null;
        ath[ticker] = null;
        supportLow[ticker] = null;
        atrPct[ticker] = null;
      }
    }));
  }

  return NextResponse.json({ ema20, ema50, ath, supportLow, atrPct });
}
