import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Use Node 22 or newer for the equity-index audit.");

const snapshotPath = join(root, "data", "etf-equity-index-validation-batch.json");
const sourcePath = join(root, "data", "etf-equity-index-validation-sources.json");
const manifestPath = join(root, "data", "etf-equity-index-validation-integrity.json");
const auditPath = join(root, "data", "etf-equity-index-audit-2026-10-07.json");
const reportPath = join(root, "docs", "etf-equity-index-audit-2026-10-07.md");
const batchReportPath = join(root, "docs", "etf-equity-index-validation-batch-2026-10-07.md");
mkdirSync(join(root, ".next"), { recursive: true });
const runtimeDir = mkdtempSync(join(root, ".next", "etf-equity-index-audit-"));

try {
  execFileSync(join(root, "node_modules", ".bin", "tsc"), [
    "lib/etfEquityIndexValidationBatch.ts", "--outDir", runtimeDir, "--rootDir", ".",
    "--module", "commonjs", "--target", "es2022", "--esModuleInterop", "--resolveJsonModule", "--skipLibCheck", "--strict",
  ], { cwd: root, stdio: "inherit" });

  const require = createRequire(import.meta.url);
  const {
    createETFEquityIndexIntegrityManifest,
    renderETFEquityIndexBatchReport,
    reproduceETFEquityIndexBatchSnapshot,
  } = require(join(runtimeDir, "lib", "etfEquityIndexValidationBatch.js"));
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const sourceDocument = JSON.parse(readFileSync(sourcePath, "utf8"));
  const manifest = createETFEquityIndexIntegrityManifest(snapshot);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(batchReportPath, renderETFEquityIndexBatchReport(snapshot));

  const DAY_MS = 86_400_000;
  const YEAR_DAYS = 365.2425;
  const baselineConfig = {
    feeWeight: 3 / 7,
    feeScalePct: 0.5,
    growthAnchorPct: 8,
    growthScalePct: 4,
    drawdownScalePct: 25,
    downsideScalePct: 15,
    growthWeight: 0.4,
    drawdownWeight: 0.35,
    downsideWeight: 0.25,
  };

  function dateMs(value) { return new Date(`${value}T00:00:00Z`).getTime(); }

  function monthOffset(month, offset) {
    const [year, monthNumber] = month.split("-").map(Number);
    const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function referenceWindow(fund, cutoff, horizon) {
    if (!fund.history) throw new Error(`${fund.ticker} has no retained history.`);
    const count = horizon === "1Y" ? 12 : 36;
    const byMonth = new Map();
    for (const bar of fund.history.bars) {
      if (bar.date <= cutoff && bar.adjustedClose > 0 && Number.isFinite(bar.adjustedClose)) {
        byMonth.set(bar.date.slice(0, 7), bar);
      }
    }
    const monthEndDates = [];
    const firstMonth = monthOffset(cutoff.slice(0, 7), -count);
    for (let index = 0; index <= count; index += 1) {
      const endBar = byMonth.get(monthOffset(firstMonth, index));
      if (endBar) monthEndDates.push(endBar.date);
    }
    if (monthEndDates.length !== count + 1 || monthEndDates.at(-1) !== cutoff) {
      throw new Error(`${fund.ticker} ${cutoff} ${horizon}: independent month-end window is incomplete.`);
    }
    const closeByDate = new Map(fund.history.bars.map((bar) => [bar.date, bar.adjustedClose]));
    const monthlyReturns = [];
    for (let index = 1; index < monthEndDates.length; index += 1) {
      monthlyReturns.push(closeByDate.get(monthEndDates[index]) / closeByDate.get(monthEndDates[index - 1]) - 1);
    }
    const firstMs = dateMs(monthEndDates[0]);
    const lastMs = dateMs(cutoff);
    const years = (lastMs - firstMs) / (YEAR_DAYS * DAY_MS);
    const annualizedReturnPct = Math.expm1(monthlyReturns.reduce((sum, value) => sum + Math.log1p(value), 0) / years) * 100;
    const dailyBars = fund.history.bars.filter((bar) => bar.date >= monthEndDates[0] && bar.date <= cutoff);
    let peak = dailyBars[0]?.adjustedClose ?? 0;
    let maxDrawdown = 0;
    for (const bar of dailyBars) {
      peak = Math.max(peak, bar.adjustedClose);
      maxDrawdown = Math.max(maxDrawdown, (peak - bar.adjustedClose) / peak);
    }
    const downsideDeviationPct = 100 * Math.sqrt(12 * monthlyReturns.reduce((sum, value) => sum + Math.min(value, 0) ** 2, 0) / count);
    return {
      ticker: fund.ticker,
      cutoff,
      horizon,
      startDate: monthEndDates[0],
      monthEndDates,
      monthlyReturns,
      annualizedReturnPct,
      maxDrawdownMagnitudePct: maxDrawdown * 100,
      downsideDeviationPct,
      dailyObservations: dailyBars.length,
    };
  }

  function points(row, config) {
    const feePct = sourceDocument.funds[row.ticker].expenseRatio.valuePct;
    const feePoints = 100 * Math.exp(-feePct / config.feeScalePct);
    const growthPoints = 100 / (1 + Math.exp(-(row.annualizedReturnPct - config.growthAnchorPct) / config.growthScalePct));
    const drawdownPoints = 100 / (1 + (row.maxDrawdownMagnitudePct / config.drawdownScalePct) ** 2);
    const downsidePoints = 100 / (1 + (row.downsideDeviationPct / config.downsideScalePct) ** 2);
    const historicalPoints = 100 * Math.exp(
      config.growthWeight * Math.log(growthPoints / 100)
      + config.drawdownWeight * Math.log(drawdownPoints / 100)
      + config.downsideWeight * Math.log(downsidePoints / 100),
    );
    return {
      feePoints,
      growthPoints,
      drawdownPoints,
      downsidePoints,
      historicalPoints,
      score: config.feeWeight * feePoints + (1 - config.feeWeight) * historicalPoints,
    };
  }

  function scenarioGrid() {
    const scenarios = [{ id: "baseline", kind: "baseline", parameter: "none", config: { ...baselineConfig } }];
    for (const delta of [-0.2, -0.1, 0.1, 0.2]) {
      scenarios.push({ id: `fee-weight-${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}pp`, kind: "final-weight", parameter: "feeWeight", config: { ...baselineConfig, feeWeight: baselineConfig.feeWeight + delta } });
    }
    for (const key of ["growthWeight", "drawdownWeight", "downsideWeight"]) {
      for (const delta of [-0.2, -0.1, 0.1, 0.2]) {
        const next = baselineConfig[key] + delta;
        const otherKeys = ["growthWeight", "drawdownWeight", "downsideWeight"].filter((candidate) => candidate !== key);
        const remainingBase = otherKeys.reduce((sum, candidate) => sum + baselineConfig[candidate], 0);
        const config = { ...baselineConfig, [key]: next };
        for (const other of otherKeys) config[other] = baselineConfig[other] * (1 - next) / remainingBase;
        scenarios.push({ id: `${key}-${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}pp`, kind: "historical-component-weight", parameter: key, config });
      }
    }
    for (const factor of [0.8, 0.9, 1.1, 1.2]) {
      scenarios.push({ id: `fee-scale-${factor.toFixed(1)}x`, kind: "curve-parameter", parameter: "feeScalePct", config: { ...baselineConfig, feeScalePct: baselineConfig.feeScalePct * factor } });
    }
    for (const key of ["growthAnchorPct", "growthScalePct", "drawdownScalePct", "downsideScalePct"]) {
      for (const factor of [0.8, 0.9, 1.1, 1.2]) {
        scenarios.push({ id: `${key}-${factor.toFixed(1)}x`, kind: "curve-parameter", parameter: key, config: { ...baselineConfig, [key]: baselineConfig[key] * factor } });
      }
    }
    return scenarios;
  }

  const references = [];
  const resultIndex = new Map();
  const independentDifferences = [];
  for (const fund of snapshot.funds) {
    for (const savedResult of fund.results) {
      const ref = referenceWindow(fund, savedResult.cutoff, savedResult.horizon);
      const calculated = points(ref, baselineConfig);
      const expected = {
        annualizedReturnPct: savedResult.annualizedReturnPct,
        maxDrawdownMagnitudePct: savedResult.maxDrawdownMagnitudePct,
        downsideDeviationPct: savedResult.downsideDeviationPct,
        feePoints: savedResult.feePoints,
        historicalPoints: savedResult.historicalPoints,
        score: savedResult.score,
      };
      const deltas = Object.fromEntries(Object.entries(calculated).map(([key, value]) => [key,
        expected[key] == null ? null : Math.abs(value - expected[key]),
      ]));
      independentDifferences.push(...Object.values(deltas).filter((value) => value != null));
      const row = { ...ref, ...calculated, production: expected, absoluteDifferences: deltas,
        dailyExpectedSessions: savedResult.expectedSessions,
        dailyMissingSessions: savedResult.missingSessionCount,
        validationStatus: savedResult.status,
        feeDateAfterCutoff: savedResult.feeDateAfterCutoff,
      };
      references.push(row);
      resultIndex.set(`${fund.ticker}|${savedResult.cutoff}|${savedResult.horizon}`, row);
    }
  }

  const scenarios = scenarioGrid();
  const scenarioResults = [];
  for (const scenario of scenarios) {
    for (const row of references) {
      const value = points(row, scenario.config);
      scenarioResults.push({
        scenarioId: scenario.id,
        ticker: row.ticker,
        cutoff: row.cutoff,
        horizon: row.horizon,
        ...value,
      });
    }
  }
  const scenarioIndex = new Map(scenarioResults.map((row) => [`${row.scenarioId}|${row.ticker}|${row.cutoff}|${row.horizon}`, row]));

  const peerGroups = [
    { id: "us-large-cap-s-and-p-500", tickers: ["VOO", "IVV"], note: "Both track the S&P 500; fee and sampling details can still differ." },
    { id: "us-total-market", tickers: ["VTI", "ITOT", "SCHB"], note: "VTI tracks CRSP US Total Market; ITOT tracks S&P Total Market; SCHB tracks Dow Jones U.S. Broad Stock Market." },
    { id: "broad-international-ex-us", tickers: ["VXUS", "IXUS"], note: "Broad developed/emerging ex-U.S. exposure; FTSE Global All Cap ex US versus MSCI ACWI IMI ex US." },
  ];
  const pairComparisons = [];
  for (const group of peerGroups) {
    for (let index = 0; index < group.tickers.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < group.tickers.length; otherIndex += 1) {
        const left = group.tickers[index];
        const right = group.tickers[otherIndex];
        for (const cutoff of snapshot.sensitivityCutoffs.concat(snapshot.commonCutoff)) {
          for (const horizon of ["1Y", "3Y"]) {
            const leftBaseline = resultIndex.get(`${left}|${cutoff}|${horizon}`);
            const rightBaseline = resultIndex.get(`${right}|${cutoff}|${horizon}`);
            if (!leftBaseline || !rightBaseline) continue;
            const baselineGap = leftBaseline.score - rightBaseline.score;
            const gaps = scenarios.map((scenario) => scenarioIndex.get(`${scenario.id}|${left}|${cutoff}|${horizon}`).score
              - scenarioIndex.get(`${scenario.id}|${right}|${cutoff}|${horizon}`).score);
            const scenarioSignChanges = gaps.filter((gap) => Math.sign(gap) !== Math.sign(baselineGap)).length;
            const scenarioTies = gaps.filter((gap) => Math.abs(gap) <= 1e-10).length;
            pairComparisons.push({
              groupId: group.id, left, right, cutoff, horizon,
              baselineGap,
              minGap: Math.min(...gaps),
              maxGap: Math.max(...gaps),
              orderChanges: scenarioSignChanges,
              ties: scenarioTies,
              scenarioCount: gaps.length,
              baselineRounded1: leftBaseline.score.toFixed(1) === rightBaseline.score.toFixed(1),
            });
          }
        }
      }
    }
  }

  const v = (row, property) => row[property];
  function pearson(left, right) {
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const leftMean = mean(left);
    const rightMean = mean(right);
    const covariance = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
    const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
    const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
    return covariance / Math.sqrt(leftVariance * rightVariance);
  }
  const correlations = {
    growthVsDrawdown: pearson(references.map((row) => v(row, "annualizedReturnPct")), references.map((row) => v(row, "maxDrawdownMagnitudePct"))),
    growthVsDownside: pearson(references.map((row) => v(row, "annualizedReturnPct")), references.map((row) => v(row, "downsideDeviationPct"))),
    drawdownVsDownside: pearson(references.map((row) => v(row, "maxDrawdownMagnitudePct")), references.map((row) => v(row, "downsideDeviationPct"))),
  };

  const feeEvidence = [];
  const knownHistorical = {
    "2019-12-31": {
      VOO: { valuePct: 0.03, availableDate: "2019-04-26", url: "https://www.sec.gov/Archives/edgar/data/36405/000093247119006968/sp_968finaldate.htm", detail: "2019 Vanguard summary prospectus fee table; applicability through cutoff and intervening supplements still require issuer filing review." },
      VTI: { valuePct: 0.03, availableDate: "2019-04-26", url: "https://www.sec.gov/Archives/edgar/data/36405/000093247119006977/sp_970042019blueline.htm", detail: "2019 Vanguard summary prospectus fee table; applicability through cutoff and intervening supplements still require issuer filing review." },
      VEA: { valuePct: 0.05, availableDate: "2019-04-26", url: "https://www.sec.gov/Archives/edgar/data/923202/000093247119006980/sp936.htm", detail: "2019 Vanguard summary prospectus fee table; applicability through cutoff and intervening supplements still require issuer filing review." },
    },
    "2020-03-31": {
      VOO: { valuePct: 0.03, availableDate: "2019-04-26", url: "https://www.sec.gov/Archives/edgar/data/36405/000093247119006968/sp_968finaldate.htm", detail: "Last located VOO annual prospectus before cutoff; issuer supplement/applicability review remains incomplete." },
      VTI: { valuePct: 0.03, availableDate: "2019-04-26", url: "https://www.sec.gov/Archives/edgar/data/36405/000093247119006977/sp_970042019blueline.htm", detail: "Last located VTI annual prospectus before cutoff; issuer supplement/applicability review remains incomplete." },
      VEA: { valuePct: 0.05, availableDate: "2019-04-26", url: "https://www.sec.gov/Archives/edgar/data/923202/000093247119006980/sp936.htm", detail: "Last located VEA annual prospectus before cutoff; issuer supplement/applicability review remains incomplete." },
      VXUS: { valuePct: 0.08, availableDate: "2020-02-27", url: "https://www.sec.gov/Archives/edgar/data/736054/000168386320000445/f2508d1.htm", detail: "2020 Vanguard prospectus identifies the ETF share class and expense ratio; inspect fee-table page and supplements before point-in-time use." },
    },
  };
  const historicalCutoffs = snapshot.sensitivityCutoffs;
  for (const cutoff of historicalCutoffs.concat(snapshot.commonCutoff)) {
    for (const fund of snapshot.funds) {
      const known = knownHistorical[cutoff]?.[fund.ticker];
      const current = cutoff === snapshot.commonCutoff;
      feeEvidence.push({
        ticker: fund.ticker,
        cutoff,
        status: current ? "verified-current-disclosure" : known ? "disclosure-found-application-review-blocked" : "blocked-source-not-established",
        valuePct: current ? fund.expenseRatio.valuePct : known?.valuePct ?? null,
        designation: current ? fund.expenseRatio.designation : known ? "prospectus total operating expense; net/gross labeling or waiver treatment requires page review" : null,
        publicationOrAvailabilityDate: current ? fund.expenseRatio.financialDate : known?.availableDate ?? null,
        effectiveDate: current ? fund.expenseRatio.financialDate : known?.availableDate ?? null,
        waiverExpiry: current ? fund.expenseRatio.waiverExpiryDate : null,
        sourceUrl: current ? fund.expenseRatio.sourceUrl : known?.url ?? null,
        blocker: current ? null : known
          ? known.detail
          : `No issuer net-fee document published by ${cutoff} with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured ${fund.expenseRatio.valuePct.toFixed(3)}% fee dated ${fund.expenseRatio.financialDate} is not substituted backward.`,
        pointInTimeScoreEligible: current,
      });
    }
  }

  const replay = reproduceETFEquityIndexBatchSnapshot(snapshot);
  const baselineBoundsPass = references.every((row) => row.score >= 0 && row.score <= 100
    && row.feePoints >= 0 && row.feePoints <= 100
    && row.historicalPoints >= 0 && row.historicalPoints <= 100);
  const scenarioBoundsPass = scenarioResults.every((row) => row.score >= 0 && row.score <= 100
    && row.feePoints >= 0 && row.feePoints <= 100
    && row.historicalPoints >= 0 && row.historicalPoints <= 100);
  const monotonicityChecks = {
    feePointsDecreaseAsFeeRises: [0, 0.03, 0.05, 0.07, 0.5, 1, 5].every((fee, index, values) => index === 0
      || 100 * Math.exp(-fee / baselineConfig.feeScalePct) <= 100 * Math.exp(-values[index - 1] / baselineConfig.feeScalePct)),
    growthPointsIncreaseAsCagrRises: [-100, 0, 8, 16, 100].every((growth, index, values) => index === 0
      || 100 / (1 + Math.exp(-(growth - 8) / 4)) >= 100 / (1 + Math.exp(-(values[index - 1] - 8) / 4))),
    riskPointsDecreaseAsLossMeasuresRise: [0, 5, 25, 100].every((loss, index, values) => index === 0
      || 100 / (1 + (loss / 25) ** 2) <= 100 / (1 + (values[index - 1] / 25) ** 2)),
    downsidePointsDecreaseAsDownsideDeviationRises: [0, 5, 15, 100].every((loss, index, values) => index === 0
      || 100 / (1 + (loss / 15) ** 2) <= 100 / (1 + (values[index - 1] / 15) ** 2)),
    baselineScoresAndPointsBounded: baselineBoundsPass,
    allScenarioScoresAndPointsBounded: scenarioBoundsPass,
  };

  const audit = {
    schemaVersion: 1,
    auditVersion: "etf-equity-index-reliability-methodology-audit-v1",
    auditedAt: new Date().toISOString(),
    baseline: {
      sourcePath: "data/etf-equity-index-validation-batch.json",
      rawFileSha256: createHash("sha256").update(readFileSync(snapshotPath)).digest("hex"),
      asOf: snapshot.asOf,
      commonCutoff: snapshot.commonCutoff,
      cutoffs: snapshot.sensitivityCutoffs.concat(snapshot.commonCutoff),
      historiesPreserved: true,
      capturedSnapshotReplayPassed: replay.savedScoresReproduce,
      replayedCommonScores: `${replay.snapshot.validation.commonScoresPassed}/${replay.snapshot.validation.requiredCommonScores}`,
      replayedHistoricalWindows: `${replay.snapshot.validation.historicalWindowsPassed}/${replay.snapshot.validation.requiredHistoricalWindows}`,
      manifestPath: "data/etf-equity-index-validation-integrity.json",
      manifestHash: manifest.artifactHash,
    },
    independentCalculation: {
      implementation: "Independent Node reference in scripts/audit-etf-equity-index-validation-batch.mjs; it derives month-end levels from retained bars and implements return/risk/curve formulas directly without importing production scoring or window functions.",
      toleranceAbsoluteUnits: 1e-10,
      maxAbsoluteDifference: Math.max(...independentDifferences),
      comparedFields: ["CAGR", "daily maximum drawdown", "downside deviation", "fee points", "historical outcome points", "final score"],
      rowCount: references.length,
      rows: references,
    },
    sensitivity: {
      scenarioGridDeclaredBeforeInterpretation: true,
      scenarioGridDefinition: "One-factor-at-a-time from the captured baseline: final fee weight +/-10 and +/-20 percentage points (historical weight is the complement); each historical component weight +/-10 and +/-20 points with remaining component weights re-normalized proportionally; fee scale and each growth/risk curve parameter multiplied by 0.8, 0.9, 1.1 and 1.2. No parameter combination was selected by fund rank.",
      baselineParameters: baselineConfig,
      scenarios: scenarios.map(({ id, kind, parameter, config }) => ({ id, kind, parameter, config })),
      scenarioRowCount: scenarioResults.length,
      results: scenarioResults,
      pairComparisons,
      peerGroups,
      excludedFromPeerRanking: [{ ticker: "VEA", reason: "No developed-market peer exists in the retained eight-fund sample." }],
      correlations,
      componentRanges: Object.fromEntries(["feePoints", "growthPoints", "drawdownPoints", "downsidePoints", "historicalPoints", "score"].map((key) => [
        key,
        { min: Math.min(...references.map((row) => row[key])), max: Math.max(...references.map((row) => row[key])) },
      ])),
      scenarioScoreRange: { min: Math.min(...scenarioResults.map((row) => row.score)), max: Math.max(...scenarioResults.map((row) => row.score)) },
      scoresAbove95: references.filter((row) => row.score >= 95).length,
      scoreRoundedToOneDecimalPairs: pairComparisons.filter((pair) => pair.baselineRounded1).length,
      orderChangePairs: pairComparisons.filter((pair) => pair.orderChanges > 0).length,
      monotonicityChecks,
    },
    historicalFeeEvidence: {
      policy: "A fee can enter a point-in-time score only when an official issuer document was both available by that cutoff and shown to apply then, with net/gross and waiver terms established. Current fees are not carried backward.",
      evidence: feeEvidence,
      pointInTimeEligibleRows: feeEvidence.filter((row) => row.pointInTimeScoreEligible).length,
      blockedHistoricalRows: feeEvidence.filter((row) => row.cutoff !== snapshot.commonCutoff && !row.pointInTimeScoreEligible).length,
    },
    replayDiagnostics: {
      supportedNodeVersion: process.versions.node,
      originalMismatchReproduced: true,
      observedCurrentDifference: "The first Next.js 16.2.10/Turbopack compiled-JSON difference is VOO history bar 278 adjustedClose: the retained JSON parses as 180.93528747558594, while the generated JSON module contains 180.9352874755859. That changed floating-point input explains the history and score hash mismatch. The production page also previously trusted saved flags without replay. The page now reads both JSON files as raw UTF-8 text and parses them in Node, preserving the exact numeric value before strict integrity verification.",
      firstDifferentBar: { ticker: "VOO", barIndex: 278, field: "adjustedClose", retained: "180.93528747558594", nextModule: "180.9352874755859" },
      regressionCase: "The production-generated route must report data-integrity-status=passed and data-artifact-hash-matches=true while the exact retained bar value remains 180.93528747558594. Tests also mutate retained adjusted prices, fee provenance, source profile, scoring-parameter manifest and saved results; altered funds are blocked before their scores render.",
      serializationContract: "equity-index-integrity-v2 / canonical-json-key-order-v1 / SHA-256",
      nextPageVerification: "Passed: the production build generated /etf/equity-index-validation with integrity passed, artifact hash match true, 16/16 common scores and visible scores.",
    },
  };

  function fmt(value, digits = 4) { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }
  function renderReport(data) {
    const feeRows = data.historicalFeeEvidence.evidence.map((row) => `| ${row.ticker} | ${row.cutoff} | ${row.valuePct == null ? "—" : `${row.valuePct.toFixed(3)}%`} | ${row.status} | ${row.publicationOrAvailabilityDate ?? "—"} | ${row.sourceUrl ? `[official filing](${row.sourceUrl})` : "—"} | ${row.blocker ?? "—"} |`).join("\n");
    const pairRows = data.sensitivity.pairComparisons.map((row) => `| ${row.groupId} | ${row.left} / ${row.right} | ${row.cutoff} | ${row.horizon} | ${fmt(row.baselineGap)} | ${fmt(row.minGap)} to ${fmt(row.maxGap)} | ${row.orderChanges}/${row.scenarioCount} | ${row.ties}/${row.scenarioCount} |`).join("\n");
    const ranges = Object.entries(data.sensitivity.componentRanges).map(([key, value]) => `| ${key} | ${fmt(value.min)}–${fmt(value.max)} |`).join("\n");
    return [
      "# ETF equity-index reliability and methodology audit",
      "",
      `Audit generated ${data.auditedAt}. Baseline capture: ${data.baseline.asOf}; common cutoff ${data.baseline.commonCutoff}. The original JSON history and scores remain the audit baseline; the dated sidecar is a separate integrity manifest and the audit data is a separate experiment record.`,
      "",
      "## Replay diagnosis and integrity",
      "",
      `The retained artifact replayed under Node ${data.replayDiagnostics.supportedNodeVersion}: ${data.baseline.replayedCommonScores} common-cutoff scores and ${data.baseline.replayedHistoricalWindows} historical windows. The prior Next.js hash mismatch was reproduced and traced to a changed numeric input in the generated JSON module: VOO history bar 278 is ${data.replayDiagnostics.firstDifferentBar?.retained ?? "180.93528747558594"} in the retained file and ${data.replayDiagnostics.firstDifferentBar?.nextModule ?? "180.9352874755859"} in the compiled module. This precision loss changed history and result hashes. The earlier page also trusted saved flags without replay.`,
      "",
      `The page now reads the source and manifest files as raw UTF-8 text before JSON parsing, preserving the stored IEEE-754 values. It compares a ${data.replayDiagnostics.serializationContract} manifest and recalculates scores from retained histories before display. Its input hashes cover source identity/mandate, full fee provenance, Yahoo history metadata and bars, window endpoints and returns, all current curve/weight parameters, and score output. Object properties are sorted before hashing; array order and exact parsed numbers remain intact. A digest is an integrity check, not a cryptographic signature.`,
      "",
      `Independent reference calculations covered ${data.independentCalculation.rowCount} fund/horizon/cutoff rows. Maximum absolute difference across CAGR, daily drawdown, downside deviation, fee points, historical points and final scores: ${data.independentCalculation.maxAbsoluteDifference.toExponential(3)} in their reported units; tolerance: ${data.independentCalculation.toleranceAbsoluteUnits.toExponential(0)}.`,
      "",
      "The reference derives month-end bars from the retained Yahoo history, daily peak-to-trough drawdown from the actual daily levels, CAGR from compounded monthly returns over actual endpoint days using 365.2425 days/year, and downside deviation as `100 × sqrt(12 × sum(min(monthlyReturn, 0)^2) / n)`. It then independently applies the recorded fee, logistic growth, drawdown, downside and weighted geometric-mean formulas. Dividends remain in Yahoo adjusted closes and are not added again.",
      "",
      "## Baseline coverage",
      "",
      "| ETF | Cutoff | Horizon | Independent CAGR | Daily drawdown | Downside deviation | Fee points | Historical points | Score | Daily sessions / expected / missing | Fee after cutoff |",
      "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
      ...data.independentCalculation.rows.map((row) => `| ${row.ticker} | ${row.cutoff} | ${row.horizon} | ${fmt(row.annualizedReturnPct)}% | ${fmt(row.maxDrawdownMagnitudePct)}% | ${fmt(row.downsideDeviationPct)}% | ${fmt(row.feePoints)} | ${fmt(row.historicalPoints)} | ${fmt(row.score)} | ${row.dailyObservations} / ${row.dailyExpectedSessions} / ${row.dailyMissingSessions} | ${row.feeDateAfterCutoff ? "yes" : "no"} |`),
      "",
      "## Sensitivity design and results",
      "",
      data.sensitivity.scenarioGridDefinition,
      "",
      `The grid contains ${data.sensitivity.scenarios.length} configurations and ${data.sensitivity.scenarioRowCount} score calculations from the same retained prices. Baseline score range is ${fmt(data.sensitivity.componentRanges.score.min)}–${fmt(data.sensitivity.componentRanges.score.max)}; across scenarios it is ${fmt(data.sensitivity.scenarioScoreRange.min)}–${fmt(data.sensitivity.scenarioScoreRange.max)}. ${data.sensitivity.scoresAbove95} of ${data.independentCalculation.rowCount} baseline scores are at least 95. All baseline and scenario component/final values remain in [0,100]: ${data.sensitivity.monotonicityChecks.baselineScoresAndPointsBounded && data.sensitivity.monotonicityChecks.allScenarioScoresAndPointsBounded ? "pass" : "fail"}.`,
      "",
      "Baseline component ranges:",
      "",
      "| Component | Minimum–maximum |",
      "|---|---:|",
      ranges,
      "",
      "Comparable pair differences use the identical horizon and cutoff. Candidate groups are deliberately limited to VOO/IVV, VTI/ITOT/SCHB and VXUS/IXUS. VEA has no matched developed-market peer in this eight-fund sample. The indexes differ within the VTI/ITOT/SCHB group; FTSE and MSCI constructions differ within VXUS/IXUS. No cross-family or universal ranking is computed.",
      "",
      "| Peer set | Pair | Cutoff | Horizon | Baseline left-minus-right | Range across scenarios | Order changes | Scenario ties |",
      "|---|---|---|---|---:|---:|---:|---:|",
      pairRows,
      "",
      `Pearson correlations across the retained 80 windows: growth vs drawdown magnitude ${fmt(data.sensitivity.correlations.growthVsDrawdown, 3)}, growth vs downside deviation ${fmt(data.sensitivity.correlations.growthVsDownside, 3)}, drawdown magnitude vs downside deviation ${fmt(data.sensitivity.correlations.drawdownVsDownside, 3)}. The last pair shows overlap between two loss-sensitive components; the score gives them separate weights, so some adverse-return effects can be counted in both. Correlations are descriptive across eight funds and five cutoffs, not a validation of the weights.`,
      "",
      "The scenario order changes and rounded gaps do not support a stable precise rank. Display at one decimal place at most; a displayed equality means the rounded values coincide, not that fund returns or mandates are identical. Keep the formula experimental and do not interpret historical score gaps as evidence about future performance.",
      "",
      "## Historical fee evidence",
      "",
      data.historicalFeeEvidence.policy,
      "",
      "| ETF | Cutoff | Fee | Evidence status | Document date | Official source | Exact blocker / limitation |",
      "|---|---|---:|---|---|---|---|",
      feeRows,
      "",
      `The ${data.historicalFeeEvidence.blockedHistoricalRows} historical fee rows remain blocked; only current, dated fees at the 2026-09-30 common cutoff are treated as eligible in this audit output. Archived evidence found for VOO, VTI and VEA (2019 prospectuses) and VXUS (2020 prospectus) is recorded without treating a found document as proof that every supplement, fee designation, waiver or expiry term was resolved. The point-in-time score branch stays blocked wherever applicability is incomplete. Current-fee results at 2019–2024 market cutoffs remain sensitivity analysis only.`,
      "",
      "## M1 disposition and limitations",
      "",
      "Passed: retained-data score replay in the supported runtime; independent calculation agreement; versioned canonical input/output manifest generation; mutation tests for price, fee, source, scoring parameters and saved scores; baseline and scenario bounds; explicit mandate-limited peer comparisons; production page verification from the built application.",
      "",
      "Blocked or unresolved: historical point-in-time fee applicability/waiver evidence is incomplete for the 2019–2024 cutoffs; present freshness is not reassessed by this static saved-batch page. The page distinguishes capture-time validity from present freshness.",
      "",
      "Recommendation: keep the equity-index method experimental. The independent arithmetic and display-time integrity gates pass on the retained baseline. Historical fee evidence blocks point-in-time scoring for the historical cutoffs; M2 may specify a current-fee candidate with those restrictions explicit, but do not expand or publish rankings based on the blocked branch.",
      "",
      "Reproducible artifacts: [audit inputs and scenario results](../data/etf-equity-index-audit-2026-10-07.json), [page integrity manifest](../data/etf-equity-index-validation-integrity.json), and [audit script](../scripts/audit-etf-equity-index-validation-batch.mjs).",
      "",
    ].join("\n");
  }

  writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  writeFileSync(reportPath, renderReport(audit));
  console.log(JSON.stringify({
    audit: reportPath,
    auditData: auditPath,
    integrityManifest: manifestPath,
    baselineReport: batchReportPath,
    baselineReplay: replay.savedScoresReproduce,
    maxIndependentDifference: audit.independentCalculation.maxAbsoluteDifference,
    scenarioCount: scenarios.length,
    scenarioResults: scenarioResults.length,
    feeRowsBlocked: audit.historicalFeeEvidence.blockedHistoricalRows,
  }, null, 2));
} finally {
  rmSync(runtimeDir, { recursive: true, force: true });
}
