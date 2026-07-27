import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes, fetchEarningsDates } from "@/lib/yahooServer";
import {
  getWatchlist, updateWatchlistAlertState, updateWatchlistEarningsAlert,
  getPriceAlerts, updatePriceAlertState, updatePriceAlertEarnings,
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

function todayET(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

interface AlertLike {
  ticker: string;
  alert_price: number;
  triggered?: boolean;
  last_price_side?: "above" | "below";
  notes?: string;
}

interface EarningsAlertLike {
  ticker: string;
  earnings_date?: string | null;
  earnings_alert_fired?: boolean;
  notes?: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [watchlist, priceAlerts] = await Promise.all([getWatchlist(), getPriceAlerts()]);
  const subscriptions = await getPushSubscriptions();

  // --- Earnings-triggered alerts: checked every run, regardless of market hours ---
  const watchlistEarningsCandidates: EarningsAlertLike[] = (Object.entries(watchlist) as [string, WatchlistEntry][])
    .filter(([, w]) => w.earnings_alert)
    .map(([ticker, w]) => ({ ticker, earnings_date: w.earnings_date, earnings_alert_fired: w.earnings_alert_fired, notes: w.notes }));

  const standaloneEarningsCandidates: EarningsAlertLike[] = (Object.entries(priceAlerts) as [string, PriceAlert][])
    .filter(([, a]) => a.earnings_alert)
    .map(([ticker, a]) => ({ ticker, earnings_date: a.earnings_date, earnings_alert_fired: a.earnings_alert_fired, notes: a.notes }));

  const earningsTickers = Array.from(new Set([...watchlistEarningsCandidates, ...standaloneEarningsCandidates].map((c) => c.ticker)));
  const earningsFiredTickers: string[] = [];

  if (earningsTickers.length > 0) {
    const freshDates = await fetchEarningsDates(earningsTickers);
    const today = todayET();

    async function processEarningsCandidate(c: EarningsAlertLike, updateState: (ticker: string, data: { earnings_alert?: boolean; earnings_date?: string | null; earnings_alert_fired?: boolean }) => Promise<void>) {
      const freshDate = freshDates[c.ticker] ?? null;

      if (!c.earnings_date) {
        // First time arming: just record the known upcoming earnings date.
        if (freshDate) await updateState(c.ticker, { earnings_date: freshDate, earnings_alert_fired: false });
        return;
      }

      if (!c.earnings_alert_fired && c.earnings_date < today) {
        // Stored earnings date has passed and we haven't notified yet — fire once.
        earningsFiredTickers.push(c.ticker);
        await updateState(c.ticker, { earnings_alert_fired: true });
        if (subscriptions.length > 0) {
          const line = `${c.ticker} reported earnings on ${c.earnings_date} — check for entry`;
          await sendPushToAll(subscriptions, {
            title: `${c.ticker} earnings reported`,
            body: c.notes ? `${line}\n${c.notes}` : line,
            url: `/stock/${c.ticker}`,
          });
        }
      } else if (c.earnings_alert_fired && freshDate && freshDate !== c.earnings_date) {
        // Yahoo rolled to the next quarter's date — re-arm automatically.
        await updateState(c.ticker, { earnings_date: freshDate, earnings_alert_fired: false });
      }
    }

    await Promise.all([
      ...watchlistEarningsCandidates.map((c) => processEarningsCandidate(c, updateWatchlistEarningsAlert)),
      ...standaloneEarningsCandidates.map((c) => processEarningsCandidate(c, updatePriceAlertEarnings)),
    ]);
  }

  // --- Price alerts: only checked during market hours ---
  if (!isMarketHoursET()) {
    return NextResponse.json({ skipped: "outside market hours (price alerts only)", earningsChecked: earningsTickers.length, earningsFired: earningsFiredTickers.length, earningsFiredTickers });
  }

  const watchlistCandidates: AlertLike[] = (Object.entries(watchlist) as [string, WatchlistEntry][])
    .filter(([, w]) => w.alert_price > 0 && !w.triggered)
    .map(([ticker, w]) => ({ ticker, alert_price: w.alert_price, triggered: w.triggered, last_price_side: w.last_price_side }));

  const standaloneCandidates: AlertLike[] = (Object.entries(priceAlerts) as [string, PriceAlert][])
    .filter(([, a]) => a.alert_price > 0 && !a.triggered)
    .map(([ticker, a]) => ({ ticker, alert_price: a.alert_price, triggered: a.triggered, last_price_side: a.last_price_side, notes: a.notes }));

  const allTickers = Array.from(new Set([...watchlistCandidates, ...standaloneCandidates].map((c) => c.ticker)));

  if (allTickers.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0, earningsChecked: earningsTickers.length, earningsFired: earningsFiredTickers.length, earningsFiredTickers });
  }

  const { prices } = await fetchQuotes(allTickers);
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
    earningsChecked: earningsTickers.length,
    earningsFired: earningsFiredTickers.length,
    earningsFiredTickers,
  });
}
