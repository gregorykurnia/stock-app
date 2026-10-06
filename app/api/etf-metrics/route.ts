import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { ETF_CATALOG, ETF_ETNS } from "@/lib/etfCatalog";
import { calculateETFMetrics, type ETFDistribution, type ETFPriceBar } from "@/lib/etfMetricCalculations";
import { getETFMetricSnapshots, recordETFMetricRefreshError, saveETFMetricSnapshot } from "@/lib/etfMetricStore";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REFRESH_SOURCE = "Yahoo Finance via yahoo-finance2";
const DEFAULT_BATCH_SIZE = 12;
const MAX_BATCH_SIZE = 12;
const HISTORY_START = new Date(Date.now() - 10.1 * 365.2425 * 24 * 60 * 60 * 1000);

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeDate(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function validPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function eventList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return null;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Yahoo Finance request failed";
  return message.replace(/https?:\/\/\S+/g, "provider URL").slice(0, 180);
}

function normalizeWeight(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value <= 1 ? value * 100 : value;
}

async function refreshTicker(ticker: string) {
  const [chartResult, summaryResult] = await Promise.allSettled([
    yahooFinance.chart(ticker, {
      period1: HISTORY_START,
      period2: new Date(Date.now() + 24 * 60 * 60 * 1000),
      interval: "1d",
      events: "div,splits",
      return: "array",
    }),
    yahooFinance.quoteSummary(ticker, { modules: ["fundProfile", "summaryDetail", "topHoldings"] }),
  ]);

  if (chartResult.status === "rejected") throw chartResult.reason;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart: any = chartResult.value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: any = summaryResult.status === "fulfilled" ? summaryResult.value : {};
  const quotes = Array.isArray(chart?.quotes) ? chart.quotes : [];
  const bars: ETFPriceBar[] = quotes.flatMap((quote: { date?: unknown; close?: unknown; adjclose?: unknown }) => {
    const date = normalizeDate(quote.date);
    if (!date || !validPositive(quote.close) || !validPositive(quote.adjclose)) return [];
    return [{ date, close: quote.close, adjustedClose: quote.adjclose }];
  }).sort((left: ETFPriceBar, right: ETFPriceBar) => left.date.localeCompare(right.date));
  if (bars.length < 2) throw new Error("Yahoo Finance returned no usable adjusted daily history");
  if (bars.some((bar, index) => index > 0 && bars[index - 1].date === bar.date)) throw new Error("Yahoo Finance returned duplicate daily bars");

  const rawEvents = eventList(chart?.events?.dividends);
  const distributions: ETFDistribution[] = (rawEvents ?? []).flatMap((rawEvent) => {
    const event = rawEvent as { date?: unknown; amount?: unknown };
    const date = normalizeDate(event?.date);
    return date && typeof event?.amount === "number" && Number.isFinite(event.amount) && event.amount >= 0
      ? [{ date, amount: event.amount }]
      : [];
  }).sort((left, right) => left.date.localeCompare(right.date));

  const rawHoldings = Array.isArray(summary?.topHoldings?.holdings) ? summary.topHoldings.holdings : [];
  // yahoo-finance2 returns fractional holding weights (0.07 = 7%) for this module.
  const holdings = rawHoldings.flatMap((holding: { symbol?: unknown; holdingPercent?: unknown }) => {
    if (typeof holding.symbol !== "string") return [];
    const weightPct = normalizeWeight(holding.holdingPercent);
    return weightPct == null ? [] : [{ symbol: holding.symbol.trim().toUpperCase(), weightPct }];
  }).filter((holding: { symbol: string }, index: number, all: { symbol: string }[]) => all.findIndex((item) => item.symbol === holding.symbol) === index);

  const fundProfile = summary?.fundProfile?.feesExpensesInvestment ?? {};
  const summaryDetail = summary?.summaryDetail ?? {};
  const expenseRatioCandidates: Array<{ value: unknown; label: string }> = [
    { value: fundProfile.netExpRatio, label: "net expense ratio" },
    { value: fundProfile.annualReportExpenseRatio, label: "annual-report expense ratio" },
    { value: fundProfile.grossExpRatio, label: "gross expense ratio" },
  ];
  const expenseRatioSource = expenseRatioCandidates.find(({ value }) => typeof value === "number" && Number.isFinite(value));
  const expenseRatio = typeof expenseRatioSource?.value === "number" ? expenseRatioSource.value : null;
  const totalAssets = summaryDetail.totalAssets;
  const netAssets = typeof totalAssets === "number" && Number.isFinite(totalAssets) && totalAssets > 0
    ? totalAssets
    : null;
  const inceptionDate = normalizeDate(summaryDetail.fundInceptionDate);
  const observedAt = normalizeDate(chart?.meta?.regularMarketTime) ?? bars.at(-1)!.date;
  const retrievedAt = new Date().toISOString();
  const runId = randomUUID();
  const metrics = calculateETFMetrics({
    ticker,
    bars,
    distributions,
    distributionEventsAvailable: rawEvents !== null,
    currency: typeof chart?.meta?.currency === "string" ? chart.meta.currency : null,
    observedAt,
    retrievedAt,
    runId,
    metadata: { expenseRatio, expenseRatioType: expenseRatioSource?.label ?? null, netAssets, inceptionDate },
    holdings,
  });
  await saveETFMetricSnapshot(metrics);
  return { ticker, observedAt, runId, historyObservations: bars.length, holdings: holdings.length, quoteSummaryAvailable: summaryResult.status === "fulfilled" };
}

