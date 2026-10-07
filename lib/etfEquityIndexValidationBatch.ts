import { createHash } from "node:crypto";
import sourceDocument from "../data/etf-equity-index-validation-sources.json";
import { buildETFCoreMarketWindow, isUsEquityTradingSession } from "./etfCorePipeline";
import { calculateCoreHistoricalOutcomes, feeEfficiencyPoints } from "./etfScoring";
import { ETF_CORE_SCORECARD_CANDIDATES } from "./etfScorecard";

export const ETF_EQUITY_INDEX_BATCH_TICKERS = ["VOO", "VTI", "IVV", "ITOT", "SCHB", "VXUS", "VEA", "IXUS"] as const;
export type ETFEquityIndexBatchTicker = typeof ETF_EQUITY_INDEX_BATCH_TICKERS[number];
export const ETF_EQUITY_INDEX_BATCH_CUTOFFS = ["2019-12-31", "2020-03-31", "2022-12-30", "2024-12-31", "2026-09-30"] as const;
export const ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF = "2026-09-30";
export const ETF_EQUITY_INDEX_BATCH_METHOD = "equity-index-free-core-trial-v1";
export const ETF_EQUITY_INDEX_BATCH_WEIGHTS = { fee: 3 / 7, historical: 4 / 7 } as const;

export interface ETFEquityIndexAdjustedBar {
  date: string;
  adjustedClose: number;
}

export interface ETFEquityIndexHistory {
  provider: "Yahoo Finance";
  sourceId: "yahoo-finance2.chart:adjusted-close";
  sourceUrl: string;
  retrievedAt: string;
  currency: string;
  bars: ETFEquityIndexAdjustedBar[];
}

interface ETFEquityIndexSourceProfile {
  name: string;
  issuer: string;
  role: string;
  identityVerified: boolean;
  identitySourceUrl: string;
  mandate: { family: string; description: string; sourceUrl: string };
  expenseRatio: {
    valuePct: number;
    financialDate: string;
    designation: string;
    waiverExpiryDate: string | null;
    sourceUrl: string;
  };
}

export interface ETFEquityIndexResult {
  cutoff: string;
  horizon: "1Y" | "3Y";
  status: "validated" | "blocked";
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
  startDate: string | null;
  feeFinancialDate: string;
  feeDateAfterCutoff: boolean;
  inputHash: string | null;
}

export interface ETFEquityIndexFundSnapshot extends ETFEquityIndexSourceProfile {
  ticker: ETFEquityIndexBatchTicker;
  history: {
    provider: "Yahoo Finance";
    sourceId: "yahoo-finance2.chart:adjusted-close";
    sourceUrl: string;
    retrievedAt: string;
    currency: string;
    firstDate: string | null;
    lastDate: string | null;
    observations: number;
    sha256: string | null;
    bars: ETFEquityIndexAdjustedBar[];
  } | null;
  coverage: {
    identity: "pass" | "blocked";
    mandate: "pass" | "blocked";
    expenseRatio: "pass" | "blocked";
    history: "pass" | "blocked";
    blockers: string[];
  };
  results: ETFEquityIndexResult[];
}

export interface ETFEquityIndexBatchSnapshot {
  schemaVersion: 1;
  methodologyVersion: string;
  asOf: string;
  sourceReviewDate: string;
  commonCutoff: string;
  sensitivityCutoffs: string[];
  source: { provider: "Yahoo Finance"; sourceId: string; adjustment: string };
  feeTreatment: string;
  validation: {
    commonScoresPassed: number;
    requiredCommonScores: number;
    historicalWindowsPassed: number;
    requiredHistoricalWindows: number;
    scoreReproducibility: "pass" | "blocked";
    inRange: "pass" | "blocked";
    batchReady: boolean;
  };
  funds: ETFEquityIndexFundSnapshot[];
}

