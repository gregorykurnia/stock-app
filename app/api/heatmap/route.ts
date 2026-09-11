import { NextRequest, NextResponse } from "next/server";
import { SP500_AS_OF, SP500_CONSTITUENTS, toYahooSymbol } from "@/lib/heatmap/constituents";
import {
  computeReturnsFromBars, deriveDataStatus, dollarVolume, marketSessionAt,
  relativeVolume,
} from "@/lib/heatmap/calculations";
import type { HeatmapHistoryResponse, HeatmapResponse, HeatmapStock } from "@/lib/heatmap/types";
import { positionInRange, smaAt } from "@/lib/markets/calc";

// Server-only Yahoo provider for the S&P 500 heatmap. The browser only ever
// talks to this route; individual provider failures stay attached to their
// symbol so an incomplete provider response never blanks the whole market.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export const runtime = "nodejs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_DAYS = 390;
const QUOTE_CHUNK_SIZE = 40;
const CHART_CONCURRENCY = 10;

interface QuoteData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  timestamp: string | null;
  quoteSource: string | null;
}

interface HistoryBar {
  date: string;
  close: number;
  high: number | null;
  low: number | null;
  volume: number | null;
}

interface ChartData {
  bars: HistoryBar[];
  metaPrice: number | null;
  metaTimestamp: string | null;
  error: string | null;
}

interface SnapshotEntry {
  data: HeatmapResponse;
  histories: Map<string, HistoryBar[]>;
  ts: number;
}

let snapshotCache: SnapshotEntry | null = null;
let snapshotInFlight: Promise<SnapshotEntry> | null = null;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  if (numberValue > 1e12) return new Date(numberValue).toISOString();
  if (numberValue > 1e9) return new Date(numberValue * 1000).toISOString();
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function quoteData(raw: any): QuoteData {
  return {
    price: finite(raw?.regularMarketPrice) ? raw.regularMarketPrice : null,
    previousClose: finite(raw?.regularMarketPreviousClose) ? raw.regularMarketPreviousClose : null,
    marketCap: finite(raw?.marketCap) ? raw.marketCap : null,
    volume: finite(raw?.regularMarketVolume) ? raw.regularMarketVolume : null,
    averageVolume: finite(raw?.averageDailyVolume3Month) ? raw.averageDailyVolume3Month : null,
    timestamp: toIso(raw?.regularMarketTime),
    quoteSource: typeof raw?.quoteSourceName === "string" ? raw.quoteSourceName : null,
  };
}

async function fetchQuotes(symbols: string[]): Promise<Map<string, QuoteData>> {
  const result = new Map<string, QuoteData>();
  for (let offset = 0; offset < symbols.length; offset += QUOTE_CHUNK_SIZE) {
    const chunk = symbols.slice(offset, offset + QUOTE_CHUNK_SIZE);
    try {
      // yahoo-finance2's batch response follows request order for valid symbols.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = await yf.quote(chunk) as any;
      if (Array.isArray(values) && values.length === chunk.length) {
        chunk.forEach((symbol, index) => result.set(symbol, quoteData(values[index])));
        continue;
      }
    } catch {
      // A malformed or renamed member can make the whole batch fail. Retry the
      // small chunk per symbol rather than losing forty valid quotes.
    }
    await Promise.all(chunk.map(async (symbol) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.set(symbol, quoteData(await yf.quote(symbol) as any));
      } catch {
        result.set(symbol, { price: null, previousClose: null, marketCap: null, volume: null, averageVolume: null, timestamp: null, quoteSource: null });
      }
    }));
  }
  return result;
}

