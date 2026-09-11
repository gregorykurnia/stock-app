// Pure financial calculations for the Global Markets dashboard. No fetching, no
// React, no server-only APIs — every function here is directly unit-testable.
//
// Conventions:
//   - All dates are "YYYY-MM-DD" strings (UTC calendar dates of the session).
//   - Bars are ascending by date with null closes already filtered out.
//   - Returns are percentages: (latest / comparison - 1) * 100, rounded to 4 dp
//     by the caller's formatter (raw values stay unrounded here).
//   - Any computation that cannot be done honestly returns null — the UI renders
//     "—". Never NaN, never Infinity, never a misleading 0.

import type { TrendState } from "./types";

export interface HistoryBar {
  date: string; // "YYYY-MM-DD"
  close: number;
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseISODate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00Z`);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateISO: string, days: number): string {
  return toISODate(new Date(parseISODate(dateISO).getTime() + days * MS_PER_DAY));
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / MS_PER_DAY);
}

// Last bar whose date is <= targetDate. Returns null when every bar is after the
// target (the "nearest prior available trading close" per the product spec).
export function findCloseOnOrBefore(bars: HistoryBar[], targetDate: string): HistoryBar | null {
  let result: HistoryBar | null = null;
  for (const bar of bars) {
    if (bar.date <= targetDate) result = bar;
    else break;
  }
  return result;
}

// Period return in percent vs the nearest prior close at or before targetDate.
// latestOverride lets the caller use the freshest quote price instead of the last
// bar close (they normally match; the override wins when the quote is ahead).
// Null when there is no earlier observation to compare against.
export function periodReturnPct(bars: HistoryBar[], targetDate: string, latestOverride?: number | null): number | null {
  const latestBar = bars.at(-1);
  if (!latestBar) return null;
  const latest = latestOverride != null && Number.isFinite(latestOverride) ? latestOverride : latestBar.close;
  const comparison = findCloseOnOrBefore(bars, targetDate);
  if (!comparison || comparison.date >= latestBar.date) return null;
  return pctChange(latest, comparison.close);
}

export function pctChange(latest: number, comparison: number): number | null {
  if (!Number.isFinite(latest) || !Number.isFinite(comparison) || comparison === 0) return null;
  return (latest / comparison - 1) * 100;
}

// Absolute change in basis points — for yield moves. (latest - comparison) * 100.
export function changeBp(latest: number, comparison: number): number | null {
  if (!Number.isFinite(latest) || !Number.isFinite(comparison)) return null;
  return (latest - comparison) * 100;
}

// Simple moving average of the last `period` values. Null when insufficient data.
export function smaAt(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

// Trend classification per the product spec:
//   rising       — close above the 20-day MA and the 20-day MA is rising
//   falling      — close below the 20-day MA and the 20-day MA is falling
//   range-bound  — everything else
//   unavailable  — fewer than 21 closes (need MA20 today and yesterday's MA20)
export function trendFromCloses(closes: number[]): TrendState {
  if (closes.length < 21) return "unavailable";
  const latest = closes[closes.length - 1];
  const ma20 = smaAt(closes, 20);
  const ma20Prev = smaAt(closes.slice(0, -1), 20);
  if (ma20 == null || ma20Prev == null) return "unavailable";
  if (latest > ma20 && ma20 > ma20Prev) return "rising";
  if (latest < ma20 && ma20 < ma20Prev) return "falling";
  return "range-bound";
}

// Highest / lowest close within `lookbackDays` of the latest bar.
export function rangeOverBars(bars: HistoryBar[], lookbackDays: number): { high: number; low: number } | null {
  const latest = bars.at(-1);
  if (!latest) return null;
  const cutoff = addDays(latest.date, -lookbackDays);
  let high: number | null = null;
  let low: number | null = null;
  for (const bar of bars) {
    if (bar.date < cutoff) continue;
    if (high == null || bar.close > high) high = bar.close;
    if (low == null || bar.close < low) low = bar.close;
  }
  if (high == null || low == null) return null;
  return { high, low };
}

// 52-week position: (latest - low) / (high - low) * 100.
// Null when the high-low range is zero (flat for a year — position is meaningless)
// or when inputs are missing.
export function positionInRange(latest: number | null, low: number | null, high: number | null): number | null {
  if (latest == null || low == null || high == null) return null;
  if (!Number.isFinite(latest) || !Number.isFinite(low) || !Number.isFinite(high)) return null;
  const span = high - low;
  if (span <= 0) return null;
  return ((latest - low) / span) * 100;
}

export function median(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

// Reconstructs the comparison close behind a return: given the latest price and
// its period return (percent), returns price / (1 + returnPct/100). Used by the
// cross-market signals to derive past ratio values without shipping full history
// to the client. Null when the reconstruction would divide by zero.
export function priceBeforeReturn(latest: number | null, returnPct: number | null): number | null {
  if (latest == null || returnPct == null || !Number.isFinite(latest) || !Number.isFinite(returnPct)) return null;
  const divisor = 1 + returnPct / 100;
  if (divisor <= 0) return null;
  return latest / divisor;
}

// Daily change derived from chart bars when a quote is unavailable (e.g. CT=F):
// previous close = the bar before the last one (works both while the latest bar
// is an in-progress session and after it completes).
export function previousCloseFromBars(bars: HistoryBar[]): number | null {
  return bars.length >= 2 ? bars[bars.length - 2].close : null;
}

// Comparison target dates anchored to the latest bar (stable across weekends —
// a Friday close viewed on Sunday still compares to the prior Friday's window).
export function returnTargets(latestBarDate: string): { week: string; month: string; ytd: string } {
  const year = Number(latestBarDate.slice(0, 4));
  return {
    week: addDays(latestBarDate, -7),
    month: addDays(latestBarDate, -30),
    ytd: `${year - 1}-12-31`,
  };
}

// Sparkline window: every bar within `lookbackDays` of the latest bar.
export function sparklineFromBars(bars: HistoryBar[], lookbackDays = 30): Array<{ time: string; value: number }> {
  const latest = bars.at(-1);
  if (!latest) return [];
  const cutoff = addDays(latest.date, -lookbackDays);
  return bars.filter((bar) => bar.date >= cutoff).map((bar) => ({ time: bar.date, value: bar.close }));
}
