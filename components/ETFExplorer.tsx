"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";
import {
  ETF_METRIC_HELP,
  ETF_METRIC_LABELS,
  type ETFCategoryMeta,
  type ETFMetricKey,
  type ETFMetricSnapshot,
  type ETFRecord,
  type ETFScoreAssessment,
  type ETFStrategy,
} from "@/lib/etfCatalog";
import { weightedHoldingsOverlap } from "@/lib/etfMetricCalculations";
import { preferredETFTableReturn } from "@/lib/etfReturnDisplay";
import { isTacticalETF, primaryETFScoreAssessment, routeETFFund } from "@/lib/etfScorecard";

type View = "explore" | "compare" | "shortlist";
type Scope = "etf" | "etn" | "all";
type SortKey = "ticker" | "category" | "exposure" | "score" | `metric:${ETFMetricKey}` | "issuer" | "dataStatus";
type DataFilter = "all" | "identity-warning" | "source-located";

interface ETFCounts {
  etfLike: number;
  etns: number;
  exclusions: number;
  categories: number;
  tradabilityConfirmed: number;
}

interface ETFExplorerProps {
  catalogue: ETFRecord[];
  etns: ETFRecord[];
  exclusions: ETFRecord[];
  categoryMeta: ETFCategoryMeta[];
  counts: ETFCounts;
  snapshotDate: string;
  initialMetricSnapshots: Record<string, ETFMetricSnapshot>;
  initialMetricLoadError: boolean;
}

interface ShortlistEntry {
  ticker: string;
  role: string;
  reason: string;
  concerns: string;
  researchStatus: string;
}

const SHORTLIST_STORAGE_KEY = "stock-analysis-etf-shortlist-v1";

const STRATEGY_OPTIONS: Array<{ value: ETFStrategy; label: string }> = [
  { value: "core", label: "Core / broad" },
  { value: "income", label: "Income" },
  { value: "leveraged", label: "Leveraged / inverse" },
  { value: "trust", label: "Trust" },
  { value: "commodity", label: "Commodity" },
  { value: "digital", label: "Digital assets" },
  { value: "allocation", label: "Multi-asset" },
  { value: "etn", label: "ETN" },
];

const METRIC_PRESETS = {
  quantitative: {
    label: "Quantitative",
    metrics: ["cagr5Y", "sharpe5Y", "maxDrawdown5Y", "rolling5YWorstCagr", "expenseRatio"],
  },
  growth: { label: "Growth", metrics: ["cagr5Y", "cagr10Y", "benchmarkExcessCagr5Y"] },
  risk: { label: "Risk", metrics: ["volatility5Y", "sharpe5Y", "sortino5Y", "calmar5Y", "maxDrawdown5Y", "recoveryTime"] },
  consistency: { label: "Consistency", metrics: ["rolling5YMedianCagr", "rolling5YP10Cagr", "rolling5YWorstCagr", "rolling5YBestCagr", "rolling5YPositiveRate", "rolling5YBenchmarkWinRate"] },
  index: { label: "Index efficiency", metrics: ["trackingDifference5Y", "trackingError5Y", "expenseRatio", "medianSpread30D", "premiumDiscount"] },
  income: { label: "Income & existing", metrics: ["cagr5Y", "cagr10Y", "trailingDistributionYield", "averageCashYield5Y", "maxDrawdown5Y"] },
} as const satisfies Record<string, { label: string; metrics: ETFMetricKey[] }>;

type MetricPreset = keyof typeof METRIC_PRESETS | "custom";
type TableMetric = { key: ETFMetricKey; label: string };
const CUSTOM_COLUMN_STORAGE_KEY = "stock-analysis-etf-columns-v1";
const DEFAULT_CUSTOM_METRICS: ETFMetricKey[] = [...METRIC_PRESETS.quantitative.metrics];

const DETAIL_METRICS: ETFMetricKey[] = [
  "totalReturn1Y",
  "calendarYearReturns",
  "cagr3Y",
  "cagr5Y",
  "cagr10Y",
  "trailingDistributionYield",
  "averageCashYield5Y",
  "maxDrawdown5Y",
  "volatility5Y",
  "sharpe5Y",
  "sortino5Y",
  "calmar5Y",
  "recoveryTime",
  "underwaterObservationRate",
  "rolling5YMedianCagr",
  "rolling5YP10Cagr",
  "rolling5YWorstCagr",
  "rolling5YBestCagr",
  "rolling5YPositiveRate",
  "rolling5YBenchmarkWinRate",
  "benchmarkExcessCagr5Y",
  "trackingDifference5Y",
  "trackingError5Y",
  "topTenWeight",
  "effectiveHoldingsCount",
  "largestHoldingWeight",
  "largestSectorWeight",
  "medianSpread30D",
  "premiumDiscount",
  "overlap",
  "expenseRatio",
  "netAssets",
  "inceptionDate",
];

const LEGACY_SCORE_METRICS = new Set<ETFMetricKey>(["overallScore", "fundQualityScore", "historicalPerformanceScore", "scoreCoverage"]);

const STATUS_METRICS: ETFMetricKey[] = [
  "totalReturn1Y", "cagr3Y", "cagr5Y", "cagr10Y", "calendarYearReturns",
  "trailingDistributionYield", "averageCashYield5Y", "maxDrawdown5Y", "volatility5Y",
  "recoveryTime", "topTenWeight", "expenseRatio", "netAssets", "inceptionDate",
];

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function isMetricPreset(value: unknown): value is MetricPreset {
  return value === "custom" || (typeof value === "string" && Object.hasOwn(METRIC_PRESETS, value));
}

function formatCategory(category: string) {
  return category.replace(" — separate from ETFs", "");
}

function formatStructure(structure: string) {
  if (structure === "physical-metal-trust") return "Physical-metal trust";
  if (structure === "spot-bitcoin-trust") return "Spot-bitcoin trust";
  if (structure === "ETF trust") return "ETF trust";
  if (structure.startsWith("commodity-pool")) return "Commodity pool / trust";
  if (structure === "ETN") return "Exchange-traded note";
  if (structure === "operating-company-stock") return "Operating-company stock";
  if (structure === "closed-end-fund") return "Closed-end fund";
  return "ETF · legal form review pending";
}

function strategyLabel(strategy: ETFStrategy) {
  return STRATEGY_OPTIONS.find((option) => option.value === strategy)?.label ?? "Core / broad";
}

const SCORE_FAMILY_LABELS: Record<string, string> = {
  "equity-index": "Equity index",
  "active-equity": "Active equity",
  "dividend-equity": "Dividend equity",
  "real-asset-equity": "Real-asset equity",
  "investment-grade-bonds": "Investment-grade bonds",
  "high-yield-em-bonds": "High-yield / emerging-market bonds",
  "preferred-securities": "Preferred securities",
  "options-income": "Options income",
  "physical-metals": "Physical metals",
  "commodity-digital-futures": "Commodity / digital futures",
  "spot-digital-assets": "Spot digital assets",
  "multi-asset-allocation": "Multi-asset allocation",
  "tactical-leveraged": "Leveraged / inverse",
  etn: "ETN",
};

function scoreAssessmentLabel(assessment: ETFScoreAssessment) {
  if (assessment.kind === "full") return `Full Grand Score · ${SCORE_FAMILY_LABELS[assessment.family] ?? assessment.family} · ${assessment.horizon}`;
  if (assessment.kind === "cost-only") return `Cost and Trading only · ${SCORE_FAMILY_LABELS[assessment.family] ?? assessment.family}`;
  if (assessment.kind === "tactical") return `Tactical Execution · ${assessment.horizon}`;
  if (assessment.kind === "etn-execution") return `ETN Execution · ${assessment.horizon}`;
  return `Core · ${SCORE_FAMILY_LABELS[assessment.family] ?? assessment.family} · ${assessment.horizon}${assessment.horizon === "1Y" ? " · Limited history" : ""}`;
}

function compactComparisonGroupId(groupId: string | null | undefined, family: string) {
  if (!groupId) return "Comparison group review pending";
  const [schema, , rawDimensions] = groupId.split(":");
  if (schema === "etf-role-group-v1" && rawDimensions) {
    const dimensions = rawDimensions.split(";").slice(0, 2).map((item) => {
      const [rawKey, rawValue] = item.split("=");
      const value = decodeURIComponent(rawValue ?? "");
      return `${decodeURIComponent(rawKey ?? "")}: ${value.length > 22 ? `${value.slice(0, 20)}…` : value}`;
    });
    return dimensions.length ? dimensions.join(" · ") : `${SCORE_FAMILY_LABELS[family] ?? family} group`;
  }
  return groupId.length > 52 ? `${groupId.slice(0, 49)}…` : groupId;
}

function scoreStatusLabel(status: string) {
  const labels: Record<string, string> = {
    available: "Available",
    notApplicable: "Not applicable",
    identityUnresolved: "Identity unresolved",
    mandatePending: "Mandate review",
    insufficientHistory: "Insufficient history",
    missingSource: "Source needed",
    staleInput: "Stale input",
    invalidInput: "Invalid input",
    methodologyPending: "Method review",
    readyForInputs: "Inputs needed",
  };
  return labels[status] ?? "Not scored";
}

function routeCandidateLabel(candidate: string) {
  if (candidate === "equity-mandate-review") return "Equity mandate review";
  if (candidate === "bond-family-review") return "Bond family review";
  if (candidate === "tactical-leveraged") return "Tactical execution";
  if (candidate === "tactical-reset-review") return "Non-daily tactical review";
  if (candidate === "etn-execution") return "ETN execution";
  if (candidate === "excluded") return "Excluded";
  if (candidate === "unclassified") return "Mandate review";
  return SCORE_FAMILY_LABELS[candidate] ?? candidate;
}

