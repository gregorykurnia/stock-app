import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

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

    const totalRevenue: number | null = fd.totalRevenue ?? null;
    const freeCashflow: number | null = fd.freeCashflow ?? null;
    const fcf_margin = totalRevenue && freeCashflow ? freeCashflow / totalRevenue : null;
    const ev: number | null = ks.enterpriseValue ?? null;
    const ev_fcf = ev && freeCashflow && freeCashflow > 0 ? ev / freeCashflow : null;

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
      ev_ebitda: ks.enterpriseToEbitda ?? null,
      ev_fcf,
      price_to_book: ks.priceToBook ?? null,
      price: quote?.regularMarketPrice ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
