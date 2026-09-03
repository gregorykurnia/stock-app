import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

interface UpsideRaw {
  gmChanges: number[] | null;
  revenueGrowth: number[] | null;
  cash: number | null;
  avgQuarterlyFcf: number | null;
  epsCurrent: number | null;
  epsNinetyDaysAgo: number | null;
  shortPercentOfFloat: number | null;
  insiderBuyCount: number | null;
}

const EMPTY_UPSIDE: UpsideRaw = {
  gmChanges: null, revenueGrowth: null, cash: null, avgQuarterlyFcf: null,
  epsCurrent: null, epsNinetyDaysAgo: null, shortPercentOfFloat: null, insiderBuyCount: null,
};

// Column Group 2 raw fundamentals — quarterly financials/cash-flow/balance-sheet come from
// fundamentalsTimeSeries (the old quoteSummary financial-statement modules return almost no
// data since Nov 2024); short interest, EPS trend and insider transactions come from quoteSummary.
async function fetchUpsideFundamentals(ticker: string): Promise<UpsideRaw> {
  const now = new Date();
  const start = new Date(now.getTime() - 700 * 24 * 3600 * 1000);
  const period1 = start.toISOString().slice(0, 10);
  const period2 = now.toISOString().slice(0, 10);

  const [financials, cashFlow, balanceSheet, quoteSummary] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yf.fundamentalsTimeSeries(ticker, { period1, period2, type: "quarterly", module: "financials" }).catch(() => [] as any[]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yf.fundamentalsTimeSeries(ticker, { period1, period2, type: "quarterly", module: "cash-flow" }).catch(() => [] as any[]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yf.fundamentalsTimeSeries(ticker, { period1, period2, type: "quarterly", module: "balance-sheet" }).catch(() => [] as any[]),
    yf.quoteSummary(ticker, { modules: ["defaultKeyStatistics", "earningsTrend", "insiderTransactions"] }).catch(() => null),
  ]);

  let gmChanges: number[] | null = null;
  let revenueGrowth: number[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fin = (financials as any[]).filter((f) => f?.totalRevenue != null && f?.grossProfit != null).slice(-4);
  if (fin.length === 4) {
    const gm = fin.map((f) => (f.totalRevenue > 0 ? (f.grossProfit / f.totalRevenue) * 100 : null));
    if (gm.every((v) => v != null)) {
      gmChanges = [gm[1]! - gm[0]!, gm[2]! - gm[1]!, gm[3]! - gm[2]!];
    }
    const rev = fin.map((f) => f.totalRevenue as number);
    if (rev.every((v) => v > 0)) {
      revenueGrowth = [(rev[1] - rev[0]) / rev[0], (rev[2] - rev[1]) / rev[1], (rev[3] - rev[2]) / rev[2]];
    }
  }

  let avgQuarterlyFcf: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cf = (cashFlow as any[]).filter((f) => f?.freeCashFlow != null).slice(-4);
  if (cf.length > 0) avgQuarterlyFcf = cf.reduce((a, f) => a + f.freeCashFlow, 0) / cf.length;

  let cash: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bs = (balanceSheet as any[]).slice(-1)[0];
  if (bs) cash = bs.cashAndCashEquivalents ?? bs.cashCashEquivalentsAndShortTermInvestments ?? null;

  const shortPercentOfFloat: number | null = quoteSummary?.defaultKeyStatistics?.shortPercentOfFloat ?? null;

  let epsCurrent: number | null = null, epsNinetyDaysAgo: number | null = null;
  const trend = quoteSummary?.earningsTrend?.trend?.find((t: { period?: string }) => t.period === "0q") ?? quoteSummary?.earningsTrend?.trend?.[0];
  if (trend?.epsTrend) {
    epsCurrent = trend.epsTrend.current ?? null;
    epsNinetyDaysAgo = trend.epsTrend["90daysAgo"] ?? null;
  }

  let insiderBuyCount: number | null = null;
  const transactions = quoteSummary?.insiderTransactions?.transactions;
  if (Array.isArray(transactions)) {
    const cutoff = now.getTime() - 180 * 24 * 3600 * 1000;
    insiderBuyCount = transactions.filter((t: { transactionText?: string; startDate?: string | Date }) => {
      const text = (t.transactionText ?? "").toLowerCase();
      const isOpenMarketBuy = text.includes("purchase") && !text.includes("option") && !text.includes("exercise") && !text.includes("gift");
      if (!isOpenMarketBuy) return false;
      const d = t.startDate ? new Date(t.startDate).getTime() : null;
      return d != null && d >= cutoff;
    }).length;
  }

  return { gmChanges, revenueGrowth, cash, avgQuarterlyFcf, epsCurrent, epsNinetyDaysAgo, shortPercentOfFloat, insiderBuyCount };
}

interface Bar { date: Date; open: number; high: number; low: number; close: number; volume: number }

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out[i] = prev;
    } else if (i >= period && prev != null) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change; else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function atr(bars: Bar[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < period + 1) return out;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let val = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period] = val;
  for (let i = period; i < trs.length; i++) {
    val = (val * (period - 1) + trs[i]) / period;
    out[i + 1] = val;
  }
  return out;
}

