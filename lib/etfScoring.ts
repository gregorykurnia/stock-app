import {
  ETF_CORE_SCORECARD_CANDIDATES,
  ETF_CORE_SCORECARD_METHODOLOGY_STATE,
  ETF_CORE_SCORECARD_VERSION_IDS,
  ETF_COST_ONLY_SCORECARD_VERSION_IDS,
  ETF_EXECUTION_SCORECARD_CANDIDATE,
  ETF_EXECUTION_SCORECARD_METHODOLOGY_STATE,
  ETF_FULL_SCORECARD_CANDIDATE,
  ETF_FULL_SCORECARD_METHODOLOGY_STATE,
  type ETFCoreScorecardFamily,
  type ETFScoreHorizon,
} from "./etfScorecard";

export type ScoreCalculationStatus = "available" | "notApplicable" | "methodologyPending" | "insufficientHistory" | "missingSource" | "staleInput" | "invalidInput";

export interface ScoreComponent {
  points: number;
  weight: number;
  inputValue: number;
  inputUnit: "percent" | "percentagePoints" | "basisPoints" | "ratio" | "score";
}

export interface ScoreCalculation {
  score: number | null;
  status: ScoreCalculationStatus;
  reason: string;
  components?: Record<string, ScoreComponent>;
  sourceIds: string[];
  cutoff: string | null;
  methodologyVersion: string;
  comparisonGroupId?: string | null;
  rankedEligible?: boolean;
  inputDates?: Record<string, string | null>;
  observations?: Record<string, number>;
}

export interface SourcedValue {
  value: number;
  sourceId: string;
  financialDate: string;
  verified: boolean;
  fresh: boolean;
}

export interface VerifiedExpenseRatio extends SourcedValue {
  /** Percentage units: 0.03 means 0.03%. */
  value: number;
  designation: "net" | "gross";
  waiverExpiryDate?: string | null;
}

export interface VerifiedMedianSpread extends SourcedValue {
  /** Basis points. Must be a verified 30-day median, not a current quote. */
  value: number;
  windowDays: 30;
  windowStartDate: string;
  windowEndDate: string;
}

export interface CoreMarketHistory {
  sourceId: string;
  authorized: boolean;
  adjustmentMethodVerified: boolean;
  complete: boolean;
  /** Exactly 12 or 36 monthly total returns, expressed as decimals. */
  monthlyReturns: number[];
  /** Prior level plus each monthly endpoint; session date for each month. */
  monthEndDates: string[];
  dailyHistory: {
    complete: boolean;
    startDate: string;
    endDate: string;
    observations: number;
  };
}

