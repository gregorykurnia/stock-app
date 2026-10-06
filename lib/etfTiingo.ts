import "server-only";

export interface TiingoDailyBar {
  date: string;
  close: number;
  adjustedClose: number;
  dividendCash: number;
  splitFactor: number;
}

export class TiingoRequestError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "TiingoRequestError";
  }
}

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

/** Reads Tiingo EOD data from the server with the token sent only in an authorization header. */
export async function fetchTiingoDailyHistory(
  ticker: string,
  startDate: string,
  endDateExclusive: string,
  request: typeof fetch = fetch,
): Promise<TiingoDailyBar[]> {
  const token = process.env.TIINGO_API_TOKEN?.trim();
  if (!token) throw new TiingoRequestError("TIINGO_API_TOKEN is not configured on the server.");
  if (!/^[A-Z0-9.-]{1,20}$/.test(ticker) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    || !/^\d{4}-\d{2}-\d{2}$/.test(endDateExclusive) || startDate >= endDateExclusive) {
    throw new TiingoRequestError("Ticker or history date range is invalid.");
  }

  const url = new URL(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}/prices`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDateExclusive);
  url.searchParams.set("format", "json");
  const response = await request(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new TiingoRequestError(`Tiingo EOD request failed with HTTP ${response.status}.`, response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TiingoRequestError("Tiingo EOD response was not valid JSON.");
  }
  if (!Array.isArray(payload)) throw new TiingoRequestError("Tiingo EOD response did not contain a daily-bar array.");

  const bars = payload.map((item): TiingoDailyBar | null => {
    if (!isRecord(item)) return null;
    const date = parseDate(item.date);
    const close = finiteNumber(item.close);
    const adjustedClose = finiteNumber(item.adjClose);
    const dividendCash = finiteNumber(item.divCash);
    const splitFactor = finiteNumber(item.splitFactor);
    if (!date || close == null || close <= 0 || adjustedClose == null || adjustedClose <= 0
      || dividendCash == null || dividendCash < 0 || splitFactor == null || splitFactor <= 0) return null;
    return { date, close, adjustedClose, dividendCash, splitFactor };
  });
  if (bars.some((bar) => bar === null)) throw new TiingoRequestError("Tiingo EOD response contains a malformed daily bar.");
  const result = (bars as TiingoDailyBar[]).sort((left, right) => left.date.localeCompare(right.date));
  if (result.some((bar, index) => index > 0 && result[index - 1].date === bar.date)) {
    throw new TiingoRequestError("Tiingo EOD response contains duplicate session dates.");
  }
  return result;
}