type SourceDocument = { funds: Record<ETFEquityIndexBatchTicker, ETFEquityIndexSourceProfile> };
const SOURCE_PROFILES = (sourceDocument as SourceDocument).funds;
const DAY_MS = 86_400_000;
const MAX_SOURCE_AGE_DAYS = 365;
const MAX_HISTORY_AGE_DAYS = 5;
const EXPECTED_HISTORY_SOURCE_ID = "yahoo-finance2.chart:adjusted-close";

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

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function officialIssuerHost(issuer: string): string | null {
  if (issuer === "Vanguard") return "advisors.vanguard.com";
  if (issuer === "iShares") return "www.ishares.com";
  if (issuer === "Schwab Asset Management") return "www.schwabassetmanagement.com";
  return null;
}

function sourceProfileIssues(ticker: ETFEquityIndexBatchTicker, profile: ETFEquityIndexSourceProfile, asOf: Date): {
  identity: string[]; mandate: string[]; fee: string[];
} {
  const issues = { identity: [] as string[], mandate: [] as string[], fee: [] as string[] };
  const host = officialIssuerHost(profile.issuer);
  const issuerUrls = [profile.identitySourceUrl, profile.mandate.sourceUrl, profile.expenseRatio.sourceUrl];
  if (!profile.identityVerified || !profile.name || !profile.issuer || !profile.role) issues.identity.push("Verified fund identity, issuer, name and broad-market role are required.");
  if (!host || issuerUrls.some((url) => {
    try { return new URL(url).protocol !== "https:" || new URL(url).hostname !== host; } catch { return true; }
  })) issues.identity.push("Identity and issuer evidence must use the verified issuer's HTTPS domain.");
  if (profile.mandate.family !== "equity-index") issues.mandate.push("Only verified equity-index mandates are eligible for this batch.");
  if (!profile.mandate.description.toLowerCase().includes("passive") || !profile.mandate.description.toLowerCase().includes("index")) {
    issues.mandate.push("A sourced passive broad equity-index mandate is required.");
  }
  if (!profile.mandate.description.trim()) issues.mandate.push("A sourced mandate description is required.");
  if (!Number.isFinite(profile.expenseRatio.valuePct) || profile.expenseRatio.valuePct < 0
    || profile.expenseRatio.designation !== "net" || !validDate(profile.expenseRatio.financialDate)
    || !profile.expenseRatio.sourceUrl.startsWith("https://")) {
    issues.fee.push("A dated, official-source net expense ratio is required; missing or invalid fees are never imputed.");
  } else {
    const age = ageDays(profile.expenseRatio.financialDate, asOf);
    if (age < 0 || age > MAX_SOURCE_AGE_DAYS) issues.fee.push(`Net expense ratio dated ${profile.expenseRatio.financialDate} is future-dated or older than ${MAX_SOURCE_AGE_DAYS} days.`);
    if (profile.expenseRatio.waiverExpiryDate && (!validDate(profile.expenseRatio.waiverExpiryDate) || profile.expenseRatio.waiverExpiryDate < asOf.toISOString().slice(0, 10))) {
      issues.fee.push("The net expense-ratio waiver has expired or has an invalid expiry date.");
    }
  }
  if (!ticker) issues.identity.push("Ticker identity is missing.");
  return issues;
}

function historyIssues(ticker: ETFEquityIndexBatchTicker, history: ETFEquityIndexHistory | null, asOf: Date): string[] {
  if (!history) return [`Yahoo Finance adjusted-price history is unavailable for ${ticker}.`];
  const issues: string[] = [];
  if (history.provider !== "Yahoo Finance" || history.sourceId !== EXPECTED_HISTORY_SOURCE_ID
    || history.sourceUrl !== `https://finance.yahoo.com/quote/${ticker}/history/`) {
    issues.push("History provider, adjusted-close source identifier or Yahoo ticker URL does not match the requested source.");
  }
  if (history.currency !== "USD") issues.push(`Yahoo history currency is ${history.currency || "missing"}; USD-denominated adjusted prices are required.`);
  const retrievedAt = new Date(history.retrievedAt).getTime();
  const age = (asOf.getTime() - retrievedAt) / DAY_MS;
  if (!Number.isFinite(retrievedAt) || age < 0 || age > MAX_HISTORY_AGE_DAYS) issues.push(`Yahoo history retrieval is missing, future-dated or older than ${MAX_HISTORY_AGE_DAYS} days.`);
  if (!history.bars.length) issues.push("Yahoo returned no adjusted-price observations.");
  const seen = new Set<string>();
  let priorDate = "";
  for (const bar of history.bars) {
    if (!validDate(bar.date) || !Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0) {
      issues.push("Yahoo adjusted history contains an invalid date or nonpositive/missing adjusted close.");
      break;
    }
    if (seen.has(bar.date)) { issues.push(`Yahoo adjusted history contains a duplicate session date (${bar.date}).`); break; }
    if (priorDate && bar.date < priorDate) { issues.push("Yahoo adjusted history is not ordered by session date."); break; }
    if (bar.date > asOf.toISOString().slice(0, 10)) { issues.push(`Yahoo adjusted history contains a future session (${bar.date}).`); break; }
    seen.add(bar.date);
    priorDate = bar.date;
  }
  const latest = history.bars.at(-1)?.date;
  if (!latest || ageDays(latest, asOf) < 0 || ageDays(latest, asOf) > MAX_HISTORY_AGE_DAYS) {
    issues.push(`Latest Yahoo price observation ${latest ?? "is missing"} is future-dated or older than ${MAX_HISTORY_AGE_DAYS} days.`);
  }
  return issues;
}

