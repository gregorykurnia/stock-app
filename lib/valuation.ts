// Server-only. Computes a stock's current trailing P/E vs. its own 5-year P/E history
// (mean, std dev, z-score) using SEC EDGAR (EPS history) + Yahoo Finance (price history).
// Do not import from client components.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SEC_USER_AGENT = "stock-app research contact:gregory.kurnia@gmail.com";
const MIN_SAMPLE_SIZE = 8; // require at least 8 quarterly TTM points to trust a z-score
const LOOKBACK_YEARS = 5;

export interface PeStats {
  ticker: string;
  currentPe: number | null;
  currentEpsTtm: number | null;
  currentPrice: number | null;
  meanPe5y: number | null;
  stdDevPe5y: number | null;
  zScore: number | null;
  sampleSize: number;
  asOfDate: string; // ISO date of the price used for "current"
  lastUpdated: string; // ISO timestamp of computation
  error?: string; // "no_cik" | "insufficient_data" | "negative_eps" | "fetch_failed"
}

// ---- CIK lookup (SEC ticker -> CIK mapping, cached in-memory per server instance) ----
let cikMapPromise: Promise<Map<string, string>> | null = null;

async function getCikMap(): Promise<Map<string, string>> {
  if (!cikMapPromise) {
    cikMapPromise = (async () => {
      const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": SEC_USER_AGENT },
      });
      if (!res.ok) throw new Error(`SEC ticker map fetch failed: ${res.status}`);
      const data = await res.json() as Record<string, { cik_str: number; ticker: string; title: string }>;
      const map = new Map<string, string>();
      for (const entry of Object.values(data)) {
        map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
      }
      return map;
    })();
  }
  return cikMapPromise;
}

async function getCik(ticker: string): Promise<string | null> {
  const map = await getCikMap();
  return map.get(ticker.toUpperCase()) ?? null;
}

// ---- EPS history from SEC EDGAR ----
interface RawUnit {
  start: string;
  end: string;
  val: number;
  form: string;
  filed: string;
}

interface QuarterPoint {
  end: string; // ISO date
  eps: number;
}

async function fetchEpsConcept(cik: string, concept: string): Promise<RawUnit[] | null> {
  const res = await fetch(
    `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`,
    { headers: { "User-Agent": SEC_USER_AGENT } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.units?.["USD/shares"] ?? null;
}

async function getQuarterlyEpsHistory(ticker: string): Promise<QuarterPoint[] | null> {
  const cik = await getCik(ticker);
  if (!cik) return null;

  let units = await fetchEpsConcept(cik, "EarningsPerShareDiluted");
  if (!units || units.length === 0) units = await fetchEpsConcept(cik, "EarningsPerShareBasic");
  if (!units || units.length === 0) return null;

  const dayDiff = (start: string, end: string) =>
    (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;

  // Single-quarter entries (~80-100 day periods), keep the most recently filed value per end date
  const quarterlyByEnd = new Map<string, { val: number; filed: string }>();
  for (const u of units) {
    const days = dayDiff(u.start, u.end);
    if (days < 80 || days > 100) continue;
    if (u.form !== "10-Q" && u.form !== "10-K") continue;
    const existing = quarterlyByEnd.get(u.end);
    if (!existing || u.filed > existing.filed) quarterlyByEnd.set(u.end, { val: u.val, filed: u.filed });
  }

  // Annual entries (~330-380 day periods) — used to derive a missing standalone Q4
  // (many companies only report Q4 inside the 10-K as the full-year figure).
  const annualByEnd = new Map<string, { start: string; val: number; filed: string }>();
  for (const u of units) {
    const days = dayDiff(u.start, u.end);
    if (days < 330 || days > 380) continue;
    if (u.form !== "10-K") continue;
    const existing = annualByEnd.get(u.end);
    if (!existing || u.filed > existing.filed) annualByEnd.set(u.end, { start: u.start, val: u.val, filed: u.filed });
  }

  const quarters: QuarterPoint[] = Array.from(quarterlyByEnd.entries()).map(([end, v]) => ({ end, eps: v.val }));

  // Derive missing Q4 for each fiscal year: annual EPS minus the other 3 quarters already known
  for (const [annualEnd, annual] of annualByEnd.entries()) {
    // Skip if a quarter already ends within 10 days of the annual end (Q4 already reported standalone)
    const alreadyCovered = quarters.some((q) => Math.abs(dayDiff(q.end, annualEnd)) <= 10);
    if (alreadyCovered) continue;

    const priorQuarters = quarters
      .filter((q) => new Date(q.end) < new Date(annualEnd) && new Date(q.end) > new Date(annual.start))
      .sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime())
      .slice(0, 3);

    if (priorQuarters.length === 3) {
      const q4 = annual.val - priorQuarters.reduce((s, q) => s + q.eps, 0);
      quarters.push({ end: annualEnd, eps: q4 });
    }
  }

  quarters.sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime());
  return quarters;
}

// ---- TTM EPS series ----
interface TtmPoint {
  end: string;
  eps: number;
}

function buildTtmSeries(quarters: QuarterPoint[]): TtmPoint[] {
  const ttm: TtmPoint[] = [];
  for (let i = 3; i < quarters.length; i++) {
    const sum = quarters[i - 3].eps + quarters[i - 2].eps + quarters[i - 1].eps + quarters[i].eps;
    ttm.push({ end: quarters[i].end, eps: sum });
  }
  return ttm;
}

// ---- Price history from Yahoo ----
async function getPriceByDate(ticker: string, fromDate: Date, toDate: Date): Promise<Map<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker.toUpperCase(), {
    period1: fromDate,
    period2: toDate,
    interval: "1d",
  });
  const map = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of result?.quotes ?? []) {
    if (q.close == null) continue;
    map.set(new Date(q.date).toISOString().slice(0, 10), q.close);
  }
  return map;
}

