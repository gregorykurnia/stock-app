import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance();

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: Record<string, number | null> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preMarket: Record<string, number | null> = {};

  // Batch in chunks of 10 to avoid rate limits
  const chunkSize = 10;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ticker) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q: any = await yf.quote(ticker);
          results[ticker] = q?.regularMarketPrice ?? null;
          preMarket[ticker] = q?.preMarketPrice ?? null;
        } catch {
          results[ticker] = null;
          preMarket[ticker] = null;
        }
      })
    );
  }

  return NextResponse.json({ prices: results, preMarketPrices: preMarket });
}
