import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/yahooServer";

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const { prices, preMarketPrices, previousCloses } = await fetchQuotes(tickers);

  return NextResponse.json({ prices, preMarketPrices, previousCloses });
}