function nearestPrice(priceByDate: Map<string, number>, targetDate: string): number | null {
  const dates = Array.from(priceByDate.keys());
  if (dates.length === 0) return null;
  let best: string | null = null;
  let bestDiff = Infinity;
  const target = new Date(targetDate).getTime();
  for (const d of dates) {
    const diff = Math.abs(new Date(d).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  }
  return best ? priceByDate.get(best)! : null;
}

function mean(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  const m = mean(nums);
  const variance = nums.reduce((s, n) => s + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

export async function computePeStats(ticker: string): Promise<PeStats> {
  const now = new Date();
  const nowIso = now.toISOString();
  const base: PeStats = {
    ticker, currentPe: null, currentEpsTtm: null, currentPrice: null,
    meanPe5y: null, stdDevPe5y: null, zScore: null, sampleSize: 0,
    asOfDate: nowIso.slice(0, 10), lastUpdated: nowIso,
  };

  try {
    const quarters = await getQuarterlyEpsHistory(ticker);
    if (!quarters) return { ...base, error: "no_cik" };

    const ttmSeries = buildTtmSeries(quarters);
    if (ttmSeries.length === 0) return { ...base, error: "insufficient_data" };

    const fromDate = new Date(now.getTime() - (LOOKBACK_YEARS + 0.3) * 365 * 86_400_000);
    const priceByDate = await getPriceByDate(ticker, fromDate, now);
    if (priceByDate.size === 0) return { ...base, error: "fetch_failed" };

    const cutoff = new Date(now.getTime() - LOOKBACK_YEARS * 365 * 86_400_000);
    const windowed = ttmSeries.filter((t) => new Date(t.end) >= cutoff);

    const pePoints: number[] = [];
    for (const t of windowed) {
      if (t.eps <= 0) continue; // undefined P/E for negative/zero earnings
      const price = nearestPrice(priceByDate, t.end);
      if (price == null) continue;
      pePoints.push(price / t.eps);
    }

    // Current: latest TTM EPS point overall (may be more recent than the 5Y window's last entry)
    const latest = ttmSeries[ttmSeries.length - 1];
    const latestDates = Array.from(priceByDate.keys()).sort();
    const latestPriceDate = latestDates[latestDates.length - 1] ?? null;
    const currentPrice = latestPriceDate ? priceByDate.get(latestPriceDate)! : null;
    const currentEpsTtm = latest?.eps ?? null;
    const currentPe = currentEpsTtm != null && currentEpsTtm > 0 && currentPrice != null
      ? currentPrice / currentEpsTtm
      : null;

    if (pePoints.length < MIN_SAMPLE_SIZE) {
      return {
        ...base,
        currentPrice, currentEpsTtm, currentPe,
        asOfDate: latestPriceDate ?? base.asOfDate,
        sampleSize: pePoints.length,
        error: currentPe == null ? "negative_eps" : "insufficient_data",
      };
    }

    const meanPe = mean(pePoints);
    const sd = stdDev(pePoints);
    const zScore = currentPe != null && sd > 0 ? (currentPe - meanPe) / sd : null;

    return {
      ...base,
      currentPrice, currentEpsTtm, currentPe,
      asOfDate: latestPriceDate ?? base.asOfDate,
      meanPe5y: meanPe,
      stdDevPe5y: sd,
      zScore,
      sampleSize: pePoints.length,
    };
  } catch {
    return { ...base, error: "fetch_failed" };
  }
}

// Computes P/E stats for many tickers with bounded concurrency to stay under SEC/Yahoo rate limits.
export async function computePeStatsBatch(tickers: string[], concurrency = 5): Promise<Record<string, PeStats>> {
  const results: Record<string, PeStats> = {};
  for (let i = 0; i < tickers.length; i += concurrency) {
    const chunk = tickers.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((t) => computePeStats(t)));
    chunk.forEach((t, idx) => { results[t] = chunkResults[idx]; });
  }
  return results;
}
