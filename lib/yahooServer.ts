// Server-only (Node runtime) helpers built on yahoo-finance2. Do not import from client components.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance();

export async function fetchQuotes(tickers: string[]): Promise<{
  prices: Record<string, number | null>;
  preMarketPrices: Record<string, number | null>;
}> {
  const prices: Record<string, number | null> = {};
  const preMarket: Record<string, number | null> = {};

  const chunkSize = 10;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ticker) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q: any = await yf.quote(ticker);
          prices[ticker] = q?.regularMarketPrice ?? null;
          preMarket[ticker] = q?.preMarketPrice ?? null;
        } catch {
          prices[ticker] = null;
          preMarket[ticker] = null;
        }
      })
    );
  }

  return { prices, preMarketPrices: preMarket };
}
