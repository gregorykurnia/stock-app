// Server-only (Node runtime) helpers built on yahoo-finance2. Do not import from client components.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance();

function dateInNewYork(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface SnapshotQuote {
  price: number | null;
  marketTime: string | null;
  marketDate: string | null;
}

export async function fetchSnapshotQuotes(tickers: string[]): Promise<Record<string, SnapshotQuote>> {
  const result: Record<string, SnapshotQuote> = {};
  const unique = [...new Set(tickers)];
  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    await Promise.all(unique.slice(i, i + chunkSize).map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const quote: any = await yf.quote(ticker);
        const marketTime = quote?.regularMarketTime ? new Date(quote.regularMarketTime).toISOString() : null;
        result[ticker] = {
          price: quote?.regularMarketPrice ?? null,
          marketTime,
          marketDate: marketTime ? dateInNewYork(new Date(marketTime)) : null,
        };
      } catch {
        result[ticker] = { price: null, marketTime: null, marketDate: null };
      }
    }));
  }
  return result;
}

export async function fetchQuotes(tickers: string[]): Promise<{
  prices: Record<string, number | null>;
  preMarketPrices: Record<string, number | null>;
  previousCloses: Record<string, number | null>;
}> {
  const prices: Record<string, number | null> = {};
  const preMarket: Record<string, number | null> = {};
  const previousCloses: Record<string, number | null> = {};

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
          previousCloses[ticker] = q?.regularMarketPreviousClose ?? null;
        } catch {
          prices[ticker] = null;
          preMarket[ticker] = null;
          previousCloses[ticker] = null;
        }
      })
    );
  }

  return { prices, preMarketPrices: preMarket, previousCloses };
}

// Returns next/last earnings date per ticker as "YYYY-MM-DD" (ET calendar date), or null if unknown.
export async function fetchEarningsDates(tickers: string[]): Promise<Record<string, string | null>> {
  const dates: Record<string, string | null> = {};

  const chunkSize = 10;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ticker) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q: any = await yf.quoteSummary(ticker, { modules: ["calendarEvents"] });
          const d: Date | undefined = q?.calendarEvents?.earnings?.earningsDate?.[0];
          dates[ticker] = d ? new Date(d).toISOString().slice(0, 10) : null;
        } catch {
          dates[ticker] = null;
        }
      })
    );
  }

  return dates;
}
