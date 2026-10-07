import {
  canonicalSha256,
  canonicalJSONStringify,
  ETF_EQUITY_INDEX_INTEGRITY_SERIALIZATION,
  ETF_EQUITY_INDEX_INTEGRITY_VERSION,
} from "./etfEquityIndexValidationBatch";
import { buildETFCoreMarketWindow, isUsEquityTradingSession } from "./etfCorePipeline";
import { calculateCoreHistoricalOutcomes, feeEfficiencyPoints } from "./etfScoring";
import { ETF_CORE_SCORECARD_CANDIDATES } from "./etfScorecard";

export const ETF_EQUITY_INDEX_M3_METHOD = "equity-index-free-core-trial-v1";
export const ETF_EQUITY_INDEX_M3_CUTOFFS = ["2019-12-31", "2020-03-31", "2022-12-30", "2024-12-31"] as const;
export const ETF_EQUITY_INDEX_M3_STRATA = [
  "us-broad-equity",
  "developed-ex-us-equity",
  "broad-international-ex-us-equity",
] as const;
const MAX_SOURCE_AGE_DAYS = 365;
const MAX_HISTORY_AGE_DAYS = 5;
export const ETF_EQUITY_INDEX_M3_RETURN_TOLERANCE_PCT_POINTS = 0.25;
const DAY_MS = 86_400_000;
const EXPECTED_HISTORY_SOURCE_ID = "yahoo-finance2.chart:adjusted-close";

export type ETFEquityIndexM3Stratum = typeof ETF_EQUITY_INDEX_M3_STRATA[number];
export type ETFEquityIndexM3Horizon = "1Y" | "3Y";

export interface ETFEquityIndexM3FeeEvidence {
  valuePct: number;
  financialDate: string;
  designation: string;
  waiverExpiryDate: string | null;
  waiverStatus: string;
  sourceUrl: string;
}

export interface ETFEquityIndexM3FundRegistration {
  ticker: string;
  name: string;
  issuer: string;
  issuerDomain: string;
  exposureStratum: ETFEquityIndexM3Stratum;
  indexName: string;
  identitySourceUrl: string;
  mandateSourceUrl: string;
  knownInceptionDate: string;
  knownMandateChangeDates: string[];
  selectionDate: string;
  comparisonGroupId: string;
  inclusionRationale: string;
  expenseRatio: ETFEquityIndexM3FeeEvidence;
}

export interface ETFEquityIndexM3Sample {
  schemaVersion: number;
  sampleId: string;
  selectionDate: string;
  frozenAt: string;
  frozenBeforePriceAcquisition: boolean;
  excludedM1Tickers: string[];
  issuerDomainReviews: Array<{ issuer: string; domain: string; reviewedAt: string; reviewedFunds: string[] }>;
  comparisonGroups: Array<{ id: string; basis: string; tickers: string[] }>;
  funds: ETFEquityIndexM3FundRegistration[];
}

export interface ETFEquityIndexM3Bar { date: string; adjustedClose: number }
export interface ETFEquityIndexM3History {
  provider: "Yahoo Finance";
  sourceId: "yahoo-finance2.chart:adjusted-close";
  sourceUrl: string;
  retrievedAt: string;
  currency: string;
  bars: ETFEquityIndexM3Bar[];
}

export interface ETFEquityIndexM3ReturnReferenceSource {
  sourceName: string;
  sourceType: "official-issuer" | "independent-provider";
  sourceUrl: string;
  asOfDate: string;
  returnConvention: string;
  oneYearReturnPct: number | null;
  threeYearAnnualizedReturnPct: number | null;
}

export interface ETFEquityIndexM3ReturnReferenceRegistration {
  ticker: string;
  reviewNote: string;
  sources: ETFEquityIndexM3ReturnReferenceSource[];
}

export interface ETFEquityIndexM3ReturnEvidenceReview {
  protocolId: string;
  comparisonAsOf: string;
  oneYearStartDate: string;
  threeYearStartDate: string;
  endDate: string;
  tolerancePctPoints: number;
  funds: ETFEquityIndexM3ReturnReferenceRegistration[];
}

export interface ETFEquityIndexM3ReturnComparison {
  referenceReturnPct: number | null;
  yahooAdjustedCloseReturnPct: number | null;
  differencePctPoints: number | null;
  status: "matched" | "discrepancy" | "unavailable";
}

export interface ETFEquityIndexM3ReturnSourceCheck extends ETFEquityIndexM3ReturnReferenceSource {
  comparisons: { "1Y": ETFEquityIndexM3ReturnComparison; "3Y": ETFEquityIndexM3ReturnComparison };
}

export interface ETFEquityIndexM3IndependentReturnEvidence {
  reviewedAt: string;
  comparisonAsOf: string;
  oneYearStartDate: string;
  threeYearStartDate: string;
  endDate: string;
  tolerancePctPoints: number;
  reviewNote: string;
  status: "matched" | "discrepancy" | "unavailable";
  blockers: string[];
  sources: ETFEquityIndexM3ReturnSourceCheck[];
}

export type ETFEquityIndexM3Acquisition = ETFEquityIndexM3History | { error: string };

export interface ETFEquityIndexM3Scenario {
  id: string;
  kind: string;
  parameter: string;
  config: {
    feeWeight: number;
    feeScalePct: number;
    growthAnchorPct: number;
    growthScalePct: number;
    drawdownScalePct: number;
    downsideScalePct: number;
    growthWeight: number;
    drawdownWeight: number;
    downsideWeight: number;
  };
}

export interface ETFEquityIndexM3Result {
  cutoff: string;
  horizon: ETFEquityIndexM3Horizon;
  classification: "current-fee-candidate-analysis" | "current-fee-market-window-sensitivity-only";
  status: "scored" | "blocked";
  reason: string;
  score: number | null;
  feePoints: number | null;
  historicalPoints: number | null;
  annualizedReturnPct: number | null;
  maxDrawdownMagnitudePct: number | null;
  downsideDeviationPct: number | null;
  dailyObservations: number;
  expectedSessions: number;
  missingSessionCount: number;
  monthlyReturnCount: number;
  monthEndDates: string[];
  startDate: string | null;
  feeFinancialDate: string;
  feeDateAfterCutoff: boolean;
  inputHash: string;
}

export interface ETFEquityIndexM3FundSnapshot extends ETFEquityIndexM3FundRegistration {
  acquisitionError: string | null;
  captureValidity: "pass" | "blocked";
  currentFreshnessAtCapture: "fresh" | "stale-or-invalid";
  sourceBlockers: string[];
  independentReturnEvidence: ETFEquityIndexM3IndependentReturnEvidence;
  history: (ETFEquityIndexM3History & {
    firstDate: string | null;
    lastDate: string | null;
    observations: number;
    sha256: string;
  }) | null;
  historyCaptureBlockers: string[];
  results: ETFEquityIndexM3Result[];
}

