import type { OHLCVBar } from "./types";

export async function fetchWeeklyBars(ticker: string): Promise<OHLCVBar[]> {
  const now = Math.floor(Date.now() / 1000);
  const twoYearsAgo = now - 2 * 365 * 24 * 3600;

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&period1=${twoYearsAgo}&period2=${now}&events=none`;
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch data (${res.status})`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No data returned for this ticker");

  const timestamps: number[] = result.timestamp;
  const q = result.indicators.quote[0];

  return timestamps
    .map((t: number, i: number) => ({
      time: t,
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume[i],
    }))
    .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null && b.volume != null);
}
