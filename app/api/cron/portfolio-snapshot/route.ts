import { NextRequest, NextResponse } from "next/server";
import { buildPortfolioSnapshot, recaptureAffectedPortfolioSnapshots, recoverPortfolioSnapshots } from "@/lib/portfolioSnapshotServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  const recapture = req.nextUrl.searchParams.get("recapture") === "1";
  const audit = req.nextUrl.searchParams.get("audit") === "1";
  const authHeader = req.headers.get("authorization");

  if (!preview && (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    if (!preview && !recapture) {
      const result = await recoverPortfolioSnapshots(audit);
      return NextResponse.json(result, { status: result.healthy ? 200 : 503 });
    }
    if (!preview && recapture) {
      return NextResponse.json({ recaptured: await recaptureAffectedPortfolioSnapshots() });
    }
    return NextResponse.json({ preview: true, snapshot: await buildPortfolioSnapshot("preview") });
  } catch (error) {
    console.error("[portfolio-snapshot] capture failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Snapshot capture failed",
    }, { status: 500 });
  }
}
