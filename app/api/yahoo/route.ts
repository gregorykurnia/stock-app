import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const twoYearsAgo = now - 2 * 365 * 24 * 3600;

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&period1=${twoYearsAgo}&period2=${now}`;

  const res = await fetch(yahooUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return NextResponse.json({ error: `Yahoo returned ${res.status}` }, { status: 502 });

  const data = await res.json();

  const result = data?.chart?.result?.[0];
  if (!result) return NextResponse.json({ error: "no data" }, { status: 404 });

  const timestamps: number[] = result.timestamp;
  const q = result.indicators.quote[0];
  const bars = timestamps.map((t: number, i: number) => ({
    time: t,
    open: q.open[i],
    high: q.high[i],
    low: q.low[i],
    close: q.close[i],
    volume: q.volume[i],
  })).filter((b: { open: number; high: number; low: number; close: number; volume: number }) =>
    b.open != null && b.high != null && b.low != null && b.close != null && b.volume != null
  );

  return NextResponse.json({ bars });
}
