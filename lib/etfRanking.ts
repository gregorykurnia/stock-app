import { dailyDrawdownForWindow, type ETFPriceBar } from "./etfMetricCalculations";

// Pure scoring for the blank-slate ETF ranking (docs/etf-blank-slate-ranking-plan.md, Sections 4 and 5).
// No I/O. Callers pass parsed bars; dates are YYYY-MM-DD strings.

export const RANKING_METHOD_VERSION = "rank-v1";

// Provisional. Plan Section 4.6 starts at 3 points and fixes the final value in Phase 5.
export const RANKING_TIE_THRESHOLD = 3;

const PERCENTILE_EPSILON = 1e-12;
const TIER_COUNT = 5;
const MIN_HISTORY_MONTHS = 36;
const AUM_MAX_AGE_MONTHS = 12;
const LIQUIDITY_SESSIONS = 30;
const TREND_MIN_MONTHS = 12;
const SMA_MONTHS = 10;

export const HORIZONS = [3, 5, 10] as const;
export type RankingHorizon = (typeof HORIZONS)[number];

export type EligibilityState = "Ranked" | "Separate list" | "Too new" | "Legal form unverified" | "Input missing" | "Excluded";

export type ProductClass = "standard" | "leveraged_inverse" | "etn" | "excluded";

export interface RankingBar extends ETFPriceBar {
  volume: number;
}

export interface RankingFundInput {
  ticker: string;
  structure: string;
  productClass: ProductClass;
  legalFormVerified: boolean;
  netExpenseRatioPct: number | null;
  aumUsd: number | null;
  aumAsOf: string | null;
  bars: RankingBar[];
}

export interface RankingContext {
  cutoff: string;
  cashBars: RankingBar[];
}

export interface MonthLevel {
  month: string;
  date: string;
  adjustedClose: number;
}

export interface EligibilityResult {
  state: EligibilityState;
  reason: string;
}

export interface HorizonMeasures {
  horizon: RankingHorizon;
  months: number;
  startDate: string;
  endDate: string;
  cagr: number;
  sortino: number | null;
  depth: number;
  underwater: number;
}

export type HorizonOutcome = { available: true; measures: HorizonMeasures } | { available: false; reason: string };

export interface HorizonPercentiles {
  cagr: number;
  sortino: number | null;
  depth: number;
  underwater: number;
  outcome: number | null;
}

export interface VehicleScore {
  expenseRatioPct: number;
  aumUsd: number;
  medianDollarVolume: number;
  costScore: number;
  liquidityScore: number;
  sizeScore: number;
  vehicle: number;
}

export interface TrendFeatures {
  mom3: number;
  mom6: number;
  mom12x: number;
  close: number;
  sma10: number;
  uptrend: boolean;
}

export interface TrendScore extends TrendFeatures {
  momentum: number;
  trendScore: number;
}

export interface FundRankingResult {
  ticker: string;
  state: EligibilityState;
  reason: string;
  monthsOfHistory: number | null;
  horizons: Partial<Record<RankingHorizon, HorizonOutcome>>;
  percentiles: Partial<Record<RankingHorizon, HorizonPercentiles>>;
  blendWeights: Partial<Record<RankingHorizon, number>> | null;
  outcome: number | null;
  vehicle: VehicleScore | null;
  trend: TrendScore | null;
  grand: number | null;
  tactical: number | null;
  scoreNote: string | null;
  rank: number | null;
  tacticalRank: number | null;
  tier: number | null;
  tied: boolean;
}

export interface RankingRun {
  methodVersion: string;
  cutoff: string;
  tieThreshold: number;
  funds: FundRankingResult[];
}

// ---------- dates and months ----------

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear * 12 + toMonth) - (fromYear * 12 + fromMonth);
}

export function isMonthEnd(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const month = monthOf(date);
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return date === lastDay;
}

// ---------- month-end levels ----------