function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

// Groups daily bars into calendar weeks (Mon-Sun), returning one close-based OHLC per week.
function toWeeklyCloses(bars: Bar[]): number[] {
  const weeks = new Map<string, Bar[]>();
  for (const b of bars) {
    const d = b.date;
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(b);
  }
  const keys = [...weeks.keys()].sort();
  return keys.map((k) => {
    const wk = weeks.get(k)!;
    return wk[wk.length - 1].close;
  });
}

interface CoilingResult {
  distFrom2yHigh: number | null;
  distFrom6moLow: number | null;
  roc1mo: number | null;
  roc3mo: number | null;
  ma30wk: number | null;
  priceVsMa30wk: number | null;
  ma30wkSlope: number | null;
  volRatio10_90: number | null;
  upDownVolRatio: number | null;
  bbw: number | null;
  atrPct: number | null;
  atrTrend: number | null;
  weeklyRsi: number | null;
  rsiFloor6mo: number | null;
  rsiDivergence: number | null;
  maStackScore: number | null;
  lowerHighs: boolean | null;
  rsVsSpy3mo: number | null;
  // Potential Bagger Reversal (capitulation) unique raw inputs — reuse this same 2yr daily
  // fetch instead of a second request per ticker.
  capVolRatio: number | null;
  rsiFloor52wk: number | null;
  priceVs20dLow: number | null;
  dropSpeed: number | null;
  recoveryCandle: number | null;
  // Column Group 1 (Breakout Proximity) raw inputs
  slopeNow: number | null;
  slope4wk: number | null;
  slope8wk: number | null;
  maTouchCount: number | null;
  rangeContractionRatio: number | null;
  rsLineDiffPct: number | null;
  volGreenRatio: number | null;
}

const EMPTY: CoilingResult = {
  distFrom2yHigh: null, distFrom6moLow: null, roc1mo: null, roc3mo: null,
  ma30wk: null, priceVsMa30wk: null, ma30wkSlope: null,
  volRatio10_90: null, upDownVolRatio: null, bbw: null,
  atrPct: null, atrTrend: null, weeklyRsi: null, rsiFloor6mo: null, rsiDivergence: null,
  maStackScore: null, lowerHighs: null, rsVsSpy3mo: null,
  capVolRatio: null, rsiFloor52wk: null, priceVs20dLow: null, dropSpeed: null, recoveryCandle: null,
  slopeNow: null, slope4wk: null, slope8wk: null, maTouchCount: null,
  rangeContractionRatio: null, rsLineDiffPct: null, volGreenRatio: null,
};

