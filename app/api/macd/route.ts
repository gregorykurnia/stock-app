import { NextRequest, NextResponse } from "next/server";
import { calculateMACD } from "@/lib/indicators";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchMACD(ticker: string) {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: oneYearAgo, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closes = (result?.quotes ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any) => q.close as number | null)
    .filter((c: number | null): c is number => c != null && !isNaN(c));

  return calculateMACD(closes);
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const macd: Record<string, number | null> = {};
  const signal: Record<string, number | null> = {};
  const histogram: Record<string, number | null> = {};
  const histDirection: Record<string, "up" | "down" | "flat" | null> = {};

  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        const r = await fetchMACD(ticker);
        macd[ticker] = r?.macd ?? null;
        signal[ticker] = r?.signal ?? null;
        histogram[ticker] = r?.histogram ?? null;
        histDirection[ticker] = r?.histDirection ?? null;
      } catch {
        macd[ticker] = null;
        signal[ticker] = null;
        histogram[ticker] = null;
        histDirection[ticker] = null;
      }
    }));
  }

  return NextResponse.json({ macd, signal, histogram, histDirection });
}
