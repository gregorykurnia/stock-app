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

async function fetchEMA20(ticker: string): Promise<number | null> {
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: twoYearsAgo, period2: now, interval: "1wk" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closes = (result?.quotes ?? []).filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null).map((q: any) => q.close as number);
  return calcEMA(closes, 20);
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const result: Record<string, number | null> = {};

  // Fetch in parallel, cap concurrency at 5
  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        result[ticker] = await fetchEMA20(ticker);
      } catch {
        result[ticker] = null;
      }
    }));
  }

  return NextResponse.json({ ema20: result });
}
