import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const twoYearsAgo = now - 2 * 365 * 24 * 3600;

  // Try query1 first, fall back to query2
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&period1=${twoYearsAgo}&period2=${now}&events=none`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&period1=${twoYearsAgo}&period2=${now}&events=none`,
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/",
  };

  let data = null;
  for (const url of urls) {
    const res = await fetch(url, { headers });
    if (res.ok) {
      data = await res.json();
      break;
    }
  }

  if (!data) return NextResponse.json({ error: "Failed to fetch from Yahoo Finance" }, { status: 502 });

  const result = data?.chart?.result?.[0];
  if (!result) return NextResponse.json({ error: "No data returned for this ticker" }, { status: 404 });

  const timestamps: number[] = result.timestamp;
  const q = result.indicators.quote[0];

  const bars = timestamps
    .map((t: number, i: number) => ({
      time: t,
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume[i],
    }))
    .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null && b.volume != null);

  return NextResponse.json({ bars });
}
