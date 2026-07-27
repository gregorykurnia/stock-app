import { NextRequest, NextResponse } from "next/server";
import { calculateBandarScore, type BandarScoreResult } from "@/lib/indicators";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchBandarScore(ticker: string): Promise<BandarScoreResult | null> {
  const now = new Date();
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: twoMonthsAgo, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars = (result?.quotes ?? []).map((q: any) => ({
    open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
  }));

  return calculateBandarScore(bars);
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const bandar: Record<string, BandarScoreResult | null> = {};

  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        bandar[ticker] = await fetchBandarScore(ticker);
      } catch {
        bandar[ticker] = null;
      }
    }));
  }

  return NextResponse.json({ bandar });
}
