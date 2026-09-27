import { NextRequest, NextResponse } from "next/server";
import { fetchLatestCloseQuotes } from "@/lib/yahooServer";

export const runtime = "nodejs";

const MAX_TICKERS = 40;

export async function GET(request: NextRequest) {
  const rawSymbols = request.nextUrl.searchParams.get("tickers");
  if (!rawSymbols) return NextResponse.json({ error: "tickers parameter is required" }, { status: 400 });
  const requestedTickers = [...new Set(rawSymbols.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  const tickers = [...new Set([...requestedTickers, "IDR=X"])];
  if (requestedTickers.length === 0 || tickers.length > MAX_TICKERS || tickers.some((ticker) => !/^[A-Z0-9.^=_-]{1,20}$/.test(ticker))) {
    return NextResponse.json({ error: `Provide up to ${MAX_TICKERS - 1} valid ticker symbols` }, { status: 400 });
  }

  const quotes = await fetchLatestCloseQuotes(tickers);
  const asOfDate = requestedTickers
    .flatMap((ticker) => quotes[ticker]?.marketDate ? [quotes[ticker].marketDate as string] : [])
    .sort()
    .at(-1) ?? null;
  return NextResponse.json({
    quotes,
    asOfDate,
    source: "Yahoo Finance completed daily close",
    fetchedAt: new Date().toISOString(),
  });
}
