import { NextRequest, NextResponse } from "next/server";
import {
  buildMacroAssessment,
  MACRO_SERIES_DEFINITIONS,
  sortMacroSeries,
  type MacroBar,
  type MacroContextResponse,
  type MacroRange,
  type MacroSeries,
  type MacroSeriesId,
} from "@/lib/macroContext";

// Server-only provider boundary. The existing Markets catalog documents that
// Yahoo's 2Y yield symbol is unreliable, so this first pass uses verified
// Treasury yield indices and exposes that limitation in the response/UI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SERIES_ORDER: MacroSeriesId[] = ["us3m", "us5y", "us10y", "us30y"];
const YAHOO_SYMBOLS: Record<MacroSeriesId, string> = {
  us3m: "^IRX",
  us5y: "^FVX",
  us10y: "^TNX",
  us30y: "^TYX",
};
const RANGE_DAYS: Record<MacroRange, number> = { "1Y": 400, "5Y": 1900, "10Y": 3700 };
const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map<MacroRange, { data: MacroContextResponse; ts: number }>();
const inFlight = new Map<MacroRange, Promise<MacroContextResponse>>();

function isRange(value: string | null): value is MacroRange {
  return value === "1Y" || value === "5Y" || value === "10Y";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function barFromQuote(value: unknown): MacroBar | null {
  if (!isRecord(value)) return null;
  const date = value.date;
  const close = value.close;
  if (!(date instanceof Date || typeof date === "string") || !isFiniteNumber(close)) return null;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return { date: parsedDate.toISOString().slice(0, 10), value: close };
}

async function fetchSeries(id: MacroSeriesId, range: MacroRange): Promise<MacroSeries> {
  const definition = MACRO_SERIES_DEFINITIONS[id];
  try {
    const result: unknown = await yf.chart(YAHOO_SYMBOLS[id], {
      period1: new Date(Date.now() - RANGE_DAYS[range] * 24 * 3600 * 1000),
      period2: new Date(),
      interval: "1d",
    });
    const quotes = isRecord(result) && Array.isArray(result.quotes) ? result.quotes : [];
    const bars = quotes
      .map(barFromQuote)
      .filter((bar): bar is MacroBar => bar !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const uniqueBars: MacroBar[] = Array.from(new Map<string, MacroBar>(bars.map((bar: MacroBar) => [bar.date, bar])).values());
    if (uniqueBars.length === 0) throw new Error("no history from provider");
    return { ...definition, bars: uniqueBars };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 120) : "provider request failed";
    return { ...definition, bars: [], error: message };
  }
}

async function fetchMacroContext(range: MacroRange): Promise<MacroContextResponse> {
  const series = sortMacroSeries(await Promise.all(SERIES_ORDER.map((id) => fetchSeries(id, range))));
  if (!series.some((item) => item.bars.length > 0)) throw new Error("No macro rate history is available right now.");

  return {
    fetchedAt: new Date().toISOString(),
    range,
    source: "Yahoo Finance (Treasury yield indices)",
    sourceNote: "The current provider has verified 3M, 5Y, 10Y, and 30Y Treasury yield indices. A reliable 2Y series, Federal Funds Rate, inflation, labor, credit, and growth feeds are not connected in this first pass.",
    outlook: {
      status: "unavailable",
      explanation: "No forward-rate feed is configured. Historical yields are observations, not a forecast.",
    },
    series,
    assessment: buildMacroAssessment(series),
  };
}

async function getMacroContext(range: MacroRange, forceRefresh: boolean): Promise<{ data: MacroContextResponse; cacheHit: boolean }> {
  const cached = cache.get(range);
  if (!forceRefresh && cached && Date.now() - cached.ts <= CACHE_TTL_MS) return { data: cached.data, cacheHit: true };

  let request = inFlight.get(range);
  if (forceRefresh || !request) {
    request = fetchMacroContext(range);
    inFlight.set(range, request);
    request.then(() => {
      if (inFlight.get(range) === request) inFlight.delete(range);
    }, () => {
      if (inFlight.get(range) === request) inFlight.delete(range);
    });
  }

  const data = await request;
  cache.set(range, { data, ts: Date.now() });
  return { data, cacheHit: false };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range");
  const range: MacroRange = isRange(rangeParam) ? rangeParam : "5Y";
  const forceRefresh = params.get("refresh") === "1";

  try {
    const result = await getMacroContext(range, forceRefresh);
    return NextResponse.json(
      { ...result.data, cacheHit: result.cacheHit },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
    );
  } catch (error) {
    console.error("[api/macro-context] request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Macro data could not be refreshed. Try again shortly." }, { status: 502 });
  }
}