function nextMonthStart(cutoff: string): Date {
  const [year, month] = cutoff.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1, 12));
}

function scoreResult(input: {
  ticker: ETFEquityIndexBatchTicker;
  profile: ETFEquityIndexSourceProfile;
  history: ETFEquityIndexHistory | null;
  historyIssues: string[];
  sourceIssues: string[];
  cutoff: string;
  horizon: "1Y" | "3Y";
}): ETFEquityIndexResult {
  const { ticker, profile, history, historyIssues: allHistoryIssues, sourceIssues: allSourceIssues, cutoff, horizon } = input;
  const feeDate = profile.expenseRatio.financialDate;
  const base = {
    cutoff, horizon, feeFinancialDate: feeDate, feeDateAfterCutoff: feeDate > cutoff,
    dailyObservations: 0, expectedSessions: 0, missingSessionCount: 0, monthlyReturnCount: 0, startDate: null as string | null,
  };
  const blockers = [...allSourceIssues, ...allHistoryIssues];
  if (!history) return { ...base, status: "blocked", reason: [...new Set(blockers)].join(" "), score: null, feePoints: null, historicalPoints: null, annualizedReturnPct: null, maxDrawdownMagnitudePct: null, downsideDeviationPct: null, inputHash: null };

  const cutoffBars = history.bars.filter((bar) => bar.date <= cutoff);
  const window = buildETFCoreMarketWindow(cutoffBars, horizon, nextMonthStart(cutoff), cutoff);
  if (!window.complete) {
    if (!validDate(cutoff) || !isUsEquityTradingSession(cutoff)) blockers.push(`Cutoff ${cutoff} is not a valid completed U.S.-listed equity trading session.`);
    if (window.missingSessionDates.length) blockers.push(`Incomplete ${horizon} daily window: ${window.missingSessionDates.length} expected U.S. sessions are missing, beginning ${window.missingSessionDates[0]}.`);
    else blockers.push(`Incomplete ${horizon} monthly/daily window at ${cutoff}: expected ${horizon === "1Y" ? 12 : 36} monthly returns and complete session coverage.`);
  }
  const market = {
    sourceId: EXPECTED_HISTORY_SOURCE_ID,
    authorized: true,
    adjustmentMethodVerified: true,
    complete: window.complete,
    monthlyReturns: window.monthlyReturns,
    monthEndDates: window.monthEndDates,
    dailyHistory: {
      complete: window.complete,
      startDate: window.startDate ?? "",
      endDate: window.cutoff,
      observations: window.dailyObservations,
    },
  };
  const historical = window.complete && window.maxDrawdownMagnitudePct != null
    ? calculateCoreHistoricalOutcomes({
      family: "equity-index", horizon, cutoff, maxDrawdownMagnitudePct: window.maxDrawdownMagnitudePct, market,
    }) : null;
  const settings = ETF_CORE_SCORECARD_CANDIDATES["equity-index"];
  const feePoints = feeEfficiencyPoints(profile.expenseRatio.valuePct, settings.feeScale);
  if (feePoints == null) blockers.push("A finite, nonnegative, sourced fee score input is required.");
  if (!historical) blockers.push("Complete adjusted-price history and valid historical outcome components are required.");
  const canScore = blockers.length === 0 && historical != null && feePoints != null;
  const historyHash = sha256({ sourceId: EXPECTED_HISTORY_SOURCE_ID, bars: history.bars });
  const inputHash = sha256({
    ticker, method: ETF_EQUITY_INDEX_BATCH_METHOD, cutoff, horizon, historyHash,
    expenseRatio: profile.expenseRatio,
  });
  return {
    ...base,
    status: canScore ? "validated" : "blocked",
    reason: [...new Set(blockers)].join(" "),
    score: canScore ? ETF_EQUITY_INDEX_BATCH_WEIGHTS.fee * feePoints! + ETF_EQUITY_INDEX_BATCH_WEIGHTS.historical * historical!.score : null,
    feePoints: canScore ? feePoints : null,
    historicalPoints: canScore ? historical!.score : null,
    annualizedReturnPct: canScore ? historical!.cagrPct : null,
    maxDrawdownMagnitudePct: canScore ? window.maxDrawdownMagnitudePct : null,
    downsideDeviationPct: canScore ? historical!.downsideDeviationPct : null,
    dailyObservations: window.dailyObservations,
    expectedSessions: window.expectedSessions,
    missingSessionCount: window.missingSessionDates.length,
    monthlyReturnCount: window.monthlyReturns.length,
    startDate: window.startDate,
    inputHash: canScore ? inputHash : null,
  };
}