export async function GET() {
  try {
    const storedSnapshots = await getETFMetricSnapshots();
    const now = Date.now();
    const snapshots = Object.fromEntries(Object.entries(storedSnapshots).map(([ticker, snapshot]) => [ticker, {
      ...snapshot,
      stale: !snapshot.observedAt || now - new Date(snapshot.observedAt).getTime() > 5 * 24 * 60 * 60 * 1000,
    }]));
    return NextResponse.json({ snapshots, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[etf-metrics] failed to read snapshots", error);
    return NextResponse.json({ error: "ETF metric snapshots are temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.ETF_YAHOO_AUTOMATION_AUTHORIZED !== "true") {
    return NextResponse.json({
      error: "ETF refresh is paused until an authorized market-data source is configured",
      readiness: "blockedByPolicy",
    }, { status: 503 });
  }

  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_BATCH_SIZE);
  if (!Number.isInteger(rawOffset) || rawOffset < 0 || !Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `offset must be non-negative and limit must be 1 to ${MAX_BATCH_SIZE}` }, { status: 400 });
  }

  const universe = [...ETF_CATALOG, ...ETF_ETNS];
  const batch = universe.slice(rawOffset, rawOffset + rawLimit);
  if (!batch.length) return NextResponse.json({ error: "offset is beyond the ETF universe" }, { status: 400 });

  const updated: Array<{ ticker: string; observedAt: string; runId: string; historyObservations: number; holdings: number; quoteSummaryAvailable: boolean; attempts: number }> = [];
  const skipped: string[] = [];
  const failed: Array<{ ticker: string; error: string }> = [];
  let index = 0;
  const worker = async () => {
    while (index < batch.length) {
      const record = batch[index++];
      if (record.identityWarning) {
        skipped.push(record.ticker);
        continue;
      }
      let lastError: unknown;
      let refreshed: Awaited<ReturnType<typeof refreshTicker>> | null = null;
      let attempts = 0;
      for (attempts = 1; attempts <= 3 && !refreshed; attempts += 1) {
        try {
          refreshed = await refreshTicker(record.ticker);
        } catch (error) {
          lastError = error;
          if (attempts < 3) await pause(500 * 2 ** (attempts - 1));
        }
      }
      if (refreshed) {
        updated.push({ ...refreshed, attempts: attempts - 1 });
      } else {
        const message = safeError(lastError);
        failed.push({ ticker: record.ticker, error: message });
        await recordETFMetricRefreshError(record.ticker, message, new Date().toISOString()).catch((storeError) => {
          console.error(`[etf-metrics] could not store error status for ${record.ticker}`, storeError);
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, batch.length) }, worker));

  const nextOffset = rawOffset + batch.length;
  const universeId = createHash("sha256").update(universe.map((record) => record.ticker).join("\n")).digest("hex").slice(0, 20);
  return NextResponse.json({
    offset: rawOffset,
    nextOffset,
    universeId,
    universeCount: universe.length,
    requested: batch.length,
    updated,
    skippedIdentityReview: skipped,
    failed,
    remaining: Math.max(0, universe.length - rawOffset - batch.length),
    source: REFRESH_SOURCE,
  });
}