function scoreForRecord(record: ETFRecord) {
  if (record.kind === "etn") {
    const assessments = record.metricSnapshot?.scoreAssessments ?? [];
    const ordered = [assessments.find((item) => item.kind === "etn-execution"), assessments.find((item) => item.kind === "cost-only")];
    return ordered.find((item) => item?.status === "available" && typeof item.score === "number" && Number.isFinite(item.score))
      ?? ordered.find((item) => item != null)
      ?? null;
  }
  return primaryETFScoreAssessment(record.metricSnapshot, isTacticalETF(record));
}

function scoreGroupForRecord(record: ETFRecord) {
  const assessment = scoreForRecord(record);
  if (assessment) {
    const label = `${scoreAssessmentLabel(assessment)} · ${compactComparisonGroupId(assessment.comparisonGroupId, assessment.family)}`;
    return {
      key: [assessment.scorecardId, assessment.horizon, assessment.comparisonGroupId ?? "unresolved", assessment.methodologyVersion, assessment.cutoff ?? "no cutoff"].join("|"),
      label,
    };
  }
  const route = routeETFFund(record);
  return { key: `pending|${route.candidate}`, label: `Scorecard review · ${routeCandidateLabel(route.candidate)}` };
}

function scoreSortValue(record: ETFRecord): number | null {
  const assessment = scoreForRecord(record);
  return assessment?.status === "available" && assessment.rankedEligible
    && !record.metricSnapshot?.stale
    && typeof assessment.score === "number" && Number.isFinite(assessment.score)
    ? assessment.score
    : null;
}

function scoreMatchedOutcome(assessment: ETFScoreAssessment | null) {
  if (!assessment?.components) return null;
  const growth = assessment.components.growth ?? assessment.components["historical.growth"];
  const drawdown = assessment.components.drawdown ?? assessment.components["historical.drawdownResilience"];
  if (growth?.inputValue == null || drawdown?.inputValue == null) return null;
  const returnLabel = `${growth.inputValue > 0 ? "+" : ""}${growth.inputValue.toFixed(1)}%`;
  return `${assessment.horizon} · ${returnLabel} return · ${drawdown.inputValue.toFixed(1)}% max loss`;
}

function compactScoreReason(record: ETFRecord, assessment: ETFScoreAssessment | null) {
  if (assessment) return scoreStatusLabel(assessment.status);
  return scoreStatusLabel(routeETFFund(record).status);
}

function ScoreCell({ record }: { record: ETFRecord }) {
  const assessment = scoreForRecord(record);
  const route = routeETFFund(record);
  const label = assessment ? scoreAssessmentLabel(assessment) : routeCandidateLabel(route.candidate);
  const status = assessment?.status ?? route.status;
  const scoreAvailable = assessment?.status === "available" && typeof assessment.score === "number" && Number.isFinite(assessment.score);
  const reason = assessment?.reason || route.reason;
  const stale = Boolean(record.metricSnapshot?.stale);
  const sortState = assessment?.rankedEligible ? "Ranked within this scorecard and comparison group" : "Not eligible for ranked placement";
  const title = [label, assessment?.comparisonGroupId, scoreStatusLabel(status), reason, assessment?.cutoff ? `Cutoff ${assessment.cutoff}` : null, assessment?.methodologyVersion ? `Method ${assessment.methodologyVersion}` : null, sortState, stale ? "Stored market-data snapshot is stale." : null].filter(Boolean).join(" · ");
  return (
    <span className="block min-w-32 text-left" title={title} aria-label={`${record.ticker} score: ${scoreAvailable ? `${assessment?.score?.toFixed(1)} out of 100` : scoreStatusLabel(status)}. ${label}. ${reason}`}>
      <span className="block font-semibold tabular-nums text-gray-800">{scoreAvailable ? `${assessment?.score?.toFixed(1)}/100` : "Not scored"}</span>
      <span className="mt-0.5 block max-w-40 text-[10px] leading-4 text-gray-500">{assessment ? label : routeCandidateLabel(route.candidate)}</span>
      {scoreAvailable && scoreMatchedOutcome(assessment) && <span className="block max-w-40 text-[10px] leading-4 text-gray-500">{scoreMatchedOutcome(assessment)}</span>}
      <span className="block text-[10px] leading-4 text-gray-400">{stale ? "Snapshot stale" : compactScoreReason(record, assessment)}{assessment?.rankedEligible === false && scoreAvailable ? " · Unranked" : ""}</span>
    </span>
  );
}

function scoreCoverageSummary(records: ETFRecord[]) {
  const countReady = (record: ETFRecord, accepts: (assessment: ETFScoreAssessment) => boolean) =>
    (record.metricSnapshot?.scoreAssessments ?? []).some((assessment) => assessment.status === "available"
      && assessment.rankedEligible && typeof assessment.score === "number" && Number.isFinite(assessment.score)
      && !record.metricSnapshot?.stale && accepts(assessment));
  const tacticalRecords = records.filter(isTacticalETF);
  const longTermRecords = records.filter((record) => !isTacticalETF(record));
  const numerical = (record: ETFRecord) => countReady(record, (assessment) => assessment.kind === "core" || assessment.kind === "full" || assessment.kind === "tactical");
  return {
    totalReady: records.filter(numerical).length,
    longTermReady: longTermRecords.filter((record) => countReady(record, (assessment) => (assessment.kind === "core" && assessment.horizon === "3Y") || (assessment.kind === "full" && assessment.horizon === "5Y"))).length,
    tacticalReady: tacticalRecords.filter((record) => countReady(record, (assessment) => assessment.kind === "tactical")).length,
    core3YReady: longTermRecords.filter((record) => countReady(record, (assessment) => assessment.kind === "core" && assessment.horizon === "3Y")).length,
    limitedHistory: records.filter((record) => countReady(record, (assessment) => assessment.kind === "core" && assessment.horizon === "1Y")).length,
    fullReady: longTermRecords.filter((record) => countReady(record, (assessment) => assessment.kind === "full")).length,
    costOnly: records.filter((record) => countReady(record, (assessment) => assessment.kind === "cost-only")).length,
    unavailable: records.length - records.filter(numerical).length,
    tacticalTotal: tacticalRecords.length,
    longTermTotal: longTermRecords.length,
  };
}