export function buildETFEquityIndexBatchSnapshot(input: {
  histories: Partial<Record<ETFEquityIndexBatchTicker, ETFEquityIndexHistory | { error: string }>>;
  now: Date;
}): ETFEquityIndexBatchSnapshot {
  const asOf = input.now.toISOString();
  const funds: ETFEquityIndexFundSnapshot[] = ETF_EQUITY_INDEX_BATCH_TICKERS.map((ticker) => {
    const profile = SOURCE_PROFILES[ticker];
    const acquired = input.histories[ticker];
    const history = acquired && "bars" in acquired ? acquired : null;
    const providerFailure = acquired && "error" in acquired ? [`Yahoo Finance history request failed: ${acquired.error}`] : [];
    const sourceIssueGroups = sourceProfileIssues(ticker, profile, input.now);
    const historyBlockers = [...providerFailure, ...historyIssues(ticker, history, input.now)];
    const sourceBlockers = [...sourceIssueGroups.identity, ...sourceIssueGroups.mandate, ...sourceIssueGroups.fee];
    const results: ETFEquityIndexResult[] = [];
    for (const cutoff of ETF_EQUITY_INDEX_BATCH_CUTOFFS) {
      for (const horizon of ["1Y", "3Y"] as const) {
        const result = scoreResult({
          ticker, profile, history, historyIssues: historyBlockers, sourceIssues: sourceBlockers, cutoff, horizon,
        });
        // An accidental nondeterminism cannot leave a persisted result with a number.
        const replay = scoreResult({
          ticker, profile, history, historyIssues: historyBlockers, sourceIssues: sourceBlockers, cutoff, horizon,
        });
        if (JSON.stringify(result) !== JSON.stringify(replay)) {
          results.push({ ...result, status: "blocked", reason: "Independent score reproduction did not match the initial calculation.", score: null, feePoints: null, historicalPoints: null, annualizedReturnPct: null, maxDrawdownMagnitudePct: null, downsideDeviationPct: null, inputHash: null });
        } else results.push(result);
      }
    }
    const historyHash = history ? sha256({ sourceId: history.sourceId, bars: history.bars }) : null;
    const historyDates = history?.bars.map((bar) => bar.date) ?? [];
    return {
      ticker,
      ...profile,
      history: history ? {
        provider: history.provider, sourceId: history.sourceId, sourceUrl: history.sourceUrl,
        retrievedAt: history.retrievedAt, currency: history.currency,
        firstDate: historyDates[0] ?? null, lastDate: historyDates.at(-1) ?? null,
        observations: history.bars.length, sha256: historyHash, bars: history.bars,
      } : null,
      coverage: {
        identity: sourceIssueGroups.identity.length ? "blocked" : "pass",
        mandate: sourceIssueGroups.mandate.length ? "blocked" : "pass",
        expenseRatio: sourceIssueGroups.fee.length ? "blocked" : "pass",
        history: historyBlockers.length ? "blocked" : "pass",
        blockers: [...new Set([...sourceBlockers, ...historyBlockers])],
      },
      results,
    };
  });
  const allResults = funds.flatMap((fund) => fund.results);
  const commonResults = allResults.filter((result) => result.cutoff === ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF);
  const historicalResults = allResults.filter((result) => result.cutoff !== ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF);
  const validated = allResults.filter((result) => result.status === "validated");
  const inRange = validated.length > 0 && validated.every((result) => Number.isFinite(result.score) && result.score! >= 0 && result.score! <= 100);
  const historicalWindowsPass = historicalResults.filter((result) => result.status === "validated").length;
  const commonScoresPass = commonResults.filter((result) => result.status === "validated").length;
  const reproducibilityPass = validated.length > 0 && validated.every((result) => Boolean(result.inputHash));
  return {
    schemaVersion: 1,
    methodologyVersion: ETF_EQUITY_INDEX_BATCH_METHOD,
    asOf,
    sourceReviewDate: "2026-10-07",
    commonCutoff: ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF,
    sensitivityCutoffs: [...ETF_EQUITY_INDEX_BATCH_CUTOFFS].filter((cutoff) => cutoff !== ETF_EQUITY_INDEX_BATCH_COMMON_CUTOFF),
    source: {
      provider: "Yahoo Finance",
      sourceId: EXPECTED_HISTORY_SOURCE_ID,
      adjustment: "Yahoo chart adjusted close (adjclose); distributions and splits are reflected in the adjusted series and are not added again.",
    },
    feeTreatment: "Current, dated official net expense ratios are held constant across the historical cutoff sensitivity grid. A sensitivity result is not a point-in-time backtest when its fee date is after the market cutoff; each result records feeDateAfterCutoff.",
    validation: {
      commonScoresPassed: commonScoresPass,
      requiredCommonScores: ETF_EQUITY_INDEX_BATCH_TICKERS.length * 2,
      historicalWindowsPassed: historicalWindowsPass,
      requiredHistoricalWindows: ETF_EQUITY_INDEX_BATCH_TICKERS.length * (ETF_EQUITY_INDEX_BATCH_CUTOFFS.length - 1) * 2,
      scoreReproducibility: reproducibilityPass ? "pass" : "blocked",
      inRange: inRange ? "pass" : "blocked",
      batchReady: commonScoresPass === ETF_EQUITY_INDEX_BATCH_TICKERS.length * 2
        && historicalWindowsPass === ETF_EQUITY_INDEX_BATCH_TICKERS.length * (ETF_EQUITY_INDEX_BATCH_CUTOFFS.length - 1) * 2
        && inRange && reproducibilityPass,
    },
    funds,
  };
}

