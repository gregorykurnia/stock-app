import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { ETF_CATALOG, ETF_ETNS, ETF_EXCLUSIONS } from "@/lib/etfCatalog";
import { calculateETFMetrics, type ETFDistribution, type ETFPriceBar } from "@/lib/etfMetricCalculations";
import {
  advanceETFSourceJob,
  getETFCoreHistory,
  getETFMetricSnapshots,
  getETFSourceJobState,
  recordETFMetricRefreshError,
  reserveTiingoRequest,
  saveETFCoreAssessments,
  saveETFCoreHistory,
  saveETFMetricSnapshot,
} from "@/lib/etfMetricStore";
import { buildETFCoreAssessments, buildETFCoreCoverageSummary, buildETFCoreMarketWindow, coreSourceReadiness, ETF_CORE_MARKET_HISTORY_SOURCE_ID, lastCompletedUsMonthEnd } from "@/lib/etfCorePipeline";
import { fetchTiingoDailyHistory, TiingoRequestError, type TiingoDailyBar } from "@/lib/etfTiingo";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REFRESH_SOURCE = "Yahoo Finance via yahoo-finance2";
const DEFAULT_BATCH_SIZE = 12;
const MAX_BATCH_SIZE = 12;
const MAX_TIINGO_BATCH_SIZE = 35;
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

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function requiredCoreHistoryStart(now: Date): string {
  // Three years of returns need 37 month-end levels; fetch the full first month for session validation.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 37, 1)).toISOString().slice(0, 10);
}

