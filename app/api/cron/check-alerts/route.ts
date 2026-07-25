import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/yahooServer";
import { getWatchlist, getPushSubscriptions, updateWatchlistAlertState } from "@/lib/firestore";
import { sendPushToAll } from "@/lib/webpush";
import type { WatchlistEntry } from "@/lib/types";

function isMarketHoursET(): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);

  if (weekday === "Sat" || weekday === "Sun") return false;

  const minutesSinceMidnight = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30am
  const marketClose = 16 * 60; // 4:00pm

  return minutesSinceMidnight >= marketOpen && minutesSinceMidnight <= marketClose;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isMarketHoursET()) {
    return NextResponse.json({ skipped: "outside market hours" });
  }

  const watchlist = await getWatchlist();
  const entries = Object.entries(watchlist) as [string, WatchlistEntry][];
  const candidates = entries.filter(([, w]) => w.alert_price > 0 && !w.triggered);

  if (candidates.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0 });
  }

  const tickers = candidates.map(([ticker]) => ticker);
  const { prices } = await fetchQuotes(tickers);

  const subscriptions = await getPushSubscriptions();
  const triggeredTickers: string[] = [];

  await Promise.all(
    candidates.map(async ([ticker, w]) => {
      const price = prices[ticker];
      if (price == null) return;

      const side: "above" | "below" = price >= w.alert_price ? "above" : "below";

      if (w.last_price_side && w.last_price_side !== side) {
        // Crossed the alert price since last check — fire once.
        triggeredTickers.push(ticker);
        await updateWatchlistAlertState(ticker, { triggered: true, last_price_side: side });
        if (subscriptions.length > 0) {
          await sendPushToAll(subscriptions, {
            title: `${ticker} hit your alert price`,
            body: `${ticker} is now $${price.toFixed(2)} (alert set at $${w.alert_price.toFixed(2)})`,
            url: `/stock/${ticker}`,
          });
        }
      } else if (!w.last_price_side) {
        // First-ever check for this alert: just record the current side, don't fire.
        await updateWatchlistAlertState(ticker, { last_price_side: side });
      }
    })
  );

  return NextResponse.json({ checked: candidates.length, triggered: triggeredTickers.length, triggeredTickers });
}
