import { NextRequest, NextResponse } from "next/server";
import { MARKET_INSTRUMENTS, INSTRUMENT_BY_ID } from "@/lib/markets/instruments";
import type { InstrumentDefinition } from "@/lib/markets/types";
import {
  periodReturnPct,
  pctChange,
  positionInRange,
  previousCloseFromBars,
  rangeOverBars,
  returnTargets,
  smaAt,
  sparklineFromBars,
  trendFromCloses,
  type HistoryBar,
} from "@/lib/markets/calc";
import type {
  DetailRange,
  MarketDetailResponse,
  MarketInstrument,
  MarketsSnapshotResponse,
} from "@/lib/markets/types";

// Server-only (Node runtime) market data endpoint for /markets, built directly on
// yahoo-finance2 like the other routes in this app. Do not import from client components.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// - One snapshot fetch covers every catalog instrument: batched quotes (for the
//   authoritative price / previous close / timestamp) plus one 370-day daily chart
//   per symbol (for returns, moving averages, 52-week range, trend, sparkline).
// - Results are cached in memory for 5 minutes per server instance; `?refresh=1`
//   bypasses the cache read and forces a fresh fetch.
// - Individual symbol failures never fail the request — the affected instruments
//   come back with an `error` field and everything else renders normally.
// - `?detail=<instrumentId>&range=1M|3M|6M|1Y|5Y` returns full daily closes for
//   one instrument (used by the inline detail chart).

const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const QUOTE_CHUNK_SIZE = 12;
const CHART_CONCURRENCY = 6;
// 52 weeks plus buffer so MA20/MA50, YTD, and the 52-week range all have data.
const HISTORY_DAYS = 370;

const DETAIL_RANGE_DAYS: Record<DetailRange, number> = {
  "1M": 31, "3M": 92, "6M": 183, "1Y": 365, "5Y": 1826,
};

interface QuoteData {
  price: number | null;
  previousClose: number | null;
  timestamp: string | null;
  quoteSource: string | null;
  name: string | null;
}

interface ChartData {
  bars: HistoryBar[];
  metaPrice: number | null;
  metaTimestamp: string | null;
  error: string | null;
}

let snapshotCache: { data: MarketsSnapshotResponse; ts: number } | null = null;
let snapshotInFlight: Promise<MarketsSnapshotResponse> | null = null;
const detailCache = new Map<string, { data: MarketDetailResponse; ts: number }>();

// Yahoo timestamps arrive as Date objects or epoch seconds/millis depending on
// the endpoint — normalize defensively to ISO.
function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > 1e12) return new Date(num).toISOString();
  if (num > 1e9) return new Date(num * 1000).toISOString();
  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toQuoteData(quote: any): QuoteData {
  return {
    price: isFiniteNumber(quote?.regularMarketPrice) ? quote.regularMarketPrice : null,
    previousClose: isFiniteNumber(quote?.regularMarketPreviousClose) ? quote.regularMarketPreviousClose : null,
    timestamp: toIso(quote?.regularMarketTime),
    quoteSource: typeof quote?.quoteSourceName === "string" ? quote.quoteSourceName : null,
    name: typeof quote?.shortName === "string" ? quote.shortName : null,
  };
}

async function fetchQuotes(symbols: string[]): Promise<Record<string, QuoteData>> {
  const quotes: Record<string, QuoteData> = {};

  for (let i = 0; i < symbols.length; i += QUOTE_CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + QUOTE_CHUNK_SIZE);
    let chunkResults: unknown[] | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chunkResults = (await yf.quote(chunk)) as any;
    } catch {
      chunkResults = null;
    }
    if (Array.isArray(chunkResults) && chunkResults.length === chunk.length) {
      chunk.forEach((symbol, index) => { quotes[symbol] = toQuoteData(chunkResults![index]); });
      continue;
    }
    // A single bad symbol fails schema validation for the whole batch — retry
    // individually so the rest of the chunk survives.
    await Promise.all(chunk.map(async (symbol) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quotes[symbol] = toQuoteData(await yf.quote(symbol) as any);
      } catch {
        quotes[symbol] = { price: null, previousClose: null, timestamp: null, quoteSource: null, name: null };
      }
    }));
  }

  return quotes;
}

async function fetchChart(symbol: string, days: number): Promise<ChartData> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.chart(symbol, {
      period1: new Date(Date.now() - days * 24 * 3600 * 1000),
      period2: new Date(),
      interval: "1d",
    });
    const bars: HistoryBar[] = (result?.quotes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q?.date != null && isFiniteNumber(q?.close))
      .map((q: { date: Date | string; close: number }) => ({
        date: new Date(q.date).toISOString().slice(0, 10),
        close: q.close,
      }));
    if (bars.length === 0) return { bars: [], metaPrice: null, metaTimestamp: null, error: "no history from provider" };
    return {
      bars,
      metaPrice: isFiniteNumber(result?.meta?.regularMarketPrice) ? result.meta.regularMarketPrice : null,
      metaTimestamp: toIso(result?.meta?.regularMarketTime),
      error: null,
    };
  } catch (err) {
    // Never surface provider stack traces to the client.
    const message = err instanceof Error && err.message ? err.message.slice(0, 120) : "provider request failed";
    return { bars: [], metaPrice: null, metaTimestamp: null, error: message };
  }
}

