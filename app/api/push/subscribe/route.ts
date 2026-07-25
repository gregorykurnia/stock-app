import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const keys = body?.keys;

  if (typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  await savePushSubscription({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  return NextResponse.json({ ok: true });
}
