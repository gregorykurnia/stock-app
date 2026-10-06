import issuerDocument from "../data/etf-core-issuer-inputs.json";
import { buildETFCoreMarketWindow, type ETFCoreMarketWindow } from "./etfCorePipeline";
import { calculateCoreHistoricalOutcomes, feeEfficiencyPoints, type ScoreComponent } from "./etfScoring";
import { ETF_CORE_SCORECARD_CANDIDATES } from "./etfScorecard";

export const ETF_FREE_CORE_TRIAL_TICKERS = ["VOO", "VXUS"] as const;
export type ETFFreeCoreTrialTicker = typeof ETF_FREE_CORE_TRIAL_TICKERS[number];
export const ETF_FREE_CORE_TRIAL_VERSION = "equity-index-free-core-trial-v1";
export const ETF_FREE_CORE_TRIAL_WEIGHTS = { fee: 3 / 7, historical: 4 / 7 } as const;

export interface TrialDailyBar {
  date: string;
  close: number;
  adjustedClose: number;
  dividendCash: number;
  splitFactor: number;
}

export interface ETFFreeCoreTrialHistory {
  provider: "Yahoo Finance" | "Tiingo";
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  currency: string;
  bars: TrialDailyBar[];
}

export interface ETFFreeCoreTrialResult {
  horizon: "1Y" | "3Y";
  methodologyVersion: string;
  status: "trial" | "unavailable";
  reason: string;
  score: number | null;
  feePoints: number | null;
  historicalPoints: number | null;
  historicalComponents: Record<string, ScoreComponent>;
  window: ETFCoreMarketWindow;
}

export interface ETFFreeCoreTrialSnapshot {
  ticker: ETFFreeCoreTrialTicker;
  asOf: string;
  source: Omit<ETFFreeCoreTrialHistory, "bars">;
  historyHash: string;
  historyObservations: number;
  dividendEvents: number;
  splitEvents: number;
  fee: { valuePct: number; financialDate: string; sourceUrl: string; designation: string };
  results: ETFFreeCoreTrialResult[];
  referenceCheck?: { provider: "Tiingo"; retrievedAt: string; differences: Array<{ horizon: "1Y" | "3Y"; score: number; cagrPct: number; maxDrawdownPct: number }> };
  sourceNotes: string[];
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function trialHistoryIssues(history: ETFFreeCoreTrialHistory, now: Date): string[] {
  const issues: string[] = [];
  const retrieved = new Date(history.retrievedAt).getTime();
  if (!history.sourceId || !history.sourceUrl.startsWith("https://")) issues.push("Market history needs source provenance.");
  if (!Number.isFinite(retrieved) || retrieved > now.getTime() || now.getTime() - retrieved > 5 * 86_400_000) issues.push("History retrieval is missing, future-dated, or older than five days.");
  if (history.currency !== "USD") issues.push("This trial requires USD-denominated market prices.");
  if (!history.bars.length) issues.push("No market history is retained.");
  const dates = new Set<string>();
  for (const bar of history.bars) {
    if (!validDate(bar.date) || ![bar.close, bar.adjustedClose, bar.dividendCash, bar.splitFactor].every(Number.isFinite)
      || bar.close <= 0 || bar.adjustedClose <= 0 || bar.dividendCash < 0 || bar.splitFactor <= 0) {
      issues.push("Market history contains a malformed price or corporate-action row.");
      break;
    }
    if (dates.has(bar.date)) { issues.push("Market history contains duplicate session dates."); break; }
    dates.add(bar.date);
  }
  return issues;
}

/** A deliberately separate trial: no spread input, production state change, or ranking eligibility. */
export function calculateETFFreeCoreTrial(input: {
  ticker: ETFFreeCoreTrialTicker;
  history: ETFFreeCoreTrialHistory;
  historyHash: string;
  now: Date;
}): ETFFreeCoreTrialSnapshot {
  const facts = issuerDocument.funds[input.ticker];
  const fee: { valuePct: number; financialDate: string; designation: string; waiverExpiryDate: string | null; sourceId: string; sourceUrl: string } = facts.expenseRatio;
  const feeAge = (Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate()) - new Date(`${fee.financialDate}T00:00:00Z`).getTime()) / 86_400_000;
  const issues = trialHistoryIssues(input.history, input.now);
  if (!facts.identityVerified || facts.mandate.family !== "equity-index") issues.push("Verified equity-index identity and mandate are required.");
  if (!Number.isFinite(fee.valuePct) || fee.valuePct < 0 || fee.designation !== "net" || !fee.sourceId || !fee.sourceUrl.startsWith("https://")) issues.push("A sourced net expense ratio is required.");
  if (!Number.isFinite(feeAge) || feeAge < 0 || feeAge > 365 || (fee.waiverExpiryDate && fee.waiverExpiryDate < input.now.toISOString().slice(0, 10))) issues.push("The expense ratio is stale or its waiver has expired.");
  const settings = ETF_CORE_SCORECARD_CANDIDATES["equity-index"];
  const feePoints = feeEfficiencyPoints(fee.valuePct, settings.feeScale);
  const results = (["3Y", "1Y"] as const).map((horizon): ETFFreeCoreTrialResult => {
    const window = buildETFCoreMarketWindow(input.history.bars, horizon, input.now);
    const gaps = [...issues];
    if (!window.complete) gaps.push(`Incomplete ${horizon} monthly/daily window; ${window.missingSessionDates.length} missing sessions.`);
    if (!window.latestObservationFresh) gaps.push("The latest price observation is stale.");
    const historical = window.complete && window.maxDrawdownMagnitudePct != null ? calculateCoreHistoricalOutcomes({
      family: "equity-index", horizon, cutoff: window.cutoff, maxDrawdownMagnitudePct: window.maxDrawdownMagnitudePct,
      market: { sourceId: input.history.sourceId, authorized: true, adjustmentMethodVerified: true, complete: true,
        monthlyReturns: window.monthlyReturns, monthEndDates: window.monthEndDates,
        dailyHistory: { complete: true, startDate: window.startDate!, endDate: window.cutoff, observations: window.dailyObservations } },
    }) : null;
    if (!historical || feePoints == null) gaps.push("Valid historical and fee components are required.");
    const available = gaps.length === 0 && historical != null && feePoints != null;
    return {
      horizon, methodologyVersion: `${ETF_FREE_CORE_TRIAL_VERSION}-${horizon.toLowerCase()}`,
      status: available ? "trial" : "unavailable", reason: gaps.join(" "),
      score: available ? ETF_FREE_CORE_TRIAL_WEIGHTS.fee * feePoints! + ETF_FREE_CORE_TRIAL_WEIGHTS.historical * historical!.score : null,
      feePoints: available ? feePoints : null, historicalPoints: available ? historical!.score : null,
      historicalComponents: available ? historical!.components : {}, window,
    };
  });
  const { bars, ...source } = input.history;
  return {
    ticker: input.ticker, asOf: input.now.toISOString(), source, historyHash: input.historyHash,
    historyObservations: bars.length, dividendEvents: bars.filter((bar) => bar.dividendCash > 0).length,
    splitEvents: bars.filter((bar) => bar.splitFactor !== 1).length,
    fee: { valuePct: fee.valuePct, financialDate: fee.financialDate, sourceUrl: fee.sourceUrl, designation: fee.designation },
    results, sourceNotes: [],
  };
}
