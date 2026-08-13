import { NextRequest, NextResponse } from "next/server";
import { computePeStatsBatch } from "@/lib/valuation";
import { savePeStats } from "@/lib/firestore";

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const data = await computePeStatsBatch(tickers);

  // Cache results so the Master Table can read them without recomputing on every load.
  await Promise.all(
    Object.entries(data).map(([ticker, stats]) => savePeStats(ticker, stats).catch(() => {}))
  );

  return NextResponse.json({ data });
}