async function fetchCoiling(ticker: string, spyReturn63: number | null, spyCloseByDate: Map<string, number>): Promise<CoilingResult> {
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, { period1: twoYearsAgo, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result?.quotes ?? []).filter((q: any) =>
    q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null);
  if (quotes.length === 0) return EMPTY;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars: Bar[] = quotes.map((q: any) => ({
    date: q.date instanceof Date ? q.date : new Date(q.date),
    open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
  }));
  const closes = bars.map((b) => b.close);
  const lastClose = closes[closes.length - 1];

  // 2Y high, from the same 2-year daily window already fetched above — no extra request needed.
  const highs = bars.map((b) => b.high);
  const high2yr = highs.length > 0 ? Math.max(...highs) : null;
  const distFrom2yHigh = high2yr != null && high2yr > 0 ? ((lastClose - high2yr) / high2yr) * 100 : null;

  const last126 = closes.slice(-126);
  const low6mo = last126.length > 0 ? Math.min(...last126) : null;
  const distFrom6moLow = low6mo != null && low6mo > 0 ? ((lastClose - low6mo) / low6mo) * 100 : null;

  const roc1mo = closes.length > 20 && closes[closes.length - 21] > 0
    ? ((lastClose - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 : null;
  const roc3mo = closes.length > 60 && closes[closes.length - 61] > 0
    ? ((lastClose - closes[closes.length - 61]) / closes[closes.length - 61]) * 100 : null;

  const sma150 = sma(closes, 150);
  const ma30wk = sma150[sma150.length - 1];
  const priceVsMa30wk = ma30wk != null && ma30wk > 0 ? lastClose / ma30wk : null;
  const ma30wkAgo = sma150.length > 20 ? sma150[sma150.length - 21] : null;
  const ma30wkSlope = ma30wk != null && ma30wkAgo != null ? ma30wk - ma30wkAgo : null;

  const volumes = bars.map((b) => b.volume);
  const avgVol10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, volumes.length);
  const avgVol90 = volumes.slice(-90).reduce((a, b) => a + b, 0) / Math.min(90, volumes.length);
  const volRatio10_90 = avgVol90 > 0 ? avgVol10 / avgVol90 : null;

  const last20 = bars.slice(-20);
  let upVol = 0, downVol = 0;
  for (let i = 1; i < last20.length; i++) {
    if (last20[i].close >= last20[i - 1].close) upVol += last20[i].volume;
    else downVol += last20[i].volume;
  }
  const upDownVolRatio = downVol > 0 ? upVol / downVol : null;

  const last20Closes = closes.slice(-20);
  let bbw: number | null = null;
  if (last20Closes.length === 20) {
    const mid = last20Closes.reduce((a, b) => a + b, 0) / 20;
    const sd = stdev(last20Closes);
    const upper = mid + 2 * sd;
    const lower = mid - 2 * sd;
    bbw = mid > 0 ? (upper - lower) / mid : null;
  }

  const atr14 = atr(bars, 14);
  const lastAtr = atr14[atr14.length - 1];
  const atrPct = lastAtr != null && lastClose > 0 ? (lastAtr / lastClose) * 100 : null;
  const atrAgo = atr14.length > 20 ? atr14[atr14.length - 21] : null;
  const atrTrend = lastAtr != null && atrAgo != null ? lastAtr - atrAgo : null;

  const weeklyCloses = toWeeklyCloses(bars);
  const weeklyRsiArr = rsi(weeklyCloses, 14);
  const weeklyRsi = weeklyRsiArr[weeklyRsiArr.length - 1];
  const last26w = weeklyRsiArr.slice(-26).filter((v): v is number => v != null);
  const rsiFloor6mo = last26w.length > 0 ? Math.min(...last26w) : null;
  const last52w = weeklyRsiArr.slice(-52).filter((v): v is number => v != null);
  const rsiFloor52wk = last52w.length > 0 ? Math.min(...last52w) : null;

  // RSI Divergence: daily RSI(14, Wilder) at Low2 (min close in last 20 days) minus RSI at Low1
  // (min close in the 40-20 days ago window). Positive = bullish divergence (price lower low,
  // RSI higher low). Requires at least 40 daily closes plus enough history for RSI to be defined.
  let rsiDivergence: number | null = null;
  {
    const dailyRsiArr = rsi(closes, 14);
    if (closes.length >= 40) {
      const w1Start = closes.length - 40, w1End = closes.length - 20; // 40..20 days ago
      const w2Start = closes.length - 20, w2End = closes.length; // last 20 days
      let low1Idx = -1, low1Val = Infinity;
      for (let i = w1Start; i < w1End; i++) {
        if (closes[i] < low1Val) { low1Val = closes[i]; low1Idx = i; }
      }
      let low2Idx = -1, low2Val = Infinity;
      for (let i = w2Start; i < w2End; i++) {
        if (closes[i] < low2Val) { low2Val = closes[i]; low2Idx = i; }
      }
      const rsiAtLow1 = low1Idx >= 0 ? dailyRsiArr[low1Idx] : null;
      const rsiAtLow2 = low2Idx >= 0 ? dailyRsiArr[low2Idx] : null;
      if (rsiAtLow1 != null && rsiAtLow2 != null) rsiDivergence = rsiAtLow2 - rsiAtLow1;
    }
  }

  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);
  const ema20 = ema20Arr[ema20Arr.length - 1];
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const ema200 = ema200Arr[ema200Arr.length - 1];
  let maStackScore: number | null = null;
  if (ema20 != null && ema50 != null && ema200 != null) {
    maStackScore = (ema20 > ema50 ? 1 : 0) + (ema50 > ema200 ? 1 : 0) + (lastClose > ema200 ? 1 : 0);
  }

  // Swing highs over the trailing ~20 weeks (~100 sessions): local maxima (higher than the 5
  // sessions on each side), most recent 3 compared in chronological order.
  const window = bars.slice(-100);
  const swingHighs: number[] = [];
  for (let i = 5; i < window.length - 5; i++) {
    const h = window[i].high;
    const isPeak = window.slice(i - 5, i).every((b) => b.high <= h) && window.slice(i + 1, i + 6).every((b) => b.high <= h);
    if (isPeak) swingHighs.push(h);
  }
  const lastThree = swingHighs.slice(-3);
  const lowerHighs = lastThree.length === 3 ? lastThree[0] > lastThree[1] && lastThree[1] > lastThree[2] : null;

  const stockReturn63 = closes.length > 63 && closes[closes.length - 64] > 0
    ? (lastClose - closes[closes.length - 64]) / closes[closes.length - 64] : null;
  const rsVsSpy3mo = stockReturn63 != null && spyReturn63 != null && spyReturn63 !== 0
    ? stockReturn63 / spyReturn63 : null;

  // --- Potential Bagger Reversal (capitulation) unique inputs ---

  const last20Vols = volumes.slice(-20);
  const capVolRatio = last20Vols.length > 0 && avgVol90 > 0 ? Math.max(...last20Vols) / avgVol90 : null;

  const last20ClosesForLow = closes.slice(-20);
  const low20d = last20ClosesForLow.length > 0 ? Math.min(...last20ClosesForLow) : null;
  const priceVs20dLow = low20d != null && low20d > 0 ? ((lastClose - low20d) / low20d) * 100 : null;

  const dropSpeed = closes.length > 30 && closes[closes.length - 31] > 0
    ? ((closes[closes.length - 31] - closes[closes.length - 11]) / closes[closes.length - 31]) * 100 : null;

  const last20Bars = bars.slice(-20);
  let recoveryCandle: number | null = null;
  if (last20Bars.length > 0) {
    const peakVolBar = last20Bars.reduce((max, b) => (b.volume > max.volume ? b : max), last20Bars[0]);
    recoveryCandle = peakVolBar.high === peakVolBar.low ? 0 : (peakVolBar.close - peakVolBar.low) / (peakVolBar.high - peakVolBar.low);
  }

  // --- Column Group 1: Breakout Proximity raw inputs ---

  // Slope Velocity: 30wk MA slope at three consecutive 20-session windows.
  const n = sma150.length;
  const slopeNow = n > 20 && sma150[n - 1] != null && sma150[n - 21] != null ? sma150[n - 1]! - sma150[n - 21]! : null;
  const slope4wk = n > 40 && sma150[n - 21] != null && sma150[n - 41] != null ? sma150[n - 21]! - sma150[n - 41]! : null;
  const slope8wk = n > 60 && sma150[n - 41] != null && sma150[n - 61] != null ? sma150[n - 41]! - sma150[n - 61]! : null;

  // MA Touch Count: sessions in the last 40 where Low <= SMA150*1.01 and Close >= SMA150*0.99.
  let maTouchCount: number | null = null;
  {
    const last40 = bars.slice(-40);
    const smaLast40 = sma150.slice(-40);
    let count = 0, any = false;
    for (let i = 0; i < last40.length; i++) {
      const m = smaLast40[i];
      if (m == null) continue;
      any = true;
      if (last40[i].low <= m * 1.01 && last40[i].close >= m * 0.99) count++;
    }
    maTouchCount = any ? count : null;
  }

  // Price Range Contraction: avg daily range last10 / avg daily range last40.
  let rangeContractionRatio: number | null = null;
  {
    const range = (b: Bar) => b.high - b.low;
    const last10 = bars.slice(-10), last40 = bars.slice(-40);
    if (last10.length === 10 && last40.length === 40) {
      const avg10 = last10.reduce((a, b) => a + range(b), 0) / 10;
      const avg40 = last40.reduce((a, b) => a + range(b), 0) / 40;
      rangeContractionRatio = avg40 > 0 ? avg10 / avg40 : null;
    }
  }

  // RS Line Direction: (stock/SPY) daily ratio, 10-session avg vs 30-session avg.
  let rsLineDiffPct: number | null = null;
  {
    const rsSeries: number[] = [];
    let lastSpy: number | null = null;
    for (const b of bars) {
      const key = b.date.toISOString().slice(0, 10);
      const spy: number | null = spyCloseByDate.get(key) ?? lastSpy;
      if (spy != null) { lastSpy = spy; rsSeries.push(b.close / spy); }
    }
    const last10rs = rsSeries.slice(-10), last30rs = rsSeries.slice(-30);
    if (last10rs.length === 10 && last30rs.length === 30) {
      const avg10 = last10rs.reduce((a, b) => a + b, 0) / 10;
      const avg30 = last30rs.reduce((a, b) => a + b, 0) / 30;
      rsLineDiffPct = avg30 > 0 ? ((avg10 - avg30) / avg30) * 100 : null;
    }
  }

  // Volume on Green Days: avg volume on up-close sessions, last10 vs last40.
  let volGreenRatio: number | null = null;
  {
    const greenVol = (window: Bar[]) => {
      const vols: number[] = [];
      for (let i = 1; i < window.length; i++) if (window[i].close >= window[i - 1].close) vols.push(window[i].volume);
      return vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
    };
    const last10 = bars.slice(-11), last40 = bars.slice(-41);
    const g10 = last10.length > 1 ? greenVol(last10) : null;
    const g40 = last40.length > 1 ? greenVol(last40) : null;
    volGreenRatio = g10 != null && g40 != null && g40 > 0 ? g10 / g40 : null;
  }

  return {
    distFrom2yHigh, distFrom6moLow, roc1mo, roc3mo,
    ma30wk, priceVsMa30wk, ma30wkSlope,
    volRatio10_90, upDownVolRatio, bbw,
    atrPct, atrTrend, weeklyRsi, rsiFloor6mo, rsiDivergence,
    maStackScore, lowerHighs, rsVsSpy3mo,
    capVolRatio, rsiFloor52wk, priceVs20dLow, dropSpeed, recoveryCandle,
    slopeNow, slope4wk, slope8wk, maTouchCount, rangeContractionRatio, rsLineDiffPct, volGreenRatio,
  };
}

