import { NextRequest, NextResponse } from "next/server";
import type { DividendObservation, PriceObservation, TickerHistory } from "@/lib/performanceReturns";

// Yahoo Finance access stays server-side; the client only receives normalized history.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export const runtime = "nodejs";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_TICKERS = 40;
const historyCache = new Map<string, { history: TickerHistory; cachedAt: number }>();
const inFlight = new Map<string, Promise<TickerHistory>>();

function toDateString(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function errorHistory(ticker: string, message: string): TickerHistory {
  return {
    ticker, name: null, currency: null, bars: [], dividends: [],
    dividendDataAvailable: false, priceDataAvailable: false, providerAvailable: false, error: message,
  };
}

async function fetchTickerHistory(ticker: string): Promise<TickerHistory> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yahooFinance.chart(ticker, {
      period1: new Date("2015-12-01T00:00:00.000Z"),
      period2: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      interval: "1d",
      events: "split",
      return: "array",
    });
    const quotes = (Array.isArray(result?.quotes) ? result.quotes : []) as { date?: unknown; close?: unknown }[];
    const bars: PriceObservation[] = quotes.flatMap((quote) => {
      const date = toDateString(quote?.date);
      return date && isPositiveNumber(quote?.close) ? [{ date, close: quote.close }] : [];
    }).sort((left, right) => left.date.localeCompare(right.date));
    let dividends: DividendObservation[] = [];
    let dividendDataAvailable = ticker === "IDR=X";
    if (ticker !== "IDR=X") {
      try {
        // Fetch dividend events separately so an unavailable events response cannot
        // be mistaken for a confirmed non-dividend payer.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dividendEvents: any = await yahooFinance.historical(ticker, {
          period1: new Date("2015-12-01T00:00:00.000Z"),
          period2: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          events: "dividends",
        });
        if (Array.isArray(dividendEvents)) {
          dividends = dividendEvents.flatMap((event: { date?: unknown; dividends?: unknown }) => {
            const date = toDateString(event?.date);
            const amount = event?.dividends;
            return date && typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? [{ date, amount }] : [];
          }).sort((left, right) => left.date.localeCompare(right.date));
          dividendDataAvailable = true;
        }
      } catch {
        dividendDataAvailable = false;
      }
    }
    return {
      ticker,
      name: typeof result?.meta?.longName === "string"
        ? result.meta.longName
        : typeof result?.meta?.shortName === "string" ? result.meta.shortName : null,
      currency: typeof result?.meta?.currency === "string" ? result.meta.currency : null,
      bars,
      dividends,
      dividendDataAvailable,
      priceDataAvailable: bars.length > 0,
      providerAvailable: true,
      error: bars.length > 0 ? null : "No price history from Yahoo Finance; ticker may be invalid or delisted.",
    };
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message.replace(/https?:\/\/\S+/g, "provider URL").slice(0, 140)
      : "Yahoo Finance request failed";
    return errorHistory(ticker, message);
  }
}

async function getTickerHistory(ticker: string, refresh: boolean): Promise<TickerHistory> {
  const cached = historyCache.get(ticker);
  if (!refresh && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.history;
  if (!refresh) {
    const existing = inFlight.get(ticker);
    if (existing) return existing;
  }
  const request = fetchTickerHistory(ticker);
  if (!refresh) inFlight.set(ticker, request);
  const history = await request;
  historyCache.set(ticker, { history, cachedAt: Date.now() });
  if (inFlight.get(ticker) === request) inFlight.delete(ticker);
  return history;
}

export async function GET(request: NextRequest) {
  const rawSymbols = request.nextUrl.searchParams.get("tickers");
  if (!rawSymbols) return NextResponse.json({ error: "tickers parameter is required" }, { status: 400 });
  const tickers = [...new Set(rawSymbols.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (tickers.length === 0 || tickers.length > MAX_TICKERS || tickers.some((ticker) => !/^[A-Z0-9.^=_-]{1,20}$/.test(ticker))) {
    return NextResponse.json({ error: `Provide 1 to ${MAX_TICKERS} valid ticker symbols` }, { status: 400 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const fxHistoryRequest = tickers.includes("IDR=X") ? null : getTickerHistory("IDR=X", refresh);
  const histories: TickerHistory[] = new Array(tickers.length);
  let next = 0;
  const worker = async () => {
    while (next < tickers.length) {
      const index = next;
      next += 1;
      histories[index] = await getTickerHistory(tickers[index], refresh);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, tickers.length) }, worker));

  const fxHistory = histories.find((history) => history.ticker === "IDR=X")
    ?? (fxHistoryRequest ? await fxHistoryRequest : errorHistory("IDR=X", "USD/IDR history is unavailable."));
  const asOfDate = histories
    .filter((history) => history.ticker !== "IDR=X")
    .flatMap((history) => history.bars.map((bar) => bar.date))
    .sort()
    .at(-1) ?? null;
  const fxAsOfDate = fxHistory.bars.map((bar) => bar.date).sort().at(-1) ?? null;
  return NextResponse.json({
    histories,
    fxHistory,
    source: "Yahoo Finance via yahoo-finance2",
    fetchedAt: new Date().toISOString(),
    asOfDate,
    fxAsOfDate,
    cacheTtlMinutes: CACHE_TTL_MS / 60_000,
  });
}
