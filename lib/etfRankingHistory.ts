import type { RankingBar } from "./etfRanking";
import type { TiingoDailyBar } from "./etfTiingoParse";

// Full-history store for the ranking run (plan Section 6). Separate from the Core store, which keeps about 37 months.
// Each fund has one document per calendar year at etf_ranking_history/{ticker}/years/{year}. Nothing is trimmed here.

export const FULL_HISTORY_COLLECTION = "etf_ranking_history";
export const FULL_HISTORY_SOURCE_ID = "tiingo-eod-full";

export interface FullHistoryBar {
  date: string;
  close: number;
  adjustedClose: number;
  volume: number;
}

export interface FullHistoryYearDoc {
  ticker: string;
  year: number;
  sourceId: string;
  fetchedAt: string;
  bars: FullHistoryBar[];
}

// Groups one fetch by calendar year. Firestore documents must stay well under 1 MiB, and a year is about 250 bars.
export function groupBarsByYear(ticker: string, bars: readonly TiingoDailyBar[], fetchedAt: string): FullHistoryYearDoc[] {
  const byYear = new Map<number, FullHistoryBar[]>();
  for (const bar of bars) {
    const year = Number(bar.date.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ date: bar.date, close: bar.close, adjustedClose: bar.adjustedClose, volume: bar.volume });
  }
  return [...byYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, yearBars]) => ({ ticker, year, sourceId: FULL_HISTORY_SOURCE_ID, fetchedAt, bars: yearBars }));
}

// Rebuilds ranking bars from stored year documents, in date order.
export function rankingBarsFrom(docs: readonly FullHistoryYearDoc[]): RankingBar[] {
  return docs
    .flatMap((doc) => doc.bars.map((bar) => ({ date: bar.date, close: bar.close, adjustedClose: bar.adjustedClose, volume: bar.volume })))
    .sort((left, right) => left.date.localeCompare(right.date));
}

// The run uses history up to and including the cutoff. Later bars stay in the store but are left out of the run and its hash.
export function barsThrough(bars: readonly RankingBar[], cutoff: string): RankingBar[] {
  return bars.filter((bar) => bar.date <= cutoff);
}