export function reproduceETFEquityIndexBatchSnapshot(saved: ETFEquityIndexBatchSnapshot): {
  snapshot: ETFEquityIndexBatchSnapshot;
  savedScoresReproduce: boolean;
} {
  const histories = Object.fromEntries(saved.funds.flatMap((fund) => fund.history ? [[fund.ticker, {
    provider: fund.history.provider,
    sourceId: fund.history.sourceId,
    sourceUrl: fund.history.sourceUrl,
    retrievedAt: fund.history.retrievedAt,
    currency: fund.history.currency,
    bars: fund.history.bars,
  }]] : [])) as Partial<Record<ETFEquityIndexBatchTicker, ETFEquityIndexHistory>>;
  const replay = buildETFEquityIndexBatchSnapshot({ histories, now: new Date(saved.asOf) });
  const savedByTicker = new Map(saved.funds.map((fund) => [fund.ticker, fund]));
  let savedScoresReproduce = true;
  for (const fund of replay.funds) {
    const prior = savedByTicker.get(fund.ticker);
    const match = JSON.stringify(prior?.results) === JSON.stringify(fund.results)
      && prior?.history?.sha256 === fund.history?.sha256;
    if (!match) {
      savedScoresReproduce = false;
      fund.results = fund.results.map((result) => ({
        ...result,
        status: "blocked",
        reason: "Saved score or history hash failed reproduction from the retained Yahoo inputs.",
        score: null,
        feePoints: null,
        historicalPoints: null,
        annualizedReturnPct: null,
        maxDrawdownMagnitudePct: null,
        downsideDeviationPct: null,
        inputHash: null,
      }));
    }
  }
  replay.validation.scoreReproducibility = savedScoresReproduce ? "pass" : "blocked";
  replay.validation.commonScoresPassed = replay.funds.flatMap((fund) => fund.results)
    .filter((result) => result.cutoff === replay.commonCutoff && result.status === "validated").length;
  replay.validation.historicalWindowsPassed = replay.funds.flatMap((fund) => fund.results)
    .filter((result) => result.cutoff !== replay.commonCutoff && result.status === "validated").length;
  replay.validation.batchReady = replay.validation.batchReady && savedScoresReproduce;
  return { snapshot: replay, savedScoresReproduce };
}

