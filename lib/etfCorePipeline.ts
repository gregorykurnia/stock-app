import issuerInputDocument from "../data/etf-core-issuer-inputs.json";
import type { ETFRecord, ETFScoreAssessment, ETFScoreComponent, ETFScoreStatus } from "./etfCatalog";
import {
  buildETFComparisonGroupId,
  ETF_COMPARISON_GROUP_REQUIREMENTS,
  ETF_CORE_SCORECARD_CANDIDATES,
  ETF_CORE_SCORECARD_METHODOLOGY_STATE,
  ETF_CORE_SCORECARD_VERSION_IDS,
  ETF_COST_ONLY_SCORECARD_VERSION_IDS,
  routeETFFund,
  type ETFCoreScorecardFamily,
  type ETFMandateVerification,
} from "./etfScorecard";
import {
  calculateCoreScore,
  calculateCostOnlyScore,
  type CoreMarketHistory,
  type ScoreCalculation,
  type VerifiedExpenseRatio,
  type VerifiedMedianSpread,
} from "./etfScoring";
import type { TiingoDailyBar } from "./etfTiingo";

const DAY_MS = 86_400_000;
const MAX_SPREAD_AGE_SESSIONS = 2;
const US_EQUITY_SESSION_CLOSE_BUFFER_MINUTES = 15;
const SOURCE_REVIEW_DATE = "2026-10-06";
const MARKET_HISTORY_SOURCE = "Tiingo EOD adjusted close";
const MARKET_HISTORY_SOURCE_ID = "tiingo:eod:adjusted-close:v1";

interface IssuerInputRecord {
  issuer: string;
  identityVerified: boolean;
  identitySourceId: string;
  identitySourceUrl: string;
  mandate: {
    family: ETFCoreScorecardFamily;
    effectiveDate: string;
    reviewedAt: string;
    sourceId: string;
    sourceUrl: string;
    comparisonDimensions: Record<string, string>;
  };
  expenseRatio: {
    valuePct: number;
    financialDate: string;
    designation: "net" | "gross";
    waiverExpiryDate: string | null;
    sourceId: string;
    sourceUrl: string;
  };
  medianSpread: {
    /** Percentage units: 0.01 means 0.01%. */
    valuePct: number;
    financialDate: string;
    definition: string;
    sourceId: string;
    sourceUrl: string;
  };
}

const ISSUER_INPUTS = (issuerInputDocument as { funds: Record<string, IssuerInputRecord> }).funds;

export interface ETFCoreMarketWindow {
  cutoff: string;
  horizon: "1Y" | "3Y";
  startDate: string | null;
  monthEndDates: string[];
  monthlyReturns: number[];
  maxDrawdownMagnitudePct: number | null;
  dailyObservations: number;
  expectedSessions: number;
  missingSessionDates: string[];
  complete: boolean;
  latestObservationDate: string | null;
  latestObservationFresh: boolean;
}

export interface ETFCoreCoverageRow {
  ticker: string;
  family: string;
  horizon: "1Y" | "3Y";
  status: string;
  score: number | null;
  rankedEligible: boolean;
  reason: string;
}

export interface ETFCoreCoverageSummary {
  asOf: string;
  totalEtfs: number;
  etns: number;
  exclusions: number;
  tacticalEtfs: number;
  nonTacticalEtfs: number;
  core3Y: { numerical: number; ranked: number };
  core1Y: { numerical: number; ranked: number };
  costOnly: { numerical: number; staleOrPending: number };
  unavailable: number;
  blockers: Array<{ reason: string; count: number }>;
  byFamily: Array<{ family: string; funds: number; core3Y: number; core1Y: number }>;
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function isWeekend(date: Date): boolean {
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  return dateString(new Date(Date.UTC(year, month, 1 + delta + (occurrence - 1) * 7)));
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const delta = (last.getUTCDay() - weekday + 7) % 7;
  return dateString(new Date(Date.UTC(year, month + 1, -delta)));
}

function observedFixedHoliday(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  // NYSE does not observe New Year's Day on the preceding Friday when January 1 falls on Saturday.
  if (date.getUTCDay() === 6 && !(month === 0 && day === 1)) date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return dateString(date);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** NYSE/NYSE Arca full-day closures used to validate the US-listed catalogue. */
export function usEquityMarketHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  const holidays = [
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    dateString(goodFriday),
    lastWeekday(year, 4, 1),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 10, 4, 4),
  ];
  for (const baseYear of [year - 1, year, year + 1]) {
    for (const [month, day, applicable] of [
      [0, 1, true],
      [5, 19, baseYear >= 2022],
      [6, 4, true],
      [11, 25, true],
    ] as const) {
      if (!applicable) continue;
      const observed = observedFixedHoliday(baseYear, month, day);
      if (observed.slice(0, 4) === String(year)) holidays.push(observed);
    }
  }
  if (year === 2025) holidays.push("2025-01-09"); // National day of mourning for President Carter.
  if (year === 2018) holidays.push("2018-12-05"); // National day of mourning for President George H.W. Bush.
  return new Set(holidays);
}