export interface ETFEquityIndexM3Snapshot {
  schemaVersion: 1;
  methodologyVersion: typeof ETF_EQUITY_INDEX_M3_METHOD;
  integrityContract: {
    version: typeof ETF_EQUITY_INDEX_INTEGRITY_VERSION;
    serialization: typeof ETF_EQUITY_INDEX_INTEGRITY_SERIALIZATION;
    hashAlgorithm: "SHA-256";
    rawJsonReadRequired: true;
  };
  sampleId: string;
  sampleSha256: string;
  sampleCanonicalHash: string;
  sample: ETFEquityIndexM3Sample;
  asOf: string;
  commonCutoff: string;
  independentReturnEvidenceProtocol: Omit<ETFEquityIndexM3ReturnEvidenceReview, "funds">;
  sensitivityCutoffs: string[];
  sourceContract: {
    provider: "Yahoo Finance";
    sourceId: typeof EXPECTED_HISTORY_SOURCE_ID;
    priceSeries: "adjusted close in USD";
    distributionsAndSplits: "already reflected in adjusted close; do not add again";
    captureAgeLimitCalendarDays: number;
    historyAgeLimitCalendarDays: number;
  };
  feeTreatment: string;
  sensitivityScenarioDefinition: string;
  sensitivityScenarios: ETFEquityIndexM3Scenario[];
  sensitivityRows: Array<{ ticker: string; horizon: ETFEquityIndexM3Horizon; scenarioId: string; score: number }>;
  funds: ETFEquityIndexM3FundSnapshot[];
  validation: {
    sampleCounts: { total: number; issuerCount: number; byStratum: Record<string, number> };
    captureValidity: "pass" | "blocked";
    independentCalculation: { status: "pass" | "blocked"; checkedRows: number; maxAbsoluteDelta: number; failures: string[] };
    independentReturnReconciliation: {
      status: "complete" | "incomplete";
      reviewedFunds: number;
      matchedFunds: number;
      discrepancyTickers: string[];
      unavailableTickers: string[];
      tolerancePctPoints: number;
    };
    inRange: "pass" | "blocked";
    primaryScoreCoverage: Record<string, { "1Y": number; "3Y": number }>;
    invalidCaseFixtures: { status: "pass" | "blocked"; checks: Array<{ id: string; passed: boolean; observed: string }> };
    sensitivity: {
      scoredRows: number;
      scoreBoundsByHorizon: Record<string, { min: number | null; max: number | null }>;
      peerPairCountByHorizon: Record<string, number>;
      pairOrderChangesByHorizon: Record<string, number>;
      oneDecimalTiesByHorizon: Record<string, number>;
      correlationsByHorizon: Record<string, { cagrVsDownside: number | null; drawdownVsDownside: number | null }>;
    };
    historicalFeePointInTimeRows: "blocked";
    batchReadyForM4Review: boolean;
  };
}

export interface ETFEquityIndexM3IntegrityManifest {
  schemaVersion: 1;
  version: typeof ETF_EQUITY_INDEX_INTEGRITY_VERSION;
  serialization: typeof ETF_EQUITY_INDEX_INTEGRITY_SERIALIZATION;
  hashAlgorithm: "SHA-256";
  artifactHash: string;
  metadataHash: string;
  scoringParameters: Record<string, string | number>;
  fundHashes: Record<string, string>;
  rowHashes: Record<string, { inputHash: string; resultHash: string }>;
}

export interface ETFEquityIndexM3Artifact {
  snapshot: ETFEquityIndexM3Snapshot;
  integrityManifest: ETFEquityIndexM3IntegrityManifest;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function ageDays(dateValue: string, asOf: Date): number {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00Z`).getTime();
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return (today - date) / DAY_MS;
}

function nextMonthStart(cutoff: string): Date {
  const [year, month] = cutoff.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1, 12));
}

function sameIssuerUrl(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === domain;
  } catch { return false; }
}

function sourceBlockersFor(profile: ETFEquityIndexM3FundRegistration, sample: ETFEquityIndexM3Sample, asOf: Date): string[] {
  const blockers: string[] = [];
  const domainReview = sample.issuerDomainReviews.find((review) => review.issuer === profile.issuer);
  if (!domainReview || domainReview.domain !== profile.issuerDomain || !domainReview.reviewedFunds.includes(profile.ticker)) {
    blockers.push("Official issuer domain was not explicitly reviewed for this registered ticker.");
  }
  for (const [label, url] of [["identity", profile.identitySourceUrl], ["mandate", profile.mandateSourceUrl], ["fee", profile.expenseRatio.sourceUrl]] as const) {
    if (!sameIssuerUrl(url, profile.issuerDomain)) blockers.push(`${label[0].toUpperCase()}${label.slice(1)} evidence is not HTTPS on the reviewed issuer domain.`);
  }
  if (!profile.name || !profile.issuer || !profile.indexName || !profile.inclusionRationale.toLowerCase().includes("passive")
    || !profile.inclusionRationale.toLowerCase().includes("index")) {
    blockers.push("Verified passive broad equity-index identity and mandate evidence is required.");
  }
  if (!ETF_EQUITY_INDEX_M3_STRATA.includes(profile.exposureStratum)) blockers.push("The fund does not map to a registered M3 exposure stratum.");
  const fee = profile.expenseRatio;
  if (!fee || !Number.isFinite(fee.valuePct) || fee.valuePct < 0 || fee.designation !== "net"
    || !validDate(fee.financialDate) || !fee.waiverStatus?.trim()) {
    blockers.push("A dated, official-source net expense ratio is required; gross-only, missing or invalid fees are blocked.");
  } else {
    const feeAge = ageDays(fee.financialDate, asOf);
    if (feeAge < 0 || feeAge > MAX_SOURCE_AGE_DAYS) blockers.push(`Net expense evidence dated ${fee.financialDate} is future-dated or older than ${MAX_SOURCE_AGE_DAYS} days.`);
    if (fee.waiverExpiryDate && (!validDate(fee.waiverExpiryDate) || fee.waiverExpiryDate < asOf.toISOString().slice(0, 10))) {
      blockers.push("The fee waiver has expired or has an invalid expiry date.");
    }
  }
  return [...new Set(blockers)];
}

function historyBlockersFor(ticker: string, history: ETFEquityIndexM3History | null, acquisitionError: string | null, asOf: Date): string[] {
  const blockers: string[] = [];
  if (acquisitionError) blockers.push(`Yahoo Finance history request failed: ${acquisitionError}`);
  if (!history) return [...new Set([...blockers, `Yahoo Finance adjusted-price history is unavailable for ${ticker}.`])];
  if (history.provider !== "Yahoo Finance" || history.sourceId !== EXPECTED_HISTORY_SOURCE_ID
    || history.sourceUrl !== `https://finance.yahoo.com/quote/${ticker}/history/`) {
    blockers.push("History provider, adjusted-close source identifier or Yahoo ticker URL does not match the requested source.");
  }
  if (history.currency !== "USD") blockers.push(`Yahoo history currency is ${history.currency || "missing"}; USD-denominated adjusted prices are required.`);
  const retrieved = Date.parse(history.retrievedAt);
  const retrievalAge = (asOf.getTime() - retrieved) / DAY_MS;
  if (!Number.isFinite(retrieved) || retrievalAge < 0 || retrievalAge > MAX_HISTORY_AGE_DAYS) blockers.push(`Yahoo history retrieval is missing, future-dated or older than ${MAX_HISTORY_AGE_DAYS} days.`);
  if (!history.bars.length) blockers.push("Yahoo returned no adjusted-price observations.");
  let prior = "";
  const seen = new Set<string>();
  for (const bar of history.bars) {
    if (!validDate(bar.date) || !Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0) {
      blockers.push("Yahoo adjusted history contains an invalid date or nonpositive/missing adjusted close.");
      break;
    }
    if (seen.has(bar.date)) { blockers.push(`Yahoo adjusted history contains duplicate session date ${bar.date}.`); break; }
    if (prior && bar.date < prior) { blockers.push("Yahoo adjusted history is not ordered by session date."); break; }
    if (bar.date > asOf.toISOString().slice(0, 10)) { blockers.push(`Yahoo adjusted history contains future session ${bar.date}.`); break; }
    seen.add(bar.date);
    prior = bar.date;
  }
  const latest = history.bars.at(-1)?.date;
  if (!latest || ageDays(latest, asOf) < 0 || ageDays(latest, asOf) > MAX_HISTORY_AGE_DAYS) {
    blockers.push(`Latest Yahoo price observation ${latest ?? "is missing"} is future-dated or older than ${MAX_HISTORY_AGE_DAYS} days.`);
  }
  return [...new Set(blockers)];
}