async function fetchChart(symbol: string): Promise<ChartData> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await yf.chart(symbol, {
      period1: new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000),
      period2: new Date(), interval: "1d",
    });
    const bars: HistoryBar[] = (raw?.quotes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((bar: any) => bar?.date != null && finite(bar?.close))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((bar: any) => ({
        date: new Date(bar.date).toISOString().slice(0, 10), close: bar.close,
        high: finite(bar.high) ? bar.high : null, low: finite(bar.low) ? bar.low : null,
        volume: finite(bar.volume) ? bar.volume : null,
      }));
    if (!bars.length) return { bars: [], metaPrice: null, metaTimestamp: null, error: "no history from provider" };
    return {
      bars,
      metaPrice: finite(raw?.meta?.regularMarketPrice) ? raw.meta.regularMarketPrice : null,
      metaTimestamp: toIso(raw?.meta?.regularMarketTime),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 140) : "provider request failed";
    return { bars: [], metaPrice: null, metaTimestamp: null, error: message };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function rangeFromBars(bars: HistoryBar[]): { high: number; low: number } | null {
  if (!bars.length) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const bar of bars) {
    // Use session high/low when supplied. Close is a safe fallback.
    high = Math.max(high, bar.high ?? bar.close);
    low = Math.min(low, bar.low ?? bar.close);
  }
  return Number.isFinite(high) && Number.isFinite(low) ? { high, low } : null;
}

function buildStock(index: number, quote: QuoteData | undefined, chart: ChartData): HeatmapStock {
  const constituent = SP500_CONSTITUENTS[index];
  const latestBar = chart.bars.at(-1);
  const price = quote?.price ?? chart.metaPrice ?? latestBar?.close ?? null;
  const previousClose = quote?.previousClose ?? (chart.bars.length > 1 ? chart.bars.at(-2)?.close ?? null : null);
  const closes = chart.bars.map((bar) => bar.close);
  const range = rangeFromBars(chart.bars);
  const averageVolume = quote?.averageVolume ?? null;
  const volume = quote?.volume ?? latestBar?.volume ?? null;
  return {
    symbol: constituent.symbol,
    companyName: constituent.companyName,
    sector: constituent.sector,
    industry: constituent.industry,
    price,
    previousClose,
    returns: computeReturnsFromBars(chart.bars, price, previousClose),
    marketCap: quote?.marketCap ?? null,
    volume,
    averageVolume,
    relativeVolume: relativeVolume(volume, averageVolume),
    dollarVolume: dollarVolume(price, volume),
    high52Week: range?.high ?? null,
    low52Week: range?.low ?? null,
    position52Week: positionInRange(price, range?.low ?? null, range?.high ?? null),
    ma20: smaAt(closes, 20),
    ma50: smaAt(closes, 50),
    ma200: smaAt(closes, 200),
    timestamp: quote?.timestamp ?? chart.metaTimestamp,
    quoteSource: quote?.quoteSource ?? null,
    error: price == null ? chart.error ?? "no data from provider" : undefined,
  };
}

async function fetchSnapshot(): Promise<SnapshotEntry> {
  const symbols = SP500_CONSTITUENTS.map((item) => item.symbol);
  const [quotes, charts, benchmarkQuoteRows, benchmarkChart] = await Promise.all([
    fetchQuotes(symbols),
    mapWithConcurrency(symbols, CHART_CONCURRENCY, fetchChart),
    fetchQuotes(["^GSPC"]),
    fetchChart("^GSPC"),
  ]);
  const stocks = symbols.map((symbol, index) => buildStock(index, quotes.get(symbol), charts[index]));
  const benchmarkQuote = benchmarkQuoteRows.get("^GSPC");
  const benchmarkPrice = benchmarkQuote?.price ?? benchmarkChart.metaPrice ?? benchmarkChart.bars.at(-1)?.close ?? null;
  const benchmarkPreviousClose = benchmarkQuote?.previousClose ?? benchmarkChart.bars.at(-2)?.close ?? null;
  const fetchedAt = new Date().toISOString();
  const errors = stocks.flatMap((stock) => stock.error ? [{ symbol: stock.symbol, message: stock.error }] : []);
  const quoteTimes = stocks.flatMap((stock) => stock.timestamp ? [new Date(stock.timestamp).getTime()] : []).filter(Number.isFinite);
  const newestQuoteAgeMs = quoteTimes.length ? Math.max(0, Date.now() - Math.max(...quoteTimes)) : null;
  const delayedQuoteCount = stocks.filter((stock) => stock.quoteSource?.toLowerCase().includes("delay")).length;
  const data: HeatmapResponse = {
    fetchedAt,
    cacheHit: false,
    stale: false,
    session: marketSessionAt(new Date()),
    status: deriveDataStatus({
      totalStocks: stocks.length, errorCount: errors.length, snapshotAgeMs: 0, newestQuoteAgeMs,
      delayedShare: stocks.length ? delayedQuoteCount / stocks.length : 0,
    }),
    constituentsAsOf: SP500_AS_OF,
    benchmark: {
      symbol: "^GSPC", label: "S&P 500", price: benchmarkPrice, previousClose: benchmarkPreviousClose,
      returns: computeReturnsFromBars(benchmarkChart.bars, benchmarkPrice, benchmarkPreviousClose),
    },
    stocks, errors, delayedQuoteCount,
  };
  return { data, histories: new Map(symbols.map((symbol, index) => [symbol, charts[index].bars])), ts: Date.now() };
}