export function isUsEquityTradingSession(dateValue: string): boolean {
  const date = parseDate(dateValue);
  return Boolean(date && !isWeekend(date) && !usEquityMarketHolidays(date.getUTCFullYear()).has(dateValue));
}

function lastCompletedUsEquitySession(now: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;

  const cursor = new Date(Date.UTC(year, month - 1, day));
  const localMinute = hour * 60 + minute;
  if (localMinute < (16 * 60) + US_EQUITY_SESSION_CLOSE_BUFFER_MINUTES) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (!isUsEquityTradingSession(dateString(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  return dateString(cursor);
}

/** Counts completed NYSE/NYSE Arca sessions strictly after a source date. */
export function usEquitySessionAgeFromDate(financialDate: string, now: Date): number {
  const sourceDate = parseDate(financialDate);
  const completedSession = lastCompletedUsEquitySession(now);
  const endDate = completedSession ? parseDate(completedSession) : null;
  if (!sourceDate || !endDate || sourceDate > endDate) return Number.POSITIVE_INFINITY;

  let age = 0;
  const cursor = new Date(sourceDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= endDate) {
    if (isUsEquityTradingSession(dateString(cursor))) age += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return age;
}

function monthString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return monthString(shifted);
}

function lastTradingSessionOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, monthNumber, 0));
  while (!isUsEquityTradingSession(dateString(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  return dateString(cursor);
}

export function lastCompletedUsMonthEnd(now: Date): string {
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return lastTradingSessionOfMonth(monthString(previousMonth));
}

function monthEndCutoff(now: Date, bars: Array<Pick<TiingoDailyBar, "date" | "adjustedClose">>, cutoffOverride?: string): string | null {
  const expectedCutoff = cutoffOverride ?? lastCompletedUsMonthEnd(now);
  const parsedCutoff = parseDate(expectedCutoff);
  if (!parsedCutoff || monthString(parsedCutoff) >= monthString(now)
    || lastTradingSessionOfMonth(monthString(parsedCutoff)) !== expectedCutoff) return null;
  return bars.some((bar) => bar.date === expectedCutoff) ? expectedCutoff : null;
}

function dayAge(date: string | null, now: Date): number {
  const parsed = date ? parseDate(date) : null;
  if (!parsed) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - parsed.getTime()) / DAY_MS);
}

function expectedSessions(startDate: string, endDate: string): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) return [];
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const date = dateString(cursor);
    if (isUsEquityTradingSession(date)) result.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function drawdownMagnitude(bars: Array<Pick<TiingoDailyBar, "date" | "adjustedClose">>): number | null {
  if (!bars.length) return null;
  let peak = bars[0].adjustedClose;
  let worst = 0;
  for (const bar of bars) {
    if (!Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0) return null;
    peak = Math.max(peak, bar.adjustedClose);
    worst = Math.max(worst, (peak - bar.adjustedClose) / peak);
  }
  return worst * 100;
}

