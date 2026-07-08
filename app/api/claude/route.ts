import { NextRequest, NextResponse } from "next/server";
import { getBusinessQuality, getVerdict } from "@/lib/claude";
import { saveBusinessQuality, saveVerdict, loadStockData } from "@/lib/firestore";
import type { LatestIndicators, HistoricalArrays } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, name, indicators, historicalArrays, mode } = body as {
    ticker: string;
    name: string;
    indicators: LatestIndicators;
    historicalArrays: HistoricalArrays;
    mode: "auto" | "reanalyze";
  };

  if (!ticker || !indicators) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const existing = await loadStockData(ticker);

  // Business quality: only run if missing or reanalyzing
  let businessQuality = existing?.business_quality ?? null;
  if (!businessQuality || mode === "reanalyze") {
    try {
      businessQuality = await getBusinessQuality(ticker, name || ticker);
      await saveBusinessQuality(ticker, businessQuality);
    } catch (e) {
      return NextResponse.json({ error: `Business quality failed: ${e instanceof Error ? e.message : e}` }, { status: 500 });
    }
  }

  // Verdict: always run fresh unless auto mode with saved verdict
  let verdict = existing?.latest_verdict ?? null;
  if (!verdict || mode === "reanalyze") {
    try {
      verdict = await getVerdict(ticker, indicators, historicalArrays);
      await saveVerdict(ticker, verdict);
    } catch (e) {
      return NextResponse.json({ error: `Verdict failed: ${e instanceof Error ? e.message : e}` }, { status: 500 });
    }
  }

  return NextResponse.json({ businessQuality, verdict });
}
