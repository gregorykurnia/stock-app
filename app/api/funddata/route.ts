import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface FundData {
  roe: number | null;
  debt_to_equity: number | null;
  eps_ttm: number | null;
  eps_fwd: number | null;
  eps_past_5y: number | null;
  eps_next_5y: number | null;
  short_float: number | null;
}

async function fetchOne(ticker: string): Promise<FundData> {
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["financialData", "defaultKeyStatistics", "earningsTrend"],
    });

    const fd = summary.financialData ?? {};
    const ks = summary.defaultKeyStatistics ?? {};
    const et = summary.earningsTrend ?? {};
    const trends: { period: string; growth?: number | null }[] = et.trend ?? [];

    const findGrowth = (period: string) =>
      trends.find((t) => t.period === period)?.growth ?? null;

    return {
      roe: fd.returnOnEquity ?? null,
      // Yahoo returns D/E as a raw ratio (not %)
      debt_to_equity: fd.debtToEquity != null ? fd.debtToEquity / 100 : null,
      eps_ttm: ks.trailingEps ?? null,
      eps_fwd: ks.forwardEps ?? null,
      // Past 5Y EPS growth: Yahoo doesn't expose directly — best proxy is earningsTrend "-5y" (often missing)
      eps_past_5y: findGrowth("-5y") ?? findGrowth("5y") ?? null,
      eps_next_5y: findGrowth("+5y") ?? null,
      short_float: ks.shortPercentOfFloat ?? null,
    };
  } catch {
    return { roe: null, debt_to_equity: null, eps_ttm: null, eps_fwd: null, eps_past_5y: null, eps_next_5y: null, short_float: null };
  }
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const results: Record<string, FundData> = {};

  // Chunk to avoid rate limits
  const chunkSize = 8;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ticker) => {
        results[ticker] = await fetchOne(ticker);
      })
    );
  }

  return NextResponse.json({ data: results });
}
