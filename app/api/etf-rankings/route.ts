import { NextRequest, NextResponse } from "next/server";
import { getETFRankingRun } from "@/lib/etfRankingStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only. Serves stored runs only and makes no provider calls. Import nothing from lib/etfTiingo here.
export async function GET(request: NextRequest) {
  const cutoff = request.nextUrl.searchParams.get("cutoff")?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
    return NextResponse.json({ error: "cutoff must be YYYY-MM-DD" }, { status: 400 });
  }
  const run = await getETFRankingRun(cutoff);
  if (!run) return NextResponse.json({ error: "No stored run for this cutoff." }, { status: 404 });
  return NextResponse.json(run, { headers: { "Cache-Control": "no-store" } });
}