export function buildETFCoreMarketWindow(
  allBars: Array<Pick<TiingoDailyBar, "date" | "adjustedClose">>,
  horizon: "1Y" | "3Y",
  now: Date,
  cutoffOverride?: string,
): ETFCoreMarketWindow {
  const bars = [...allBars].sort((left, right) => left.date.localeCompare(right.date));
  const cutoff = monthEndCutoff(now, bars, cutoffOverride) ?? "";
  const latestObservationDate = bars.at(-1)?.date ?? null;
  const returnCount = horizon === "3Y" ? 36 : 12;
  if (!cutoff) return {
    cutoff: "", horizon, startDate: null, monthEndDates: [], monthlyReturns: [],
    maxDrawdownMagnitudePct: null, dailyObservations: 0, expectedSessions: 0,
    missingSessionDates: [], complete: false, latestObservationDate,
    latestObservationFresh: dayAge(latestObservationDate, now) <= 5,
  };

  const endMonth = cutoff.slice(0, 7);
  const firstMonth = shiftMonth(endMonth, -returnCount);
  const byDate = new Map(bars.map((bar) => [bar.date, bar]));
  const monthEndDates: string[] = [];
  for (let index = 0; index <= returnCount; index += 1) {
    const month = shiftMonth(firstMonth, index);
    const expectedMonthEnd = lastTradingSessionOfMonth(month);
    if (expectedMonthEnd <= cutoff && byDate.has(expectedMonthEnd)) monthEndDates.push(expectedMonthEnd);
  }
  const startDate = monthEndDates[0] ?? null;
  const expected = startDate ? expectedSessions(startDate, cutoff) : [];
  const actual = startDate ? bars.filter((bar) => bar.date >= startDate && bar.date <= cutoff) : [];
  const actualDates = new Set(actual.map((bar) => bar.date));
  const missingSessionDates = expected.filter((date) => !actualDates.has(date));
  const monthlyReturns: number[] = [];
  if (monthEndDates.length === returnCount + 1) {
    for (let index = 1; index < monthEndDates.length; index += 1) {
      const previous = byDate.get(monthEndDates[index - 1]);
      const current = byDate.get(monthEndDates[index]);
      if (!previous || !current || previous.adjustedClose <= 0 || current.adjustedClose <= 0) {
        monthlyReturns.length = 0;
        break;
      }
      monthlyReturns.push(current.adjustedClose / previous.adjustedClose - 1);
    }
  }
  const lastCalendarDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const cutoffGap = (lastCalendarDay.getTime() - new Date(`${cutoff}T00:00:00Z`).getTime()) / DAY_MS;
  const complete = monthEndDates.length === returnCount + 1
    && monthEndDates.at(-1) === cutoff
    && monthlyReturns.length === returnCount
    && missingSessionDates.length === 0
    && actual.length === expected.length
    && expected.length > 2
    && cutoffGap >= 0 && cutoffGap <= 3;
  return {
    cutoff,
    horizon,
    startDate,
    monthEndDates,
    monthlyReturns,
    maxDrawdownMagnitudePct: startDate ? drawdownMagnitude(actual) : null,
    dailyObservations: actual.length,
    expectedSessions: expected.length,
    missingSessionDates,
    complete,
    latestObservationDate,
    latestObservationFresh: dayAge(latestObservationDate, now) >= 0 && dayAge(latestObservationDate, now) <= 5,
  };
}

function dateFresh(financialDate: string, now: Date, maximumAgeDays: number): boolean {
  const age = dayAge(financialDate, now);
  return age >= 0 && age <= maximumAgeDays;
}

export function validateETFCoreIssuerInput(ticker: string): string[] {
  const facts = ISSUER_INPUTS[ticker];
  if (!facts) return [`No reviewed issuer input bundle is recorded for ${ticker}.`];
  const errors: string[] = [];
  const sourceUrls = [facts.identitySourceUrl, facts.mandate.sourceUrl, facts.expenseRatio.sourceUrl, facts.medianSpread.sourceUrl];
  if (!facts.identityVerified || !facts.identitySourceId) errors.push("Issuer identity is not verified.");
  if (sourceUrls.some((url) => !url.startsWith("https://"))) errors.push("Every issuer fact must retain an HTTPS source URL.");
  if (!facts.mandate.sourceId || !parseDate(facts.mandate.effectiveDate) || !parseDate(facts.mandate.reviewedAt)) errors.push("Mandate evidence or its financial dates are incomplete.");
  if (!Number.isFinite(facts.expenseRatio.valuePct) || facts.expenseRatio.valuePct < 0
    || !parseDate(facts.expenseRatio.financialDate) || !facts.expenseRatio.sourceId
    || !["net", "gross"].includes(facts.expenseRatio.designation)
    || (facts.expenseRatio.waiverExpiryDate != null && !parseDate(facts.expenseRatio.waiverExpiryDate))) {
    errors.push("Expense ratio, net/gross designation, waiver date, or source is malformed.");
  }
  if (!Number.isFinite(facts.medianSpread.valuePct) || facts.medianSpread.valuePct < 0
    || !parseDate(facts.medianSpread.financialDate) || !facts.medianSpread.sourceId
    || !/30[- ]day/i.test(facts.medianSpread.definition)) {
    errors.push("Median spread must be a dated, sourced 30-day issuer disclosure in percentage units.");
  }
  const required = ETF_COMPARISON_GROUP_REQUIREMENTS[facts.mandate.family];
  const missingDimensions = required.filter((dimension) => !facts.mandate.comparisonDimensions[dimension]?.trim());
  if (missingDimensions.length) errors.push(`Comparison dimensions are missing: ${missingDimensions.join(", ")}.`);
  return errors;
}