function changedMandateBlocker(profile: ETFEquityIndexM3FundRegistration, startDate: string | null, cutoff: string): string[] {
  if (!startDate) return [];
  const changes = profile.knownMandateChangeDates
    .map((value) => /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0] ?? "")
    .filter(Boolean);
  const inWindow = changes.find((date) => date > startDate && date <= cutoff);
  return inWindow ? [`Known index/mandate transition on ${inWindow} falls inside the ${startDate}–${cutoff} window.`] : [];
}

function historyHash(history: ETFEquityIndexM3FundSnapshot["history"]): string {
  return canonicalSha256({
    provider: history?.provider ?? null,
    sourceId: history?.sourceId ?? null,
    sourceUrl: history?.sourceUrl ?? null,
    retrievedAt: history?.retrievedAt ?? null,
    currency: history?.currency ?? null,
    bars: history?.bars ?? [],
  });
}

function calculateEndpointReturn(
  history: ETFEquityIndexM3History | null,
  startDate: string,
  endDate: string,
  annualizeYears: number,
): number | null {
  const bars = new Map((history?.bars ?? []).map((bar) => [bar.date, bar.adjustedClose]));
  const start = bars.get(startDate);
  const end = bars.get(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start! <= 0 || end! <= 0) return null;
  return (Math.pow(end! / start!, 1 / annualizeYears) - 1) * 100;
}

function compareIndependentReturns(
  registration: ETFEquityIndexM3ReturnReferenceRegistration | undefined,
  history: ETFEquityIndexM3History | null,
  protocol: Omit<ETFEquityIndexM3ReturnEvidenceReview, "funds">,
  reviewedAt: string,
): ETFEquityIndexM3IndependentReturnEvidence {
  const sources = (registration?.sources ?? []).map((source): ETFEquityIndexM3ReturnSourceCheck => {
    const datesMatch = source.asOfDate === protocol.comparisonAsOf && source.asOfDate === protocol.endDate;
    const compare = (reference: number | null, startDate: string, years: number): ETFEquityIndexM3ReturnComparison => {
      const yahoo = datesMatch ? calculateEndpointReturn(history, startDate, protocol.endDate, years) : null;
      if (reference == null || yahoo == null) return { referenceReturnPct: reference, yahooAdjustedCloseReturnPct: yahoo, differencePctPoints: null, status: "unavailable" };
      const differencePctPoints = yahoo - reference;
      return {
        referenceReturnPct: reference,
        yahooAdjustedCloseReturnPct: yahoo,
        differencePctPoints,
        status: Math.abs(differencePctPoints) <= protocol.tolerancePctPoints ? "matched" : "discrepancy",
      };
    };
    return {
      ...source,
      comparisons: {
        "1Y": compare(source.oneYearReturnPct, protocol.oneYearStartDate, 1),
        "3Y": compare(source.threeYearAnnualizedReturnPct, protocol.threeYearStartDate, 3),
      },
    };
  });
  const comparisons = sources.flatMap((source) => [source.comparisons["1Y"], source.comparisons["3Y"]]);
  const status = comparisons.some((comparison) => comparison.status === "discrepancy")
    ? "discrepancy"
    : comparisons.some((comparison) => comparison.status === "matched") ? "matched" : "unavailable";
  const blockers = status === "discrepancy"
    ? [`Independent return evidence differs from Yahoo adjusted-close return by more than ${protocol.tolerancePctPoints} percentage points; scoring for this fund is blocked pending source/convention reconciliation.`]
    : [];
  return {
    reviewedAt,
    comparisonAsOf: protocol.comparisonAsOf,
    oneYearStartDate: protocol.oneYearStartDate,
    threeYearStartDate: protocol.threeYearStartDate,
    endDate: protocol.endDate,
    tolerancePctPoints: protocol.tolerancePctPoints,
    reviewNote: registration?.reviewNote ?? "No matched independent return source was available for this registered ticker.",
    status,
    blockers,
    sources,
  };
}

function rowInputPayload(
  fund: ETFEquityIndexM3FundSnapshot,
  result: ETFEquityIndexM3Result,
  retainedHistoryHash: string,
  parameters: Record<string, string | number>,
): unknown {
  const profile = Object.fromEntries(Object.entries(fund).filter(([key]) => !["history", "captureValidity", "currentFreshnessAtCapture", "sourceBlockers", "historyCaptureBlockers", "results"].includes(key)));
  const bars = (fund.history?.bars ?? []).filter((bar) => bar.date <= result.cutoff);
  const window = buildETFCoreMarketWindow(bars, result.horizon, nextMonthStart(result.cutoff), result.cutoff);
  return {
    version: ETF_EQUITY_INDEX_INTEGRITY_VERSION,
    ticker: fund.ticker,
    profile,
    historyHash: retainedHistoryHash,
    window: {
      cutoff: result.cutoff,
      horizon: result.horizon,
      startDate: window.startDate,
      monthEndDates: window.monthEndDates,
      monthlyReturns: window.monthlyReturns,
      maxDrawdownMagnitudePct: window.maxDrawdownMagnitudePct,
      dailyObservations: window.dailyObservations,
      expectedSessions: window.expectedSessions,
      missingSessionDates: window.missingSessionDates,
      complete: window.complete,
    },
    scoring: parameters,
  };
}

function scoringParameters(): Record<string, string | number> {
  const settings = ETF_CORE_SCORECARD_CANDIDATES["equity-index"];
  return {
    methodologyVersion: ETF_EQUITY_INDEX_M3_METHOD,
    formula: "(3/7 * feePoints) + (4/7 * historicalOutcomePoints)",
    feeWeight: 3 / 7,
    historicalWeight: 4 / 7,
    feeScalePct: settings.feeScale,
    growthAnchorPct: settings.growthAnchor,
    growthScalePct: settings.growthScale,
    drawdownScalePct: settings.drawdownScale,
    downsideScalePct: settings.downsideScale,
    growthWeight: settings.growthWeight,
    drawdownWeight: settings.drawdownWeight,
    downsideWeight: settings.downsideWeight,
  };
}