async function fetchSpyCloseByDate(): Promise<Map<string, number>> {
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart("SPY", { period1: twoYearsAgo, period2: now, interval: "1d" }).catch(() => null);
  const map = new Map<string, number>();
  for (const q of result?.quotes ?? []) {
    if (q.close == null) continue;
    const d = q.date instanceof Date ? q.date : new Date(q.date);
    map.set(d.toISOString().slice(0, 10), q.close);
  }
  return map;
}

async function fetchSpyReturn63(): Promise<number | null> {
  const now = new Date();
  const start = new Date(now.getTime() - 200 * 24 * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart("SPY", { period1: start, period2: now, interval: "1d" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closes = (result?.quotes ?? []).map((q: any) => q.close).filter((c: number) => c != null);
  if (closes.length <= 63) return null;
  const last = closes[closes.length - 1];
  const prior = closes[closes.length - 64];
  return prior > 0 ? (last - prior) / prior : null;
}

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const [spyReturn63, spyCloseByDate] = await Promise.all([
    fetchSpyReturn63().catch(() => null),
    fetchSpyCloseByDate().catch(() => new Map<string, number>()),
  ]);

  const distFrom2yHigh: Record<string, number | null> = {};
  const distFrom6moLow: Record<string, number | null> = {};
  const roc1mo: Record<string, number | null> = {};
  const roc3mo: Record<string, number | null> = {};
  const ma30wk: Record<string, number | null> = {};
  const priceVsMa30wk: Record<string, number | null> = {};
  const ma30wkSlope: Record<string, number | null> = {};
  const volRatio10_90: Record<string, number | null> = {};
  const upDownVolRatio: Record<string, number | null> = {};
  const bbw: Record<string, number | null> = {};
  const atrPct: Record<string, number | null> = {};
  const atrTrend: Record<string, number | null> = {};
  const weeklyRsi: Record<string, number | null> = {};
  const rsiFloor6mo: Record<string, number | null> = {};
  const rsiDivergence: Record<string, number | null> = {};
  const maStackScore: Record<string, number | null> = {};
  const lowerHighs: Record<string, boolean | null> = {};
  const rsVsSpy3mo: Record<string, number | null> = {};
  const capVolRatio: Record<string, number | null> = {};
  const rsiFloor52wk: Record<string, number | null> = {};
  const priceVs20dLow: Record<string, number | null> = {};
  const dropSpeed: Record<string, number | null> = {};
  const recoveryCandle: Record<string, number | null> = {};
  const slopeNow: Record<string, number | null> = {};
  const slope4wk: Record<string, number | null> = {};
  const slope8wk: Record<string, number | null> = {};
  const maTouchCount: Record<string, number | null> = {};
  const rangeContractionRatio: Record<string, number | null> = {};
  const rsLineDiffPct: Record<string, number | null> = {};
  const volGreenRatio: Record<string, number | null> = {};
  const upside: Record<string, UpsideRaw> = {};

  const chunkSize = 8;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (ticker) => {
      const [r, u] = await Promise.all([
        fetchCoiling(ticker, spyReturn63, spyCloseByDate).catch(() => EMPTY),
        fetchUpsideFundamentals(ticker).catch(() => EMPTY_UPSIDE),
      ]);
      distFrom2yHigh[ticker] = r.distFrom2yHigh;
      distFrom6moLow[ticker] = r.distFrom6moLow;
      roc1mo[ticker] = r.roc1mo;
      roc3mo[ticker] = r.roc3mo;
      ma30wk[ticker] = r.ma30wk;
      priceVsMa30wk[ticker] = r.priceVsMa30wk;
      ma30wkSlope[ticker] = r.ma30wkSlope;
      volRatio10_90[ticker] = r.volRatio10_90;
      upDownVolRatio[ticker] = r.upDownVolRatio;
      bbw[ticker] = r.bbw;
      atrPct[ticker] = r.atrPct;
      atrTrend[ticker] = r.atrTrend;
      weeklyRsi[ticker] = r.weeklyRsi;
      rsiFloor6mo[ticker] = r.rsiFloor6mo;
      rsiDivergence[ticker] = r.rsiDivergence;
      maStackScore[ticker] = r.maStackScore;
      lowerHighs[ticker] = r.lowerHighs;
      rsVsSpy3mo[ticker] = r.rsVsSpy3mo;
      capVolRatio[ticker] = r.capVolRatio;
      rsiFloor52wk[ticker] = r.rsiFloor52wk;
      priceVs20dLow[ticker] = r.priceVs20dLow;
      dropSpeed[ticker] = r.dropSpeed;
      recoveryCandle[ticker] = r.recoveryCandle;
      slopeNow[ticker] = r.slopeNow;
      slope4wk[ticker] = r.slope4wk;
      slope8wk[ticker] = r.slope8wk;
      maTouchCount[ticker] = r.maTouchCount;
      rangeContractionRatio[ticker] = r.rangeContractionRatio;
      rsLineDiffPct[ticker] = r.rsLineDiffPct;
      volGreenRatio[ticker] = r.volGreenRatio;
      upside[ticker] = u;
    }));
  }

  return NextResponse.json({
    distFrom2yHigh, distFrom6moLow, roc1mo, roc3mo,
    ma30wk, priceVsMa30wk, ma30wkSlope,
    volRatio10_90, upDownVolRatio, bbw,
    atrPct, atrTrend, weeklyRsi, rsiFloor6mo, rsiDivergence,
    slopeNow, slope4wk, slope8wk, maTouchCount, rangeContractionRatio, rsLineDiffPct, volGreenRatio,
    upside,
    maStackScore, lowerHighs, rsVsSpy3mo,
    capVolRatio, rsiFloor52wk, priceVs20dLow, dropSpeed, recoveryCandle,
  });
}