export function normalizeIssuerSpreadPctToBps(valuePct: number): number | null {
  return Number.isFinite(valuePct) && valuePct >= 0 ? valuePct * 100 : null;
}

function mandateVerification(facts: IssuerInputRecord): ETFMandateVerification {
  const required = ETF_COMPARISON_GROUP_REQUIREMENTS[facts.mandate.family];
  const comparisonDimensionSourceIds = Object.fromEntries(required.map((dimension) => [dimension, [facts.mandate.sourceId]]));
  return {
    family: facts.mandate.family,
    evidenceSourceIds: [facts.identitySourceId, facts.mandate.sourceId],
    comparisonDimensions: facts.mandate.comparisonDimensions,
    comparisonDimensionSourceIds,
    reviewedAt: facts.mandate.reviewedAt,
    mandateEffectiveDate: facts.mandate.effectiveDate,
    identityVerified: facts.identityVerified,
  };
}

function toAssessment(
  kind: "core" | "cost-only",
  family: string,
  horizon: "1Y" | "3Y",
  groupId: string | null,
  groupEvidence: string[],
  runId: string,
  calculation: ScoreCalculation,
  inputGaps: string[],
  historyHash: string,
): ETFScoreAssessment {
  const reasonParts = [calculation.reason, ...inputGaps].filter(Boolean);
  const components: Record<string, ETFScoreComponent> | undefined = calculation.components
    ? Object.fromEntries(Object.entries(calculation.components).map(([key, component]) => [key, {
      points: component.points,
      weight: component.weight,
      inputValue: component.inputValue,
      inputUnit: component.inputUnit,
    }]))
    : undefined;
  return {
    scorecardId: kind === "cost-only" ? `core:${family}:cost-only` : `core:${family}:${horizon}`,
    kind,
    family,
    horizon,
    methodologyVersion: calculation.methodologyVersion,
    methodologyState: "candidate",
    comparisonGroupId: groupId,
    comparisonGroupEvidence: [...new Set(groupEvidence)],
    cutoff: calculation.cutoff,
    runId,
    status: calculation.status as ETFScoreStatus,
    score: calculation.score,
    rankedEligible: Boolean(calculation.rankedEligible && !inputGaps.length),
    reason: reasonParts.join(" "),
    ...(components ? { components } : {}),
    sourceIds: [...new Set(calculation.sourceIds)],
    inputDates: calculation.inputDates,
    observations: calculation.observations,
    inputHash: historyHash || undefined,
  };
}

function pendingAssessment(record: ETFRecord, horizon: "1Y" | "3Y", runId: string): ETFScoreAssessment {
  const route = routeETFFund(record);
  const tacticalRoute = route.candidate === "tactical-leveraged" || route.candidate === "tactical-reset-review";
  const routeStatus: ETFScoreStatus = tacticalRoute || route.status === "notApplicable" ? "notApplicable"
    : route.status === "identityUnresolved" ? "identityUnresolved" : "mandatePending";
  return {
    scorecardId: `core:${route.candidate}:${horizon}`,
    kind: "core",
    family: route.candidate,
    horizon,
    methodologyVersion: `unassigned-core-${horizon.toLowerCase()}`,
    methodologyState: "candidate",
    comparisonGroupId: null,
    comparisonGroupEvidence: route.evidenceSourceIds,
    cutoff: null,
    runId,
    status: routeStatus,
    score: null,
    rankedEligible: false,
    reason: tacticalRoute ? "This record follows the separate tactical-execution route; the Core scorecard does not rate leveraged or inverse funds." : route.reason,
    sourceIds: route.evidenceSourceIds,
  };
}

