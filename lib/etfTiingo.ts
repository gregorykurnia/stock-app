import "server-only";
import { parseTiingoDailyBars, type TiingoDailyBar } from "./etfTiingoParse";

export type { TiingoDailyBar } from "./etfTiingoParse";

export class TiingoRequestError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "TiingoRequestError";
  }
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
  const parsed = parseTiingoDailyBars(payload);
  if ("error" in parsed) throw new TiingoRequestError(parsed.error);
  return parsed.bars;
}
