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

export interface LatestCloseQuote {
  price: number | null;
  marketDate: string | null;
}

function latestCompletedNewYorkDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const cutoff = new Date(`${date}T00:00:00Z`);
  if (Number(get("hour")) < 16) cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  return cutoff.toISOString().slice(0, 10);
}

/** Fetches the most recent completed daily close, avoiding an in-progress market candle. */
export async function fetchLatestCloseQuotes(tickers: string[]): Promise<Record<string, LatestCloseQuote>> {
  const result: Record<string, LatestCloseQuote> = {};
  const unique = [...new Set(tickers.map((ticker) => ticker.toUpperCase()))];
  const cutoffDate = latestCompletedNewYorkDate();
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const ticker = unique[next];
      next += 1;
      try {
        const period1 = new Date(`${cutoffDate}T00:00:00Z`);
        period1.setUTCDate(period1.getUTCDate() - 20);
        const period2 = new Date(`${cutoffDate}T00:00:00Z`);
        period2.setUTCDate(period2.getUTCDate() + 2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart: any = await yf.chart(ticker, { period1, period2, interval: "1d", return: "array" });
        const quotes = (Array.isArray(chart?.quotes) ? chart.quotes : []) as { date?: unknown; close?: unknown }[];
        const bars = quotes.flatMap((quote) => {
          if (quote.date == null || typeof quote.close !== "number" || !Number.isFinite(quote.close) || quote.close <= 0) return [];
          const timestamp = quote.date instanceof Date ? quote.date : new Date(quote.date as string | number);
          if (Number.isNaN(timestamp.getTime())) return [];
          const date = timestamp.toISOString().slice(0, 10);
          return date <= cutoffDate ? [{ date, close: quote.close }] : [];
        }).sort((left, right) => left.date.localeCompare(right.date));
        const latest = bars.at(-1);
        result[ticker] = { price: latest?.close ?? null, marketDate: latest?.date ?? null };
      } catch {
        result[ticker] = { price: null, marketDate: null };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, worker));
  return result;
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

/**
 * Fetches daily closes for a stored US session date. This is used only for
 * authenticated historical snapshot recapture; a missing close stays missing
 * so the rebuilt snapshot remains partial instead of inventing a value.
 */
export async function fetchHistoricalSnapshotQuotes(
  tickers: string[],
  sessionDate: string,
): Promise<Record<string, SnapshotQuote>> {
  const result: Record<string, SnapshotQuote> = {};
  const period1 = new Date(`${sessionDate}T00:00:00.000Z`);
  period1.setUTCDate(period1.getUTCDate() - 3);
  const period2 = new Date(`${sessionDate}T00:00:00.000Z`);
  period2.setUTCDate(period2.getUTCDate() + 4);
  const unique = [...new Set(tickers)];
  const chunkSize = 10;

  for (let i = 0; i < unique.length; i += chunkSize) {
    await Promise.all(unique.slice(i, i + chunkSize).map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart: any = await yf.chart(ticker, { period1, period2, interval: "1d" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matching = (chart?.quotes ?? []).filter((quote: any) => (
          quote?.date && (ticker === "IDR=X"
            ? new Date(quote.date).toISOString().slice(0, 10)
            : dateInNewYork(new Date(quote.date))) === sessionDate
          && typeof quote.close === "number" && Number.isFinite(quote.close) && quote.close > 0
        ));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const quote: any = matching.sort((left: any, right: any) => new Date(left.date).getTime() - new Date(right.date).getTime()).at(-1);
        const marketTime = quote?.date ? new Date(quote.date).toISOString() : null;
        result[ticker] = {
          price: quote?.close ?? null,
          marketTime,
          marketDate: marketTime ? sessionDate : null,
        };
      } catch {
        result[ticker] = { price: null, marketTime: null, marketDate: null };
      }
    }));
  }

  return result;
}

/** Actual published US daily bars exclude weekends and exchange holidays. Fail on provider errors. */
export async function fetchPortfolioSessionDates(start: string, end: string): Promise<string[]> {
  if (start > end) return [];
  const period2 = new Date(`${end}T00:00:00Z`);
  period2.setUTCDate(period2.getUTCDate() + 1);
  const chart = await yf.chart("SPY", {
    period1: new Date(`${start}T00:00:00Z`), period2, interval: "1d", return: "array",
  });
  const dates = (chart.quotes ?? []).flatMap((quote: { date: Date; close: number | null }) => {
    if (quote.close == null || !Number.isFinite(quote.close) || quote.close <= 0) return [];
    const date = dateInNewYork(new Date(quote.date));
    return date >= start && date <= end ? [date] : [];
  });
  if (dates.length === 0) throw new Error("US trading-session history is unavailable");
  return [...new Set<string>(dates)].sort();
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