// Last valid bar of each calendar month, using only bars on or before the cutoff.
export function monthEndLevels(bars: readonly RankingBar[], cutoff: string): Map<string, MonthLevel> {
  const levels = new Map<string, MonthLevel>();
  for (const bar of bars) {
    if (bar.date > cutoff || !(bar.adjustedClose > 0)) continue;
    const month = monthOf(bar.date);
    const previous = levels.get(month);
    if (!previous || bar.date > previous.date) levels.set(month, { month, date: bar.date, adjustedClose: bar.adjustedClose });
  }
  return levels;
}

// Consecutive months from endMonth back n months (n + 1 entries, oldest first).
function windowMonths(endMonth: string, n: number): string[] {
  return Array.from({ length: n + 1 }, (_, index) => addMonths(endMonth, index - n));
}

// ---------- percentiles (plan Section 4.3) ----------

// pct = (others worse + 0.5 × others tied) ÷ count of others × 100. Ties share a value. Lower-is-better inverts the comparison.
// With no other funds the value is 50, a neutral score rather than an undefined one.
export function percentileOf(value: number, others: readonly number[], direction: "higher" | "lower"): number {
  if (others.length === 0) return 50;
  let worse = 0;
  let tied = 0;
  for (const other of others) {
    if (Math.abs(other - value) <= PERCENTILE_EPSILON) tied += 1;
    else if (direction === "higher" ? other < value : other > value) worse += 1;
  }
  return ((worse + 0.5 * tied) / others.length) * 100;
}

export function percentileRanks(values: ReadonlyMap<string, number>, direction: "higher" | "lower"): Map<string, number> {
  const entries = [...values];
  const result = new Map<string, number>();
  for (const [key, value] of entries) {
    const others = entries.filter(([otherKey]) => otherKey !== key).map(([, otherValue]) => otherValue);
    result.set(key, percentileOf(value, others, direction));
  }
  return result;
}

// ---------- horizon measures (plan Sections 4.2 and 4.3) ----------

export function horizonWeights(monthsOfHistory: number): Partial<Record<RankingHorizon, number>> | null {
  if (monthsOfHistory < MIN_HISTORY_MONTHS) return null;
  if (monthsOfHistory < 60) return { 3: 1 };
  if (monthsOfHistory < 120) return { 3: 0.4, 5: 0.6 };
  return { 3: 0.2, 5: 0.3, 10: 0.5 };
}

export function horizonMeasures(
  horizon: RankingHorizon,
  bars: readonly RankingBar[],
  levels: ReadonlyMap<string, MonthLevel>,
  cashLevels: ReadonlyMap<string, MonthLevel>,
  cutoff: string,
): HorizonOutcome {
  const cutoffMonth = monthOf(cutoff);
  const months = windowMonths(cutoffMonth, horizon * 12);
  const fund = months.map((month) => levels.get(month));
  if (fund.some((level) => !level)) return { available: false, reason: `Requires ${horizon * 12 + 1} consecutive month-end levels; the history has a gap or starts later.` };
  const cash = months.map((month) => cashLevels.get(month));
  const missingCash = months.find((_, index) => !cash[index]);
  if (missingCash) return { available: false, reason: `Cash proxy BIL has no month-end level for ${missingCash}.` };

  const fundLevels = fund as MonthLevel[];
  const cashSeries = cash as MonthLevel[];
  const n = horizon * 12;
  const start = fundLevels[0];
  const end = fundLevels[n];
  const cagr = (end.adjustedClose / start.adjustedClose) ** (12 / n) - 1;

  // Excess monthly returns over BIL (plan Section 4.3). Sortino needs at least one negative excess month.
  const excess: number[] = [];
  for (let index = 1; index <= n; index += 1) {
    const fundReturn = fundLevels[index].adjustedClose / fundLevels[index - 1].adjustedClose - 1;
    const cashReturn = cashSeries[index].adjustedClose / cashSeries[index - 1].adjustedClose - 1;
    excess.push(fundReturn - cashReturn);
  }
  const negativeMonths = excess.filter((value) => value < 0).length;
  const annualizedExcess = (12 * excess.reduce((sum, value) => sum + value, 0)) / n;
  const downsideDeviation = Math.sqrt((12 * excess.reduce((sum, value) => sum + Math.min(value, 0) ** 2, 0)) / n);
  const sortino = negativeMonths === 0 ? null : annualizedExcess / downsideDeviation;

  const drawdown = dailyDrawdownForWindow([...bars], start.date, cutoff);
  if (drawdown.value == null || drawdown.underwaterDays == null) return { available: false, reason: "Daily observations in the window are insufficient for drawdown." };
  const dailyCount = bars.filter((bar) => bar.date >= start.date && bar.date <= cutoff && bar.adjustedClose > 0).length;

  return {
    available: true,
    measures: {
      horizon,
      months: n,
      startDate: start.date,
      endDate: end.date,
      cagr,
      sortino,
      depth: Math.max(0, -drawdown.value / 100),
      underwater: drawdown.underwaterDays / dailyCount,
    },
  };
}