export function buildETFCoreAssessments(input: {
  record: ETFRecord;
  bars: TiingoDailyBar[];
  now: Date;
  runId: string;
  historyHash: string;
  cutoffDate?: string;
}): ETFScoreAssessment[] {
  const { record, bars, now, runId, historyHash, cutoffDate } = input;
  const facts = ISSUER_INPUTS[record.ticker];
  if (!facts) return [pendingAssessment(record, "3Y", runId), pendingAssessment(record, "1Y", runId)];
  const sourceInputErrors = validateETFCoreIssuerInput(record.ticker);
  if (sourceInputErrors.length) {
    return ["3Y", "1Y"].map((horizon) => ({
      ...pendingAssessment(record, horizon as "1Y" | "3Y", runId),
      status: "invalidInput" as const,
      reason: sourceInputErrors.join(" "),
    }));
  }

  const verification = mandateVerification(facts);
  const route = routeETFFund(record, verification);
  const group = buildETFComparisonGroupId(facts.mandate.family, facts.mandate.comparisonDimensions);
  const groupEvidence = [...verification.evidenceSourceIds, ...Object.values(verification.comparisonDimensionSourceIds).flat()];
  const cutoffWindow = buildETFCoreMarketWindow(bars, "3Y", now, cutoffDate);
  const expenseFresh = dateFresh(facts.expenseRatio.financialDate, now, 365)
    && (!facts.expenseRatio.waiverExpiryDate || facts.expenseRatio.waiverExpiryDate >= dateString(now));
  const spreadAgeSessions = usEquitySessionAgeFromDate(facts.medianSpread.financialDate, now);
  const spreadFresh = spreadAgeSessions >= 0 && spreadAgeSessions <= MAX_SPREAD_AGE_SESSIONS;
  const expenseRatio: VerifiedExpenseRatio = {
    value: facts.expenseRatio.valuePct,
    sourceId: facts.expenseRatio.sourceId,
    financialDate: facts.expenseRatio.financialDate,
    verified: Boolean(facts.expenseRatio.sourceId && facts.expenseRatio.sourceUrl),
    fresh: expenseFresh,
    designation: facts.expenseRatio.designation,
    waiverExpiryDate: facts.expenseRatio.waiverExpiryDate,
  };
  const spreadAsOf = facts.medianSpread.financialDate;
  const spreadStart = new Date(`${spreadAsOf}T00:00:00Z`);
  spreadStart.setUTCDate(spreadStart.getUTCDate() - 29);
  const medianSpread: VerifiedMedianSpread = {
    value: normalizeIssuerSpreadPctToBps(facts.medianSpread.valuePct) ?? Number.NaN,
    sourceId: facts.medianSpread.sourceId,
    financialDate: facts.medianSpread.financialDate,
    verified: Boolean(facts.medianSpread.sourceId && facts.medianSpread.sourceUrl && facts.medianSpread.definition),
    fresh: spreadFresh,
    windowDays: 30,
    windowStartDate: dateString(spreadStart),
    windowEndDate: spreadAsOf,
  };

  const result: ETFScoreAssessment[] = [];
  for (const horizon of ["3Y", "1Y"] as const) {
    const window = horizon === "3Y" ? cutoffWindow : buildETFCoreMarketWindow(bars, horizon, now, cutoffDate);
    const market: CoreMarketHistory = {
      sourceId: MARKET_HISTORY_SOURCE_ID,
      authorized: true,
      adjustmentMethodVerified: true,
      complete: window.complete && window.latestObservationFresh,
      monthlyReturns: window.monthlyReturns,
      monthEndDates: window.monthEndDates,
      dailyHistory: {
        complete: window.complete,
        startDate: window.startDate ?? "",
        endDate: window.cutoff,
        observations: window.dailyObservations,
      },
    };
    const inputGaps: string[] = [];
    if (route.status !== "readyForInputs") inputGaps.push(route.reason);
    if (!bars.length) inputGaps.push("No Tiingo EOD history has been retained for this ticker.");
    else if (!window.latestObservationFresh) inputGaps.push(`Latest Tiingo history observation ${window.latestObservationDate ?? "is missing"} is older than five days.`);
    else if (!window.complete) {
      if (window.missingSessionDates.length) inputGaps.push(`Tiingo history is missing ${window.missingSessionDates.length} expected US trading session(s), beginning ${window.missingSessionDates[0]}.`);
      else inputGaps.push(`Core ${horizon} does not have an exact complete ${horizon === "3Y" ? 36 : 12}-month window through ${window.cutoff || "the last completed UTC month"}.`);
    }
    if (!spreadFresh) inputGaps.push(`Issuer 30-day median spread disclosure is stale (as of ${spreadAsOf}; maximum age is ${MAX_SPREAD_AGE_SESSIONS} completed US trading sessions).`);
    const calculation = calculateCoreScore({
      family: facts.mandate.family,
      horizon,
      comparisonGroupId: group.groupId,
      mandateVerified: route.status === "readyForInputs",
      cutoff: window.cutoff,
      expenseRatio,
      medianSpread,
      market,
      maxDrawdownMagnitudePct: window.maxDrawdownMagnitudePct ?? Number.NaN,
      now,
    });
    const assessment = toAssessment("core", facts.mandate.family, horizon, group.groupId,
      groupEvidence, runId, calculation, [...new Set(inputGaps)], historyHash);
    assessment.methodologyState = ETF_CORE_SCORECARD_METHODOLOGY_STATE;
    assessment.sourceIds = [...new Set([
      facts.identitySourceId,
      facts.mandate.sourceId,
      facts.expenseRatio.sourceId,
      facts.medianSpread.sourceId,
      ...(bars.length ? [MARKET_HISTORY_SOURCE_ID] : []),
    ])];
    assessment.sourceUrls = [...new Set([
      facts.identitySourceUrl,
      facts.mandate.sourceUrl,
      facts.expenseRatio.sourceUrl,
      facts.medianSpread.sourceUrl,
      ...(bars.length ? ["https://www.tiingo.com/documentation/end-of-day"] : []),
    ])];
    if (window.startDate) assessment.inputDates = {
      ...assessment.inputDates,
      marketLatestObservation: window.latestObservationDate,
      monthWindowStart: window.startDate,
      marketRetrievedAt: dateString(now),
    };
    if (route.status === "identityUnresolved") assessment.status = "identityUnresolved";
    else if (route.status === "mandatePending") assessment.status = "mandatePending";
    else if (route.status === "notApplicable") assessment.status = "notApplicable";
    if (route.status !== "readyForInputs") {
      assessment.score = null;
      assessment.rankedEligible = false;
      assessment.reason = route.reason;
    }
    result.push(assessment);
  }

  const cost = calculateCostOnlyScore({
    family: facts.mandate.family,
    comparisonGroupId: group.groupId,
    mandateVerified: route.status === "readyForInputs",
    expenseRatio,
    medianSpread,
  });
  const costAssessment = toAssessment("cost-only", facts.mandate.family, "3Y", group.groupId,
    groupEvidence, runId, cost, spreadFresh ? [] : [`Issuer 30-day median spread disclosure is stale (as of ${spreadAsOf}; maximum age is ${MAX_SPREAD_AGE_SESSIONS} completed US trading sessions).`], historyHash);
  costAssessment.sourceUrls = [...new Set([facts.identitySourceUrl, facts.expenseRatio.sourceUrl, facts.medianSpread.sourceUrl])];
  result.push(costAssessment);
  return result;
}

