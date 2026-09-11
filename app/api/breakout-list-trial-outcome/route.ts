import { NextRequest, NextResponse } from "next/server";
import { calculateListTrialOutcomes } from "@/lib/listTrialOutcomes";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

interface YahooQuote {
  date: Date | string | number;
  close?: number | null;
}

function dateKey(value: Date | string | number): string | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseRequestedDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  const requestedDate = req.nextUrl.searchParams.get("date");
  const candidateDate = parseRequestedDate(requestedDate);

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  if (!candidateDate || !requestedDate) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });

  const todayKey = new Date().toISOString().slice(0, 10);
  if (requestedDate > todayKey) return NextResponse.json({ error: "date cannot be in the future" }, { status: 400 });

  // This endpoint intentionally fetches future bars only to grade a signal that was already
  // constructed elsewhere from as-of-date information. Outcomes use daily closing prices so a
  // target and breakdown cannot ambiguously occur on the same bar.
  const fetchStart = new Date(candidateDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fetchEnd = new Date();
  fetchEnd.setUTCDate(fetchEnd.getUTCDate() + 1);
  let result: { quotes?: YahooQuote[] };
  try {
    result = await yf.chart(ticker, { period1: fetchStart, period2: fetchEnd, interval: "1d" }) as { quotes?: YahooQuote[] };
  } catch {
    return NextResponse.json({ error: `historical data unavailable for ${ticker}` }, { status: 502 });
  }

  const bars = (result.quotes ?? [])
    .map((quote) => {
      const date = dateKey(quote.date);
      return date != null && quote.close != null ? { date, close: quote.close } : null;
    })
    .filter((bar): bar is { date: string; close: number } => bar != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let candidateIndex = -1;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].date <= requestedDate) { candidateIndex = i; break; }
  }
  if (candidateIndex < 0) return NextResponse.json({ error: `no data for ${ticker} through ${requestedDate}` }, { status: 404 });

  const candidate = bars[candidateIndex];
  const outcomes = calculateListTrialOutcomes(bars, candidateIndex);
  const primaryTarget = outcomes.targets.find((target) => target.targetPct === 20)!;
  const primaryBreakdown = primaryTarget.breakdowns.find((breakdown) => breakdown.breakdownPct === -12)!;

  return NextResponse.json({
    ticker,
    requestedDate,
    asOfDate: candidate.date,
    entryPrice: outcomes.entryPrice,
    outcomeBasis: "daily_close",
    barsAfterCandidate: outcomes.barsAfterCandidate,
    targets: outcomes.targets,
    returns: outcomes.returns,
    primaryOutcome: {
      targetPct: primaryTarget.targetPct,
      breakdownPct: primaryBreakdown.breakdownPct,
      status: primaryBreakdown.status,
      targetHitDate: primaryTarget.targetHitDate,
      breakdownHitDate: primaryBreakdown.breakdownHitDate,
      daysToTarget: primaryTarget.daysToTarget,
      maxAdverseExcursionPct: primaryTarget.maxAdverseExcursionPct,
    },
  });
}