export interface CoreScoreInput {
  family: ETFCoreScorecardFamily;
  horizon: "1Y" | "3Y";
  comparisonGroupId?: string | null;
  mandateVerified: boolean;
  cutoff: string;
  expenseRatio: VerifiedExpenseRatio;
  medianSpread: VerifiedMedianSpread;
  market: CoreMarketHistory;
  /** Magnitude, in percentage points. For example, -18.4% is passed as 18.4. */
  maxDrawdownMagnitudePct: number;
  now?: Date;
}

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function stableLogistic(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function geometricMean(points: number[], weights: number[]): number | null {
  if (points.length !== weights.length || points.length === 0) return null;
  if (points.some((point) => !finite(point) || point < 0 || point > 100)
    || weights.some((weight) => !finite(weight) || weight < 0)
    || Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-10) return null;
  if (points.some((point, index) => point === 0 && weights[index] > 0)) return 0;
  return Math.exp(points.reduce((sum, point, index) => sum + weights[index] * Math.log(point / 100), 0)) * 100;
}

export function feeEfficiencyPoints(expenseRatioPct: number, feeScalePct: number): number | null {
  if (!finite(expenseRatioPct) || expenseRatioPct < 0 || !finite(feeScalePct) || feeScalePct <= 0) return null;
  return 100 * Math.exp(-expenseRatioPct / feeScalePct);
}

export function spreadEfficiencyPoints(spreadBps: number, spreadScaleBps: number): number | null {
  if (!finite(spreadBps) || spreadBps < 0 || !finite(spreadScaleBps) || spreadScaleBps <= 0) return null;
  return 100 / (1 + (spreadBps / spreadScaleBps) ** 2);
}

export function growthPoints(cagrPct: number, anchorPct: number, scalePct: number): number | null {
  if (!finite(cagrPct) || !finite(anchorPct) || !finite(scalePct) || scalePct <= 0) return null;
  return 100 * stableLogistic((cagrPct - anchorPct) / scalePct);
}

export function drawdownResiliencePoints(drawdownMagnitudePct: number, scalePct: number): number | null {
  if (!finite(drawdownMagnitudePct) || drawdownMagnitudePct < 0 || drawdownMagnitudePct > 100 || !finite(scalePct) || scalePct <= 0) return null;
  return 100 / (1 + (drawdownMagnitudePct / scalePct) ** 2);
}

export function downsidePoints(downsideDeviationPct: number, scalePct: number): number | null {
  if (!finite(downsideDeviationPct) || downsideDeviationPct < 0 || !finite(scalePct) || scalePct <= 0) return null;
  return 100 / (1 + (downsideDeviationPct / scalePct) ** 2);
}

export function consistencyPoints(gapPct: number, scalePct: number): number | null {
  if (!finite(gapPct) || gapPct < 0 || !finite(scalePct) || scalePct <= 0) return null;
  return 100 / (1 + (gapPct / scalePct) ** 2);
}

export function trackingDifferencePoints(trackingDifferencePct: number, scalePct: number): number | null {
  if (!finite(trackingDifferencePct) || !finite(scalePct) || scalePct <= 0) return null;
  return 100 / (1 + (Math.abs(trackingDifferencePct) / scalePct) ** 2);
}

export function trackingErrorPoints(trackingErrorPct: number, scalePct: number): number | null {
  if (!finite(trackingErrorPct) || trackingErrorPct < 0 || !finite(scalePct) || scalePct <= 0) return null;
  return 100 / (1 + (trackingErrorPct / scalePct) ** 2);
}

export function calculateCostAndTradingScore(
  expenseRatioPct: number,
  medianSpreadBps: number,
  settings: { feeScale: number; spreadScale: number },
): { score: number; feePoints: number; spreadPoints: number } | null {
  const feePoints = feeEfficiencyPoints(expenseRatioPct, settings.feeScale);
  const spreadPoints = spreadEfficiencyPoints(medianSpreadBps, settings.spreadScale);
  if (feePoints == null || spreadPoints == null) return null;
  return { score: 0.5 * feePoints + 0.5 * spreadPoints, feePoints, spreadPoints };
}

export function calculateCostOnlyScore(input: {
  family: ETFCoreScorecardFamily;
  comparisonGroupId?: string | null;
  mandateVerified: boolean;
  expenseRatio: VerifiedExpenseRatio;
  medianSpread: VerifiedMedianSpread;
}): ScoreCalculation {
  const sourceIds = [input.expenseRatio.sourceId, input.medianSpread.sourceId].filter(Boolean);
  const base = {
    score: null,
    sourceIds,
    cutoff: input.medianSpread.windowEndDate || input.expenseRatio.financialDate || null,
    methodologyVersion: ETF_COST_ONLY_SCORECARD_VERSION_IDS[input.family],
    comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: false,
    inputDates: {
      expenseRatioFinancialDate: input.expenseRatio.financialDate ?? null,
      expenseWaiverExpiry: input.expenseRatio.waiverExpiryDate ?? null,
      medianSpreadWindowStart: input.medianSpread.windowStartDate ?? null,
      medianSpreadWindowEnd: input.medianSpread.windowEndDate ?? null,
    },
    observations: { medianSpreadWindowDays: input.medianSpread.windowDays },
  };
  if (!input.mandateVerified) return { ...base, status: "missingSource", reason: "Dated evidence for the fund's current mandate and identity is required." };
  if (!input.expenseRatio.sourceId || !input.medianSpread.sourceId || !input.expenseRatio.verified || !input.medianSpread.verified) return { ...base, status: "missingSource", reason: "A verified current net expense ratio and verified 30-day median spread are required." };
  if (!input.expenseRatio.fresh || !input.medianSpread.fresh) return { ...base, status: "staleInput", reason: "Expense-ratio or 30-day median-spread input is stale." };
  if (input.expenseRatio.designation !== "net") return { ...base, status: "missingSource", reason: "Cost and Trading requires a verified current net expense ratio." };
  if (!finite(input.expenseRatio.value) || input.expenseRatio.value < 0 || !finite(input.medianSpread.value) || input.medianSpread.value < 0
    || input.medianSpread.windowDays !== 30 || !validDateString(input.medianSpread.windowStartDate) || !validDateString(input.medianSpread.windowEndDate)
    || input.medianSpread.windowStartDate > input.medianSpread.windowEndDate) return { ...base, status: "invalidInput", reason: "Expense or spread inputs are malformed or outside their allowed range." };
  const calculated = calculateCostAndTradingScore(input.expenseRatio.value, input.medianSpread.value, ETF_CORE_SCORECARD_CANDIDATES[input.family]);
  if (!calculated) return { ...base, status: "invalidInput", reason: "Cost and Trading components could not be calculated." };
  const methodologyPending = ETF_CORE_SCORECARD_METHODOLOGY_STATE !== "frozen";
  return {
    ...base,
    score: methodologyPending ? null : calculated.score,
    status: methodologyPending ? "methodologyPending" : "available",
    reason: methodologyPending ? "Cost and Trading curves remain candidates and are not ready for publication." : "",
    components: {
      fee: { points: calculated.feePoints, weight: 0.5, inputValue: input.expenseRatio.value, inputUnit: "percent" },
      spread: { points: calculated.spreadPoints, weight: 0.5, inputValue: input.medianSpread.value, inputUnit: "basisPoints" },
    },
  };
}

function lastCompletedMonthCutoff(cutoff: string, now: Date): boolean {
  if (!validDateString(cutoff)) return false;
  const date = new Date(`${cutoff}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const nowMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (cutoff.slice(0, 7) >= nowMonth) return false;
  const nextMonthFirstDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  const finalCalendarDay = nextMonthFirstDay - DAY_MS;
  return finalCalendarDay - date.getTime() >= 0 && finalCalendarDay - date.getTime() <= 3 * DAY_MS;
}

function validMonthEndSequence(dates: string[], returnsCount: number, cutoff: string): boolean {
  if (dates.length !== returnsCount + 1 || dates.at(-1) !== cutoff) return false;
  for (let index = 0; index < dates.length; index += 1) {
    if (!validDateString(dates[index])) return false;
    if (index > 0) {
      const previous = dates[index - 1].slice(0, 7);
      const currentDate = new Date(`${previous}-01T00:00:00Z`);
      currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
      if (dates[index].slice(0, 7) !== currentDate.toISOString().slice(0, 7)) return false;
    }
  }
  return true;
}

function annualizedReturnPct(returns: number[], startDate: string, endDate: string): number | null {
  if (!validDateString(startDate) || !validDateString(endDate)) return null;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const years = (end - start) / (YEAR_DAYS * DAY_MS);
  if (!finite(start) || !finite(end) || years <= 0 || returns.some((value) => !finite(value) || value <= -1)) return null;
  const logGrowth = returns.reduce((sum, value) => sum + Math.log1p(value), 0);
  return Math.expm1(logGrowth / years) * 100;
}

function sourceIssues(input: CoreScoreInput): { status: ScoreCalculationStatus; reason: string } | null {
  if (!input.mandateVerified) return { status: "missingSource", reason: "Dated evidence for the fund's current mandate and identity is required." };
  const facts = [input.expenseRatio, input.medianSpread];
  if (facts.some((fact) => !fact.sourceId || !fact.verified)) return { status: "missingSource", reason: "Verified expense-ratio and 30-day median-spread sources are required." };
  if (facts.some((fact) => !fact.fresh)) return { status: "staleInput", reason: "Expense-ratio or median-spread input is stale." };
  if (!input.market.sourceId || !input.market.authorized || !input.market.adjustmentMethodVerified) return { status: "missingSource", reason: "Authorized, verified market-price total-return history is required." };
  if (!input.market.complete) return { status: "insufficientHistory", reason: "The monthly and daily market-history window is incomplete." };
  if (input.expenseRatio.designation !== "net") return { status: "missingSource", reason: "Core requires a verified current net expense ratio." };
  if (!finite(input.expenseRatio.value) || input.expenseRatio.value < 0
    || !finite(input.medianSpread.value) || input.medianSpread.value < 0
    || input.medianSpread.windowDays !== 30
    || !validDateString(input.medianSpread.windowStartDate) || !validDateString(input.medianSpread.windowEndDate)
    || input.medianSpread.windowStartDate > input.medianSpread.windowEndDate
    || !finite(input.maxDrawdownMagnitudePct) || input.maxDrawdownMagnitudePct < 0 || input.maxDrawdownMagnitudePct > 100) {
    return { status: "invalidInput", reason: "A score input is malformed or outside its allowed range." };
  }
  return null;
}

function computeMarketOutcome(input: CoreScoreInput): { cagrPct: number; downsideDeviationPct: number } | null {
  const count = input.horizon === "3Y" ? 36 : 12;
  const returns = input.market.monthlyReturns;
  if (returns.length !== count) return null;
  if (returns.some((value) => !finite(value) || value <= -1)) return null;
  if (!validMonthEndSequence(input.market.monthEndDates, count, input.cutoff)) return null;
  const { startDate, endDate, observations, complete } = input.market.dailyHistory;
  if (!complete || observations < 2 || startDate !== input.market.monthEndDates[0] || endDate !== input.cutoff) return null;
  const annualGrowth = annualizedReturnPct(returns, input.market.monthEndDates[0], input.cutoff);
  if (annualGrowth == null) return null;
  const downsideDeviation = 100 * Math.sqrt(12 * returns.reduce((sum, value) => sum + Math.min(value, 0) ** 2, 0) / count);
  return { cagrPct: annualGrowth, downsideDeviationPct: downsideDeviation };
}

function result(
  input: CoreScoreInput,
  score: number | null,
  status: ScoreCalculationStatus,
  reason: string,
  sourceIds: string[],
  components?: Record<string, ScoreComponent>,
): ScoreCalculation {
  return {
    score,
    status,
    reason,
    sourceIds,
    cutoff: input.cutoff,
    methodologyVersion: ETF_CORE_SCORECARD_VERSION_IDS[input.family][input.horizon],
    comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: status === "available" && Boolean(input.comparisonGroupId?.trim()),
    inputDates: {
      expenseRatioFinancialDate: input.expenseRatio.financialDate ?? null,
      expenseWaiverExpiry: input.expenseRatio.waiverExpiryDate ?? null,
      medianSpreadWindowStart: input.medianSpread.windowStartDate ?? null,
      medianSpreadWindowEnd: input.medianSpread.windowEndDate ?? null,
      marketWindowStart: input.market.monthEndDates[0] ?? null,
      marketWindowEnd: input.market.monthEndDates.at(-1) ?? null,
    },
    observations: {
      monthlyReturns: input.market.monthlyReturns.length,
      dailyHistory: input.market.dailyHistory.observations,
      medianSpreadWindowDays: input.medianSpread.windowDays,
    },
    ...(components ? { components } : {}),
  };
}

/** Returns a complete Core result only after the candidate rules have been frozen. */
export function calculateCoreScore(input: CoreScoreInput): ScoreCalculation {
  const settings = ETF_CORE_SCORECARD_CANDIDATES[input.family];
  const sourceIds = [input.expenseRatio.sourceId, input.medianSpread.sourceId, input.market.sourceId].filter(Boolean);
  const issue = sourceIssues(input);
  if (issue) return result(input, null, issue.status, issue.reason, sourceIds);
  const now = input.now ?? new Date();
  if (!lastCompletedMonthCutoff(input.cutoff, now)) return result(input, null, "invalidInput", "The score cutoff must be the last completed UTC month-end trading date.", sourceIds);
  const outcomes = computeMarketOutcome(input);
  if (!outcomes) {
    const required = input.horizon === "3Y" ? 36 : 12;
    const currentCount = input.market.monthlyReturns.length;
    return result(input, null, currentCount === required ? "invalidInput" : "insufficientHistory", `Core ${input.horizon} requires exactly ${required} complete monthly returns and matching complete daily history.`, sourceIds);
  }
  const costs = calculateCostAndTradingScore(input.expenseRatio.value, input.medianSpread.value, settings);
  const growth = growthPoints(outcomes.cagrPct, settings.growthAnchor, settings.growthScale);
  const drawdown = drawdownResiliencePoints(input.maxDrawdownMagnitudePct, settings.drawdownScale);
  const downside = downsidePoints(outcomes.downsideDeviationPct, settings.downsideScale);
  if (!costs || growth == null || drawdown == null || downside == null) return result(input, null, "invalidInput", "Core score components could not be calculated from finite, valid inputs.", sourceIds);
  const historicalOutcomes = geometricMean([growth, drawdown, downside], [settings.growthWeight, settings.drawdownWeight, settings.downsideWeight]);
  if (historicalOutcomes == null) return result(input, null, "invalidInput", "Core outcome weights or component points are invalid.", sourceIds);
  const score = 0.6 * costs.score + 0.4 * historicalOutcomes;
  const methodologyPending = ETF_CORE_SCORECARD_METHODOLOGY_STATE !== "frozen";
  return result(
    input,
    methodologyPending ? null : score,
    methodologyPending ? "methodologyPending" : "available",
    methodologyPending ? "Inputs are complete, but candidate scorecard constants are not approved for publication yet." : "",
    sourceIds,
    {
      fee: { points: costs.feePoints, weight: 0.3, inputValue: input.expenseRatio.value, inputUnit: "percent" },
      spread: { points: costs.spreadPoints, weight: 0.3, inputValue: input.medianSpread.value, inputUnit: "basisPoints" },
      growth: { points: growth, weight: 0.4 * settings.growthWeight, inputValue: outcomes.cagrPct, inputUnit: "percent" },
      drawdown: { points: drawdown, weight: 0.4 * settings.drawdownWeight, inputValue: input.maxDrawdownMagnitudePct, inputUnit: "percent" },
      downside: { points: downside, weight: 0.4 * settings.downsideWeight, inputValue: outcomes.downsideDeviationPct, inputUnit: "percent" },
    },
  );
}

export interface VerifiedTotalReturnLevel {
  date: string;
  value: number;
}

export interface FullHistoricalInputs {
  /** Authorized market-price total-return levels. The last 96 produce exactly 36 five-year endpoints. */
  totalReturnLevels: VerifiedTotalReturnLevel[];
  cutoff: string;
  maxDrawdownMagnitudePct: number;
  dailyHistory: { complete: boolean; startDate: string; endDate: string; observations: number };
}

export interface FullHistoricalPerformanceResult {
  growthCagrPct: number;
  maxDrawdownMagnitudePct: number;
  rollingMedianCagrPct: number;
  rollingP10CagrPct: number;
  rollingWindowCount: number;
  monthEndLevelCount: number;
  consistencyGapPct: number;
  growth: number;
  resilience: number;
  consistency: number;
}

export interface FullQualityInputs {
  expenseRatioPct: number;
  medianSpreadBps: number;
  cutoff: string;
  navMonthlyReturns: number[];
  benchmarkMonthlyReturns: number[];
  alignedMonthEndDates: string[];
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2 || values.some((value) => !finite(value))) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function interpolatedQuantile(values: number[], probability: number): number | null {
  if (!values.length || probability < 0 || probability > 1) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
}

export function calculateFullHistoricalPerformance(input: FullHistoricalInputs): FullHistoricalPerformanceResult | null {
  if (input.totalReturnLevels.length < 96 || !finite(input.maxDrawdownMagnitudePct)
    || input.maxDrawdownMagnitudePct < 0 || input.maxDrawdownMagnitudePct > 100) return null;
  const levels = input.totalReturnLevels.slice(-96);
  const dates = levels.map((level) => level.date);
  if (!validMonthEndSequence(dates, 95, input.cutoff)
    || levels.some((level) => !finite(level.value) || level.value <= 0)
    || !input.dailyHistory.complete || input.dailyHistory.observations < 2
    || input.dailyHistory.startDate !== levels.at(-61)?.date || input.dailyHistory.endDate !== input.cutoff) return null;
  const rollingCagrs: number[] = [];
  for (let endIndex = 60; endIndex < levels.length; endIndex += 1) {
    const window = levels.slice(endIndex - 60, endIndex + 1);
    const elapsedYears = (new Date(`${window.at(-1)!.date}T00:00:00Z`).getTime() - new Date(`${window[0].date}T00:00:00Z`).getTime()) / (YEAR_DAYS * DAY_MS);
    const factor = window.at(-1)!.value / window[0].value;
    if (elapsedYears <= 0 || factor <= 0) return null;
    rollingCagrs.push((factor ** (1 / elapsedYears) - 1) * 100);
  }
  if (rollingCagrs.length !== 36) return null;
  const rollingMedianCagrPct = interpolatedQuantile(rollingCagrs, 0.5);
  const rollingP10CagrPct = interpolatedQuantile(rollingCagrs, 0.1);
  const growthCagrPct = rollingCagrs.at(-1);
  if (rollingMedianCagrPct == null || rollingP10CagrPct == null || growthCagrPct == null) return null;
  const rawGap = rollingMedianCagrPct - rollingP10CagrPct;
  if (rawGap < -1e-8) return null;
  const consistencyGapPct = Math.max(0, rawGap);
  const settings = ETF_FULL_SCORECARD_CANDIDATE.historical;
  const growth = growthPoints(growthCagrPct, settings.growthAnchor, settings.growthScale);
  const resilience = drawdownResiliencePoints(input.maxDrawdownMagnitudePct, settings.drawdownScale);
  const consistency = consistencyPoints(consistencyGapPct, settings.consistencyScale);
  if (growth == null || resilience == null || consistency == null) return null;
  return {
    growthCagrPct, maxDrawdownMagnitudePct: input.maxDrawdownMagnitudePct,
    rollingMedianCagrPct, rollingP10CagrPct, rollingWindowCount: rollingCagrs.length,
    monthEndLevelCount: levels.length, consistencyGapPct, growth, resilience, consistency,
  };
}

export function calculateFullHistoricalScore(input: FullHistoricalInputs & { expenseRatioPct: number }): { score: number; components: Record<string, ScoreComponent> } | null {
  if (!finite(input.expenseRatioPct) || input.expenseRatioPct < 0) return null;
  const calculated = calculateFullHistoricalPerformance(input);
  if (!calculated) return null;
  const fee = feeEfficiencyPoints(input.expenseRatioPct, ETF_FULL_SCORECARD_CANDIDATE.historical.feeScale);
  if (fee == null) return null;
  const weights = [0.4, 0.35, 0.15, 0.1];
  const score = geometricMean([calculated.growth, calculated.resilience, calculated.consistency, fee], weights);
  if (score == null) return null;
  return {
    score,
    components: {
      growth: { points: calculated.growth, weight: weights[0], inputValue: calculated.growthCagrPct, inputUnit: "percent" },
      drawdownResilience: { points: calculated.resilience, weight: weights[1], inputValue: calculated.maxDrawdownMagnitudePct, inputUnit: "percent" },
      consistency: { points: calculated.consistency, weight: weights[2], inputValue: calculated.consistencyGapPct, inputUnit: "percentagePoints" },
      feeEfficiency: { points: fee, weight: weights[3], inputValue: input.expenseRatioPct, inputUnit: "percent" },
    },
  };
}

export function calculateFullFundQuality(input: FullQualityInputs): { score: number; trackingErrorPct: number; components: Record<string, ScoreComponent> } | null {
  const returnsCount = 60;
  if (![input.expenseRatioPct, input.medianSpreadBps].every(finite)
    || input.expenseRatioPct < 0 || input.medianSpreadBps < 0
    || input.navMonthlyReturns.length !== returnsCount || input.benchmarkMonthlyReturns.length !== returnsCount
    || input.alignedMonthEndDates.length !== returnsCount + 1
    || !validMonthEndSequence(input.alignedMonthEndDates, returnsCount, input.cutoff)
    || input.navMonthlyReturns.some((value) => !finite(value) || value <= -1)
    || input.benchmarkMonthlyReturns.some((value) => !finite(value) || value <= -1)) return null;
  const gaps = input.navMonthlyReturns.map((value, index) => value - input.benchmarkMonthlyReturns[index]);
  const monthlyStd = sampleStdDev(gaps);
  if (monthlyStd == null) return null;
  const navCagrPct = annualizedReturnPct(input.navMonthlyReturns, input.alignedMonthEndDates[0], input.cutoff);
  const benchmarkCagrPct = annualizedReturnPct(input.benchmarkMonthlyReturns, input.alignedMonthEndDates[0], input.cutoff);
  if (navCagrPct == null || benchmarkCagrPct == null) return null;
  const trackingDifferencePct = navCagrPct - benchmarkCagrPct;
  const trackingErrorPct = monthlyStd * Math.sqrt(12) * 100;
  const settings = ETF_FULL_SCORECARD_CANDIDATE.quality;
  const fee = feeEfficiencyPoints(input.expenseRatioPct, settings.feeScale);
  const spread = spreadEfficiencyPoints(input.medianSpreadBps, settings.spreadScale);
  const difference = trackingDifferencePoints(trackingDifferencePct, settings.trackingDifferenceScale);
  const error = trackingErrorPoints(trackingErrorPct, settings.trackingErrorScale);
  if (fee == null || spread == null || difference == null || error == null) return null;
  const weights = [settings.fee, settings.spread, settings.trackingDifference, settings.trackingError];
  const score = (fee * weights[0]) + (spread * weights[1]) + (difference * weights[2]) + (error * weights[3]);
  return {
    score,
    trackingErrorPct,
    components: {
      feeEfficiency: { points: fee, weight: weights[0], inputValue: input.expenseRatioPct, inputUnit: "percent" },
      tradingEfficiency: { points: spread, weight: weights[1], inputValue: input.medianSpreadBps, inputUnit: "basisPoints" },
      trackingDifference: { points: difference, weight: weights[2], inputValue: trackingDifferencePct, inputUnit: "percentagePoints" },
      trackingError: { points: error, weight: weights[3], inputValue: trackingErrorPct, inputUnit: "percent" },
    },
  };
}

export function calculateFullGrandScore(input: {
  historical: FullHistoricalInputs & { expenseRatioPct: number };
  quality: FullQualityInputs;
  sourcesVerified: boolean;
  sourcesFresh: boolean;
  mandateAndBenchmarkVerified: boolean;
  comparisonGroupId?: string | null;
  cutoff?: string | null;
  sourceIds?: string[];
}): ScoreCalculation {
  const sourceIds = input.sourceIds ?? [];
  const finish = (status: ScoreCalculationStatus, reason: string, score: number | null = null, components?: Record<string, ScoreComponent>): ScoreCalculation => ({
    score,
    status,
    reason,
    sourceIds,
    cutoff: null,
    methodologyVersion: ETF_FULL_SCORECARD_CANDIDATE.id,
    comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: status === "available" && Boolean(input.comparisonGroupId?.trim()),
    ...(input.cutoff ? { cutoff: input.cutoff } : {}),
    ...(components ? { components } : {}),
  });
  if (!input.sourcesVerified || !input.mandateAndBenchmarkVerified) return finish("missingSource", "Verified price, NAV, official benchmark, mandate, fee, and spread sources are required.");
  if (!input.sourcesFresh) return finish("staleInput", "One or more Full score inputs are stale.");
  if (!input.cutoff || input.quality.cutoff !== input.cutoff || input.historical.cutoff !== input.cutoff || !lastCompletedMonthCutoff(input.cutoff, new Date())) return finish("invalidInput", "Full score inputs must use the last completed UTC month cutoff with matching market, NAV, and benchmark dates.");
  if (!calculateFullHistoricalPerformance(input.historical)) return finish("insufficientHistory", "Full Historical Performance requires valid five-year risk/return data, 36 rolling windows, and about eight years of month-end history.");
  const historical = calculateFullHistoricalScore(input.historical);
  const quality = calculateFullFundQuality(input.quality);
  if (!historical || !quality) return finish("invalidInput", "Full score inputs are malformed, incomplete, or misaligned.");
  const fullComponents = {
    ...Object.fromEntries(Object.entries(historical.components).map(([key, value]) => [`historical.${key}`, { ...value, weight: value.weight * ETF_FULL_SCORECARD_CANDIDATE.grandScoreWeights.historicalPerformance }])),
    ...Object.fromEntries(Object.entries(quality.components).map(([key, value]) => [`quality.${key}`, { ...value, weight: value.weight * ETF_FULL_SCORECARD_CANDIDATE.grandScoreWeights.fundQuality }])),
  };
  if (ETF_FULL_SCORECARD_METHODOLOGY_STATE !== "frozen") return finish("methodologyPending", "Full score constants remain candidates and are not ready for publication.", null, fullComponents);
  const score = ETF_FULL_SCORECARD_CANDIDATE.grandScoreWeights.fundQuality * quality.score
    + ETF_FULL_SCORECARD_CANDIDATE.grandScoreWeights.historicalPerformance * historical.score;
  return finish("available", "", score, fullComponents);
}

export interface ExecutionScoreInput {
  horizon: "60-session" | "252-session";
  instrumentSeriesType: "nav" | "indicativeValue";
  expenseRatio: VerifiedExpenseRatio;
  medianSpread: VerifiedMedianSpread;
  signedLeverage: number;
  instrumentDailyReturns: number[];
  referenceDailyReturns: number[];
  dailySessionDates: string[];
  inputsVerified: boolean;
  inputsFresh: boolean;
  mandateVerified: boolean;
  comparisonGroupId?: string | null;
  cutoff: string;
  sourceIds: string[];
}

export function calculateTacticalExecutionScore(input: ExecutionScoreInput): ScoreCalculation {
  const required = input.horizon === "252-session" ? 252 : 60;
  const sourceIds = [...new Set([...input.sourceIds, input.expenseRatio.sourceId, input.medianSpread.sourceId].filter(Boolean))];
  const finish = (status: ScoreCalculationStatus, reason: string, components?: Record<string, ScoreComponent>): ScoreCalculation => ({
    score: null,
    status,
    reason,
    sourceIds,
    cutoff: input.cutoff,
    methodologyVersion: ETF_EXECUTION_SCORECARD_CANDIDATE.tacticalIds[input.horizon],
    comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: false,
    inputDates: {
      expenseRatioFinancialDate: input.expenseRatio.financialDate ?? null,
      expenseWaiverExpiry: input.expenseRatio.waiverExpiryDate ?? null,
      medianSpreadWindowStart: input.medianSpread.windowStartDate ?? null,
      medianSpreadWindowEnd: input.medianSpread.windowEndDate ?? null,
      executionWindowStart: input.dailySessionDates[0] ?? null,
      executionWindowEnd: input.dailySessionDates.at(-1) ?? null,
    },
    observations: { executionSessions: input.instrumentDailyReturns.length, medianSpreadWindowDays: input.medianSpread.windowDays },
    ...(components ? { components } : {}),
  });
  if (!input.mandateVerified) return finish("missingSource", "Current mandate, leverage, reset interval, and comparison-group facts must be verified before scoring.");
  if (input.instrumentSeriesType !== "nav") return finish("invalidInput", "Tactical ETF execution requires NAV total-return history.");
  if (!input.inputsVerified) return finish("missingSource", "Verified NAV / indicative-value total returns, the official daily reference, fee, and 30-day median spread are required.");
  if (!input.inputsFresh) return finish("staleInput", "One or more execution-score inputs are stale.");
  if (!input.expenseRatio.sourceId || !input.medianSpread.sourceId || !input.expenseRatio.verified || !input.medianSpread.verified) return finish("missingSource", "A verified net expense ratio and verified 30-day median spread are required.");
  if (!input.expenseRatio.fresh || !input.medianSpread.fresh) return finish("staleInput", "Expense-ratio or median-spread input is stale.");
  if (input.expenseRatio.designation !== "net") return finish("missingSource", "Execution cost requires a verified current net expense ratio.");
  if (input.instrumentDailyReturns.length !== required || input.referenceDailyReturns.length !== required || input.dailySessionDates.length !== required
    || input.dailySessionDates.some((date, index) => !validDateString(date) || (index > 0 && date <= input.dailySessionDates[index - 1]))) return finish("insufficientHistory", `Execution score requires exactly ${required} ordered, aligned daily return pairs.`);
  if (input.dailySessionDates.at(-1) !== input.cutoff || !lastCompletedMonthCutoff(input.cutoff, new Date())) return finish("invalidInput", "The execution window must end on the last completed UTC month trading date.");
  if (![input.expenseRatio.value, input.medianSpread.value, input.signedLeverage].every(finite)
    || input.expenseRatio.value < 0 || input.medianSpread.value < 0 || input.signedLeverage === 0
    || input.medianSpread.windowDays !== 30 || !validDateString(input.medianSpread.windowStartDate) || !validDateString(input.medianSpread.windowEndDate)
    || input.instrumentDailyReturns.some((value) => !finite(value) || value <= -1)
    || input.referenceDailyReturns.some((value) => !finite(value) || value <= -1)) return finish("invalidInput", "Execution inputs are malformed or outside their allowed range.");
  const cost = calculateCostAndTradingScore(input.expenseRatio.value, input.medianSpread.value, ETF_EXECUTION_SCORECARD_CANDIDATE);
  if (!cost) return finish("invalidInput", "Tactical cost components could not be calculated.");
  const rmsGapBps = 10_000 * Math.sqrt(input.instrumentDailyReturns.reduce((sum, instrumentReturn, index) => sum + (instrumentReturn - input.signedLeverage * input.referenceDailyReturns[index]) ** 2, 0) / required);
  const fidelity = 100 / (1 + (rmsGapBps / ETF_EXECUTION_SCORECARD_CANDIDATE.dailyRmsGapScaleBps) ** 2);
  const score = 0.4 * cost.score + 0.6 * fidelity;
  const methodologyPending = ETF_EXECUTION_SCORECARD_METHODOLOGY_STATE !== "frozen";
  return {
    score: methodologyPending ? null : score,
    status: methodologyPending ? "methodologyPending" : "available",
    reason: methodologyPending ? "Execution-score constants remain candidates and are not ready for publication." : "",
    sourceIds,
    cutoff: input.cutoff,
    methodologyVersion: ETF_EXECUTION_SCORECARD_CANDIDATE.tacticalIds[input.horizon],
    comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: !methodologyPending && Boolean(input.comparisonGroupId?.trim()),
    components: {
    fee: { points: cost.feePoints, weight: 0.2, inputValue: input.expenseRatio.value, inputUnit: "percent" },
    spread: { points: cost.spreadPoints, weight: 0.2, inputValue: input.medianSpread.value, inputUnit: "basisPoints" },
    dailyFidelity: { points: fidelity, weight: 0.6, inputValue: rmsGapBps, inputUnit: "basisPoints" },
    tacticalComposite: { points: score, weight: 1, inputValue: score, inputUnit: "score" },
    },
  };
}

export function calculateTacticalCostOnlyScore(input: {
  horizon: "60-session" | "252-session";
  mandateVerified: boolean;
  expenseRatio: VerifiedExpenseRatio;
  medianSpread: VerifiedMedianSpread;
  sourceIds: string[];
}): ScoreCalculation {
  const base = {
    score: null,
    sourceIds: input.sourceIds,
    cutoff: input.medianSpread.windowEndDate || input.expenseRatio.financialDate || null,
    methodologyVersion: `${ETF_EXECUTION_SCORECARD_CANDIDATE.tacticalIds[input.horizon]}-cost-only`,
    comparisonGroupId: null,
    rankedEligible: false,
    inputDates: {
      expenseRatioFinancialDate: input.expenseRatio.financialDate ?? null,
      expenseWaiverExpiry: input.expenseRatio.waiverExpiryDate ?? null,
      medianSpreadWindowStart: input.medianSpread.windowStartDate ?? null,
      medianSpreadWindowEnd: input.medianSpread.windowEndDate ?? null,
    },
    observations: { medianSpreadWindowDays: input.medianSpread.windowDays },
  };
  if (!input.mandateVerified) return { ...base, status: "missingSource", reason: "Verified leveraged/inverse mandate, reset interval, and instrument identity are required." };
  if (!input.expenseRatio.sourceId || !input.medianSpread.sourceId || !input.expenseRatio.verified || !input.medianSpread.verified) return { ...base, status: "missingSource", reason: "A verified current net expense ratio and verified 30-day median spread are required." };
  if (!input.expenseRatio.fresh || !input.medianSpread.fresh) return { ...base, status: "staleInput", reason: "Expense-ratio or 30-day median-spread input is stale." };
  if (input.expenseRatio.designation !== "net" || !finite(input.expenseRatio.value) || input.expenseRatio.value < 0
    || !finite(input.medianSpread.value) || input.medianSpread.value < 0 || input.medianSpread.windowDays !== 30
    || !validDateString(input.medianSpread.windowStartDate) || !validDateString(input.medianSpread.windowEndDate) || input.medianSpread.windowStartDate > input.medianSpread.windowEndDate) {
    return { ...base, status: "invalidInput", reason: "Tactical cost inputs are malformed or outside their allowed range." };
  }
  const cost = calculateCostAndTradingScore(input.expenseRatio.value, input.medianSpread.value, ETF_EXECUTION_SCORECARD_CANDIDATE);
  if (!cost) return { ...base, status: "invalidInput", reason: "Tactical cost components could not be calculated." };
  const methodologyPending = ETF_EXECUTION_SCORECARD_METHODOLOGY_STATE !== "frozen";
  return {
    ...base,
    score: methodologyPending ? null : cost.score,
    status: methodologyPending ? "methodologyPending" : "available",
    reason: methodologyPending ? "Tactical cost curves remain candidates and are not ready for publication." : "",
    components: {
      fee: { points: cost.feePoints, weight: 0.5, inputValue: input.expenseRatio.value, inputUnit: "percent" },
      spread: { points: cost.spreadPoints, weight: 0.5, inputValue: input.medianSpread.value, inputUnit: "basisPoints" },
    },
  };
}

/** ETN result uses indicative value, retains its own method ID, and does not assess issuer credit risk. */
export function calculateETNExecutionScore(input: ExecutionScoreInput & {
  identityContinuityVerified: boolean;
  dailyResetPayoffApplicable: boolean;
}): ScoreCalculation {
  if (input.instrumentSeriesType !== "indicativeValue") return {
    score: null, status: "invalidInput", reason: "ETN execution requires issuer indicative-value returns, not ETF NAV returns.", sourceIds: input.sourceIds,
    cutoff: input.cutoff, methodologyVersion: ETF_EXECUTION_SCORECARD_CANDIDATE.etnIds[input.horizon], comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: false,
  };
  if (!input.identityContinuityVerified) return {
    score: null, status: "missingSource", reason: "Verified note-series identity and continuity are required.", sourceIds: input.sourceIds,
    cutoff: input.cutoff, methodologyVersion: ETF_EXECUTION_SCORECARD_CANDIDATE.etnIds[input.horizon], comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: false,
  };
  if (!input.dailyResetPayoffApplicable) return {
    score: null, status: "notApplicable", reason: "The proposed ETN execution method only covers verified daily-reset, payoff-compatible notes.", sourceIds: input.sourceIds,
    cutoff: input.cutoff, methodologyVersion: ETF_EXECUTION_SCORECARD_CANDIDATE.etnIds[input.horizon], comparisonGroupId: input.comparisonGroupId?.trim() || null,
    rankedEligible: false,
  };
  const calculation = calculateTacticalExecutionScore(input);
  const creditContext = "ETN execution only; this result does not assess issuer credit, maturity, calls, or redemption risk.";
  return {
    ...calculation,
    methodologyVersion: ETF_EXECUTION_SCORECARD_CANDIDATE.etnIds[input.horizon],
    reason: calculation.reason ? `${calculation.reason} ${creditContext}` : creditContext,
    rankedEligible: calculation.status === "available" && Boolean(input.comparisonGroupId?.trim()),
  };
}

export function coreScorecardVersion(family: ETFCoreScorecardFamily, horizon: "1Y" | "3Y"): string {
  return ETF_CORE_SCORECARD_VERSION_IDS[family][horizon];
}

export function scoreHorizonMonths(horizon: ETFScoreHorizon): number | null {
  if (horizon === "1Y") return 12;
  if (horizon === "3Y") return 36;
  if (horizon === "5Y") return 60;
  return null;
}
