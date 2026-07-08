import { NextRequest, NextResponse } from "next/server";
import { getBusinessQuality, getVerdict } from "@/lib/claude";
import { saveBusinessQuality, saveVerdict, loadStockData } from "@/lib/firestore";
import type { LatestIndicators } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, name, indicators, obvPattern, mode } = body as {
    ticker: string;
    name: string;
    indicators: LatestIndicators;
    obvPattern: string;
    mode: "auto" | "reanalyze";
  };

  if (!ticker || !indicators) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const existing = await loadStockData(ticker);

  // Business quality: only run if missing or reanalyzing
  let businessQuality = existing?.business_quality ?? null;
  if (!businessQuality || mode === "reanalyze") {
    businessQuality = await getBusinessQuality(ticker, name || ticker);
    await saveBusinessQuality(ticker, businessQuality);
  }

  // Verdict: always run fresh unless auto mode with saved verdict
  let verdict = existing?.latest_verdict ?? null;
  if (!verdict || mode === "reanalyze") {
    verdict = await getVerdict(ticker, indicators, obvPattern);
    await saveVerdict(ticker, verdict);
  }

  return NextResponse.json({ businessQuality, verdict });
}