export function issuerInputTickers(): string[] {
  return Object.keys(ISSUER_INPUTS).sort();
}

export function coreSourceReadiness(now: Date): { ticker: string; family: string; feeFresh: boolean; spreadFresh: boolean; spreadAgeSessions: number | null; sources: string[] }[] {
  return Object.entries(ISSUER_INPUTS).map(([ticker, facts]) => {
    const spreadAgeSessions = usEquitySessionAgeFromDate(facts.medianSpread.financialDate, now);
    return {
      ticker,
      family: facts.mandate.family,
      feeFresh: dateFresh(facts.expenseRatio.financialDate, now, 365),
      spreadFresh: spreadAgeSessions >= 0 && spreadAgeSessions <= MAX_SPREAD_AGE_SESSIONS,
      spreadAgeSessions: Number.isFinite(spreadAgeSessions) ? spreadAgeSessions : null,
      sources: [facts.identitySourceUrl, facts.mandate.sourceUrl, facts.expenseRatio.sourceUrl, facts.medianSpread.sourceUrl],
    };
  }).sort((left, right) => left.ticker.localeCompare(right.ticker));
}

export function buildETFCoreCoverageSummary(input: {
  records: ETFRecord[];
  snapshots: Record<string, { scoreAssessments?: ETFScoreAssessment[]; scoreStale?: boolean }>;
  etnCount: number;
  exclusionCount: number;
  asOf?: string;
}): ETFCoreCoverageSummary {
  const rows: ETFCoreCoverageRow[] = [];
  const tacticalTickers = new Set(input.records.filter((record) => record.strategy === "leveraged").map((record) => record.ticker));
  for (const record of input.records) {
    const assessments = input.snapshots[record.ticker]?.scoreAssessments ?? [];
    for (const assessment of assessments.filter((item) => item.kind === "core" && (item.horizon === "1Y" || item.horizon === "3Y"))) {
      rows.push({ ticker: record.ticker, family: assessment.family, horizon: assessment.horizon as "1Y" | "3Y", status: assessment.status,
        score: input.snapshots[record.ticker]?.scoreStale ? null : assessment.score,
        rankedEligible: assessment.rankedEligible && !input.snapshots[record.ticker]?.scoreStale,
        reason: assessment.reason });
    }
  }
  const core3YRows = rows.filter((row) => row.horizon === "3Y");
  const core1YRows = rows.filter((row) => row.horizon === "1Y");
  const validNumerical = (row: ETFCoreCoverageRow) => typeof row.score === "number" && Number.isFinite(row.score);
  const byTickerReason = new Map<string, { reason: string; ticker: string }>();
  for (const row of rows) {
    if (!validNumerical(row) && row.reason) byTickerReason.set(row.ticker, { reason: row.reason, ticker: row.ticker });
  }
  const reasonCounts = new Map<string, number>();
  for (const { reason } of byTickerReason.values()) {
    const primary = reason.split(/[.;]/)[0].trim() || "Unavailable input";
    reasonCounts.set(primary, (reasonCounts.get(primary) ?? 0) + 1);
  }
  const families = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!families.has(row.family)) families.set(row.family, new Set());
    families.get(row.family)!.add(row.ticker);
  }
  const nonTacticalEtfs = input.records.length - tacticalTickers.size;
  const costAssessments = input.records.flatMap((record) => input.snapshots[record.ticker]?.scoreAssessments ?? [])
    .filter((assessment) => assessment.kind === "cost-only");
  const costNumerical = costAssessments.filter((assessment) => typeof assessment.score === "number" && Number.isFinite(assessment.score)).length;
  return {
    asOf: input.asOf ?? dateString(new Date()),
    totalEtfs: input.records.length,
    etns: input.etnCount,
    exclusions: input.exclusionCount,
    tacticalEtfs: tacticalTickers.size,
    nonTacticalEtfs,
    core3Y: { numerical: core3YRows.filter(validNumerical).length, ranked: core3YRows.filter((row) => row.rankedEligible && validNumerical(row)).length },
    core1Y: { numerical: core1YRows.filter(validNumerical).length, ranked: core1YRows.filter((row) => row.rankedEligible && validNumerical(row)).length },
    costOnly: { numerical: costNumerical, staleOrPending: costAssessments.length - costNumerical },
    unavailable: new Set([...core3YRows, ...core1YRows].filter((row) => !validNumerical(row)).map((row) => row.ticker)).size,
    blockers: [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    byFamily: [...families.entries()].map(([family, tickers]) => ({
      family,
      funds: tickers.size,
      core3Y: core3YRows.filter((row) => row.family === family && validNumerical(row) && row.rankedEligible).length,
      core1Y: core1YRows.filter((row) => row.family === family && validNumerical(row) && row.rankedEligible).length,
    })).sort((left, right) => left.family.localeCompare(right.family)),
  };
}

export function methodologyCandidateFor(family: ETFCoreScorecardFamily, horizon: "1Y" | "3Y"): string {
  return ETF_CORE_SCORECARD_VERSION_IDS[family][horizon];
}

export function costMethodologyCandidateFor(family: ETFCoreScorecardFamily): string {
  return ETF_COST_ONLY_SCORECARD_VERSION_IDS[family];
}

export function coreSettingsFor(family: ETFCoreScorecardFamily) {
  return ETF_CORE_SCORECARD_CANDIDATES[family];
}

export const ETF_CORE_SOURCE_REVIEW_DATE = SOURCE_REVIEW_DATE;
export const ETF_CORE_MARKET_HISTORY_SOURCE = MARKET_HISTORY_SOURCE;
export const ETF_CORE_MARKET_HISTORY_SOURCE_ID = MARKET_HISTORY_SOURCE_ID;
