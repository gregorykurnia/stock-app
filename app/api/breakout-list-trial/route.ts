import { NextRequest, NextResponse } from "next/server";
import { calcIndicators, macdSeriesFull } from "@/lib/indicators";
import { calcBottomCandidateScore } from "@/lib/listTrialScore";
import type { OHLCVBar } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const CURRENT_LOW_WINDOW = 20;
const PRIOR_LOW_START = 40;
const PRIOR_LOW_END = 120;
const BREAKDOWN_THRESHOLDS = [-8, -12, -15] as const;

interface YahooQuote {
  date: Date | string | number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}

interface TrialBar extends OHLCVBar {
  dateKey: string;
}

function nullable(value: number | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function dateKey(value: Date | string | number): string | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function percentChange(current: number | null, prior: number | null): number | null {
  return current != null && prior != null && prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : null;
}

function difference(current: number | null, prior: number | null): number | null {
  return current != null && prior != null ? current - prior : null;
}

function minIndex(values: number[], start: number, end: number): number | null {
  if (end <= start) return null;
  let result: number | null = null;
  for (let i = start; i < end; i++) {
    if (result == null || values[i] < values[result]) result = i;
  }
  return result;
}

function valueAt(values: number[], index: number | null): number | null {
  if (index == null) return null;
  return nullable(values[index]);
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
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

  // Fetch the maximum practical daily history for this one-ticker trial request. The as-of
  // filter below is applied before any indicator or eligibility value is read.
  const period2 = new Date(candidateDate.getTime() + 24 * 60 * 60 * 1000);
  let result: { quotes?: YahooQuote[] };
  try {
    result = await yf.chart(ticker, { period1: new Date("1970-01-01T00:00:00.000Z"), period2, interval: "1d" }) as { quotes?: YahooQuote[] };
  } catch {
    return NextResponse.json({ error: `historical data unavailable for ${ticker}` }, { status: 502 });
  }

  const bars: TrialBar[] = (result.quotes ?? [])
    .map((quote) => {
      const key = dateKey(quote.date);
      if (key == null || quote.open == null || quote.high == null || quote.low == null || quote.close == null || quote.volume == null) return null;
      return {
        dateKey: key,
        time: Math.floor(new Date(quote.date).getTime() / 1000),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
      };
    })
    .filter((bar): bar is TrialBar => bar != null && bar.dateKey <= requestedDate)
    .sort((a, b) => a.time - b.time);

  if (bars.length === 0) return NextResponse.json({ error: `no data for ${ticker} through ${requestedDate}` }, { status: 404 });

  const asOf = bars[bars.length - 1];
  const ohlcv: OHLCVBar[] = bars.map((bar) => ({
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
  const closes = ohlcv.map((bar) => bar.close);
  const volumes = ohlcv.map((bar) => bar.volume);
  const indicators = calcIndicators(ohlcv);
  const { hist } = macdSeriesFull(closes);
  const asOfIndex = bars.length - 1;

  const currentLowIndex = minIndex(closes, Math.max(0, bars.length - CURRENT_LOW_WINDOW), bars.length);
  const priorLowIndex = bars.length >= PRIOR_LOW_END
    ? minIndex(closes, bars.length - PRIOR_LOW_END, bars.length - PRIOR_LOW_START)
    : null;
  const allTimeHigh = Math.max(...closes);
  const currentLow = currentLowIndex == null ? null : closes[currentLowIndex];
  const priorLow = priorLowIndex == null ? null : closes[priorLowIndex];
  const currentLowHistPct = currentLowIndex != null && currentLow != null && currentLow !== 0 && !Number.isNaN(hist[currentLowIndex]) ? (hist[currentLowIndex] / currentLow) * 100 : null;
  const priorLowHistPct = priorLowIndex != null && priorLow != null && priorLow !== 0 && !Number.isNaN(hist[priorLowIndex]) ? (hist[priorLowIndex] / priorLow) * 100 : null;
  const volume20 = volumes.slice(Math.max(0, bars.length - 20), bars.length);
  const avgVolume20 = average(volume20);
  const atr = valueAt(indicators.atr, asOfIndex);
  const rollingLowForBreakdown = currentLow ?? asOf.close;
  const drawdownFromAthPct = percentChange(asOf.close, allTimeHigh);
  const pctAboveCurrentRollingLow = percentChange(asOf.close, currentLow);
  const currentLowVsPriorLowPct = percentChange(currentLow, priorLow);
  const rsiDeltaCurrentVsPrior = currentLow != null && priorLow != null ? difference(valueAt(indicators.rsi, currentLowIndex), valueAt(indicators.rsi, priorLowIndex)) : null;
  const macdHistPctDeltaCurrentVsPrior = difference(currentLowHistPct, priorLowHistPct);
  const diGapDeltaCurrentVsPrior = difference(
    difference(valueAt(indicators.diPlus, currentLowIndex), valueAt(indicators.diMinus, currentLowIndex)),
    difference(valueAt(indicators.diPlus, priorLowIndex), valueAt(indicators.diMinus, priorLowIndex))
  );
  const adxDeltaCurrentVsPrior = difference(valueAt(indicators.adx, currentLowIndex), valueAt(indicators.adx, priorLowIndex));
  const cmfDeltaCurrentVsPrior = difference(valueAt(indicators.cmf, currentLowIndex), valueAt(indicators.cmf, priorLowIndex));
  const eligibleAt40PctBelowAth = asOf.close <= allTimeHigh * 0.6;
  const bottomCandidate = calcBottomCandidateScore({
    eligibleAt40PctBelowAth,
    drawdownFromAthPct,
    pctAboveCurrentRollingLow,
    currentLowVsPriorLowPct,
    rsiDeltaCurrentVsPrior,
    macdHistPctDeltaCurrentVsPrior,
    diGapDeltaCurrentVsPrior,
    adxDeltaCurrentVsPrior,
    cmfDeltaCurrentVsPrior,
  });

  return NextResponse.json({
    ticker,
    requestedDate,
    asOfDate: asOf.dateKey,
    barsThroughDate: bars.length,
    price: asOf.close,
    allTimeHighThroughDate: allTimeHigh,
    drawdownFromAthPct,
    eligibleAt40PctBelowAth,
    currentLowWindowDays: Math.min(CURRENT_LOW_WINDOW, bars.length),
    currentRollingLow: valueAt(closes, currentLowIndex),
    currentRollingLowDate: currentLowIndex == null ? null : bars[currentLowIndex].dateKey,
    pctAboveCurrentRollingLow,
    priorSellingEpisodeLow: priorLow,
    priorSellingEpisodeLowDate: priorLowIndex == null ? null : bars[priorLowIndex].dateKey,
    currentLowVsPriorLowPct,
    indicators: {
      rsi: valueAt(indicators.rsi, asOfIndex),
      rsiAtCurrentLow: valueAt(indicators.rsi, currentLowIndex),
      rsiAtPriorLow: valueAt(indicators.rsi, priorLowIndex),
      rsiDeltaCurrentVsPrior,
      macdHist: valueAt(hist, asOfIndex),
      macdHistPctOfPrice: hist[asOfIndex] != null && !Number.isNaN(hist[asOfIndex]) ? (hist[asOfIndex] / asOf.close) * 100 : null,
      macdHistPctAtCurrentLow: currentLowHistPct,
      macdHistPctAtPriorLow: priorLowHistPct,
      macdHistPctDeltaCurrentVsPrior,
      diGap: difference(valueAt(indicators.diPlus, asOfIndex), valueAt(indicators.diMinus, asOfIndex)),
      diGapAtCurrentLow: currentLowIndex == null ? null : difference(valueAt(indicators.diPlus, currentLowIndex), valueAt(indicators.diMinus, currentLowIndex)),
      diGapAtPriorLow: priorLowIndex == null ? null : difference(valueAt(indicators.diPlus, priorLowIndex), valueAt(indicators.diMinus, priorLowIndex)),
      adx: valueAt(indicators.adx, asOfIndex),
      adxAtCurrentLow: valueAt(indicators.adx, currentLowIndex),
      adxAtPriorLow: valueAt(indicators.adx, priorLowIndex),
      adxDeltaCurrentVsPrior,
      cmf: valueAt(indicators.cmf, asOfIndex),
      cmfAtCurrentLow: valueAt(indicators.cmf, currentLowIndex),
      cmfAtPriorLow: valueAt(indicators.cmf, priorLowIndex),
      cmfDeltaCurrentVsPrior,
      atr14: atr,
      atrPct: atr != null && asOf.close > 0 ? (atr / asOf.close) * 100 : null,
      volume: asOf.volume,
      averageVolume20: avgVolume20,
      relativeVolume20: avgVolume20 != null && avgVolume20 > 0 ? asOf.volume / avgVolume20 : null,
    },
    provisionalBreakdownReferences: BREAKDOWN_THRESHOLDS.map((pct) => ({ pct, price: rollingLowForBreakdown * (1 + pct / 100) })),
    bottomCandidate,
    dataQuality: {
      enoughHistoryForIndicators: bars.length >= 50,
      enoughHistoryForPriorEpisode: priorLowIndex != null,
      requestedDateWasTradingDay: asOf.dateKey === requestedDate,
    },
  });
}
