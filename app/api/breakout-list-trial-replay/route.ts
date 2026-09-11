import { NextRequest, NextResponse } from "next/server";
import { calculateListTrialReplay, type ListTrialReplayBar } from "@/lib/listTrialReplay";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const MAX_RANGE_DAYS = 5 * 366;
const MAX_RETURNED_SIGNALS = 150;

interface YahooQuote {
  date: Date | string | number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function dateKey(value: Date | string | number): string | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const minScoreParam = Number(req.nextUrl.searchParams.get("minScore") ?? "55");
  const minScore = Number.isFinite(minScoreParam) ? Math.min(Math.max(minScoreParam, 0), 100) : 55;

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  if (!startDate || !endDate || !start || !end) return NextResponse.json({ error: "start and end must be YYYY-MM-DD" }, { status: 400 });
  if (startDate > endDate) return NextResponse.json({ error: "start must be on or before end" }, { status: 400 });
  if (endDate.getTime() - startDate.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "replay range is limited to five years" }, { status: 400 });
  if (end > new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "end cannot be in the future" }, { status: 400 });

  let result: { quotes?: YahooQuote[] };
  try {
    // Full available history before the range is necessary to calculate the then-known ATH and
    // warmed-up indicators. Bars after the range exist solely to grade each already-formed signal.
    const period2 = new Date();
    period2.setUTCDate(period2.getUTCDate() + 1);
    result = await yf.chart(ticker, { period1: new Date("1970-01-01T00:00:00.000Z"), period2, interval: "1d" }) as { quotes?: YahooQuote[] };
  } catch {
    return NextResponse.json({ error: `historical data unavailable for ${ticker}` }, { status: 502 });
  }

  const bars: ListTrialReplayBar[] = (result.quotes ?? [])
    .map((quote) => {
      const date = dateKey(quote.date);
      if (date == null || quote.open == null || quote.high == null || quote.low == null || quote.close == null || quote.volume == null) return null;
      return { date, time: Math.floor(new Date(quote.date).getTime() / 1000), open: quote.open, high: quote.high, low: quote.low, close: quote.close, volume: quote.volume };
    })
    .filter((bar): bar is ListTrialReplayBar => bar != null)
    .sort((a, b) => a.time - b.time);
  if (bars.length < 120) return NextResponse.json({ error: `insufficient daily history for ${ticker}` }, { status: 404 });

  const replay = calculateListTrialReplay(bars, start, end, minScore);
  const truncated = replay.signals.length > MAX_RETURNED_SIGNALS;
  return NextResponse.json({
    ticker,
    start,
    end,
    minScore,
    scoreBasis: "as_of_date_only",
    outcomeBasis: "+20% before -12% using future daily closes",
    eligibleDates: replay.eligibleDates,
    signalCount: replay.signals.length,
    signals: replay.signals.slice(0, MAX_RETURNED_SIGNALS),
    truncated,
    bands: replay.bands,
  });
}