// ---------- Vehicle (plan Section 4.4) ----------

const VEHICLE_WEIGHTS = { cost: 0.5, liquidity: 0.25, size: 0.25 };
const LIQUIDITY_BOUNDS = { low: 1_000_000, high: 50_000_000 };
const SIZE_BOUNDS = { low: 50_000_000, high: 1_000_000_000 };

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function logBand(value: number, bounds: { low: number; high: number }): number {
  if (!(value > 0)) return 0;
  const position = (Math.log10(value) - Math.log10(bounds.low)) / (Math.log10(bounds.high) - Math.log10(bounds.low));
  return clamp(position * 100, 0, 100);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Median of close × volume over the last 30 sessions on or before the cutoff. Null if fewer than 30 sessions.
export function medianDollarVolume(bars: readonly RankingBar[], cutoff: string): number | null {
  const sessions = bars.filter((bar) => bar.date <= cutoff).sort((left, right) => left.date.localeCompare(right.date)).slice(-LIQUIDITY_SESSIONS);
  if (sessions.length < LIQUIDITY_SESSIONS) return null;
  return median(sessions.map((bar) => bar.close * bar.volume));
}

export function vehicleScore(input: {
  expenseRatioPct: number | null;
  aumUsd: number | null;
  medianDollarVolume: number | null;
}): VehicleScore | null {
  const { expenseRatioPct, aumUsd, medianDollarVolume: dollarVolume } = input;
  if (expenseRatioPct == null || aumUsd == null || dollarVolume == null) return null;
  const costScore = 100 * clamp(1 - expenseRatioPct / 1, 0, 1);
  const liquidityScore = logBand(dollarVolume, LIQUIDITY_BOUNDS);
  const sizeScore = logBand(aumUsd, SIZE_BOUNDS);
  return {
    expenseRatioPct,
    aumUsd,
    medianDollarVolume: dollarVolume,
    costScore,
    liquidityScore,
    sizeScore,
    vehicle: VEHICLE_WEIGHTS.cost * costScore + VEHICLE_WEIGHTS.liquidity * liquidityScore + VEHICLE_WEIGHTS.size * sizeScore,
  };
}

// ---------- Trend (plan Section 4.5) ----------

export function trendFeatures(levels: ReadonlyMap<string, MonthLevel>, cutoff: string): TrendFeatures | null {
  const cutoffMonth = monthOf(cutoff);
  const months = windowMonths(cutoffMonth, TREND_MIN_MONTHS);
  const series = months.map((month) => levels.get(month));
  if (series.some((level) => !level)) return null;
  const close = (offset: number) => series[TREND_MIN_MONTHS - offset]!.adjustedClose;
  const last = close(0);
  const sma10 = series.slice(-SMA_MONTHS).reduce((sum, level) => sum + level!.adjustedClose, 0) / SMA_MONTHS;
  return {
    mom3: last / close(3) - 1,
    mom6: last / close(6) - 1,
    mom12x: close(1) / close(12) - 1,
    close: last,
    sma10,
    uptrend: last >= sma10,
  };
}

// Momentum: average of three percentiles against the universe. The universe is the Ranked funds.
export function momentumScores(features: ReadonlyMap<string, TrendFeatures>, universe: ReadonlySet<string>): Map<string, number> {
  const components: Array<keyof Pick<TrendFeatures, "mom3" | "mom6" | "mom12x">> = ["mom3", "mom6", "mom12x"];
  const members = [...features].filter(([ticker]) => universe.has(ticker));
  const scores = new Map<string, number>();
  for (const [ticker, feature] of features) {
    const percentiles = components.map((component) => {
      const others = members.filter(([otherTicker]) => otherTicker !== ticker).map(([, other]) => other[component]);
      return percentileOf(feature[component], others, "higher");
    });
    scores.set(ticker, percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length);
  }
  return scores;
}

// ---------- eligibility (plan Section 5) ----------

// Phase 1 decision 4: the legal-form gate covers commodity-pool, trust and metal/bitcoin trust entries. Plain ETFs are not gated.
const LEGAL_FORM_GATED = /^(commodity-pool|physical-metal-trust|spot-bitcoin-trust)/i;

export function assessEligibility(input: RankingFundInput, levels: ReadonlyMap<string, MonthLevel>, cutoff: string): EligibilityResult {
  if (input.productClass === "excluded") {
    return { state: "Excluded", reason: `Operating-company stock or closed-end fund (structure: ${input.structure}); outside ETF rankings per plan Section 5.` };
  }
  if (input.productClass === "leveraged_inverse") {
    return { state: "Separate list", reason: "Leveraged or inverse (daily reset); shown on its own list per plan Section 5." };
  }
  if (input.productClass === "etn") {
    return { state: "Separate list", reason: "ETN; shown on its own list per plan Section 5." };
  }

  const firstMonth = firstMonthOf(levels);
  const monthsOfHistory = firstMonth ? monthsBetween(firstMonth, monthOf(cutoff)) : 0;
  if (monthsOfHistory < MIN_HISTORY_MONTHS) {
    return { state: "Too new", reason: `Under ${MIN_HISTORY_MONTHS} months of history at cutoff: ${monthsOfHistory} months from ${firstMonth ?? "no data"}. Not ranked.` };
  }

  if (LEGAL_FORM_GATED.test(input.structure) && !input.legalFormVerified) {
    return { state: "Legal form unverified", reason: `Legal form not confirmed from issuer source (structure: ${input.structure}). Not ranked until checked.` };
  }

  const missing: string[] = [];
  const cutoffLevel = levels.get(monthOf(cutoff));
  if (!cutoffLevel || daysBetween(cutoffLevel.date, cutoff) > 5) missing.push("price history does not reach the cutoff");
  if (input.netExpenseRatioPct == null) missing.push("net_expense_ratio_pct");
  if (input.aumUsd == null) missing.push("aum_usd");
  else if (!input.aumAsOf || input.aumAsOf < addMonthsToDate(cutoff, -AUM_MAX_AGE_MONTHS)) missing.push(`aum_usd older than ${AUM_MAX_AGE_MONTHS} months at cutoff`);
  if (missing.length) {
    return { state: "Input missing", reason: `Missing verified inputs: ${missing.join("; ")}. Not ranked; nothing imputed.` };
  }
  return { state: "Ranked", reason: "Verified legal form or exempt structure, at least 36 months of history, dated net fee and AUM, complete Vehicle inputs." };
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function addMonthsToDate(date: string, delta: number): string {
  const month = addMonths(monthOf(date), delta);
  const day = Number(date.slice(8, 10));
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

// ---------- full run ----------

interface Prepared {
  input: RankingFundInput;
  levels: Map<string, MonthLevel>;
  eligibility: EligibilityResult;
  monthsOfHistory: number | null;
}

export function rankFunds(inputs: readonly RankingFundInput[], context: RankingContext): RankingRun {
  const { cutoff } = context;
  if (!isMonthEnd(cutoff)) throw new Error(`Cutoff must be a month-end date (YYYY-MM-DD): ${cutoff}`);
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.ticker)) throw new Error(`Duplicate ticker in ranking input: ${input.ticker}`);
    seen.add(input.ticker);
  }

  const cashLevels = monthEndLevels(context.cashBars, cutoff);
  const prepared = new Map<string, Prepared>();
  for (const input of inputs) {
    const levels = monthEndLevels(input.bars, cutoff);
    const eligibility = assessEligibility(input, levels, cutoff);
    const firstMonth = firstMonthOf(levels);
    const monthsOfHistory = firstMonth ? monthsBetween(firstMonth, monthOf(cutoff)) : null;
    prepared.set(input.ticker, { input, levels, eligibility, monthsOfHistory });
  }

  const rankedTickers = [...prepared.values()].filter((item) => item.eligibility.state === "Ranked").map((item) => item.input.ticker);
  const ranked = new Set(rankedTickers);

  // Horizon measures and per-horizon percentiles, across the Ranked universe.
  const horizonsByTicker = new Map<string, Partial<Record<RankingHorizon, HorizonOutcome>>>();
  for (const ticker of rankedTickers) {
    const item = prepared.get(ticker)!;
    const horizons: Partial<Record<RankingHorizon, HorizonOutcome>> = {};
    for (const horizon of HORIZONS) {
      if ((item.monthsOfHistory ?? 0) < horizon * 12) continue;
      horizons[horizon] = horizonMeasures(horizon, item.input.bars, item.levels, cashLevels, cutoff);
    }
    horizonsByTicker.set(ticker, horizons);
  }

  const percentilesByTicker = new Map<string, Partial<Record<RankingHorizon, HorizonPercentiles>>>(rankedTickers.map((ticker) => [ticker, {}]));
  for (const horizon of HORIZONS) {
    const measures = new Map<string, HorizonMeasures>();
    for (const ticker of rankedTickers) {
      const outcome = horizonsByTicker.get(ticker)![horizon];
      if (outcome?.available) measures.set(ticker, outcome.measures);
    }
    const cagr = percentileRanks(new Map([...measures].map(([ticker, m]) => [ticker, m.cagr])), "higher");
    const depth = percentileRanks(new Map([...measures].map(([ticker, m]) => [ticker, m.depth])), "lower");
    const underwater = percentileRanks(new Map([...measures].map(([ticker, m]) => [ticker, m.underwater])), "lower");
    const sortinoValues = new Map<string, number>();
    for (const [ticker, m] of measures) if (m.sortino != null) sortinoValues.set(ticker, m.sortino);
    const sortino = percentileRanks(sortinoValues, "higher");

    for (const ticker of measures.keys()) {
      const sortinoPct = sortino.get(ticker) ?? null;
      const outcome = sortinoPct == null ? null : 0.35 * cagr.get(ticker)! + 0.35 * sortinoPct + 0.3 * (0.5 * depth.get(ticker)! + 0.5 * underwater.get(ticker)!);
      percentilesByTicker.get(ticker)![horizon] = {
        cagr: cagr.get(ticker)!,
        sortino: sortinoPct,
        depth: depth.get(ticker)!,
        underwater: underwater.get(ticker)!,
        outcome,
      };
    }
  }

  // Trend features and momentum: universe is the Ranked funds.
  const trendFeaturesByTicker = new Map<string, TrendFeatures>();
  for (const item of prepared.values()) {
    const features = trendFeatures(item.levels, cutoff);
    if (features) trendFeaturesByTicker.set(item.input.ticker, features);
  }
  const momentum = momentumScores(trendFeaturesByTicker, ranked);

  const results = new Map<string, FundRankingResult>();
  for (const item of prepared.values()) {
    const { input, eligibility, monthsOfHistory } = item;
    const ticker = input.ticker;
    const isRanked = eligibility.state === "Ranked";
    const vehicle = eligibility.state === "Excluded"
      ? null
      : vehicleScore({ expenseRatioPct: input.netExpenseRatioPct, aumUsd: input.aumUsd, medianDollarVolume: medianDollarVolume(input.bars, cutoff) });
    const features = trendFeaturesByTicker.get(ticker);
    const trend: TrendScore | null = features && eligibility.state !== "Excluded"
      ? { ...features, momentum: momentum.get(ticker)!, trendScore: 0.5 * momentum.get(ticker)! + 0.5 * (features.uptrend ? 100 : 0) }
      : null;

    let outcome: number | null = null;
    let blendWeights: Partial<Record<RankingHorizon, number>> | null = null;
    let scoreNote: string | null = null;
    if (isRanked && monthsOfHistory != null) {
      blendWeights = horizonWeights(monthsOfHistory);
      if (blendWeights) {
        const blended = blendOutcome(blendWeights, percentilesByTicker.get(ticker)!, horizonsByTicker.get(ticker)!);
        outcome = blended.value;
        scoreNote = blended.note;
      }
    }
    const grand = outcome != null && vehicle ? 0.7 * outcome + 0.3 * vehicle.vehicle : null;
    results.set(ticker, {
      ticker,
      state: eligibility.state,
      reason: eligibility.reason,
      monthsOfHistory,
      horizons: isRanked ? horizonsByTicker.get(ticker)! : {},
      percentiles: isRanked ? percentilesByTicker.get(ticker)! : {},
      blendWeights,
      outcome,
      vehicle,
      trend,
      grand,
      tactical: grand != null && trend ? 0.5 * grand + 0.5 * trend.trendScore : null,
      scoreNote,
      rank: null,
      tacticalRank: null,
      tier: null,
      tied: false,
    });
  }

  // Ranks, tiers and ties across the scored Ranked funds (plan Section 4.6).
  const scored = [...results.values()].filter((result) => result.grand != null);
  const grandOf = new Map(scored.map((result) => [result.ticker, result.grand!]));
  const tacticalOf = new Map([...results.values()].filter((result) => result.state === "Ranked" && result.tactical != null).map((result) => [result.ticker, result.tactical!]));
  for (const result of scored) {
    const higher = countHigher(grandOf, grandOf.get(result.ticker)!);
    result.rank = higher + 1;
    result.tier = tierOf(higher, scored.length);
    result.tied = [...grandOf].some(([other, value]) => other !== result.ticker && Math.abs(value - grandOf.get(result.ticker)!) < RANKING_TIE_THRESHOLD);
  }
  for (const result of results.values()) {
    if (tacticalOf.has(result.ticker)) result.tacticalRank = countHigher(tacticalOf, tacticalOf.get(result.ticker)!) + 1;
  }

  return {
    methodVersion: RANKING_METHOD_VERSION,
    cutoff,
    tieThreshold: RANKING_TIE_THRESHOLD,
    funds: [...results.values()].sort((left, right) => left.ticker.localeCompare(right.ticker)),
  };
}