// Runs async tasks with a fixed concurrency limit — no request waterfalls, but no
// 45-way burst against the provider either.
async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function buildInstrument(definition: InstrumentDefinition, quote: QuoteData | undefined, chart: ChartData): MarketInstrument {
  const bars = chart.bars;
  const closes = bars.map((bar) => bar.close);
  const lastBar = bars.at(-1) ?? null;

  const price = quote?.price ?? chart.metaPrice ?? lastBar?.close ?? null;
  const previousClose = quote?.previousClose ?? previousCloseFromBars(bars);
  const change = price != null && previousClose != null ? price - previousClose : null;
  const changePct = price != null && previousClose != null ? pctChange(price, previousClose) : null;

  const targets = lastBar ? returnTargets(lastBar.date) : null;
  const range52 = rangeOverBars(bars, 365);

  return {
    id: definition.id,
    symbol: definition.symbol,
    name: quote?.name || definition.name,
    shortName: definition.shortName,
    category: definition.category,
    instrumentType: definition.instrumentType,
    currency: definition.currency,
    unit: definition.unit,
    price,
    previousClose,
    change,
    changePct,
    return1w: targets ? periodReturnPct(bars, targets.week, price) : null,
    return1m: targets ? periodReturnPct(bars, targets.month, price) : null,
    returnYtd: targets ? periodReturnPct(bars, targets.ytd, price) : null,
    high52w: range52?.high ?? null,
    low52w: range52?.low ?? null,
    position52w: positionInRange(price, range52?.low ?? null, range52?.high ?? null),
    ma20: smaAt(closes, 20),
    ma50: smaAt(closes, 50),
    trend: closes.length >= 21 ? trendFromCloses(closes) : "unavailable",
    timestamp: quote?.timestamp ?? chart.metaTimestamp,
    sparkline: sparklineFromBars(bars, 30),
    quoteSource: quote?.quoteSource ?? null,
    error: price == null ? chart.error ?? "no data from provider" : undefined,
  };
}

async function fetchSnapshot(): Promise<MarketsSnapshotResponse> {
  const quoteSymbols = MARKET_INSTRUMENTS
    .filter((definition) => !definition.chartOnly)
    .map((definition) => definition.symbol);

  const [quotes, charts] = await Promise.all([
    fetchQuotes(quoteSymbols),
    mapWithConcurrency(MARKET_INSTRUMENTS, CHART_CONCURRENCY, (definition) => fetchChart(definition.symbol, HISTORY_DAYS)),
  ]);

  const instruments = MARKET_INSTRUMENTS.map((definition, index) =>
    buildInstrument(definition, quotes[definition.symbol], charts[index])
  );

  return { fetchedAt: new Date().toISOString(), cacheHit: false, instruments };
}

async function handleSnapshot(forceRefresh: boolean): Promise<NextResponse> {
  if (!forceRefresh && snapshotCache && Date.now() - snapshotCache.ts <= SNAPSHOT_CACHE_TTL_MS) {
    return NextResponse.json(
      { ...snapshotCache.data, cacheHit: true },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  }

  // Deduplicate concurrent cold requests; a forced refresh always re-fetches.
  let fetchPromise = snapshotInFlight;
  if (forceRefresh || !fetchPromise) {
    fetchPromise = fetchSnapshot();
    snapshotInFlight = fetchPromise;
    // Clear the in-flight slot on settle; the .then chain handles its own
    // rejection so a provider failure never becomes an unhandled rejection.
    fetchPromise.then(
      () => { if (snapshotInFlight === fetchPromise) snapshotInFlight = null; },
      () => { if (snapshotInFlight === fetchPromise) snapshotInFlight = null; }
    );
  }

  try {
    const data = await fetchPromise;
    snapshotCache = { data, ts: Date.now() };
    return NextResponse.json(
      data,
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("[api/markets] snapshot failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Market data could not be refreshed. Try again shortly." }, { status: 502 });
  }
}

async function handleDetail(id: string, rangeParam: string | null): Promise<NextResponse> {
  const definition = INSTRUMENT_BY_ID[id];
  if (!definition) {
    return NextResponse.json({ error: "Unknown instrument." }, { status: 400 });
  }
  const range: DetailRange = (["1M", "3M", "6M", "1Y", "5Y"] as const).includes(rangeParam as DetailRange)
    ? (rangeParam as DetailRange)
    : "1Y";

  const cacheKey = `${id}:${range}`;
  const cached = detailCache.get(cacheKey);
  if (cached && Date.now() - cached.ts <= DETAIL_CACHE_TTL_MS) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "public, s-maxage=300" } });
  }

  const chart = await fetchChart(definition.symbol, DETAIL_RANGE_DAYS[range] + 10);
  if (chart.error) {
    return NextResponse.json({ error: `No data available for ${definition.shortName} right now.` }, { status: 502 });
  }

  const data: MarketDetailResponse = {
    id,
    symbol: definition.symbol,
    range,
    bars: chart.bars,
    fetchedAt: new Date().toISOString(),
  };
  detailCache.set(cacheKey, { data, ts: Date.now() });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300" } });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const detailId = params.get("detail");
  try {
    if (detailId) return await handleDetail(detailId, params.get("range"));
    return await handleSnapshot(params.get("refresh") === "1");
  } catch (err) {
    console.error("[api/markets] unexpected failure:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Market data request failed." }, { status: 500 });
  }
}
