import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const now = new Date();
  const fetchStart = new Date(now.getTime());
  fetchStart.setMonth(fetchStart.getMonth() - 20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker.toUpperCase(), {
    period1: fetchStart,
    period2: now,
    interval: "1d",
  });

  if (!result?.quotes?.length) {
    return NextResponse.json({ error: "no data" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars = result.quotes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume,
    }));

  return NextResponse.json({ bars });
}