function buildResult(input: {
  fund: ETFEquityIndexM3FundSnapshot;
  history: ETFEquityIndexM3History | null;
  cutoff: string;
  horizon: ETFEquityIndexM3Horizon;
  commonCutoff: string;
  parameters: Record<string, string | number>;
}): ETFEquityIndexM3Result {
  const { fund, history, cutoff, horizon, commonCutoff, parameters } = input;
  const classification = cutoff === commonCutoff ? "current-fee-candidate-analysis" : "current-fee-market-window-sensitivity-only";
  const blockers = [...fund.sourceBlockers, ...fund.historyCaptureBlockers, ...fund.independentReturnEvidence.blockers];
  const feeDate = fund.expenseRatio.financialDate;
  const historyDigest = historyHash(fund.history);
  let window = null as ReturnType<typeof buildETFCoreMarketWindow> | null;
  if (history) {
    const cutoffBars = history.bars.filter((bar) => bar.date <= cutoff);
    window = buildETFCoreMarketWindow(cutoffBars, horizon, nextMonthStart(cutoff), cutoff);
    if (!window.complete) {
      if (!validDate(cutoff) || !isUsEquityTradingSession(cutoff)) blockers.push(`Cutoff ${cutoff} is not a valid completed U.S. equity trading session.`);
      if (window.missingSessionDates.length) blockers.push(`Incomplete ${horizon} daily window: ${window.missingSessionDates.length} expected U.S. sessions are missing, beginning ${window.missingSessionDates[0]}.`);
      else blockers.push(`Incomplete ${horizon} monthly/daily window at ${cutoff}: expected ${horizon === "1Y" ? 12 : 36} monthly returns and complete session coverage.`);
    }
    blockers.push(...changedMandateBlocker(fund, window.startDate, cutoff));
  }
  const market = window && {
    sourceId: EXPECTED_HISTORY_SOURCE_ID,
    authorized: true,
    adjustmentMethodVerified: true,
    complete: window.complete,
    monthlyReturns: window.monthlyReturns,
    monthEndDates: window.monthEndDates,
    dailyHistory: {
      complete: window.complete,
      startDate: window.startDate ?? "",
      endDate: cutoff,
      observations: window.dailyObservations,
    },
  };
  const historical = market && window?.complete && window.maxDrawdownMagnitudePct != null
    ? calculateCoreHistoricalOutcomes({
      family: "equity-index",
      horizon,
      cutoff,
      maxDrawdownMagnitudePct: window.maxDrawdownMagnitudePct,
      market,
    }) : null;
  const feePoints = fund.sourceBlockers.length === 0
    ? feeEfficiencyPoints(fund.expenseRatio.valuePct, ETF_CORE_SCORECARD_CANDIDATES["equity-index"].feeScale)
    : null;
  if (feePoints == null) blockers.push("A finite, nonnegative, current, sourced net-fee score input is required.");
  if (!historical) blockers.push("Complete adjusted-price history and valid historical outcome components are required.");
  const status = blockers.length === 0 && historical != null && feePoints != null ? "scored" : "blocked";
  const output: Omit<ETFEquityIndexM3Result, "inputHash"> = {
    cutoff,
    horizon,
    classification,
    status,
    reason: [...new Set(blockers)].join(" "),
    score: status === "scored" ? (3 / 7) * feePoints! + (4 / 7) * historical!.score : null,
    feePoints: status === "scored" ? feePoints : null,
    historicalPoints: status === "scored" ? historical!.score : null,
    annualizedReturnPct: status === "scored" ? historical!.cagrPct : null,
    maxDrawdownMagnitudePct: status === "scored" ? window?.maxDrawdownMagnitudePct ?? null : null,
    downsideDeviationPct: status === "scored" ? historical!.downsideDeviationPct : null,
    dailyObservations: window?.dailyObservations ?? 0,
    expectedSessions: window?.expectedSessions ?? 0,
    missingSessionCount: window?.missingSessionDates.length ?? 0,
    monthlyReturnCount: window?.monthlyReturns.length ?? 0,
    monthEndDates: window?.monthEndDates ?? [],
    startDate: window?.startDate ?? null,
    feeFinancialDate: feeDate,
    feeDateAfterCutoff: feeDate > cutoff,
  };
  const rowInput = rowInputPayload(fund, { ...output, inputHash: "" }, historyDigest, parameters);
  return { ...output, inputHash: canonicalSha256(rowInput) };
}

interface IndependentMarketMetrics {
  annualizedReturnPct: number;
  maxDrawdownMagnitudePct: number;
  downsideDeviationPct: number;
}

const independentMarketCache = new WeakMap<object, Map<string, IndependentMarketMetrics | null>>();

