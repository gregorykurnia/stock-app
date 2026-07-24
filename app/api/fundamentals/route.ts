import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function getExchangeRate(from: string, to: string): Promise<number | null> {
  try {
    const q = await yf.quote(`${from}${to}=X`);
    return q.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const [summary, quote] = await Promise.all([
      yf.quoteSummary(ticker.toUpperCase(), {
        modules: ["financialData", "defaultKeyStatistics", "summaryProfile"],
      }),
      yf.quote(ticker.toUpperCase()),
    ]);

    const fd = summary.financialData ?? {};
    const ks = summary.defaultKeyStatistics ?? {};
    const sp = summary.summaryProfile ?? {};

    // FX correction: same logic as /api/funddata
    // Some stocks (e.g. Indonesian stocks reporting in USD) have EV in stock currency
    // but financials in another currency, inflating ratios like EV/EBITDA by the FX rate.
    const stockCurrency: string = quote?.currency ?? "";
    const financialCurrency: string = quote?.financialCurrency ?? stockCurrency;
    let fxCorrection = 1;
    if (stockCurrency && financialCurrency && stockCurrency !== financialCurrency) {
      const rate = await getExchangeRate(financialCurrency, stockCurrency);
      if (rate != null && rate > 0) fxCorrection = rate;
    }

    const totalRevenue: number | null = fd.totalRevenue ?? null;
    const freeCashflow: number | null = fd.freeCashflow ?? null;
    const fcf_margin = totalRevenue && freeCashflow ? freeCashflow / totalRevenue : null;
    const ev: number | null = ks.enterpriseValue ?? null;
    const ev_fcf = ev && freeCashflow && freeCashflow > 0 ? ev / freeCashflow / fxCorrection : null;
    const ev_ebitda = ks.enterpriseToEbitda != null ? ks.enterpriseToEbitda / fxCorrection : null;

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      name: quote?.longName ?? quote?.shortName ?? ticker.toUpperCase(),
      sector: sp.sector ?? null,
      industry: sp.industry ?? null,
      rev_growth: fd.revenueGrowth ?? null,
      gross_margin: fd.grossMargins ?? null,
      op_margin: fd.operatingMargins ?? null,
      net_margin: fd.profitMargins ?? null,
      fcf_margin,
      ebitda_margin: fd.ebitdaMargins ?? null,
      fwd_pe: ks.forwardPE ?? null,
      peg: ks.pegRatio ?? null,
      ev_ebitda,
      ev_fcf,
      price_to_book: ks.priceToBook != null ? ks.priceToBook / fxCorrection : null,
      price: quote?.regularMarketPrice ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