function headers(forceRefresh = false): HeadersInit {
  return { "Cache-Control": forceRefresh ? "no-store" : "public, s-maxage=300, stale-while-revalidate=600" };
}

function cachedResponse(entry: SnapshotEntry, refreshFailed?: string): NextResponse {
  const snapshotAgeMs = Date.now() - entry.ts;
  const quoteTimes = entry.data.stocks.flatMap((stock) => stock.timestamp ? [new Date(stock.timestamp).getTime()] : []).filter(Number.isFinite);
  const newestQuoteAgeMs = quoteTimes.length ? Math.max(0, Date.now() - Math.max(...quoteTimes)) : null;
  const data: HeatmapResponse = {
    ...entry.data,
    cacheHit: true,
    stale: Boolean(refreshFailed) || snapshotAgeMs > CACHE_TTL_MS,
    refreshFailed,
    status: deriveDataStatus({
      totalStocks: entry.data.stocks.length, errorCount: entry.data.errors.length, snapshotAgeMs,
      newestQuoteAgeMs, delayedShare: entry.data.stocks.length ? entry.data.delayedQuoteCount / entry.data.stocks.length : 0,
    }),
  };
  return NextResponse.json(data, { headers: headers(Boolean(refreshFailed)) });
}

async function snapshotResponse(forceRefresh: boolean): Promise<NextResponse> {
  if (!forceRefresh && snapshotCache && Date.now() - snapshotCache.ts <= CACHE_TTL_MS) return cachedResponse(snapshotCache);
  const previous = snapshotCache;
  let inFlight = snapshotInFlight;
  if (forceRefresh || !inFlight) {
    inFlight = fetchSnapshot();
    snapshotInFlight = inFlight;
    inFlight.finally(() => { if (snapshotInFlight === inFlight) snapshotInFlight = null; }).catch(() => undefined);
  }
  try {
    const entry = await inFlight;
    snapshotCache = entry;
    return NextResponse.json(entry.data, { headers: headers(forceRefresh) });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 140) : "provider refresh failed";
    if (previous) return cachedResponse(previous, message);
    return NextResponse.json({ error: "Market data could not be loaded. Try again shortly." }, { status: 502, headers: headers(forceRefresh) });
  }
}

function historyResponse(rawSymbol: string | null): NextResponse {
  const symbol = rawSymbol ? toYahooSymbol(rawSymbol) : "";
  if (!symbol || !SP500_CONSTITUENTS.some((item) => item.symbol === symbol)) {
    return NextResponse.json({ error: "Unknown S&P 500 symbol." }, { status: 400 });
  }
  const bars = snapshotCache?.histories.get(symbol);
  if (!bars) return NextResponse.json({ error: "Load the heatmap before requesting stock history." }, { status: 409 });
  const response: HeatmapHistoryResponse = {
    symbol, bars: bars.map((bar) => ({ date: bar.date, close: bar.close })), fetchedAt: snapshotCache!.data.fetchedAt,
  };
  return NextResponse.json(response, { headers: headers() });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.has("history")) return historyResponse(params.get("history"));
  try {
    return await snapshotResponse(params.get("refresh") === "1");
  } catch (error) {
    console.error("[api/heatmap] unexpected request failure:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Heatmap data request failed." }, { status: 500 });
  }
}
