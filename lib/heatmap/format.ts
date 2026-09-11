// Display formatting for the US Market Heatmap. Pure functions — used by client
// components and unit-tested alongside the calculation tests.

import type { HeatmapPeriod } from "./types";

export const MISSING = "—";

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value.toFixed(digits)}×`;
}

// "$3.4T" / "$812.3B" — market caps and dollar volumes.
export function formatLargeUsd(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value) || value < 0) return MISSING;
  if (value >= 1e12) return `$${(value / 1e12).toFixed(digits)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(digits)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(digits)}M`;
  return `$${value.toFixed(0)}`;
}

// "48.2M" — share volumes.
export function formatCompactShares(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return MISSING;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(0);
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Sep 11, 15:47 ET" — quote timestamps, matching the Markets dashboard style.
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

export function periodShortLabel(period: HeatmapPeriod): string {
  return period;
}
