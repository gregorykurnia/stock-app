import { NextRequest, NextResponse } from "next/server";
import { buildPortfolioSnapshot } from "@/lib/portfolioSnapshotServer";
import { newYorkMarketContext } from "@/lib/portfolioSchedule";
import {
  getPortfolioPerformanceSnapshot,
  savePortfolioPerformanceSnapshot,
} from "@/lib/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  const authHeader = req.headers.get("authorization");

  if (!preview && process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const context = newYorkMarketContext();
    if (!preview && (!context.isWeekday || !context.isAfterCloseBuffer)) {
      return NextResponse.json({
        skipped: "outside the post-close capture window",
        sessionDate: context.sessionDate,
        weekday: context.weekday,
      });
    }

    const snapshot = await buildPortfolioSnapshot(preview ? "preview" : "scheduled");

    // A stale quote date means today was a market holiday or the provider has not published
    // the session close yet. A preview may still display it, but scheduled runs must not save it.
    if (!preview && snapshot.sessionDate !== context.sessionDate) {
      return NextResponse.json({
        skipped: "no US market close is available for the current New York date",
        expectedSessionDate: context.sessionDate,
        quoteSessionDate: snapshot.sessionDate,
      });
    }

    if (preview) return NextResponse.json({ preview: true, snapshot });

    const existing = await getPortfolioPerformanceSnapshot(snapshot.sessionDate);
    if (existing?.status === "complete") {
      return NextResponse.json({ skipped: "complete snapshot already exists", snapshot: existing });
    }

    await savePortfolioPerformanceSnapshot(snapshot);
    return NextResponse.json({ saved: true, snapshot }, { status: snapshot.status === "partial" ? 207 : 200 });
  } catch (error) {
    console.error("[portfolio-snapshot] capture failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Snapshot capture failed",
    }, { status: 500 });
  }
}
