// Pure parser for Tiingo EOD payloads. No server-only import, so the tests can load it.
// Volume is kept as the raw session volume (Tiingo `volume`), which is what the liquidity measure uses.

export interface TiingoDailyBar {
  date: string;
  close: number;
  adjustedClose: number;
  volume: number;
  dividendCash: number;
  splitFactor: number;
}

export type TiingoParseResult = { bars: TiingoDailyBar[] } | { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseTiingoDailyBars(payload: unknown): TiingoParseResult {
  if (!Array.isArray(payload)) return { error: "Tiingo EOD response did not contain a daily-bar array." };

  const bars = payload.map((item): TiingoDailyBar | null => {
    if (!isRecord(item)) return null;
    const date = parseDate(item.date);
    const close = finiteNumber(item.close);
    const adjustedClose = finiteNumber(item.adjClose);
    const volume = finiteNumber(item.volume);
    const dividendCash = finiteNumber(item.divCash);
    const splitFactor = finiteNumber(item.splitFactor);
    if (!date || close == null || close <= 0 || adjustedClose == null || adjustedClose <= 0
      || volume == null || volume < 0 || dividendCash == null || dividendCash < 0 || splitFactor == null || splitFactor <= 0) return null;
    return { date, close, adjustedClose, volume, dividendCash, splitFactor };
  });
  if (bars.some((bar) => bar === null)) return { error: "Tiingo EOD response contains a malformed daily bar." };

  const result = (bars as TiingoDailyBar[]).sort((left, right) => left.date.localeCompare(right.date));
  if (result.some((bar, index) => index > 0 && result[index - 1].date === bar.date)) {
    return { error: "Tiingo EOD response contains duplicate session dates." };
  }
  return { bars: result };
}
