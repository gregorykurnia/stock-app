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
  dividend_yield: number | null;
}

// Cache exchange rates for 1 hour to avoid hammering Yahoo on every batch
const fxCache: Record<string, { rate: number; ts: number }> = {};
async function getExchangeRate(from: string, to: string): Promise<number | null> {
  const pair = `${from}${to}=X`;
  const cached = fxCache[pair];
  if (cached && Date.now() - cached.ts < 3600_000) return cached.rate;
  try {
    const q = await yf.quote(pair);
    const rate = q.regularMarketPrice ?? null;
    if (rate != null) fxCache[pair] = { rate, ts: Date.now() };
    return rate;
  } catch {
    return null;
  }
}

async function fetchOne(ticker: string): Promise<FundData> {
  try {
    const [summary, quoteData] = await Promise.all([
      yf.quoteSummary(ticker, {
        modules: ["financialData", "defaultKeyStatistics", "earningsTrend", "summaryDetail"],
      }),
      yf.quote(ticker).catch(() => null),
    ]);

    const fd = summary.financialData ?? {};
    const ks = summary.defaultKeyStatistics ?? {};
    const sd = summary.summaryDetail ?? {};
    const et = summary.earningsTrend ?? {};
    const trends: { period: string; growth?: number | null }[] = et.trend ?? [];

    const findGrowth = (period: string) =>
      trends.find((t) => t.period === period)?.growth ?? null;

    // Detect currency mismatch: stock trades in one currency but reports financials in another
    // e.g. BUMI.JK: currency=IDR, financialCurrency=USD → ratios like P/S, P/B, EV/Rev are inflated by the FX rate
    const stockCurrency: string = quoteData?.currency ?? "";
    const financialCurrency: string = quoteData?.financialCurrency ?? stockCurrency;
    let fxCorrection = 1;
    if (stockCurrency && financialCurrency && stockCurrency !== financialCurrency) {
      // Ratio = (market cap in stockCurrency) / (revenue in financialCurrency)
      // Correct = ratio / (stockCurrency per financialCurrency)
      const rate = await getExchangeRate(financialCurrency, stockCurrency);
      if (rate != null && rate > 0) fxCorrection = rate;
    }

    const evFcf = (ks.enterpriseValue != null && fd.freeCashflow != null && fd.freeCashflow > 0)
      ? ks.enterpriseValue / fd.freeCashflow / fxCorrection : null;
    const fcfMargin = (fd.freeCashflow != null && fd.totalRevenue != null && fd.totalRevenue > 0)
      ? fd.freeCashflow / fd.totalRevenue : null;
    const pFcf = (sd.marketCap != null && fd.freeCashflow != null && fd.freeCashflow > 0)
      ? sd.marketCap / fd.freeCashflow / fxCorrection : null;

    // Cap ratios that are clearly bad data
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
      ps_ratio: cap((sd.priceToSalesTrailing12Months ?? null) != null ? (sd.priceToSalesTrailing12Months as number) / fxCorrection : null, 500),
      pb_ratio: cap((ks.priceToBook ?? null) != null ? (ks.priceToBook as number) / fxCorrection : null, 200),
      ev_revenue: cap((ks.enterpriseToRevenue ?? null) != null ? (ks.enterpriseToRevenue as number) / fxCorrection : null, 500),
      p_fcf: cap(pFcf, 2000),
      rev_growth: fd.revenueGrowth ?? null,
      gross_margin: fd.grossMargins ?? null,
      op_margin: fd.operatingMargins ?? null,
      fcf_margin: fcfMargin,
      fwd_pe: ks.forwardPE ?? sd.forwardPE ?? null,
      peg: ks.pegRatio ?? null,
      ev_ebitda: cap((ks.enterpriseToEbitda ?? null) != null ? (ks.enterpriseToEbitda as number) / fxCorrection : null, 2000),
      ev_fcf: cap(evFcf, 2000),
      dividend_yield: sd.dividendYield ?? null,
    };
  } catch {
    return { roe: null, debt_to_equity: null, eps_ttm: null, eps_fwd: null, eps_past_5y: null, eps_next_5y: null, short_float: null, trailing_pe: null, ps_ratio: null, pb_ratio: null, ev_revenue: null, p_fcf: null, rev_growth: null, gross_margin: null, op_margin: null, fcf_margin: null, fwd_pe: null, peg: null, ev_ebitda: null, ev_fcf: null, dividend_yield: null };
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
