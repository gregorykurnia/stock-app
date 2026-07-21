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
  trailing_pe: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  ev_revenue: number | null;
  p_fcf: number | null;
  // Live margins/growth (fills in for non-seed stocks)
  rev_growth: number | null;
  gross_margin: number | null;
  op_margin: number | null;
  fcf_margin: number | null;
  // Live valuation
  fwd_pe: number | null;
  peg: number | null;
  ev_ebitda: number | null;
  ev_fcf: number | null;
}

async function fetchOne(ticker: string): Promise<FundData> {
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["financialData", "defaultKeyStatistics", "earningsTrend", "summaryDetail"],
    });

    const fd = summary.financialData ?? {};
    const ks = summary.defaultKeyStatistics ?? {};
    const sd = summary.summaryDetail ?? {};
    const et = summary.earningsTrend ?? {};
    const trends: { period: string; growth?: number | null }[] = et.trend ?? [];

    const findGrowth = (period: string) =>
      trends.find((t) => t.period === period)?.growth ?? null;

    const evFcf = (ks.enterpriseValue != null && fd.freeCashflow != null && fd.freeCashflow > 0)
      ? ks.enterpriseValue / fd.freeCashflow : null;
    const fcfMargin = (fd.freeCashflow != null && fd.totalRevenue != null && fd.totalRevenue > 0)
      ? fd.freeCashflow / fd.totalRevenue : null;
    const pFcf = (sd.marketCap != null && fd.freeCashflow != null && fd.freeCashflow > 0)
      ? sd.marketCap / fd.freeCashflow : null;

    // Cap ratios that are clearly bad data (Yahoo Finance returns junk for some IDX micro-caps)
    const cap = <T extends number | null>(v: T, max: number): T | null => (v != null && (v as number) > max) ? null : v;

    return {
      roe: fd.returnOnEquity ?? null,
      debt_to_equity: fd.debtToEquity != null ? fd.debtToEquity / 100 : null,
      eps_ttm: ks.trailingEps ?? null,
      eps_fwd: ks.forwardEps ?? null,
      eps_past_5y: findGrowth("-5y") ?? findGrowth("5y") ?? null,
      eps_next_5y: findGrowth("+5y") ?? null,
      short_float: ks.shortPercentOfFloat ?? null,
      trailing_pe: cap(sd.trailingPE ?? null, 2000),
      ps_ratio: cap(sd.priceToSalesTrailing12Months ?? null, 500),
      pb_ratio: cap(ks.priceToBook ?? null, 200),
      ev_revenue: cap(ks.enterpriseToRevenue ?? null, 500),
      p_fcf: cap(pFcf, 2000),
      rev_growth: fd.revenueGrowth ?? null,
      gross_margin: fd.grossMargins ?? null,
      op_margin: fd.operatingMargins ?? null,
      fcf_margin: fcfMargin,
      fwd_pe: ks.forwardPE ?? sd.forwardPE ?? null,
      peg: ks.pegRatio ?? null,
      ev_ebitda: cap(ks.enterpriseToEbitda ?? null, 2000),
      ev_fcf: cap(evFcf, 2000),
    };
  } catch {
    return { roe: null, debt_to_equity: null, eps_ttm: null, eps_fwd: null, eps_past_5y: null, eps_next_5y: null, short_float: null, trailing_pe: null, ps_ratio: null, pb_ratio: null, ev_revenue: null, p_fcf: null, rev_growth: null, gross_margin: null, op_margin: null, fcf_margin: null, fwd_pe: null, peg: null, ev_ebitda: null, ev_fcf: null };
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