function mergeBars(previous: TiingoDailyBar[], fresh: TiingoDailyBar[]): TiingoDailyBar[] {
  const byDate = new Map(previous.map((bar) => [bar.date, bar]));
  for (const bar of fresh) byDate.set(bar.date, bar);
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function stableHistoryHash(bars: TiingoDailyBar[]): string {
  return createHash("sha256").update(JSON.stringify(bars.map((bar) => [bar.date, bar.close, bar.adjustedClose, bar.dividendCash, bar.splitFactor]))).digest("hex");
}

async function requestTiingoBars(ticker: string, startDate: string, endDateExclusive: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (!await reserveTiingoRequest(new Date())) throw new Error("Tiingo hourly request budget is exhausted; this batch will resume in the next quota window.");
    try {
      return await fetchTiingoDailyHistory(ticker, startDate, endDateExclusive);
    } catch (error) {
      if (error instanceof TiingoRequestError && error.status === 429) {
        throw new Error("Tiingo hourly request budget is exhausted; this batch will resume in the next quota window.");
      }
      if (error instanceof TiingoRequestError && (error.status === 401 || error.status === 403)) {
        throw new Error("Tiingo rejected the token or EOD entitlement; refresh progress is paused for review.");
      }
      lastError = error;
      if (attempt < 3) await pause(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tiingo EOD request failed.");
}

async function refreshTiingoCoreTicker(ticker: string, now: Date, runId: string, cutoffDate?: string) {
  const previous = await getETFCoreHistory(ticker);
  const requiredStart = requiredCoreHistoryStart(now);
  const hasWindowCoverage = previous.length > 0 && previous[0].date <= requiredStart;
  const recentStart = previous.length ? dateOnly(addDays(new Date(`${previous.at(-1)!.date}T00:00:00Z`), -10)) : requiredStart;
  const requestStart = hasWindowCoverage ? recentStart : requiredStart;
  const requestEnd = dateOnly(addDays(now, 1));
  let fresh = await requestTiingoBars(ticker, requestStart, requestEnd);
  const hasNewCorporateAction = fresh.some((bar) => bar.date >= requestStart && (bar.dividendCash > 0 || Math.abs(bar.splitFactor - 1) > 1e-12));
  if (hasWindowCoverage && hasNewCorporateAction) fresh = await requestTiingoBars(ticker, requiredStart, requestEnd);
  const merged = mergeBars(previous, fresh).filter((bar) => bar.date >= requiredStart);
  if (merged.length < 2) throw new Error("Tiingo EOD returned too little history for Core validation.");

  const historyHash = stableHistoryHash(merged);
  const fetchedAt = now.toISOString();
  await saveETFCoreHistory({ ticker, rows: merged, fetchedAt, sourceId: ETF_CORE_MARKET_HISTORY_SOURCE_ID });
  const record = ETF_CATALOG.find((item) => item.ticker === ticker);
  if (!record) throw new Error("Ticker is not in the ETF Core universe.");
  const assessments = buildETFCoreAssessments({ record, bars: merged, now, runId, historyHash, cutoffDate });
  await saveETFCoreAssessments({ ticker, assessments, observedAt: fetchedAt, historyHash });
  const window = buildETFCoreMarketWindow(merged, "3Y", now, cutoffDate);
  return {
    ticker,
    fetchedBars: fresh.length,
    retainedBars: merged.length,
    historyStart: merged[0].date,
    historyEnd: merged.at(-1)?.date ?? null,
    cutoff: window.cutoff || null,
    core3YComplete: window.complete,
    missingSessions: window.missingSessionDates.length,
    assessmentStatuses: assessments.map((assessment) => ({ kind: assessment.kind, horizon: assessment.horizon, status: assessment.status })),
    historyHash,
  };
}

async function postTiingoCore(request: NextRequest) {
  if (process.env.ETF_TIINGO_AUTOMATION_AUTHORIZED !== "true") {
    return NextResponse.json({ error: "Tiingo refresh is paused until the rotated token and free-tier entitlement are confirmed." }, { status: 503 });
  }
  if (!process.env.TIINGO_API_TOKEN?.trim()) {
    return NextResponse.json({ error: "TIINGO_API_TOKEN is not configured in the server environment." }, { status: 503 });
  }

  const now = new Date();
  const tickerParam = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? MAX_TIINGO_BATCH_SIZE);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_TIINGO_BATCH_SIZE) {
    return NextResponse.json({ error: `limit must be from 1 to ${MAX_TIINGO_BATCH_SIZE}` }, { status: 400 });
  }
  if (tickerParam) {
    if (!ETF_CATALOG.some((record) => record.ticker === tickerParam)) return NextResponse.json({ error: "ticker is not in the ETF Core universe" }, { status: 400 });
    try {
      const result = await refreshTiingoCoreTicker(tickerParam, now, randomUUID());
      return NextResponse.json({ provider: "tiingo", source: "Core history validation", requested: 1, updated: [result], failed: [] });
    } catch (error) {
      const message = safeError(error);
      await recordETFMetricRefreshError(tickerParam, message, now.toISOString()).catch(() => undefined);
      const status = /quota window/.test(message) ? 429 : /rejected the token|entitlement/.test(message) ? 503 : 502;
      return NextResponse.json({ provider: "tiingo", requested: 1, updated: [], failed: [{ ticker: tickerParam, error: message }] }, { status });
    }
  }

  const universe = ETF_CATALOG;
  const universeId = createHash("sha256").update(universe.map((record) => record.ticker).join("\n")).digest("hex").slice(0, 20);
  const oldState = await getETFSourceJobState();
  const currentCutoff = lastCompletedUsMonthEnd(now);
  const sameUniverse = oldState?.universeId === universeId;
  const sameCutoff = oldState?.scoreCutoffDate === currentCutoff;
  let cursor = sameUniverse && sameCutoff ? oldState.cursor : 0;
  let completedAt = sameUniverse && sameCutoff ? oldState.completedAt : null;
  let runId = sameUniverse && sameCutoff ? oldState.runId : randomUUID();
  const scoreCutoffDate = sameUniverse && sameCutoff ? oldState.scoreCutoffDate : currentCutoff;
  if (!sameUniverse || !sameCutoff) {
    await advanceETFSourceJob({ universeId, cursor, completedAt, runId, scoreCutoffDate, now });
  }
  if (cursor >= universe.length) {
    const hoursSinceCompletion = completedAt ? (now.getTime() - new Date(completedAt).getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
    if (hoursSinceCompletion < 23) {
      return NextResponse.json({ provider: "tiingo", universeId, universeCount: universe.length, cursor, remaining: 0, waitingForNextDailyRefresh: true, updated: [], failed: [] });
    }
    cursor = 0;
    completedAt = null;
    runId = randomUUID();
    await advanceETFSourceJob({ universeId, cursor, completedAt, runId, scoreCutoffDate, now });
  }

  const batchEnd = Math.min(universe.length, cursor + rawLimit);
  const updated: Array<Record<string, unknown>> = [];
  const failed: Array<{ ticker: string; error: string }> = [];
  for (let index = cursor; index < batchEnd; index += 1) {
    const ticker = universe[index].ticker;
    try {
      const result = await refreshTiingoCoreTicker(ticker, now, runId, scoreCutoffDate);
      updated.push(result);
      await advanceETFSourceJob({ universeId, cursor: index + 1, completedAt: index + 1 === universe.length ? now.toISOString() : null, runId, scoreCutoffDate, now });
    } catch (error) {
      const message = safeError(error);
      failed.push({ ticker, error: message });
      await recordETFMetricRefreshError(ticker, message, now.toISOString()).catch(() => undefined);
      if (/quota window|rejected the token|entitlement/.test(message)) break;
      await advanceETFSourceJob({ universeId, cursor: index + 1, completedAt: index + 1 === universe.length ? now.toISOString() : null, runId, scoreCutoffDate, now });
    }
  }
  const state = await getETFSourceJobState();
  const nextCursor = state?.universeId === universeId ? state.cursor : cursor;
  return NextResponse.json({
    provider: "tiingo",
    runId,
    universeId,
    universeCount: universe.length,
    offset: cursor,
    nextOffset: nextCursor,
    requested: updated.length + failed.length,
    updated,
    failed,
    remaining: Math.max(0, universe.length - nextCursor),
    complete: nextCursor >= universe.length,
    source: "Tiingo EOD adjusted close; month-end Core score inputs",
  });
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
    const nowDate = new Date();
    const now = nowDate.getTime();
    const snapshots = Object.fromEntries(Object.entries(storedSnapshots).map(([ticker, snapshot]) => [ticker, {
      ...snapshot,
      stale: !snapshot.observedAt || now - new Date(snapshot.observedAt).getTime() > 5 * 24 * 60 * 60 * 1000,
      scoreStale: !snapshot.scoreObservedAt || now - new Date(snapshot.scoreObservedAt).getTime() > 5 * 24 * 60 * 60 * 1000,
    }]));
    const coverageSnapshots = { ...snapshots };
    for (const record of ETF_CATALOG) {
      if (coverageSnapshots[record.ticker]?.scoreAssessments?.length) continue;
      coverageSnapshots[record.ticker] = {
        ...coverageSnapshots[record.ticker],
        scoreAssessments: buildETFCoreAssessments({ record, bars: [], now: nowDate, runId: "coverage-audit", historyHash: "" }),
        scoreStale: true,
      };
    }
    const coreCoverage = buildETFCoreCoverageSummary({
      records: ETF_CATALOG,
      snapshots: coverageSnapshots,
      etnCount: ETF_ETNS.length,
      exclusionCount: ETF_EXCLUSIONS.length,
      asOf: nowDate.toISOString().slice(0, 10),
    });
    return NextResponse.json({ snapshots, coreCoverage, issuerInputs: coreSourceReadiness(nowDate), generatedAt: nowDate.toISOString() });
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
  const provider = request.nextUrl.searchParams.get("provider") ?? "yahoo";
  if (provider === "tiingo") return postTiingoCore(request);
  if (provider !== "yahoo") return NextResponse.json({ error: "provider must be yahoo or tiingo" }, { status: 400 });
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