function independentMarketMetrics(fund: ETFEquityIndexM3FundSnapshot, horizon: ETFEquityIndexM3Horizon, cutoff: string): IndependentMarketMetrics | null {
  const cacheOwner = fund.history;
  const key = `${cutoff}|${horizon}`;
  const cached = cacheOwner ? independentMarketCache.get(cacheOwner)?.get(key) : undefined;
  if (cached !== undefined) return cached;
  const bars = fund.history?.bars ?? [];
  const count = horizon === "1Y" ? 12 : 36;
  const [cutoffYear, cutoffMonth] = cutoff.slice(0, 7).split("-").map(Number);
  const endpointDates: string[] = [];
  for (let offset = -count; offset <= 0; offset += 1) {
    const month = new Date(Date.UTC(cutoffYear, cutoffMonth - 1 + offset, 1));
    const monthId = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    const [year, monthNumber] = monthId.split("-").map(Number);
    const cursor = new Date(Date.UTC(year, monthNumber, 0));
    while (!isUsEquityTradingSession(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    endpointDates.push(cursor.toISOString().slice(0, 10));
  }
  const closeByDay = new Map(bars.map((bar) => [bar.date, bar.adjustedClose]));
  if (endpointDates.some((date) => !closeByDay.has(date)) || endpointDates.at(-1) !== cutoff) return null;
  const firstDate = endpointDates[0];
  const sessionDates: string[] = [];
  const cursor = new Date(`${firstDate}T00:00:00Z`);
  const end = new Date(`${cutoff}T00:00:00Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (isUsEquityTradingSession(date)) sessionDates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const actual = bars.filter((bar) => bar.date >= firstDate && bar.date <= cutoff);
  if (actual.length !== sessionDates.length || actual.some((bar, index) => bar.date !== sessionDates[index])) return null;
  if (actual.some((bar) => !Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0)) return null;
  const monthlyReturns: number[] = [];
  for (let index = 1; index < endpointDates.length; index += 1) {
    const previous = closeByDay.get(endpointDates[index - 1]);
    const current = closeByDay.get(endpointDates[index]);
    if (!previous || !current) return null;
    monthlyReturns.push(current / previous - 1);
  }
  if (monthlyReturns.length !== count || monthlyReturns.some((value) => !Number.isFinite(value) || value <= -1)) return null;
  const elapsedDays = (Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / DAY_MS;
  const years = elapsedDays / 365.2425;
  const cagr = Math.expm1(monthlyReturns.reduce((sum, value) => sum + Math.log1p(value), 0) / years) * 100;
  let runningPeak = actual[0].adjustedClose;
  let maxDrawdown = 0;
  for (const bar of actual) {
    runningPeak = Math.max(runningPeak, bar.adjustedClose);
    maxDrawdown = Math.max(maxDrawdown, (runningPeak - bar.adjustedClose) / runningPeak);
  }
  maxDrawdown *= 100;
  const downside = 100 * Math.sqrt(12 * monthlyReturns.reduce((sum, value) => sum + Math.min(value, 0) ** 2, 0) / count);
  const metrics = {
    annualizedReturnPct: cagr,
    maxDrawdownMagnitudePct: maxDrawdown,
    downsideDeviationPct: downside,
  };
  if (cacheOwner) {
    const cache = independentMarketCache.get(cacheOwner) ?? new Map<string, IndependentMarketMetrics | null>();
    cache.set(key, metrics);
    independentMarketCache.set(cacheOwner, cache);
  }
  return metrics;
}

function referenceOutcome(
  fund: ETFEquityIndexM3FundSnapshot,
  horizon: ETFEquityIndexM3Horizon,
  cutoff: string,
  params: ETFEquityIndexM3Scenario["config"],
): { score: number; feePoints: number; historicalPoints: number; annualizedReturnPct: number; maxDrawdownMagnitudePct: number; downsideDeviationPct: number } | null {
  const market = independentMarketMetrics(fund, horizon, cutoff);
  if (!market) return null;
  const feePoints = 100 * Math.exp(-fund.expenseRatio.valuePct / params.feeScalePct);
  const growth = 100 / (1 + Math.exp(-(market.annualizedReturnPct - params.growthAnchorPct) / params.growthScalePct));
  const drawdown = 100 / (1 + (market.maxDrawdownMagnitudePct / params.drawdownScalePct) ** 2);
  const downsidePoints = 100 / (1 + (market.downsideDeviationPct / params.downsideScalePct) ** 2);
  const components = [[growth, params.growthWeight], [drawdown, params.drawdownWeight], [downsidePoints, params.downsideWeight]] as const;
  const historicalPoints = Math.exp(components.reduce((sum, [points, weight]) => sum + weight * Math.log(points / 100), 0)) * 100;
  return {
    score: params.feeWeight * feePoints + (1 - params.feeWeight) * historicalPoints,
    feePoints,
    historicalPoints,
    ...market,
  };
}

function baselineScenario(): ETFEquityIndexM3Scenario {
  const settings = ETF_CORE_SCORECARD_CANDIDATES["equity-index"];
  return {
    id: "baseline",
    kind: "baseline",
    parameter: "none",
    config: {
      feeWeight: 3 / 7,
      feeScalePct: settings.feeScale,
      growthAnchorPct: settings.growthAnchor,
      growthScalePct: settings.growthScale,
      drawdownScalePct: settings.drawdownScale,
      downsideScalePct: settings.downsideScale,
      growthWeight: settings.growthWeight,
      drawdownWeight: settings.drawdownWeight,
      downsideWeight: settings.downsideWeight,
    },
  };
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index] - meanY), 0);
  const denominator = Math.sqrt(xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0) * ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0));
  return denominator ? numerator / denominator : null;
}

function sensitivitySummary(
  funds: ETFEquityIndexM3FundSnapshot[],
  scenarios: ETFEquityIndexM3Scenario[],
  sensitivityRows: ETFEquityIndexM3Snapshot["sensitivityRows"],
  commonCutoff: string,
): ETFEquityIndexM3Snapshot["validation"]["sensitivity"] {
  const rows = sensitivityRows;
  const horizons = ["1Y", "3Y"] as const;
  const scoreBoundsByHorizon: Record<string, { min: number | null; max: number | null }> = {};
  const peerPairCountByHorizon: Record<string, number> = {};
  const pairOrderChangesByHorizon: Record<string, number> = {};
  const oneDecimalTiesByHorizon: Record<string, number> = {};
  const correlationsByHorizon: Record<string, { cagrVsDownside: number | null; drawdownVsDownside: number | null }> = {};
  for (const horizon of horizons) {
    const scored = rows.filter((row) => row.horizon === horizon).map((row) => row.score);
    scoreBoundsByHorizon[horizon] = scored.length ? { min: Math.min(...scored), max: Math.max(...scored) } : { min: null, max: null };
    const baselineId = scenarios.find((scenario) => scenario.kind === "baseline")?.id ?? "baseline";
    const baselineByTicker = new Map(rows.filter((row) => row.horizon === horizon && row.scenarioId === baselineId).map((row) => [row.ticker, row.score]));
    const groupPairs = new Set<string>();
    let changed = 0;
    let ties = 0;
    for (const group of new Set(funds.map((fund) => fund.comparisonGroupId).filter((id) => id !== "unranked-pending-peer"))) {
      const tickers = funds.filter((fund) => fund.comparisonGroupId === group).map((fund) => fund.ticker);
      for (let i = 0; i < tickers.length; i += 1) for (let j = i + 1; j < tickers.length; j += 1) {
        const left = tickers[i]; const right = tickers[j];
        const leftBase = baselineByTicker.get(left); const rightBase = baselineByTicker.get(right);
        if (leftBase == null || rightBase == null) continue;
        groupPairs.add(`${left}|${right}`);
        if (Math.round(leftBase * 10) === Math.round(rightBase * 10)) ties += 1;
        const baseOrder = Math.sign(leftBase - rightBase);
        const variantOrders = scenarios.flatMap((scenario) => {
          const leftScenario = rows.find((row) => row.ticker === left && row.horizon === horizon && row.scenarioId === scenario.id)?.score;
          const rightScenario = rows.find((row) => row.ticker === right && row.horizon === horizon && row.scenarioId === scenario.id)?.score;
          return leftScenario == null || rightScenario == null ? [] : [Math.sign(leftScenario - rightScenario)];
        });
        if (baseOrder && variantOrders.some((order) => order !== baseOrder)) changed += 1;
      }
    }
    peerPairCountByHorizon[horizon] = groupPairs.size;
    pairOrderChangesByHorizon[horizon] = changed;
    oneDecimalTiesByHorizon[horizon] = ties;
    const current = funds.map((fund) => fund.results.find((result) => result.cutoff === commonCutoff && result.horizon === horizon && result.status === "scored"))
      .filter((result): result is ETFEquityIndexM3Result => Boolean(result));
    correlationsByHorizon[horizon] = {
      cagrVsDownside: pearson(current.map((row) => row.annualizedReturnPct!), current.map((row) => row.downsideDeviationPct!)),
      drawdownVsDownside: pearson(current.map((row) => row.maxDrawdownMagnitudePct!), current.map((row) => row.downsideDeviationPct!)),
    };
  }
  return {
    scoredRows: rows.length,
    scoreBoundsByHorizon,
    peerPairCountByHorizon,
    pairOrderChangesByHorizon,
    oneDecimalTiesByHorizon,
    correlationsByHorizon,
  };
}

function independentAudit(funds: ETFEquityIndexM3FundSnapshot[]): ETFEquityIndexM3Snapshot["validation"]["independentCalculation"] {
  const baseline = baselineScenario().config;
  const failures: string[] = [];
  let checkedRows = 0;
  let maxAbsoluteDelta = 0;
  const parametersToCheck: Array<keyof ETFEquityIndexM3Result> = [
    "score", "feePoints", "historicalPoints", "annualizedReturnPct", "maxDrawdownMagnitudePct", "downsideDeviationPct",
  ];
  for (const fund of funds) for (const row of fund.results) {
    if (row.status !== "scored") continue;
    checkedRows += 1;
    const reference = referenceOutcome(fund, row.horizon, row.cutoff, baseline);
    if (reference == null) {
      failures.push(`${fund.ticker}|${row.cutoff}|${row.horizon}: independent window reconstruction was incomplete.`);
      continue;
    }
    const expected: Record<string, number> = {
      score: reference.score,
      feePoints: reference.feePoints,
      historicalPoints: reference.historicalPoints,
      annualizedReturnPct: reference.annualizedReturnPct,
      maxDrawdownMagnitudePct: reference.maxDrawdownMagnitudePct,
      downsideDeviationPct: reference.downsideDeviationPct,
    };
    const deltas = Object.fromEntries(parametersToCheck.map((key) => [key, Number.isFinite(row[key] as number)
      ? Math.abs((row[key] as number) - expected[key])
      : Number.POSITIVE_INFINITY]));
    const rowMax = Math.max(...Object.values(deltas));
    maxAbsoluteDelta = Math.max(maxAbsoluteDelta, rowMax);
    if (rowMax > 1e-10) failures.push(`${fund.ticker}|${row.cutoff}|${row.horizon}: independent score/fee delta ${rowMax} exceeds 1e-10.`);
    if (row.score! < 0 || row.score! > 100) failures.push(`${fund.ticker}|${row.cutoff}|${row.horizon}: score falls outside [0, 100].`);
  }
  return { status: failures.length === 0 && checkedRows > 0 ? "pass" : "blocked", checkedRows, maxAbsoluteDelta, failures };
}

export function buildETFEquityIndexM3Snapshot(input: {
  sample: ETFEquityIndexM3Sample;
  sampleSha256: string;
  histories: Record<string, ETFEquityIndexM3Acquisition>;
  now: Date;
  commonCutoff: string;
  sensitivityScenarios: ETFEquityIndexM3Scenario[];
  returnEvidenceReview?: ETFEquityIndexM3ReturnEvidenceReview;
}): ETFEquityIndexM3Snapshot {
  const asOf = input.now.toISOString();
  const params = scoringParameters();
  const returnEvidenceProtocol = input.returnEvidenceReview
    ? Object.fromEntries(Object.entries(input.returnEvidenceReview).filter(([key]) => key !== "funds")) as Omit<ETFEquityIndexM3ReturnEvidenceReview, "funds">
    : {
      protocolId: "issuer-market-price-return-reconciliation-v1",
      comparisonAsOf: "2026-08-31",
      oneYearStartDate: "2025-08-29",
      threeYearStartDate: "2023-08-31",
      endDate: "2026-08-31",
      tolerancePctPoints: ETF_EQUITY_INDEX_M3_RETURN_TOLERANCE_PCT_POINTS,
    };
  const returnEvidenceByTicker = new Map((input.returnEvidenceReview?.funds ?? []).map((item) => [item.ticker, item]));
  const cutoffs = [...ETF_EQUITY_INDEX_M3_CUTOFFS, input.commonCutoff];
  const funds = input.sample.funds.map((profile): ETFEquityIndexM3FundSnapshot => {
    const acquisition = input.histories[profile.ticker];
    const history = acquisition && "bars" in acquisition ? acquisition : null;
    const error = acquisition && "error" in acquisition ? acquisition.error : null;
    const sourceBlockers = sourceBlockersFor(profile, input.sample, input.now);
    const historyCaptureBlockers = historyBlockersFor(profile.ticker, history, error, input.now);
    const independentReturnEvidence = compareIndependentReturns(returnEvidenceByTicker.get(profile.ticker), history, returnEvidenceProtocol, asOf);
    const serializedHistory = history ? {
      ...history,
      firstDate: history.bars[0]?.date ?? null,
      lastDate: history.bars.at(-1)?.date ?? null,
      observations: history.bars.length,
      sha256: "",
    } : null;
    if (serializedHistory) serializedHistory.sha256 = historyHash(serializedHistory);
    const fund: ETFEquityIndexM3FundSnapshot = {
      ...profile,
      acquisitionError: error,
      captureValidity: sourceBlockers.length === 0 && historyCaptureBlockers.length === 0 ? "pass" : "blocked",
      currentFreshnessAtCapture: historyCaptureBlockers.length === 0 ? "fresh" : "stale-or-invalid",
      sourceBlockers,
      independentReturnEvidence,
      history: serializedHistory,
      historyCaptureBlockers,
      results: [],
    };
    fund.results = cutoffs.flatMap((cutoff) => (["1Y", "3Y"] as const).map((horizon) => buildResult({
      fund,
      history,
      cutoff,
      horizon,
      commonCutoff: input.commonCutoff,
      parameters: params,
    })));
    return fund;
  });
  const sensitivityRows = funds.flatMap((fund) => (["1Y", "3Y"] as const).flatMap((horizon) => {
    const base = fund.results.find((row) => row.cutoff === input.commonCutoff && row.horizon === horizon);
    if (!base || base.status !== "scored") return [];
    return input.sensitivityScenarios.flatMap((scenario) => {
      const outcome = referenceOutcome(fund, horizon, input.commonCutoff, scenario.config);
      return outcome == null ? [] : [{ ticker: fund.ticker, horizon, scenarioId: scenario.id, score: outcome.score }];
    });
  }));
  const primaryScoreCoverage: Record<string, { "1Y": number; "3Y": number }> = {};
  for (const stratum of ETF_EQUITY_INDEX_M3_STRATA) {
    const stratumFunds = funds.filter((fund) => fund.exposureStratum === stratum);
    primaryScoreCoverage[stratum] = {
      "1Y": stratumFunds.filter((fund) => fund.results.some((row) => row.cutoff === input.commonCutoff && row.horizon === "1Y" && row.status === "scored")).length,
      "3Y": stratumFunds.filter((fund) => fund.results.some((row) => row.cutoff === input.commonCutoff && row.horizon === "3Y" && row.status === "scored")).length,
    };
  }
  const counts = Object.fromEntries(ETF_EQUITY_INDEX_M3_STRATA.map((stratum) => [stratum, funds.filter((fund) => fund.exposureStratum === stratum).length]));
  const reference = independentAudit(funds);
  const validated = funds.flatMap((fund) => fund.results).filter((row) => row.status === "scored");
  const inRange = validated.length > 0 && validated.every((row) => Number.isFinite(row.score) && row.score! >= 0 && row.score! <= 100);
  const coveragePass = ETF_EQUITY_INDEX_M3_STRATA.every((stratum) => primaryScoreCoverage[stratum]["1Y"] >= 2 && primaryScoreCoverage[stratum]["3Y"] >= 2);
  const capturePass = funds.length >= 12 && new Set(funds.map((fund) => fund.issuer)).size >= 3
    && ETF_EQUITY_INDEX_M3_STRATA.every((stratum) => counts[stratum] >= 4);
  const independentPass = reference.status === "pass";
  const returnEvidenceReviewComplete = Boolean(input.returnEvidenceReview)
    && funds.every((fund) => returnEvidenceByTicker.has(fund.ticker) && (returnEvidenceByTicker.get(fund.ticker)?.sources.length ?? 0) > 0);
  const returnEvidenceSummary = {
    status: returnEvidenceReviewComplete ? "complete" as const : "incomplete" as const,
    reviewedFunds: funds.filter((fund) => fund.independentReturnEvidence.status !== "unavailable").length,
    matchedFunds: funds.filter((fund) => fund.independentReturnEvidence.status === "matched").length,
    discrepancyTickers: funds.filter((fund) => fund.independentReturnEvidence.status === "discrepancy").map((fund) => fund.ticker),
    unavailableTickers: funds.filter((fund) => fund.independentReturnEvidence.status === "unavailable").map((fund) => fund.ticker),
    tolerancePctPoints: returnEvidenceProtocol.tolerancePctPoints,
  };
  const invalidCaseFixtures = runETFEquityIndexM3FixtureChecks({ sample: input.sample, now: input.now });
  return {
    schemaVersion: 1,
    methodologyVersion: ETF_EQUITY_INDEX_M3_METHOD,
    integrityContract: {
      version: ETF_EQUITY_INDEX_INTEGRITY_VERSION,
      serialization: ETF_EQUITY_INDEX_INTEGRITY_SERIALIZATION,
      hashAlgorithm: "SHA-256",
      rawJsonReadRequired: true,
    },
    sampleId: input.sample.sampleId,
    sampleSha256: input.sampleSha256,
    sampleCanonicalHash: canonicalSha256(input.sample),
    sample: input.sample,
    asOf,
    commonCutoff: input.commonCutoff,
    independentReturnEvidenceProtocol: returnEvidenceProtocol,
    sensitivityCutoffs: [...ETF_EQUITY_INDEX_M3_CUTOFFS],
    sourceContract: {
      provider: "Yahoo Finance",
      sourceId: EXPECTED_HISTORY_SOURCE_ID,
      priceSeries: "adjusted close in USD",
      distributionsAndSplits: "already reflected in adjusted close; do not add again",
      captureAgeLimitCalendarDays: MAX_SOURCE_AGE_DAYS,
      historyAgeLimitCalendarDays: MAX_HISTORY_AGE_DAYS,
    },
    feeTreatment: "The common-cutoff output is a current-fee candidate analysis. All earlier-cutoff outputs are market-window sensitivity only, with current fee inputs held constant; they are not point-in-time historical scores. M1's 32 unresolved historical fee rows remain blocked.",
    sensitivityScenarioDefinition: "The exact M1 37-scenario one-factor grid: baseline; final fee weight +/-10 and +/-20 percentage points; each historical component weight +/-10 and +/-20 points with remaining component weights renormalized proportionally; fee scale and each growth/risk curve parameter multiplied by 0.8, 0.9, 1.1 and 1.2.",
    sensitivityScenarios: input.sensitivityScenarios,
    sensitivityRows,
    funds,
    validation: {
      sampleCounts: { total: funds.length, issuerCount: new Set(funds.map((fund) => fund.issuer)).size, byStratum: counts },
      captureValidity: capturePass && funds.every((fund) => fund.captureValidity === "pass") ? "pass" : "blocked",
      independentCalculation: reference,
      independentReturnReconciliation: returnEvidenceSummary,
      inRange: inRange ? "pass" : "blocked",
      primaryScoreCoverage,
      invalidCaseFixtures: { status: invalidCaseFixtures.passed ? "pass" : "blocked", checks: invalidCaseFixtures.checks },
      sensitivity: sensitivitySummary(funds, input.sensitivityScenarios, sensitivityRows, input.commonCutoff),
      historicalFeePointInTimeRows: "blocked",
      batchReadyForM4Review: capturePass && coveragePass && independentPass && returnEvidenceReviewComplete && inRange && invalidCaseFixtures.passed,
    },
  };
}

function snapshotScoringParameters(snapshot: ETFEquityIndexM3Snapshot): Record<string, string | number> {
  return {
    ...scoringParameters(),
    sensitivityScenarioCount: snapshot.sensitivityScenarios.length,
  };
}

export function createETFEquityIndexM3IntegrityManifest(snapshot: ETFEquityIndexM3Snapshot): ETFEquityIndexM3IntegrityManifest {
  const { funds, ...metadata } = snapshot;
  const parameters = snapshotScoringParameters(snapshot);
  const fundHashes: Record<string, string> = {};
  const rowHashes: ETFEquityIndexM3IntegrityManifest["rowHashes"] = {};
  for (const fund of funds) {
    fundHashes[fund.ticker] = canonicalSha256(fund);
    const retainedDigest = historyHash(fund.history);
    for (const result of fund.results) {
      const rowId = `${fund.ticker}|${result.cutoff}|${result.horizon}`;
      rowHashes[rowId] = {
        inputHash: canonicalSha256(rowInputPayload(fund, result, retainedDigest, parameters)),
        resultHash: canonicalSha256(result),
      };
    }
  }
  return {
    schemaVersion: 1,
    version: ETF_EQUITY_INDEX_INTEGRITY_VERSION,
    serialization: ETF_EQUITY_INDEX_INTEGRITY_SERIALIZATION,
    hashAlgorithm: "SHA-256",
    artifactHash: canonicalSha256(snapshot),
    metadataHash: canonicalSha256(metadata),
    scoringParameters: parameters,
    fundHashes,
    rowHashes,
  };
}

export function createETFEquityIndexM3Artifact(snapshot: ETFEquityIndexM3Snapshot): ETFEquityIndexM3Artifact {
  return { snapshot, integrityManifest: createETFEquityIndexM3IntegrityManifest(snapshot) };
}

export function verifyETFEquityIndexM3Artifact(saved: ETFEquityIndexM3Artifact): {
  status: "passed" | "blocked";
  savedScoresReproduce: boolean;
  artifactHashMatches: boolean;
  rowCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  const { snapshot, integrityManifest } = saved;
  const replay = buildETFEquityIndexM3Snapshot({
    sample: snapshot.sample,
    sampleSha256: snapshot.sampleSha256,
    histories: Object.fromEntries(snapshot.funds.flatMap((fund): Array<[string, ETFEquityIndexM3Acquisition]> => {
      if (fund.history) return [[fund.ticker, {
        provider: fund.history.provider,
        sourceId: fund.history.sourceId,
        sourceUrl: fund.history.sourceUrl,
        retrievedAt: fund.history.retrievedAt,
        currency: fund.history.currency,
        bars: fund.history.bars,
      }]];
      return fund.acquisitionError ? [[fund.ticker, { error: fund.acquisitionError }]] : [];
    })),
    now: new Date(snapshot.asOf),
    commonCutoff: snapshot.commonCutoff,
    sensitivityScenarios: snapshot.sensitivityScenarios,
    returnEvidenceReview: {
      ...snapshot.independentReturnEvidenceProtocol,
      funds: snapshot.funds.map((fund) => ({
        ticker: fund.ticker,
        reviewNote: fund.independentReturnEvidence.reviewNote,
        sources: fund.independentReturnEvidence.sources.map((source) => ({
          sourceName: source.sourceName,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          asOfDate: source.asOfDate,
          returnConvention: source.returnConvention,
          oneYearReturnPct: source.oneYearReturnPct,
          threeYearAnnualizedReturnPct: source.threeYearAnnualizedReturnPct,
        })),
      })),
    },
  });
  const scoresReproduce = canonicalJSONStringify(replay) === canonicalJSONStringify(snapshot);
  if (!scoresReproduce) issues.push("Saved M3 scores, coverage or metadata do not match replay from the retained sample and full histories.");
  const calculatedManifest = createETFEquityIndexM3IntegrityManifest(snapshot);
  const expectedFundKeys = Object.keys(calculatedManifest.fundHashes).sort();
  const savedFundKeys = Object.keys(integrityManifest.fundHashes ?? {}).sort();
  const expectedRowKeys = Object.keys(calculatedManifest.rowHashes).sort();
  const savedRowKeys = Object.keys(integrityManifest.rowHashes ?? {}).sort();
  if (canonicalJSONStringify(expectedFundKeys) !== canonicalJSONStringify(savedFundKeys)
    || canonicalJSONStringify(expectedRowKeys) !== canonicalJSONStringify(savedRowKeys)) issues.push("M3 integrity manifest does not cover the exact retained fund and score-row set.");
  if (integrityManifest.schemaVersion !== 1 || integrityManifest.version !== ETF_EQUITY_INDEX_INTEGRITY_VERSION
    || integrityManifest.serialization !== ETF_EQUITY_INDEX_INTEGRITY_SERIALIZATION || integrityManifest.hashAlgorithm !== "SHA-256") {
    issues.push("M3 integrity contract version, serialization or hash algorithm is unsupported.");
  }
  if (canonicalJSONStringify(integrityManifest.scoringParameters) !== canonicalJSONStringify(calculatedManifest.scoringParameters)) issues.push("M3 scoring parameters or sensitivity scenario count differ from the integrity manifest.");
  if (integrityManifest.metadataHash !== calculatedManifest.metadataHash) issues.push("M3 metadata hash does not match retained metadata.");
  for (const fund of snapshot.funds) {
    if (integrityManifest.fundHashes?.[fund.ticker] !== calculatedManifest.fundHashes[fund.ticker]) issues.push(`${fund.ticker} retained profile/history/results hash does not match the M3 integrity manifest.`);
    for (const row of fund.results) {
      const id = `${fund.ticker}|${row.cutoff}|${row.horizon}`;
      const savedRow = integrityManifest.rowHashes?.[id];
      const calculated = calculatedManifest.rowHashes[id];
      if (!savedRow || savedRow.inputHash !== calculated.inputHash || savedRow.resultHash !== calculated.resultHash) issues.push(`${id} row input/result hash does not match the M3 integrity manifest.`);
    }
  }
  const artifactHashMatches = integrityManifest.artifactHash === calculatedManifest.artifactHash;
  if (!artifactHashMatches) issues.push("M3 artifact hash does not match the retained raw-input snapshot.");
  return {
    status: issues.length ? "blocked" : "passed",
    savedScoresReproduce: scoresReproduce,
    artifactHashMatches,
    rowCount: snapshot.funds.reduce((sum, fund) => sum + fund.results.length, 0),
    issues: [...new Set(issues)],
  };
}

/** Invalid-source fixtures used by both the M3 tests and capture preflight. */
export function runETFEquityIndexM3FixtureChecks(input: {
  sample: ETFEquityIndexM3Sample;
  now: Date;
}): { passed: boolean; checks: Array<{ id: string; passed: boolean; observed: string }> } {
  const base = input.sample.funds.find((fund) => fund.ticker === "SPYM")!;
  const staleFee = { ...base, expenseRatio: { ...base.expenseRatio, financialDate: "2025-09-01" } };
  const grossFee = { ...base, expenseRatio: { ...base.expenseRatio, designation: "gross" } };
  const invalidFee = { ...base, expenseRatio: { ...base.expenseRatio, waiverExpiryDate: "2026-01-01" } };
  const unknownIssuer = { ...base, issuerDomain: "unreviewed.example" };
  const badHistory = (changes: Partial<ETFEquityIndexM3History>) => ({
    provider: "Yahoo Finance" as const,
    sourceId: "yahoo-finance2.chart:adjusted-close" as const,
    sourceUrl: "https://finance.yahoo.com/quote/SPYM/history/",
    retrievedAt: input.now.toISOString(),
    currency: "USD",
    bars: [{ date: "2026-10-06", adjustedClose: 100 }, { date: "2026-10-05", adjustedClose: 99 }],
    ...changes,
  });
  const incompleteDailyBars: ETFEquityIndexM3Bar[] = [];
  const incompleteCursor = new Date("2025-09-30T00:00:00Z");
  while (incompleteCursor <= new Date("2026-09-30T00:00:00Z")) {
    const date = incompleteCursor.toISOString().slice(0, 10);
    if (date !== "2026-09-29" && isUsEquityTradingSession(date)) incompleteDailyBars.push({ date, adjustedClose: 100 + incompleteDailyBars.length / 100 });
    incompleteCursor.setUTCDate(incompleteCursor.getUTCDate() + 1);
  }
  const checks = [
    { id: "stale-fee", passed: sourceBlockersFor(staleFee, input.sample, input.now).some((reason) => reason.includes("older than 365 days")), observed: sourceBlockersFor(staleFee, input.sample, input.now).join(" ") },
    { id: "gross-only-fee", passed: sourceBlockersFor(grossFee, input.sample, input.now).some((reason) => reason.includes("gross-only")), observed: sourceBlockersFor(grossFee, input.sample, input.now).join(" ") },
    { id: "expired-waiver", passed: sourceBlockersFor(invalidFee, input.sample, input.now).some((reason) => reason.includes("expired")), observed: sourceBlockersFor(invalidFee, input.sample, input.now).join(" ") },
    { id: "unreviewed-domain", passed: sourceBlockersFor(unknownIssuer, input.sample, input.now).length > 0, observed: sourceBlockersFor(unknownIssuer, input.sample, input.now).join(" ") },
    { id: "missing-history", passed: historyBlockersFor("SPYM", null, "fixture: no response", input.now).some((reason) => reason.includes("request failed")), observed: historyBlockersFor("SPYM", null, "fixture: no response", input.now).join(" ") },
    { id: "wrong-currency", passed: historyBlockersFor("SPYM", badHistory({ currency: "EUR" }), null, input.now).some((reason) => reason.includes("USD")), observed: historyBlockersFor("SPYM", badHistory({ currency: "EUR" }), null, input.now).join(" ") },
    { id: "duplicate-date", passed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-06", adjustedClose: 100 }, { date: "2026-10-06", adjustedClose: 99 }] }), null, input.now).some((reason) => reason.includes("duplicate")), observed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-06", adjustedClose: 100 }, { date: "2026-10-06", adjustedClose: 99 }] }), null, input.now).join(" ") },
    { id: "invalid-close", passed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-06", adjustedClose: 0 }] }), null, input.now).some((reason) => reason.includes("nonpositive")), observed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-06", adjustedClose: 0 }] }), null, input.now).join(" ") },
    { id: "out-of-order-history", passed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-06", adjustedClose: 100 }, { date: "2026-10-05", adjustedClose: 99 }] }), null, input.now).some((reason) => reason.includes("not ordered")), observed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-06", adjustedClose: 100 }, { date: "2026-10-05", adjustedClose: 99 }] }), null, input.now).join(" ") },
    { id: "future-date", passed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-08", adjustedClose: 100 }] }), null, input.now).some((reason) => reason.includes("future session")), observed: historyBlockersFor("SPYM", badHistory({ bars: [{ date: "2026-10-08", adjustedClose: 100 }] }), null, input.now).join(" ") },
    { id: "short-history", passed: buildETFCoreMarketWindow([{ date: "2026-09-30", adjustedClose: 100 }], "3Y", nextMonthStart("2026-09-30"), "2026-09-30").complete === false, observed: "3Y monthly and daily coverage is incomplete for a one-observation history." },
    { id: "missing-session", passed: buildETFCoreMarketWindow(incompleteDailyBars, "1Y", nextMonthStart("2026-09-30"), "2026-09-30").missingSessionDates.includes("2026-09-29"), observed: "The complete expected-session check identifies the omitted 2026-09-29 session." },
  ];
  return { passed: checks.every((check) => check.passed), checks };
}
