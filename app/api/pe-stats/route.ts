import { NextRequest, NextResponse } from "next/server";
import { computePeStatsBatch } from "@/lib/valuation";
import { savePeStats } from "@/lib/firestore";

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const data = await computePeStatsBatch(tickers);

  const errorCount = Object.values(data).filter((s) => s.error).length;
  if (errorCount > 0) {
    console.warn(`[pe-stats] batch of ${tickers.length}: ${errorCount} failed`,
      Object.entries(data).filter(([, s]) => s.error).map(([t, s]) => `${t}:${s.error}`).join(", "));
  }

  // Cache results so the Master Table can read them without recomputing on every load.
  await Promise.all(
    Object.entries(data).map(([ticker, stats]) =>
      savePeStats(ticker, stats).catch((e) => console.error(`[pe-stats] savePeStats failed for ${ticker}`, e)))
  );

  return NextResponse.json({ data });
}