// Weighted Outcome across the horizons in the blend. If any horizon has no Outcome, the blend is not computed.
function blendOutcome(
  weights: Partial<Record<RankingHorizon, number>>,
  percentiles: Partial<Record<RankingHorizon, HorizonPercentiles>>,
  horizons: Partial<Record<RankingHorizon, HorizonOutcome>>,
): { value: number | null; note: string | null } {
  let value = 0;
  for (const horizon of HORIZONS) {
    const weight = weights[horizon];
    if (weight == null) continue;
    const outcome = percentiles[horizon]?.outcome ?? null;
    if (outcome == null) {
      const horizonState = horizons[horizon];
      const note = horizonState?.available === false
        ? `${horizon}Y horizon unavailable: ${horizonState.reason} Not scored, not imputed.`
        : `${horizon}Y Sortino undefined (no negative excess months against BIL). Not scored, not imputed.`;
      return { value: null, note };
    }
    value += weight * outcome;
  }
  return { value, note: null };
}

function firstMonthOf(levels: ReadonlyMap<string, MonthLevel>): string | null {
  let first: string | null = null;
  for (const month of levels.keys()) if (first == null || month < first) first = month;
  return first;
}

// Tier 1 is the top 20% by count of funds scoring strictly higher. Equal scores share a count, so they share a tier.
export function tierOf(higherCount: number, scoredCount: number): number {
  return Math.min(TIER_COUNT, Math.floor((higherCount * TIER_COUNT) / scoredCount) + 1);
}

function countHigher(values: ReadonlyMap<string, number>, value: number): number {
  let count = 0;
  for (const other of values.values()) if (other - value > PERCENTILE_EPSILON) count += 1;
  return count;
}
