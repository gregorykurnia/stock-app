// Display formatting for the Global Markets dashboard. Pure functions — used by
// client components and covered indirectly via the calculation tests.

import type { InstrumentType, MarketInstrument } from "./types";

export const MISSING = "—";

export function formatPrice(value: number | null | undefined, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatBp(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)} bp`;
}

export function formatSigned(value: number | null | undefined, digits = 2, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return value.toFixed(digits);
}

// Instrument Latest column: yields carry a % suffix, everything else is a plain level.
export function formatLatest(instrument: MarketInstrument, decimals: number): string {
  if (instrument.price == null || !Number.isFinite(instrument.price)) return MISSING;
  if (instrument.instrumentType === "yield") return `${instrument.price.toFixed(decimals)}%`;
  return formatPrice(instrument.price, decimals);
}

// 1D/1W/1M/YTD cells: yield rows move in basis points (unambiguous, standard for
// rates), everything else shows percentage returns.
export function formatChangeCell(instrument: MarketInstrument, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  if (instrument.instrumentType === "yield") return formatBp(value * 100);
  return formatPct(value);
}

export function formatPosition52w(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${Math.round(value)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Sep 11" — for the compact Updated column.
export function formatDateShort(dateISO: string | null | undefined): string {
  if (!dateISO) return MISSING;
  const date = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return MISSING;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

// "Sep 11, 03:56 ET" — quote timestamps for card headers.
export function formatTimestampET(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("hour")}:${get("minute")} ET`;
}

export function trendLabel(trend: string): string {
  if (trend === "rising") return "Rising";
  if (trend === "falling") return "Falling";
  if (trend === "range-bound") return "Range-bound";
  return "Insufficient data";
}

export function trendArrow(trend: string): string {
  if (trend === "rising") return "↗";
  if (trend === "falling") return "↘";
  if (trend === "range-bound") return "→";
  return "·";
}

// US market session label from the current time in America/New_York — used for
// the status chip, computed client-side only (never during SSR).
export type MarketSession = "pre-market" | "open" | "post-market" | "closed";

export function usMarketSession(now: Date = new Date()): { session: MarketSession; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const weekend = weekday === "Sat" || weekday === "Sun";
  if (weekend) return { session: "closed", label: "US market closed (weekend)" };
  if (minutes >= 240 && minutes < 570) return { session: "pre-market", label: "US pre-market" };
  if (minutes >= 570 && minutes < 960) return { session: "open", label: "US market open" };
  if (minutes >= 960 && minutes < 1200) return { session: "post-market", label: "US post-market" };
  return { session: "closed", label: "US market closed" };
}

export function instrumentTypeLabel(type: InstrumentType): string {
  switch (type) {
    case "future": return "Futures";
    case "index": return "Index";
    case "yield": return "Yield index";
    case "etf": return "ETF";
    case "currency": return "Currency pair";
  }
}