function badgeClass(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("inverse") || lower.includes("etn") || lower.includes("identity")) return "bg-red-50 text-red-700 border-red-200";
  if (lower.includes("leveraged") || lower.includes("daily") || lower.includes("single-stock") || lower.includes("0dte")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (lower.includes("income") || lower.includes("weekly")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (lower.includes("trust") || lower.includes("metal") || lower.includes("bitcoin") || lower.includes("commodity")) return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function isComplex(record: ETFRecord) {
  return record.strategy === "leveraged" || record.category === "Options income and distribution strategies" || record.kind === "etn" || record.badges.some((badge) => ["Single-stock", "0DTE"].includes(badge));
}

function roleExplanation(record: ETFRecord) {
  if (record.kind === "etn") return "This is an unsecured exchange-traded note. Its outcome depends on the reference strategy and the issuer's ability to meet its obligations.";
  if (record.strategy === "leveraged") return "This product targets a multiple or inverse of a reference exposure over a daily reset period. Holding-period results can differ materially from the headline multiple.";
  if (record.strategy === "income") return "This product emphasizes distributions through dividends, option income, or another income mechanism. Cash yield should be read with total return and the strategy's upside tradeoff.";
  if (record.strategy === "trust") return "This is an exchange-traded trust structure intended to provide direct or near-direct exposure to the named physical or digital asset.";
  if (record.strategy === "commodity" || record.strategy === "digital") return "This product uses commodity or digital-asset exposure that may be futures-based, trust-based, or otherwise derivative-based. The structure badge shows the current research classification.";
  if (record.category === "Fixed income and preferred securities") return "This fund provides fixed-income or preferred-security exposure. Duration, credit quality, and distribution history still need validated enrichment before comparing outcomes.";
  if (record.category === "Multi-asset allocation") return "This fund combines multiple sleeves in one portfolio. Its actual allocation and rebalance rules should be checked against the issuer source.";
  return "This fund provides a defined equity, international, sector, or thematic exposure. The description is descriptive and does not create an investment recommendation.";
}

function candidateMetricLabel(key: string) {
  const labels: Record<string, string> = {
    expenseRatio: "Expense ratio",
    inceptionDate: "Inception date",
    distributionFrequency: "Distribution frequency",
    netAssets: "Issuer-reported net assets",
    cusip: "CUSIP",
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function displayMetricState(state?: string) {
  return state?.toLowerCase().includes("insufficient") ? "Insufficient history" : state;
}

function metricText(key: ETFMetricKey, value: number | string | undefined, state?: string, currency?: string | null, result?: NonNullable<ETFMetricSnapshot["metricResults"]>[ETFMetricKey]) {
  const displayState = displayMetricState(state);
  if (value === undefined || value === "") {
    if (key === "recoveryTime" && result?.status === "unrecovered") return `${result.observations.toLocaleString()} trading days elapsed · not yet recovered`;
    if (!displayState || displayState.toLowerCase().includes("not collected") || displayState.toLowerCase().includes("not validated") || displayState.toLowerCase().includes("no snapshot")) return "No data";
    if (displayState.toLowerCase().includes("insufficient")) return "Insufficient history";
    if (displayState.toLowerCase().includes("not yet recovered")) return "Not yet recovered";
    if (displayState.toLowerCase().includes("no distributions")) return "0.00%";
    if (displayState.toLowerCase().includes("compare")) return "Select funds to compare";
    if (displayState.toLowerCase().includes("unavailable")) return "Unavailable";
    if (displayState.toLowerCase().includes("price history")) return "Price history unavailable";
    return displayState;
  }
  if (typeof value === "string") return value;
  if (["sharpe5Y", "sortino5Y", "calmar5Y"].includes(key)) return value.toFixed(2);
  if (["medianSpread30D"].includes(key)) return `${value.toFixed(1)} bps`;
  if (["effectiveHoldingsCount"].includes(key)) return value.toFixed(1);
  if (["overallScore", "fundQualityScore", "historicalPerformanceScore"].includes(key)) return `${Math.round(value)}/100`;
  if (["totalReturn1Y", "cagr3Y", "cagr5Y", "cagr10Y", "trailingDistributionYield", "averageCashYield5Y", "maxDrawdown5Y", "volatility5Y", "topTenWeight", "largestHoldingWeight", "largestSectorWeight", "underwaterObservationRate", "rolling5YMedianCagr", "rolling5YP10Cagr", "rolling5YWorstCagr", "rolling5YBestCagr", "rolling5YPositiveRate", "rolling5YBenchmarkWinRate", "benchmarkExcessCagr5Y", "trackingDifference5Y", "trackingError5Y", "premiumDiscount", "scoreCoverage", "expenseRatio"].includes(key)) {
    const signedReturn = value > 0 && ["totalReturn1Y", "cagr3Y", "cagr5Y", "cagr10Y"].includes(key);
    const unit = key === "benchmarkExcessCagr5Y" || key === "trackingDifference5Y" ? " pp" : "%";
    return `${signedReturn ? "+" : ""}${value.toFixed(key === "expenseRatio" ? 4 : 2)}${unit}`;
  }
  if (key === "recoveryTime") return `${Math.round(value).toLocaleString()} trading days`;
  if (key === "netAssets") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  }
  return value.toLocaleString();
}

function FundMetric({ record, metricKey, valueOverride, stateOverride }: {
  record: ETFRecord;
  metricKey: ETFMetricKey;
  valueOverride?: number;
  stateOverride?: string;
}) {
  const snapshot = record.metricSnapshot;
  const state = record.identityWarning ? `Identity review: ${record.identityWarning}` : stateOverride ?? snapshot?.states[metricKey] ?? record.metricStates[metricKey];
  const value = record.identityWarning ? undefined : valueOverride ?? snapshot?.values[metricKey];
  const result = snapshot?.metricResults?.[metricKey];
  const label = [
    ETF_METRIC_HELP[metricKey] ?? ETF_METRIC_LABELS[metricKey],
    snapshot?.source,
    result?.startDate && result.endDate ? `${result.startDate} to ${result.endDate}` : null,
    result?.observations ? `${result.observations} observations` : null,
    result?.sourceIds.length ? `Sources: ${result.sourceIds.join(", ")}` : null,
    result?.methodologyId ? `Method: ${result.methodologyId}` : null,
    result?.reason,
    snapshot?.observedAt ? `Retrieved market data ${snapshot.observedAt}` : null,
    displayMetricState(state),
  ].filter(Boolean).join(" · ");
  return <span className={value === undefined ? "text-gray-400" : "font-semibold text-gray-800"} title={label || state}>{metricText(metricKey, value, state, snapshot?.currency, result)}</span>;
}

function OtherHistoryHint({ record }: { record: ETFRecord }) {
  const history = preferredETFTableReturn(record.metricSnapshot, record.identityWarning);
  if (history.metricKey === "cagr5Y" && history.valueOverride === undefined) return null;
  const value = history.valueOverride ?? record.metricSnapshot?.values[history.metricKey];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const periodLabel = history.valueOverride !== undefined && record.metricSnapshot?.sinceInceptionReturn?.annualized
    ? `${history.periodLabel} · ${record.metricSnapshot.sinceInceptionReturn.periodYears.toFixed(2)} years`
    : history.periodLabel;
  return <span className="mt-0.5 block text-[10px] font-normal leading-3 text-gray-400">Other history: {periodLabel} · {metricText(history.metricKey, value, history.stateOverride, record.metricSnapshot?.currency)}</span>;
}

function DataStatus({ record }: { record: ETFRecord }) {
  if (record.identityWarning) return <span className="badge border bg-amber-50 text-amber-800 border-amber-200">Identity review</span>;
  const snapshot = record.metricSnapshot;
  if (!snapshot?.observedAt) return <span className="badge border bg-gray-50 text-gray-600 border-gray-200" title="No stored market-data snapshot is available for this fund.">No snapshot</span>;
  if (snapshot.lastError) return <span className="badge border bg-amber-50 text-amber-800 border-amber-200" title={snapshot.lastError}>Refresh issue · last values kept</span>;
  const tracked = STATUS_METRICS;
  const resolved = tracked.filter((key) => {
    const state = (snapshot.states[key] ?? "").toLowerCase();
    return state.startsWith("available") || state.includes("no distributions") || state.includes("not yet recovered") || state.includes("no drawdown in window");
  }).length;
  if (snapshot.stale) return <span className="badge border bg-amber-50 text-amber-800 border-amber-200" title={`Last successful market data: ${snapshot.observedAt}`}>Stale · {resolved}/{tracked.length}</span>;
  return <span className="badge border bg-gray-50 text-gray-600 border-gray-200" title={`${resolved} of ${tracked.length} fields sourced or explicitly resolved`}>{resolved === tracked.length ? "Ready" : `Partial · ${resolved}/${tracked.length}`}</span>;
}

function dataStatusSortValue(record: ETFRecord) {
  if (record.identityWarning) return "Identity review";
  const snapshot = record.metricSnapshot;
  if (!snapshot?.observedAt) return "No snapshot";
  if (snapshot.lastError) return "Refresh issue";
  if (snapshot.stale) return "Stale";
  const tracked = STATUS_METRICS;
  const resolved = tracked.filter((key) => {
    const state = (snapshot.states[key] ?? "").toLowerCase();
    return state.startsWith("available") || state.includes("no distributions") || state.includes("not yet recovered") || state.includes("no drawdown in window");
  }).length;
  return resolved === tracked.length ? "Ready" : "Partial";
}

function sortValue(record: ETFRecord, key: SortKey): string | number | null {
  if (key === "score") return scoreSortValue(record);
  if (key.startsWith("metric:")) {
    const metricKey = key.slice("metric:".length) as ETFMetricKey;
    if (record.identityWarning) return null;
    const exactResult = record.metricSnapshot?.metricResults?.[metricKey];
    if (exactResult && exactResult.status !== "available") return null;
    if (exactResult && typeof exactResult.value === "number" && Number.isFinite(exactResult.value)) return exactResult.value;
    const value = record.metricSnapshot?.values[metricKey];
    if (metricKey === "trailingDistributionYield" && value === undefined) {
      const state = (record.metricSnapshot?.states[metricKey] ?? record.metricStates[metricKey]).toLowerCase();
      if (state.includes("no distributions")) return 0;
    }
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  if (key === "ticker") return record.ticker;
  if (key === "category") return `${record.category} ${strategyLabel(record.strategy)}`;
  if (key === "exposure") return record.exposure;
  if (key === "issuer") return record.issuer;
  return dataStatusSortValue(record);
}

function SummaryCard({ label, value, note, tone = "text-gray-900" }: { label: string; value: string | number; note: string; tone?: string }) {
  return (
    <div className="surface-card min-w-0 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold tracking-tight ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-gray-400">{note}</div>
    </div>
  );
}

function ScoreCoveragePanel({ records }: { records: ETFRecord[] }) {
  const coverage = scoreCoverageSummary(records);
  return (
    <section className="surface-card p-4 sm:p-5" aria-labelledby="score-coverage-heading">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Independent scorecards</p>
          <h2 id="score-coverage-heading" className="mt-1 text-base font-bold text-gray-900">Score coverage</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">Scores are calculated per fund, then ranked only inside a verified investment role and matching horizon. The coverage counts below include current, ranked-eligible numerical results.</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[560px]">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">All ETF roles</dt><dd className="mt-1 font-mono text-lg font-bold text-gray-900">{coverage.totalReady}<span className="text-xs font-medium text-gray-400"> / {records.length}</span></dd></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Core / Full · 3Y+</dt><dd className="mt-1 font-mono text-lg font-bold text-gray-900">{coverage.longTermReady}<span className="text-xs font-medium text-gray-400"> / {coverage.longTermTotal}</span></dd></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tactical</dt><dd className="mt-1 font-mono text-lg font-bold text-gray-900">{coverage.tacticalReady}<span className="text-xs font-medium text-gray-400"> / {coverage.tacticalTotal}</span></dd></div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Current variants</dt><dd className="mt-1 text-[10px] font-bold leading-5 text-gray-800">Core 3Y {coverage.core3YReady} · Core 1Y {coverage.limitedHistory} · Full {coverage.fullReady}<br />Tactical {coverage.tacticalReady} · cost-only {coverage.costOnly} · unavailable {coverage.unavailable}</dd></div>
        </dl>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-3 text-[11px] leading-5 text-gray-500">
        <strong className="font-semibold text-gray-700">Current blockers:</strong> dated mandate and comparison-group verification; an authorized, validated total-return history; a verified current net fee; and a 30-day median spread. Full scores also need official NAV and benchmark returns. Candidate score curves remain unpublished until their sensitivity review is complete.
        <span className="ml-1">Release targets from the current catalogue are at least {Math.ceil(records.length * 0.8)} of {records.length} ranked ETF scores overall and {Math.ceil(coverage.longTermTotal * 0.8)} of {coverage.longTermTotal} long-term Core / Full scores; actual coverage is shown above.</span>
      </div>
    </section>
  );
}

function CategoryCard({ category, count, active, onClick }: { category: ETFCategoryMeta; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface-card min-w-0 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transform-none ${active ? "border-indigo-300 bg-indigo-50/50" : ""}`}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-5 text-gray-900">{formatCategory(category.key)}</span>
        <span className="shrink-0 font-mono text-lg font-bold text-indigo-600">{count}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-gray-500">{category.description}</p>
    </button>
  );
}

function SortButton({ label, sortKey, currentSort, descending, onChange }: { label: string; sortKey: SortKey; currentSort: SortKey; descending: boolean; onChange: (key: SortKey) => void }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => onChange(sortKey)}>
      {label}<span aria-hidden="true" className="text-[9px]">{currentSort === sortKey ? (descending ? "▼" : "▲") : "↕"}</span>
    </button>
  );
}

function ETFTable({ records, shortlist, compareTickers, metrics, onSelect, onToggleShortlist, onToggleCompare, sortKey, descending, onSort }: {
  records: ETFRecord[];
  shortlist: Record<string, ShortlistEntry>;
  compareTickers: string[];
  metrics: TableMetric[];
  onSelect: (record: ETFRecord) => void;
  onToggleShortlist: (record: ETFRecord) => void;
  onToggleCompare: (record: ETFRecord) => void;
  sortKey: SortKey;
  descending: boolean;
  onSort: (key: SortKey) => void;
}) {
  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, record: ETFRecord) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(record);
    }
  }
  const mobileMetrics = metrics.slice(0, 4);
  const additionalMobileMetrics = metrics.slice(4);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-b-2xl lg:block">
        <table className="w-full min-w-[1980px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[9%]" />
            {metrics.map((metric) => <col key={metric.key} className="w-[6%]" />)}
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--border)] bg-gray-50/80 text-[11px] uppercase tracking-wide text-gray-500">
              <th scope="col" aria-sort={sortKey === "ticker" ? (descending ? "descending" : "ascending") : "none"} className="sticky left-0 z-20 min-w-56 bg-gray-50 px-4 py-3 text-left font-semibold"><SortButton label="Fund" sortKey="ticker" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "category" ? (descending ? "descending" : "ascending") : "none"} className="min-w-56 px-4 py-3 text-left font-semibold"><SortButton label="Category / strategy" sortKey="category" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "exposure" ? (descending ? "descending" : "ascending") : "none"} className="min-w-64 px-4 py-3 text-left font-semibold"><SortButton label="Exposure" sortKey="exposure" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "score" ? (descending ? "descending" : "ascending") : "none"} title="Independent scorecard result. Ranked only inside the same methodology, horizon, and verified comparison group." className="min-w-36 px-4 py-3 text-left font-semibold"><SortButton label="Score" sortKey="score" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              {metrics.map((metric) => <th key={metric.key} scope="col" title={ETF_METRIC_HELP[metric.key] ?? ETF_METRIC_LABELS[metric.key]} aria-sort={sortKey === `metric:${metric.key}` ? (descending ? "descending" : "ascending") : "none"} className="whitespace-nowrap px-4 py-3 text-right font-semibold"><SortButton label={metric.label} sortKey={`metric:${metric.key}`} currentSort={sortKey} descending={descending} onChange={onSort} /></th>)}
              <th scope="col" aria-sort={sortKey === "issuer" ? (descending ? "descending" : "ascending") : "none"} className="min-w-32 px-4 py-3 text-left font-semibold"><SortButton label="Issuer" sortKey="issuer" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" aria-sort={sortKey === "dataStatus" ? (descending ? "descending" : "ascending") : "none"} className="min-w-36 px-4 py-3 text-left font-semibold"><SortButton label="Data status" sortKey="dataStatus" currentSort={sortKey} descending={descending} onChange={onSort} /></th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => {
              const compared = compareTickers.includes(record.ticker);
              const saved = Boolean(shortlist[record.ticker]);
              const scoreGroup = scoreGroupForRecord(record);
              const previousScoreGroup = index > 0 ? scoreGroupForRecord(records[index - 1]) : null;
              const showScoreGroup = sortKey === "score" && scoreGroup.key !== previousScoreGroup?.key;
              return (
                <Fragment key={record.id}>
                  {showScoreGroup && <tr className="border-b border-indigo-100 bg-indigo-50/60"><th colSpan={7 + metrics.length} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-indigo-800">{scoreGroup.label}</th></tr>}
                  <tr
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelect(record)}
                  onKeyDown={(event) => handleRowKeyDown(event, record)}
                  className="group cursor-pointer border-b border-gray-100 last:border-0 hover:bg-indigo-50/40 focus:outline-none focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <th scope="row" className="sticky left-0 z-[1] bg-white px-4 py-3 text-left group-hover:bg-[#f8f8ff] group-focus-visible:bg-indigo-50">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-mono text-[10px] font-bold text-indigo-700">{record.ticker.slice(0, 2)}</span>
                      <span className="min-w-0"><span className="block font-mono font-bold text-gray-900">{record.ticker}</span><span className="mt-0.5 block max-w-44 truncate text-[11px] font-normal text-gray-500" title={record.name}>{record.name}</span></span>
                    </div>
                  </th>
                  <td className="px-4 py-3 align-top"><span className="block max-w-52 text-xs font-semibold text-gray-800">{formatCategory(record.category)}</span><span className="mt-1 flex flex-wrap gap-1">{record.badges.slice(0, 2).map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</span></td>
                  <td className="max-w-72 px-4 py-3 align-top text-xs leading-5 text-gray-600">{record.exposure}</td>
                  <td className="px-4 py-3 align-top text-xs"><ScoreCell record={record} /></td>
                  {metrics.map((metric) => <td key={metric.key} className="whitespace-nowrap px-4 py-3 text-right text-xs"><FundMetric record={record} metricKey={metric.key} />{metric.key === "cagr5Y" && <OtherHistoryHint record={record} />}</td>)}
                  <td className="px-4 py-3 align-top text-xs text-gray-600">{record.issuer}</td>
                  <td className="px-4 py-3 align-top"><DataStatus record={record} /></td>
                  <td className="px-4 py-3 align-top"><div className="flex justify-end gap-1.5"><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${compared ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-700"}`} onClick={(event) => { event.stopPropagation(); onToggleCompare(record); }} disabled={!compared && compareTickers.length >= 4} aria-label={`${compared ? "Remove" : "Add"} ${record.ticker} ${compared ? "from" : "to"} comparison`}>{compared ? "Compared" : "Compare"}</button><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${saved ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-600 hover:border-amber-200 hover:text-amber-800"}`} onClick={(event) => { event.stopPropagation(); onToggleShortlist(record); }} aria-label={`${saved ? "Remove" : "Save"} ${record.ticker} ${saved ? "from" : "to"} shortlist`}>{saved ? "Saved" : "Save"}</button></div></td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 lg:hidden">
        {records.map((record, index) => {
          const compared = compareTickers.includes(record.ticker);
          const saved = Boolean(shortlist[record.ticker]);
          const scoreGroup = scoreGroupForRecord(record);
          const previousScoreGroup = index > 0 ? scoreGroupForRecord(records[index - 1]) : null;
          const showScoreGroup = sortKey === "score" && scoreGroup.key !== previousScoreGroup?.key;
          return (
            <Fragment key={record.id}>
              {showScoreGroup && <div className="bg-indigo-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">{scoreGroup.label}</div>}
              <article className="p-4">
              <button type="button" onClick={() => onSelect(record)} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-mono text-[10px] font-bold text-indigo-700">{record.ticker.slice(0, 2)}</span><div className="min-w-0"><div className="font-mono font-bold text-gray-900">{record.ticker}</div><div className="truncate text-xs text-gray-500">{record.name}</div></div></div><DataStatus record={record} /></div>
                <p className="mt-3 text-xs leading-5 text-gray-600">{record.exposure}</p>
                <div className="mt-3 flex flex-wrap gap-1.5"><span className="badge border bg-indigo-50 text-indigo-700 border-indigo-200">{formatCategory(record.category)}</span>{record.badges.map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</div>
                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Scorecard</div><div className="mt-1"><ScoreCell record={record} /></div></div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-4">{mobileMetrics.map((metric) => <div key={metric.key}><div className="text-[10px] uppercase tracking-wide text-gray-400">{metric.label}</div><div className="mt-1 text-xs"><FundMetric record={record} metricKey={metric.key} />{metric.key === "cagr5Y" && <OtherHistoryHint record={record} />}</div></div>)}</div>
              </button>
              {additionalMobileMetrics.length > 0 && <details className="mt-3 rounded-lg border border-gray-100 px-3 py-2"><summary className="cursor-pointer text-[11px] font-semibold text-indigo-700">More selected metrics ({additionalMobileMetrics.length})</summary><div className="mt-3 grid grid-cols-2 gap-3">{additionalMobileMetrics.map((metric) => <div key={metric.key}><div className="text-[10px] uppercase tracking-wide text-gray-400">{metric.label}</div><div className="mt-1 text-xs"><FundMetric record={record} metricKey={metric.key} /></div></div>)}</div></details>}
              <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[11px] text-gray-400">{record.issuer}</span><div className="flex gap-1.5"><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${compared ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => onToggleCompare(record)} disabled={!compared && compareTickers.length >= 4}>{compared ? "Compared" : "Compare"}</button><button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${saved ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => onToggleShortlist(record)}>{saved ? "Saved" : "Save"}</button></div></div>
              </article>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}

function CompareView({ records, onSelect, onRemove }: { records: ETFRecord[]; onSelect: (record: ETFRecord) => void; onRemove: (record: ETFRecord) => void }) {
  return (
    <section className="space-y-4" aria-labelledby="compare-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="compare-heading" className="text-lg font-bold text-gray-900">Compare selected funds</h2><p className="mt-1 text-xs text-gray-500">Compare sourced return, yield, drawdown, and holdings coverage for two to four funds.</p></div>
        <span className="text-xs font-semibold text-gray-500">{records.length}/4 selected</span>
      </div>
      {records.length === 0 ? (
        <div className="surface-card flex min-h-56 flex-col items-center justify-center p-8 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg text-indigo-600">↔</div><h3 className="mt-3 text-sm font-bold text-gray-900">Choose funds to compare</h3><p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Use the Compare action in Explore, then return here for a side-by-side view of exposure, structure, and data coverage.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {records.map((record) => (
            <article key={record.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onSelect(record)} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><div className="font-mono text-lg font-bold text-gray-900">{record.ticker}</div><div className="mt-0.5 line-clamp-2 text-xs text-gray-500">{record.name}</div></button><button type="button" onClick={() => onRemove(record)} className="text-xs text-gray-400 hover:text-red-600" aria-label={`Remove ${record.ticker} from comparison`}>Remove</button></div>
              <div className="mt-3 flex flex-wrap gap-1">{record.badges.map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</div>
              <dl className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Category</dt><dd className="text-right font-semibold text-gray-700">{formatCategory(record.category)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">ETF score</dt><dd className="text-right"><ScoreCell record={record} /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Issuer</dt><dd className="text-right text-gray-700">{record.issuer}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">5Y CAGR</dt><dd><FundMetric record={record} metricKey="cagr5Y" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">TTM yield</dt><dd><FundMetric record={record} metricKey="trailingDistributionYield" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">5Y drawdown</dt><dd><FundMetric record={record} metricKey="maxDrawdown5Y" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">5Y volatility</dt><dd><FundMetric record={record} metricKey="volatility5Y" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">5Y Calmar</dt><dd><FundMetric record={record} metricKey="calmar5Y" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Worst rolling 5Y CAGR</dt><dd><FundMetric record={record} metricKey="rolling5YWorstCagr" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-400">Top-ten overlap</dt><dd className="text-right">{records.length < 2 ? "Select another fund" : records.filter((peer) => peer.ticker !== record.ticker).map((peer) => { const value = weightedHoldingsOverlap(record.metricSnapshot?.holdings ?? [], peer.metricSnapshot?.holdings ?? []); return <span key={peer.ticker} className="block">{peer.ticker}: {value == null ? "Holdings unavailable" : `≥${value.toFixed(2)}%`}</span>; })}</dd></div>
              </dl>
              <p className="mt-4 text-[11px] leading-4 text-gray-500">{record.exposure}</p>
            </article>
          ))}
        </div>
      )}
      {records.length > 0 && <p className="text-[11px] leading-5 text-gray-500">Top-ten overlap is a minimum: it sums shared symbols’ smaller reported weights across the providers’ top-ten lists and does not capture holdings outside those lists.</p>}
      <div className="surface-card border border-amber-200 bg-amber-50/70 p-4 text-xs leading-5 text-amber-900"><strong>Matched-date comparison is gated.</strong> These cards show each fund’s own five-year period. Aligned wealth and drawdown charts, rolling-window differences, and benchmark excess need persisted normalized history and a cleared data-source license. Available and unavailable inputs remain separate; the cards do not rank unlike exposures.</div>
    </section>
  );
}

function ShortlistView({ records, shortlist, onSelect, onRemove, onUpdate }: { records: ETFRecord[]; shortlist: Record<string, ShortlistEntry>; onSelect: (record: ETFRecord) => void; onRemove: (record: ETFRecord) => void; onUpdate: (ticker: string, field: keyof Omit<ShortlistEntry, "ticker">, value: string) => void }) {
  return (
    <section className="space-y-4" aria-labelledby="shortlist-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="shortlist-heading" className="text-lg font-bold text-gray-900">Shortlist and decision notes</h2><p className="mt-1 text-xs text-gray-500">Save funds and record the role, reason, concerns, and research state that matter to you.</p></div><span className="text-xs text-gray-400">Saved in this browser</span></div>
      {records.length === 0 ? <div className="surface-card flex min-h-56 flex-col items-center justify-center p-8 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-lg text-amber-700">☆</div><h3 className="mt-3 text-sm font-bold text-gray-900">Your shortlist is empty</h3><p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Use Save in Explore to keep a fund here. Notes stay separate from sourced catalogue facts.</p></div> : <div className="space-y-3">{records.map((record) => { const entry = shortlist[record.ticker]; return <article key={record.id} className="surface-card p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onSelect(record)} className="font-mono text-lg font-bold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{record.ticker}</button><DataStatus record={record} /></div><p className="mt-1 text-xs text-gray-500">{record.name}</p><p className="mt-2 text-xs leading-5 text-gray-600">{record.exposure}</p></div><button type="button" onClick={() => onRemove(record)} className="self-start text-xs font-semibold text-red-500 hover:text-red-700">Remove</button></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Intended role<input className="input-field mt-1 w-full" placeholder="e.g. core US equity" value={entry.role} onChange={(event) => onUpdate(record.ticker, "role", event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Research status<input className="input-field mt-1 w-full" placeholder="e.g. waiting for drawdown history" value={entry.researchStatus} onChange={(event) => onUpdate(record.ticker, "researchStatus", event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Why am I interested?<textarea className="input-field mt-1 min-h-20 w-full resize-y" placeholder="What would this add?" value={entry.reason} onChange={(event) => onUpdate(record.ticker, "reason", event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Concerns to resolve<textarea className="input-field mt-1 min-h-20 w-full resize-y" placeholder="Costs, overlap, structure, or risk questions" value={entry.concerns} onChange={(event) => onUpdate(record.ticker, "concerns", event.target.value)} /></label></div></article>; })}</div>}
    </section>
  );
}

function ETFScoreDetails({ record }: { record: ETFRecord }) {
  const route = routeETFFund(record);
  const assessments = record.metricSnapshot?.scoreAssessments ?? [];
  const displayedAssessments = [...assessments].sort((left, right) => {
    const rank = (assessment: ETFScoreAssessment) => assessment.kind === "core" && assessment.horizon === "3Y" ? 0
      : assessment.kind === "core" && assessment.horizon === "1Y" ? 1
        : assessment.kind === "cost-only" ? 2
          : assessment.kind === "full" ? 3 : assessment.kind === "tactical" ? 4 : 5;
    return rank(left) - rank(right);
  });
  return (
    <section className="surface-card p-4 sm:p-5" aria-labelledby="score-details-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 id="score-details-heading" className="text-sm font-bold text-gray-900">Score assessment</h3><p className="mt-1 text-xs leading-5 text-gray-500">Each result has its own scorecard, history horizon, methodology version, and comparison group.</p></div>
        <ScoreCell record={record} />
      </div>

      {displayedAssessments.length > 0 ? (
        <div className="mt-4 space-y-3">
          {displayedAssessments.map((assessment) => {
            const scoreAvailable = assessment.status === "available" && typeof assessment.score === "number" && Number.isFinite(assessment.score);
            return (
              <article key={`${assessment.scorecardId}-${assessment.horizon}-${assessment.methodologyVersion}`} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-gray-800">{scoreAssessmentLabel(assessment)}</h4><span className="badge border border-gray-200 bg-white text-gray-600">{scoreStatusLabel(assessment.status)}</span></div>
                {scoreAvailable && <div className="mt-2 font-mono text-xl font-bold tabular-nums text-gray-900">{assessment.score!.toFixed(2)}<span className="ml-1 text-xs font-medium text-gray-400">/ 100</span></div>}
                {assessment.reason && <p className="mt-2 text-xs leading-5 text-gray-600">{assessment.reason}</p>}
                <dl className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                  <div title={assessment.comparisonGroupId ?? "No verified group ID"}><dt className="text-gray-400">Comparison group</dt><dd className="mt-0.5 break-words font-medium text-gray-700">{compactComparisonGroupId(assessment.comparisonGroupId, assessment.family)}</dd></div>
                  <div><dt className="text-gray-400">Cutoff · method</dt><dd className="mt-0.5 font-medium text-gray-700">{assessment.cutoff ?? "No completed run"} · {assessment.methodologyVersion}</dd></div>
                  <div><dt className="text-gray-400">Ranking</dt><dd className="mt-0.5 font-medium text-gray-700">{assessment.rankedEligible && scoreAvailable ? "Eligible within the matching scorecard group" : "Not ranked"}</dd></div>
                  {assessment.sourceIds && <div><dt className="text-gray-400">Input sources</dt><dd className="mt-0.5 break-words font-medium text-gray-700">{assessment.sourceIds.join(", ") || "Not recorded"}</dd></div>}
                </dl>
                {scoreAvailable && assessment.components && <div className="mt-3 overflow-x-auto rounded-lg border border-gray-100 bg-white"><table className="w-full min-w-[420px] text-left text-[11px]"><thead><tr className="border-b border-gray-100 text-gray-400"><th className="px-2.5 py-2 font-medium">Component</th><th className="px-2.5 py-2 text-right font-medium">Weight</th><th className="px-2.5 py-2 text-right font-medium">Points</th><th className="px-2.5 py-2 text-right font-medium">Input</th></tr></thead><tbody>{Object.entries(assessment.components).map(([key, component]) => <tr key={key} className="border-b border-gray-50 last:border-0"><th className="px-2.5 py-2 font-medium text-gray-700">{key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())}</th><td className="px-2.5 py-2 text-right tabular-nums text-gray-500">{(component.weight * 100).toFixed(0)}%</td><td className="px-2.5 py-2 text-right font-mono tabular-nums text-gray-800">{component.points == null ? "—" : component.points.toFixed(2)}</td><td className="px-2.5 py-2 text-right font-mono tabular-nums text-gray-500">{component.inputValue == null ? "—" : `${component.inputValue.toFixed(3)} ${component.inputUnit ?? ""}`}</td></tr>)}</tbody></table></div>}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-gray-800">{routeCandidateLabel(route.candidate)}</span><span className="badge border border-gray-200 bg-white text-gray-600">{scoreStatusLabel(route.status)}</span></div>
          <p className="mt-2 text-xs leading-5 text-gray-600">{route.reason}</p>
          <p className="mt-2 text-[11px] leading-5 text-gray-500">No numeric result is stored for this fund. A category or ticker match alone does not verify its current mandate or qualify it for a comparison group.</p>
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3 text-[11px] leading-5 text-gray-500">
        <p><strong className="text-gray-700">Core:</strong> 60% cost and trading plus 40% historical outcomes, using either a complete 3Y or separately ranked 1Y history. Its cost component uses a verified current net fee and 30-day median spread.</p>
        <p className="mt-1.5"><strong className="text-gray-700">Full Grand Score:</strong> available only for verified, unleveraged equity index funds; 60% Fund Quality plus 40% Historical Performance. It also needs aligned official NAV and benchmark total returns.</p>
        <p className="mt-1.5">Scores describe product costs, implementation, and past outcomes. They do not predict returns, measure personal fit, or rank different investment roles together.</p>
      </div>
    </section>
  );
}

function ETFDetailDrawer({ record, saved, compared, onClose, onToggleShortlist, onToggleCompare }: { record: ETFRecord; saved: boolean; compared: boolean; onClose: () => void; onToggleShortlist: (record: ETFRecord) => void; onToggleCompare: (record: ETFRecord) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="etf-detail-heading" className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-white/95 p-5 backdrop-blur sm:p-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-indigo-600">{record.ticker}</span><span className="badge border bg-indigo-50 text-indigo-700 border-indigo-200">{record.kind === "etn" ? "ETN" : "ETF / ETF-like"}</span><DataStatus record={record} /></div><h2 id="etf-detail-heading" className="mt-2 text-xl font-bold tracking-tight text-gray-900">{record.name}</h2><p className="mt-1 text-xs text-gray-500">{record.issuer} · {formatCategory(record.category)}</p></div><button type="button" className="btn btn-ghost shrink-0" onClick={onClose} aria-label="Close ETF details">Close</button></div>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2"><button type="button" className={`btn ${compared ? "btn-primary" : "btn-secondary"}`} onClick={() => onToggleCompare(record)}>{compared ? "Remove from compare" : "Add to compare"}</button><button type="button" className={`btn ${saved ? "btn-secondary" : "btn-ghost"}`} onClick={() => onToggleShortlist(record)}>{saved ? "Saved to shortlist" : "Save to shortlist"}</button></div>

          {record.identityWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Identity review required.</strong> {record.identityWarning}</div>}

          <section aria-labelledby="what-buying-heading"><h3 id="what-buying-heading" className="text-sm font-bold text-gray-900">What am I buying?</h3><p className="mt-2 text-sm leading-6 text-gray-600">{record.exposure}</p><p className="mt-2 text-xs leading-5 text-gray-500">{roleExplanation(record)}</p><div className="mt-3 flex flex-wrap gap-1.5">{record.badges.map((badge) => <span key={badge} className={`badge border ${badgeClass(badge)}`}>{badge}</span>)}</div></section>

          <section aria-labelledby="fund-overview-heading"><h3 id="fund-overview-heading" className="text-sm font-bold text-gray-900">Fund overview</h3><dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 text-xs sm:grid-cols-2">{[["Issuer", record.issuer], ["Catalogue category", formatCategory(record.category)], ["Structure", formatStructure(record.structure)], ["Platform asset ID", String(record.assetId)], ["Catalogue listing", "Public listing observed"], ["Tradability", "Authenticated tradability not checked"], ["Catalogue page", record.cataloguePage ? String(record.cataloguePage) : "US catalogue addition"], ["Source observed", formatSnapshotDate(record.observedAt)], ["Inception date", metricText("inceptionDate", record.metricSnapshot?.values.inceptionDate, record.metricSnapshot?.states.inceptionDate)], ["Expense ratio", metricText("expenseRatio", record.metricSnapshot?.values.expenseRatio, record.metricSnapshot?.states.expenseRatio)], ["Fund net assets", metricText("netAssets", record.metricSnapshot?.values.netAssets, record.metricSnapshot?.states.netAssets, record.metricSnapshot?.currency)]].map(([label, value]) => <div key={label}><dt className="text-gray-400">{label}</dt><dd className="mt-1 font-semibold text-gray-700">{value}</dd></div>)}</dl>{(record.leverageTarget || record.resetInterval) && <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600"><strong className="text-gray-800">Reset and leverage:</strong> {record.leverageTarget ? `${record.leverageTarget} target` : "Target not recorded"}{record.resetInterval ? ` · ${record.resetInterval} reset` : ""}. This is a property of the underlying product, separate from any account-level financing.</div>}</section>

          <ETFScoreDetails record={record} />

          <section aria-labelledby="metric-status-heading"><div className="flex items-end justify-between gap-3"><div><h3 id="metric-status-heading" className="text-sm font-bold text-gray-900">Analysis coverage</h3><p className="mt-1 text-xs text-gray-500">Each value keeps its date range, sample count, source, and method.</p></div><span className="badge border bg-gray-50 text-gray-600 border-gray-200">Market data {record.metricSnapshot?.observedAt ?? "no stored snapshot"}</span></div><div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2">{DETAIL_METRICS.map((key) => <div key={key} className="flex items-start justify-between gap-3 text-xs"><span className="text-gray-500">{ETF_METRIC_LABELS[key]}</span><div className="max-w-[65%] text-right"><FundMetric record={record} metricKey={key} />{record.metricSnapshot?.metricResults?.[key]?.reason && <p className="mt-1 text-[10px] leading-4 text-gray-400">{record.metricSnapshot.metricResults[key]?.reason}</p>}</div></div>)}</div><p className="mt-3 text-[11px] leading-5 text-gray-400">{record.metricSnapshot?.source ?? "Yahoo Finance via yahoo-finance2"}. Missing inputs and open recovery periods retain their own states. The Yahoo series and metadata have not passed source licensing or adjustment verification.</p></section>

          {Object.keys(record.candidateMetrics).length > 0 && <details className="rounded-xl border border-gray-200"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Issuer research leads · unvalidated</summary><div className="border-t border-gray-100 px-4 py-3"><p className="text-[11px] leading-5 text-amber-800">These observations come from issuer research and are shown for review only. They are not production comparison values.</p><dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">{Object.entries(record.candidateMetrics).map(([key, value]) => <div key={key}><dt className="text-gray-400">{candidateMetricLabel(key)}</dt><dd className="mt-1 font-semibold text-gray-700">{value}</dd></div>)}</dl></div></details>}

          <section aria-labelledby="sources-heading"><h3 id="sources-heading" className="text-sm font-bold text-gray-900">Source trail</h3><div className="mt-3 space-y-2 text-xs">{record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-indigo-700 hover:bg-indigo-50"><span>{record.sourceTitle}</span><span aria-hidden="true">↗</span></a> : <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-gray-400">Issuer source URL not recorded.</p>}<a href={record.pluangUrl} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-indigo-700 hover:bg-indigo-50"><span>Pluang public profile · catalogue evidence</span><span aria-hidden="true">↗</span></a></div><p className="mt-3 text-[11px] leading-5 text-gray-400">Availability is catalogue-listed evidence from the {formatSnapshotDate(record.observedAt)} snapshot. It does not confirm account-specific access or authenticated tradability.</p></section>
        </div>
      </aside>
    </div>
  );
}

export default function ETFExplorer({ catalogue, etns, exclusions, categoryMeta, counts, snapshotDate, initialMetricSnapshots, initialMetricLoadError }: ETFExplorerProps) {
  const [view, setView] = useState<View>("explore");
  const [scope, setScope] = useState<Scope>("etf");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [strategy, setStrategy] = useState<ETFStrategy | "all">("all");
  const [issuer, setIssuer] = useState("all");
  const [dataFilter, setDataFilter] = useState<DataFilter>("all");
  const [includeComplex, setIncludeComplex] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [descending, setDescending] = useState(false);
  const [metricPreset, setMetricPreset] = useState<MetricPreset>("quantitative");
  const [customMetrics, setCustomMetrics] = useState<ETFMetricKey[]>(DEFAULT_CUSTOM_METRICS);
  const [columnsHydrated, setColumnsHydrated] = useState(false);
  const [selected, setSelected] = useState<ETFRecord | null>(null);
  const [compareTickers, setCompareTickers] = useState<string[]>([]);
  const [shortlist, setShortlist] = useState<Record<string, ShortlistEntry>>({});
  const [shortlistHydrated, setShortlistHydrated] = useState(false);
  const [metricSnapshots, setMetricSnapshots] = useState<Record<string, ETFMetricSnapshot>>(initialMetricSnapshots);
  const [metricLoadError, setMetricLoadError] = useState(initialMetricLoadError);
  const [metricRetrying, setMetricRetrying] = useState(false);

  const selectedMetricColumns = useMemo<TableMetric[]>(() => {
    const keys = metricPreset === "custom" ? customMetrics : METRIC_PRESETS[metricPreset].metrics;
    return keys.map((key) => ({ key, label: ETF_METRIC_LABELS[key] }));
  }, [metricPreset, customMetrics]);

  const allRecords = useMemo<ETFRecord[]>(
    () => [...catalogue, ...etns].map((record): ETFRecord => ({ ...record, metricSnapshot: metricSnapshots[record.ticker] })),
    [catalogue, etns, metricSnapshots],
  );
  const scoreCoverageRecords = useMemo(() => allRecords.filter((record) => record.kind === "etf"), [allRecords]);
  const recordByTicker = useMemo(() => new Map(allRecords.map((record) => [record.ticker, record])), [allRecords]);

  const reloadMetricSnapshots = useCallback(async () => {
    setMetricRetrying(true);
    try {
      const response = await fetch("/api/etf-metrics", { cache: "no-store" });
      if (!response.ok) throw new Error("Stored market-data snapshots are unavailable");
      const payload = await response.json() as { snapshots?: Record<string, ETFMetricSnapshot> };
      setMetricSnapshots(payload.snapshots ?? {});
      setMetricLoadError(false);
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") console.warn("[etf-metrics] snapshot load failed", error.message);
      setMetricLoadError(true);
    } finally {
      setMetricRetrying(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
        if (stored) setShortlist(JSON.parse(stored) as Record<string, ShortlistEntry>);
      } catch {
        // A blocked or malformed local-storage value should not prevent catalogue browsing.
      }
      setShortlistHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(CUSTOM_COLUMN_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { preset?: MetricPreset; metrics?: string[] };
          if (isMetricPreset(parsed.preset)) setMetricPreset(parsed.preset);
          if (Array.isArray(parsed.metrics)) {
            const available = parsed.metrics.filter((metric): metric is ETFMetricKey => metric in ETF_METRIC_LABELS && !LEGACY_SCORE_METRICS.has(metric as ETFMetricKey));
            if (available.length) setCustomMetrics(available);
          }
        }
      } catch {
        // A malformed saved column choice should not interrupt ETF browsing.
      }
      setColumnsHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (columnsHydrated) window.localStorage.setItem(CUSTOM_COLUMN_STORAGE_KEY, JSON.stringify({ preset: metricPreset, metrics: customMetrics }));
  }, [columnsHydrated, metricPreset, customMetrics]);

  useEffect(() => {
    if (shortlistHydrated) window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(shortlist));
  }, [shortlist, shortlistHydrated]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [selected]);

  const scopedRecords = useMemo(
    () => allRecords.filter((record) => scope === "all" || record.kind === scope),
    [scope, allRecords],
  );
  const issuers = useMemo(() => [...new Set(scopedRecords.map((record) => record.issuer))].sort((a, b) => a.localeCompare(b)), [scopedRecords]);
  const categoryCounts = useMemo(() => {
    const countsByCategory = new Map<string, number>();
    catalogue.forEach((record) => countsByCategory.set(record.category, (countsByCategory.get(record.category) ?? 0) + 1));
    return countsByCategory;
  }, [catalogue]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = scopedRecords.filter((record) => {
      const matchesSearch = !query || [record.ticker, record.name, record.issuer, record.exposure, record.category, ...record.badges].join(" ").toLowerCase().includes(query);
      const matchesCategory = category === "all" || record.category === category;
      const matchesStrategy = strategy === "all" || record.strategy === strategy;
      const matchesIssuer = issuer === "all" || record.issuer === issuer;
      const matchesData = dataFilter === "all" || (dataFilter === "identity-warning" ? Boolean(record.identityWarning) : !record.identityWarning);
      const matchesComplexity = includeComplex || !isComplex(record);
      return matchesSearch && matchesCategory && matchesStrategy && matchesIssuer && matchesData && matchesComplexity;
    });
    return rows.sort((a, b) => {
      if (sortKey === "score") {
        const groupComparison = scoreGroupForRecord(a).label.localeCompare(scoreGroupForRecord(b).label, undefined, { numeric: true, sensitivity: "base" });
        if (groupComparison !== 0) return groupComparison;
        const aScore = scoreSortValue(a);
        const bScore = scoreSortValue(b);
        if (aScore === null) return bScore === null ? a.ticker.localeCompare(b.ticker) : 1;
        if (bScore === null) return -1;
        const scoreComparison = aScore - bScore;
        return scoreComparison === 0 ? a.ticker.localeCompare(b.ticker) : descending ? -scoreComparison : scoreComparison;
      }
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === null) return bv === null ? a.ticker.localeCompare(b.ticker) : 1;
      if (bv === null) return -1;
      const comparison = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      if (comparison !== 0) return descending ? -comparison : comparison;
      return a.ticker.localeCompare(b.ticker);
    });
  }, [scopedRecords, search, category, strategy, issuer, dataFilter, includeComplex, sortKey, descending]);

  const compareRecords = compareTickers.map((ticker) => recordByTicker.get(ticker)).filter((record): record is ETFRecord => Boolean(record));
  const shortlistRecords = Object.keys(shortlist).map((ticker) => recordByTicker.get(ticker)).filter((record): record is ETFRecord => Boolean(record));
  const activeFilterCount = [search.trim(), category !== "all" ? category : "", strategy !== "all" ? strategy : "", issuer !== "all" ? issuer : "", dataFilter !== "all" ? dataFilter : "", !includeComplex ? "simple" : ""].filter(Boolean).length;

  function toggleCompare(record: ETFRecord) {
    setCompareTickers((current) => current.includes(record.ticker) ? current.filter((ticker) => ticker !== record.ticker) : current.length < 4 ? [...current, record.ticker] : current);
  }

  function toggleShortlist(record: ETFRecord) {
    setShortlist((current) => {
      if (current[record.ticker]) {
        const next = { ...current };
        delete next[record.ticker];
        return next;
      }
      return { ...current, [record.ticker]: { ticker: record.ticker, role: "", reason: "", concerns: "", researchStatus: "Needs more research" } };
    });
  }

  function updateShortlist(ticker: string, field: keyof Omit<ShortlistEntry, "ticker">, value: string) {
    setShortlist((current) => ({ ...current, [ticker]: { ...current[ticker], [field]: value } }));
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) setDescending((value) => !value);
    else { setSortKey(key); setDescending(key === "score"); }
  }

  function clearFilters() {
    setSearch(""); setCategory("all"); setStrategy("all"); setIssuer("all"); setDataFilter("all"); setIncludeComplex(true);
  }

  function changeScope(nextScope: Scope) {
    setScope(nextScope);
    setCategory("all");
  }

  function exportCsv() {
    const headers = ["Ticker", "Name", "Issuer", "Exposure", "Category", "Strategy", "Structure", "Instrument", "Asset ID", "Catalogue page", "Availability", "Research status", "Identity warning", "Issuer source", "Issuer source URL", "Snapshot date", "Snapshot source", "Schema version", "Calculation version", "Run ID", "Candidate metrics (unvalidated)", "Score route candidate", "Score route status", "Score route reason", "Primary score", "Assessment", "Score family", "Score horizon", "Comparison group", "Ranked eligible", "Score status", "Score reason", "Score cutoff", "Methodology version", "Score run ID", "Score source IDs", "Score components", "Score input dates", "Score observations", "All score variants (JSON)", ...selectedMetricColumns.flatMap(({ key }) => [`${ETF_METRIC_LABELS[key]} value`, `${ETF_METRIC_LABELS[key]} unit`, `${ETF_METRIC_LABELS[key]} state`, `${ETF_METRIC_LABELS[key]} start date`, `${ETF_METRIC_LABELS[key]} end date`, `${ETF_METRIC_LABELS[key]} observations`, `${ETF_METRIC_LABELS[key]} source IDs`, `${ETF_METRIC_LABELS[key]} reference IDs`, `${ETF_METRIC_LABELS[key]} methodology`])];
    const rows = filteredRecords.map((record) => {
      const route = routeETFFund(record);
      const assessment = scoreForRecord(record);
      return [
        record.ticker, record.name, record.issuer, record.exposure, record.category, strategyLabel(record.strategy), formatStructure(record.structure), record.kind === "etn" ? "ETN" : "ETF / ETF-like", record.assetId, record.cataloguePage ?? "", record.availabilityStatus, record.researchStatus, record.identityWarning ?? "", record.sourceTitle, record.sourceUrl, record.observedAt, record.metricSnapshot?.source ?? "", record.metricSnapshot?.schemaVersion ?? "", record.metricSnapshot?.calculationVersion ?? "", record.metricSnapshot?.runId ?? "", Object.entries(record.candidateMetrics).map(([key, value]) => `${candidateMetricLabel(key)}: ${value}`).join("; "),
        routeCandidateLabel(route.candidate), route.status, route.reason,
        assessment?.score ?? "", assessment ? scoreAssessmentLabel(assessment) : "", assessment?.family ?? "", assessment?.horizon ?? "", assessment?.comparisonGroupId ?? "", assessment?.rankedEligible && !record.metricSnapshot?.stale ? "Yes" : "No", assessment?.status ?? route.status, assessment?.reason ?? route.reason, assessment?.cutoff ?? "", assessment?.methodologyVersion ?? "", assessment?.runId ?? "", assessment?.sourceIds?.join(" | ") ?? "", JSON.stringify(assessment?.components ?? {}), JSON.stringify(assessment?.inputDates ?? {}), JSON.stringify(assessment?.observations ?? {}), JSON.stringify(record.metricSnapshot?.scoreAssessments ?? []),
        ...selectedMetricColumns.flatMap(({ key }) => {
          const result = record.metricSnapshot?.metricResults?.[key];
          return [
            result?.value ?? record.metricSnapshot?.values[key] ?? "",
            result?.unit ?? "",
            record.metricSnapshot?.states[key] ?? record.metricStates[key],
            result?.startDate ?? "",
            result?.endDate ?? "",
            result?.observations ?? "",
            result?.sourceIds.join(" | ") ?? "",
            [result?.benchmarkId, result?.riskFreeSeriesId].filter(Boolean).join(" | "),
            result?.methodologyId ?? "",
          ];
        }),
      ];
    });
    downloadCsv(`etf-catalogue-${snapshotDate}.csv`, headers, rows);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">ETF catalogue</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Compare ETFs by investment role</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Start with broad diversified equity, then explore other investment roles. Scores are grouped by verified mandate and history horizon; no universal winner is implied.</p></div>
        <div className="text-left text-[11px] text-gray-500 sm:text-right"><div className="font-semibold text-gray-700">Public snapshot · {formatSnapshotDate(snapshotDate)}</div><div>Catalogue evidence only · tradability not confirmed</div></div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ETF catalogue coverage"><SummaryCard label="ETF / ETF-like" value={counts.etfLike} note="Retained candidates in the reviewed public catalogue" tone="text-indigo-700" /><SummaryCard label="Separate ETNs" value={counts.etns} note="Shown separately because issuer-credit risk differs" tone="text-red-700" /><SummaryCard label="Excluded discoveries" value={counts.exclusions} note="2 company stocks and 1 closed-end fund" /><SummaryCard label="Tradability confirmed" value={counts.tradabilityConfirmed} note="Authenticated account access was not checked" tone="text-amber-700" /></section>

      <ScoreCoveragePanel records={scoreCoverageRecords} />

      <section className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 sm:p-5" aria-label="Data coverage notice"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">i</span><div><h2 className="text-sm font-bold text-sky-950">Financial metric sources</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-sky-900">{metricLoadError ? "Saved market data could not be loaded." : `${Object.keys(metricSnapshots).length} funds have stored market-data snapshots.`} Existing growth, daily drawdown, monthly volatility, Calmar, and rolling-return fields are calculated from provider adjusted prices. Those fields remain contextual analysis and are not admitted into scores until source permission and adjustment behavior are verified. Risk-free returns, official NAV/index series, and full holdings are not configured. Historical outcomes describe the observed period and are not forecasts. Catalogue listing evidence does not confirm account-specific tradability.</p>{metricLoadError && <button type="button" onClick={() => void reloadMetricSnapshots()} disabled={metricRetrying} className="mt-2 text-xs font-semibold text-sky-800 underline disabled:opacity-60">{metricRetrying ? "Retrying…" : "Retry loading saved data"}</button>}</div></div></section>

      <nav className="segmented w-full overflow-x-auto sm:w-fit" aria-label="ETF page views"><button type="button" className={`segmented-btn flex-1 sm:flex-none ${view === "explore" ? "is-active" : ""}`} onClick={() => setView("explore")}>Explore <span className="ml-1 text-[10px] text-gray-400">{filteredRecords.length}</span></button><button type="button" className={`segmented-btn flex-1 sm:flex-none ${view === "compare" ? "is-active" : ""}`} onClick={() => setView("compare")}>Compare <span className="ml-1 text-[10px] text-gray-400">{compareRecords.length}</span></button><button type="button" className={`segmented-btn flex-1 sm:flex-none ${view === "shortlist" ? "is-active" : ""}`} onClick={() => setView("shortlist")}>Shortlist <span className="ml-1 text-[10px] text-gray-400">{shortlistRecords.length}</span></button></nav>

      {view === "explore" && <>
        <section className="space-y-4" aria-labelledby="catalogue-heading"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="catalogue-heading" className="text-lg font-bold text-gray-900">Catalogue overview</h2><p className="mt-1 text-xs text-gray-500">Choose a category or search across ticker, name, issuer, exposure, and strategy tags.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={`btn ${scope === "etf" ? "btn-primary" : "btn-secondary"}`} onClick={() => changeScope("etf")}>ETF / ETF-like · {catalogue.length}</button><button type="button" className={`btn ${scope === "etn" ? "btn-primary" : "btn-secondary"}`} onClick={() => changeScope("etn")}>ETNs · {etns.length}</button><button type="button" className={`btn ${scope === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => changeScope("all")}>All · {allRecords.length}</button></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{categoryMeta.map((item) => <CategoryCard key={item.key} category={item} count={categoryCounts.get(item.key) ?? 0} active={category === item.key} onClick={() => { setCategory(category === item.key ? "all" : item.key); setScope("etf"); }} />)}</div>
        </section>

        <section className="surface-card p-4 sm:p-5" aria-label="ETF catalogue filters"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="text-xs font-semibold text-gray-600 xl:col-span-2">Search<input type="search" className="input-field mt-1 w-full" placeholder="Ticker, name, issuer, exposure…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="text-xs font-semibold text-gray-600">Category<select className="input-field mt-1 w-full" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categoryMeta.map((item) => <option key={item.key} value={item.key}>{formatCategory(item.key)}</option>)}</select></label><label className="text-xs font-semibold text-gray-600">Strategy<select className="input-field mt-1 w-full" value={strategy} onChange={(event) => setStrategy(event.target.value as ETFStrategy | "all")}><option value="all">All strategies</option>{STRATEGY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs font-semibold text-gray-600">Issuer<select className="input-field mt-1 w-full" value={issuer} onChange={(event) => setIssuer(event.target.value)}><option value="all">All issuers</option>{issuers.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3"><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={includeComplex} onChange={(event) => setIncludeComplex(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />Include leveraged, inverse, and option-income products</label><label className="flex items-center gap-2 text-xs text-gray-600">Data state<select className="input-field py-1" value={dataFilter} onChange={(event) => setDataFilter(event.target.value as DataFilter)}><option value="all">All rows</option><option value="identity-warning">Identity review</option><option value="source-located">Source located</option></select></label><span className="text-[11px] text-gray-400">Numeric filters unlock after validated enrichment.</span>{activeFilterCount > 0 && <button type="button" className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800" onClick={clearFilters}>Clear filters ({activeFilterCount})</button>}</div></section>

      <section className="surface-card overflow-hidden" aria-labelledby="comparison-table-heading"><div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5"><div><h2 id="comparison-table-heading" className="text-lg font-bold text-gray-900">Browse funds</h2><p className="mt-1 text-xs text-gray-500">{filteredRecords.length} of {scopedRecords.length} records · score sorting keeps scorecards and horizons in separate groups · unavailable values stay last</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>{compareRecords.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => setView("compare")}>Review compare · {compareRecords.length}</button>}</div></div><div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5"><label className="flex items-center gap-2 text-xs font-semibold text-gray-600">Metric preset<select className="input-field py-1" value={metricPreset} onChange={(event) => setMetricPreset(event.target.value as MetricPreset)}>{Object.entries(METRIC_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}<option value="custom">Custom columns</option></select></label><span className="text-[11px] leading-4 text-gray-400">Select Score or a metric header to sort. Score rows stay partitioned by methodology, horizon, and verified comparison group.</span></div>{metricPreset === "custom" && <details className="border-b border-gray-100 px-4 py-3 sm:px-5" open><summary className="cursor-pointer text-xs font-semibold text-indigo-700">Choose table columns</summary><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">{(Object.keys(ETF_METRIC_LABELS) as ETFMetricKey[]).filter((key) => key !== "overlap" && !LEGACY_SCORE_METRICS.has(key)).map((key) => <label key={key} className="flex items-start gap-2 text-[11px] leading-4 text-gray-600"><input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={customMetrics.includes(key)} onChange={(event) => setCustomMetrics((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} /><span title={ETF_METRIC_HELP[key]}>{ETF_METRIC_LABELS[key]}</span></label>)}</div></details>}{filteredRecords.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">No catalogue rows match these filters.</div> : <ETFTable records={filteredRecords} shortlist={shortlist} compareTickers={compareTickers} metrics={selectedMetricColumns} onSelect={setSelected} onToggleShortlist={toggleShortlist} onToggleCompare={toggleCompare} sortKey={sortKey} descending={descending} onSort={changeSort} />}</section>
        <p className="text-[11px] leading-5 text-gray-400">Five-year columns use the exact five-year period and show insufficient history for newer funds. Hover a value for its definition, dates, sample count, source, and calculation method. Missing inputs are never replaced with estimates or zero.</p>
      </>}

      {view === "compare" && <CompareView records={compareRecords} onSelect={setSelected} onRemove={toggleCompare} />}
      {view === "shortlist" && <ShortlistView records={shortlistRecords} shortlist={shortlist} onSelect={setSelected} onRemove={toggleShortlist} onUpdate={updateShortlist} />}

      {selected && <ETFDetailDrawer record={recordByTicker.get(selected.ticker) ?? selected} saved={Boolean(shortlist[selected.ticker])} compared={compareTickers.includes(selected.ticker)} onClose={() => setSelected(null)} onToggleShortlist={toggleShortlist} onToggleCompare={toggleCompare} />}

      <details className="surface-card overflow-hidden"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Audit boundary · {exclusions.length} discoveries excluded from the fund table</summary><div className="border-t border-gray-100 px-4 py-3"><p className="text-[11px] leading-5 text-gray-500">The public audit also found labels that resolve to operating-company stocks or a closed-end fund. They remain accounted for here and are excluded from ETF / ETN comparisons.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{exclusions.map((record) => <div key={record.id} className="rounded-lg bg-gray-50 p-3"><div className="font-mono text-xs font-bold text-gray-800">{record.ticker}</div><div className="mt-1 text-[11px] text-gray-500">{formatStructure(record.structure)} · {record.name}</div></div>)}</div></div></details>

      <footer className="border-t border-[var(--border)] pt-4 text-[11px] leading-5 text-gray-400">Catalogue snapshot observed {formatSnapshotDate(snapshotDate)}. Financial figures are sourced from Yahoo Finance, calculated from daily adjusted prices and distribution events, and refreshed by the scheduled data job. Provider coverage differs by fund; the displayed status and observation date apply to each row. Review current issuer documents and customer terms before acting.</footer>
    </div>
  );
}