function scoreText(value: number | null): string {
  return value == null ? "—" : value.toFixed(4);
}

export function renderETFEquityIndexBatchReport(snapshot: ETFEquityIndexBatchSnapshot): string {
  const lines = [
    "# Broad equity-index ETF validation batch",
    "",
    `Run captured ${snapshot.asOf} UTC. Common score cutoff: **${snapshot.commonCutoff}**. This is a separate experimental batch; it does not update the ETF Core or Full scorecards.`,
    "",
    `Method ${snapshot.methodologyVersion}: (0.30 × FeePoints + 0.40 × HistoricalOutcomes) ÷ 0.70. Fee efficiency is 100 × exp(−net expense ratio / 0.50%). Historical outcomes reuse the equity-index growth, drawdown and downside curves from the VOO/VXUS trial. No spread is required or inferred.`,
    "",
    "The original trial report documents the outcome component curves and window definitions: [VOO / VXUS Free Core trial](etf-free-core-trial-2026-10-07.md).",
    "",
    "Historical cutoffs test market-window sensitivity. The latest dated issuer net fee is held constant at every cutoff. Results whose fee date is after the cutoff are not point-in-time backtests; see each row's `fee after cutoff` flag.",
    "",
    "## Source and completeness coverage",
    "",
    "| ETF | Mandate | Identity / mandate source | Issuer net fee | Official fee source | Yahoo adjusted history | Data coverage |",
    "|---|---|---|---:|---|---|---|",
  ];
  for (const fund of snapshot.funds) {
    const history = fund.history;
    const historyText = history
      ? `[Yahoo Finance adjusted history](${history.sourceUrl}) · ${history.observations} rows · ${history.firstDate}–${history.lastDate} · ${history.currency} · hash ${history.sha256?.slice(0, 16)}`
      : "Unavailable";
    const feeText = `${fund.expenseRatio.valuePct.toFixed(3)}% net · ${fund.expenseRatio.financialDate}`;
    const statusText = `${fund.coverage.identity}/${fund.coverage.mandate}/${fund.coverage.expenseRatio}/${fund.coverage.history}`;
    lines.push(`| ${fund.ticker} | ${fund.role} | [identity](${fund.identitySourceUrl}) · [mandate](${fund.mandate.sourceUrl}) | ${feeText} | [issuer source](${fund.expenseRatio.sourceUrl}) | ${historyText} | identity/mandate/fee/history: ${statusText} |`);
  }
  lines.push("", "Issuer note: Vanguard renamed VTI to Vanguard Morningstar Total Stock Market ETF effective July 29, 2026; the issuer says the name change did not affect the investment objective or management. [Vanguard announcement](https://corporate.vanguard.com/content/corporatesite/us/en/corp/who-we-are/pressroom/press-release-vanguard-to-update-names-of-us-equity-index-funds-tracking-morningstar-indexes-042926.html).", "");
  lines.push("", "## Common-cutoff scores and window validation", "", "| ETF | Horizon | Status / score | Net fee points | Historical points | CAGR | Max drawdown | Downside deviation | Monthly returns | Daily sessions / expected / missing | Fee after cutoff | Input hash prefix | Blockers |", "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|");
  for (const fund of snapshot.funds) {
    for (const result of fund.results.filter((item) => item.cutoff === snapshot.commonCutoff)) {
      const status = result.status === "validated" ? `validated · ${scoreText(result.score)}` : "blocked · —";
      const feePoints = result.feePoints == null ? "—" : result.feePoints.toFixed(4);
      const historyPoints = result.historicalPoints == null ? "—" : result.historicalPoints.toFixed(4);
      const percent = (value: number | null) => value == null ? "—" : `${value.toFixed(4)}%`;
      lines.push(`| ${fund.ticker} | ${result.horizon} | ${status} | ${feePoints} | ${historyPoints} | ${percent(result.annualizedReturnPct)} | ${percent(result.maxDrawdownMagnitudePct)} | ${percent(result.downsideDeviationPct)} | ${result.monthlyReturnCount} | ${result.dailyObservations} / ${result.expectedSessions} / ${result.missingSessionCount} | ${result.feeDateAfterCutoff ? "yes" : "no"} | ${result.inputHash?.slice(0, 16) ?? "—"} | ${result.reason || "—"} |`);
    }
  }
  lines.push("", "## Historical-cutoff sensitivity", "", "Each cell is `1Y / 3Y`, with the current dated fee held constant. All four historical cutoffs precede the issuer fee dates shown above, so these are cutoff-sensitivity scores rather than point-in-time backtests.", "", `| ETF | ${snapshot.sensitivityCutoffs.map((cutoff) => `${cutoff} · score 1Y / 3Y`).join(" | ")} |`, `|---|${snapshot.sensitivityCutoffs.map(() => "---:").join("|")}|`);
  for (const fund of snapshot.funds) {
    const cells = snapshot.sensitivityCutoffs.map((cutoff) => {
      const one = fund.results.find((result) => result.cutoff === cutoff && result.horizon === "1Y");
      const three = fund.results.find((result) => result.cutoff === cutoff && result.horizon === "3Y");
      return `${one?.status === "validated" ? scoreText(one.score) : "—"} / ${three?.status === "validated" ? scoreText(three.score) : "—"}`;
    });
    lines.push(`| ${fund.ticker} | ${cells.join(" | ")} |`);
  }
  lines.push("", "## Validation results", "", `- Common cutoff: ${snapshot.validation.commonScoresPassed}/${snapshot.validation.requiredCommonScores} scores have complete inputs.`, `- Historical sensitivity windows: ${snapshot.validation.historicalWindowsPassed}/${snapshot.validation.requiredHistoricalWindows} are complete and scored.`, `- Score reproducibility from retained adjusted history and dated fee inputs: ${snapshot.validation.scoreReproducibility}; common-cutoff input hash prefixes are shown above and full history and input hashes are retained in the JSON artifact.`, `- Score bounds: ${snapshot.validation.inRange}. Scores are saved only when all row-level inputs pass.`, `- Batch ready for this validation milestone: ${snapshot.validation.batchReady ? "yes" : "no"}.`, "- Price series are Yahoo Finance adjusted closes in USD. Dividends and splits are reflected in adjclose; no distribution is added a second time. No bid/ask spread was fetched or treated as zero.", "", "## Precise blockers", "");
  const blocked = snapshot.funds.flatMap((fund) => fund.results.filter((result) => result.status === "blocked").map((result) => `- **${fund.ticker} · ${result.cutoff} · ${result.horizon}:** ${result.reason || "Score unavailable; required inputs did not pass validation."}`));
  const sourceBlockers = snapshot.funds.flatMap((fund) => fund.coverage.blockers.map((blocker) => `- **${fund.ticker} source coverage:** ${blocker}`));
  lines.push(...(sourceBlockers.length || blocked.length ? [...new Set([...sourceBlockers, ...blocked])] : ["- None at the time of this run."]));
  lines.push("", "## Scope", "", "This eight-fund sample includes U.S. large-cap, U.S. total-market, international developed-market and broad international ex-U.S. index funds. It is not catalogue coverage, a recommendation, or a frozen methodology. Results from distinct mandates are shown without a pooled ranking. The candidate method applies only to verified equity-index funds; it is not reused for active equity, bonds, income, commodity, leveraged, ETN or other fund families.", "");
  return lines.join("\n");
}
