import { NextRequest, NextResponse } from "next/server";
import { calculateATR } from "@/lib/indicators";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchATR(ticker: string) {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: oneYearAgo, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars = (result?.quotes ?? []).map((q: any) => ({ high: q.high, low: q.low, close: q.close }));

  return calculateATR(bars, 14);
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const atr: Record<string, number | null> = {};
  const stopLoss: Record<string, number | null> = {};
  const stopLossPercent: Record<string, number | null> = {};

  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        const r = await fetchATR(ticker);
        atr[ticker] = r?.atr ?? null;
        stopLoss[ticker] = r?.stopLoss ?? null;
        stopLossPercent[ticker] = r?.stopLossPercent ?? null;
      } catch {
        atr[ticker] = null;
        stopLoss[ticker] = null;
        stopLossPercent[ticker] = null;
      }
    }));
  }

  return NextResponse.json({ atr, stopLoss, stopLossPercent });
}
