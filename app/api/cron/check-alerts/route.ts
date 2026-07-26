import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/yahooServer";
import {
  getWatchlist, updateWatchlistAlertState,
  getPriceAlerts, updatePriceAlertState,
  getPushSubscriptions,
} from "@/lib/firestore";
import { sendPushToAll } from "@/lib/webpush";
import type { WatchlistEntry, PriceAlert } from "@/lib/types";

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

interface AlertLike {
  ticker: string;
  alert_price: number;
  triggered?: boolean;
  last_price_side?: "above" | "below";
  notes?: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isMarketHoursET()) {
    return NextResponse.json({ skipped: "outside market hours" });
  }

  const [watchlist, priceAlerts] = await Promise.all([getWatchlist(), getPriceAlerts()]);

  const watchlistCandidates: AlertLike[] = (Object.entries(watchlist) as [string, WatchlistEntry][])
    .filter(([, w]) => w.alert_price > 0 && !w.triggered)
    .map(([ticker, w]) => ({ ticker, alert_price: w.alert_price, triggered: w.triggered, last_price_side: w.last_price_side }));

  const standaloneCandidates: AlertLike[] = (Object.entries(priceAlerts) as [string, PriceAlert][])
    .filter(([, a]) => a.alert_price > 0 && !a.triggered)
    .map(([ticker, a]) => ({ ticker, alert_price: a.alert_price, triggered: a.triggered, last_price_side: a.last_price_side, notes: a.notes }));

  const allTickers = Array.from(new Set([...watchlistCandidates, ...standaloneCandidates].map((c) => c.ticker)));

  if (allTickers.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0 });
  }

  const { prices } = await fetchQuotes(allTickers);
  const subscriptions = await getPushSubscriptions();
  const triggeredTickers: string[] = [];

  async function processCandidate(c: AlertLike, updateState: (ticker: string, data: { triggered?: boolean; last_price_side?: "above" | "below" }) => Promise<void>) {
    const price = prices[c.ticker];
    if (price == null) return;

    const side: "above" | "below" = price >= c.alert_price ? "above" : "below";

    if (c.last_price_side && c.last_price_side !== side) {
      triggeredTickers.push(c.ticker);
      await updateState(c.ticker, { triggered: true, last_price_side: side });
      if (subscriptions.length > 0) {
        const priceLine = `${c.ticker} is now $${price.toFixed(2)} (alert set at $${c.alert_price.toFixed(2)})`;
        await sendPushToAll(subscriptions, {
          title: `${c.ticker} hit your alert price`,
          body: c.notes ? `${priceLine}\n${c.notes}` : priceLine,
          url: `/stock/${c.ticker}`,
        });
      }
    } else if (!c.last_price_side) {
      // First-ever check for this alert: just record the current side, don't fire.
      await updateState(c.ticker, { last_price_side: side });
    }
  }

  await Promise.all([
    ...watchlistCandidates.map((c) => processCandidate(c, updateWatchlistAlertState)),
    ...standaloneCandidates.map((c) => processCandidate(c, updatePriceAlertState)),
  ]);

  return NextResponse.json({
    checked: watchlistCandidates.length + standaloneCandidates.length,
    triggered: triggeredTickers.length,
    triggeredTickers,
  });
}
