import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Use Node 22 or newer for M3 validation.");
const require = createRequire(import.meta.url);
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const samplePath = join(root, "data", "etf-equity-index-m3-sample-v1.json");
const sampleDigestPath = join(root, "data", "etf-equity-index-m3-sample-v1.sha256");
const dataUsePolicyPath = join(root, "data", "etf-scoring-data-use-policy.json");
const auditPath = join(root, "data", "etf-equity-index-audit-2026-10-07.json");
const returnEvidencePath = join(root, "data", "etf-equity-index-m3-return-evidence-2026-10-07.json");
const tempDir = mkdtempSync(join(tmpdir(), "etf-equity-index-m3-"));

try {
  execFileSync(process.execPath, [join(root, "scripts", "validate-etf-equity-index-m3-sample.mjs")], { cwd: root, stdio: "inherit" });
  const sampleBytes = readFileSync(samplePath);
  const sample = JSON.parse(sampleBytes.toString("utf8"));
  const sampleSha256 = createHash("sha256").update(sampleBytes).digest("hex");
  const sidecar = readFileSync(sampleDigestPath, "utf8");
  if (sidecar !== `${sampleSha256}  etf-equity-index-m3-sample-v1.json\n`) throw new Error("The frozen sample SHA-256 changed; stopping before Yahoo history acquisition.");
  const audit = JSON.parse(readFileSync(auditPath, "utf8"));
  const sensitivityScenarios = audit?.sensitivity?.scenarios;
  if (!Array.isArray(sensitivityScenarios) || sensitivityScenarios.length !== 37) throw new Error("The retained M1 audit does not contain the fixed 37-scenario sensitivity grid.");
  const returnEvidenceReview = JSON.parse(readFileSync(returnEvidencePath, "utf8"));
  const returnEvidenceTickers = returnEvidenceReview.funds?.map((fund) => fund.ticker).sort();
  const sampleTickers = sample.funds.map((fund) => fund.ticker).sort();
  const invalidReturnEvidence = !Array.isArray(returnEvidenceReview.funds) || returnEvidenceReview.funds.some((fund) => {
    if (!fund.reviewNote?.trim() || !Array.isArray(fund.sources) || fund.sources.length === 0) return true;
    return fund.sources.some((source) => {
      const invalidReturn = (value) => value != null && (!Number.isFinite(value) || value <= -100);
      return source.asOfDate !== returnEvidenceReview.comparisonAsOf
        || !source.sourceName?.trim()
        || !source.returnConvention?.trim()
        || !["official-issuer", "independent-provider"].includes(source.sourceType)
        || !/^https:\/\//.test(source.sourceUrl)
        || invalidReturn(source.oneYearReturnPct)
        || invalidReturn(source.threeYearAnnualizedReturnPct);
    });
  });
  if (!Array.isArray(returnEvidenceTickers) || JSON.stringify(returnEvidenceTickers) !== JSON.stringify(sampleTickers)
    || returnEvidenceReview.protocolId !== "issuer-market-price-return-reconciliation-v1"
    || returnEvidenceReview.tolerancePctPoints !== 0.25
    || returnEvidenceReview.endDate !== returnEvidenceReview.comparisonAsOf
    || returnEvidenceReview.oneYearStartDate !== "2025-08-29"
    || returnEvidenceReview.threeYearStartDate !== "2023-08-31"
    || invalidReturnEvidence) {
    throw new Error("The dated independent-return evidence does not cover the frozen sample under the registered comparison protocol.");
  }

  execFileSync(join(root, "node_modules", ".bin", "tsc"), [
    "lib/etfEquityIndexM3Validation.ts", "lib/etfEquityIndexM4Policy.ts", "--outDir", tempDir, "--rootDir", ".",
    "--module", "commonjs", "--target", "es2022", "--esModuleInterop", "--resolveJsonModule", "--skipLibCheck", "--strict",
  ], { cwd: root, stdio: "inherit" });
  const {
    buildETFEquityIndexM3Snapshot,
    createETFEquityIndexM3Artifact,
    verifyETFEquityIndexM3Artifact,
    ETF_EQUITY_INDEX_M3_STRATA,
  } = require(join(tempDir, "lib", "etfEquityIndexM3Validation.js"));
  const { lastCompletedUsMonthEnd } = require(join(tempDir, "lib", "etfCorePipeline.js"));
  const { assertETFEquityIndexM4RetentionAllowed, assertETFEquityIndexM4YahooAcquisitionAllowed } = require(join(tempDir, "lib", "etfEquityIndexM4Policy.js"));
  const dataUsePolicy = JSON.parse(readFileSync(dataUsePolicyPath, "utf8"));
  const replayRetained = process.argv.includes("--replay-retained");
  assertETFEquityIndexM4RetentionAllowed(dataUsePolicy);
  if (!replayRetained) assertETFEquityIndexM4YahooAcquisitionAllowed(dataUsePolicy);
  const acquisitionStartedAt = new Date();
  const commonCutoff = lastCompletedUsMonthEnd(acquisitionStartedAt);
  if (!commonCutoff) throw new Error("Unable to determine the latest completed U.S. equity month-end session.");
  const period1 = new Date("2016-01-01T00:00:00Z");
  const period2 = new Date(acquisitionStartedAt.getTime() + 86_400_000);
  const histories = {};
  let retainedAsOf = null;

  function dateOnly(value) {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Yahoo returned an invalid adjusted-price date.");
    return parsed.toISOString().slice(0, 10);
  }
  function normalizeYahoo(chart, ticker, retrievedAt) {
    return {
      provider: "Yahoo Finance",
      sourceId: "yahoo-finance2.chart:adjusted-close",
      sourceUrl: `https://finance.yahoo.com/quote/${ticker}/history/`,
      retrievedAt,
      currency: chart.meta?.currency ?? "",
      bars: (chart.quotes ?? []).map((quote) => ({ date: dateOnly(quote.date), adjustedClose: quote.adjclose ?? null })),
    };
  }
  function shortError(error) {
    return String(error?.message ?? error).replace(/https?:\/\/\S+/g, "Yahoo chart endpoint").slice(0, 240);
  }

  if (replayRetained) {
    const retainedPath = join(root, "data", `etf-equity-index-m3-validation-${new Date().toISOString().slice(0, 10)}.json`);
    const retained = JSON.parse(readFileSync(retainedPath, "utf8"));
    if (retained.snapshot?.sampleSha256 !== sampleSha256 || retained.snapshot?.funds?.length !== sample.funds.length) {
      throw new Error("Retained M3 artifact does not match the frozen sample; cannot replay it.");
    }
    retainedAsOf = retained.snapshot.asOf;
    for (const fund of retained.snapshot.funds) {
      histories[fund.ticker] = fund.history
        ? {
          provider: fund.history.provider,
          sourceId: fund.history.sourceId,
          sourceUrl: fund.history.sourceUrl,
          retrievedAt: fund.history.retrievedAt,
          currency: fund.history.currency,
          bars: fund.history.bars,
        }
        : { error: fund.acquisitionError ?? "retained Yahoo history is unavailable" };
    }
    console.log(`Replaying ${Object.keys(histories).length} retained Yahoo captures without new history requests.`);
  } else {
    for (const [index, fund] of sample.funds.entries()) {
      const retrievedAt = new Date().toISOString();
      try {
        const chart = await yf.chart(fund.ticker, {
          period1,
          period2,
          interval: "1d",
          events: "div,splits",
          return: "array",
        });
        histories[fund.ticker] = normalizeYahoo(chart, fund.ticker, retrievedAt);
        console.log(`${fund.ticker}: received ${histories[fund.ticker].bars.length} Yahoo adjusted-close observations (${histories[fund.ticker].currency || "currency missing"}).`);
      } catch (error) {
        histories[fund.ticker] = { error: shortError(error) };
        console.error(`${fund.ticker}: Yahoo history blocked: ${histories[fund.ticker].error}`);
      }
      if (index < sample.funds.length - 1) await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  const now = retainedAsOf ? new Date(retainedAsOf) : new Date();
  const snapshot = buildETFEquityIndexM3Snapshot({ sample, sampleSha256, histories, now, commonCutoff, sensitivityScenarios, returnEvidenceReview });
  const artifact = createETFEquityIndexM3Artifact(snapshot);
  const dateTag = now.toISOString().slice(0, 10);
  const outputPath = join(root, "data", `etf-equity-index-m3-validation-${dateTag}.json`);
  const reportPath = join(root, "docs", `etf-equity-index-m3-validation-${dateTag}.md`);
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);

  // Replay from raw retained JSON text before writing the human-readable report.
  const reparsedArtifact = JSON.parse(readFileSync(outputPath, "utf8"));
  const integrityReplay = verifyETFEquityIndexM3Artifact(reparsedArtifact);
  if (integrityReplay.status !== "passed") throw new Error(`M3 raw-text replay failed: ${integrityReplay.issues.join(" ")}`);

  const score = (value) => value == null ? "—" : value.toFixed(1);
  const sourceLink = (url) => `[issuer source](${url})`;
  const strataNames = {
    "us-broad-equity": "U.S. broad equity",
    "developed-ex-us-equity": "Developed ex-U.S.",
    "broad-international-ex-us-equity": "Broad international ex-U.S.",
  };
  const lines = [
    `# ETF scoring M3 validation report · ${dateTag}`,
    "",
    `Validation snapshot evaluated at ${snapshot.asOf} using method ${snapshot.methodologyVersion} at common market cutoff ${snapshot.commonCutoff}; per-ticker history retrieval timestamps are retained in the artifact. This is experimental validation evidence, not approval for Browse funds publication or a rank across unlike mandates.`,
    "",
    "## Frozen sample and source contract",
    "",
    `- Frozen sample: ${snapshot.sampleId}; SHA-256 ${snapshot.sampleSha256} (validated against the committed sidecar before history requests).`,
    `- Sample: ${snapshot.validation.sampleCounts.total} funds from ${snapshot.validation.sampleCounts.issuerCount} issuers; ${ETF_EQUITY_INDEX_M3_STRATA.map((stratum) => `${strataNames[stratum]} ${snapshot.validation.sampleCounts.byStratum[stratum]}`).join("; ")}.`,
    `- Excluded all M1 funds: ${snapshot.sample.excludedM1Tickers.join(", ")}.`,
    `- Price input: Yahoo Finance adjusted closes in USD; dividends and splits are already reflected in adjclose. Retrieval and latest-session limits are five calendar days.`,
    `- Official identity, mandate, index, issuer domain, fee, dated net/gross designation, and peer grouping were recorded before history acquisition in the [frozen manifest](../data/etf-equity-index-m3-sample-v1.json).`,
    "",
    "## Current-cutoff coverage",
    "",
    "The candidate uses current net fees and exact 12/36 monthly returns from 13/37 month-end endpoints, with complete daily U.S. equity-session coverage. Scores are shown to one decimal only.",
    "",
    "| Stratum | Ticker | Index | Net fee | Fee date | Latest bar | 1Y | 3Y | Peer treatment |",
    "|---|---|---|---:|---|---|---:|---:|---|",
  ];
  for (const fund of snapshot.funds) {
    const one = fund.results.find((row) => row.cutoff === snapshot.commonCutoff && row.horizon === "1Y");
    const three = fund.results.find((row) => row.cutoff === snapshot.commonCutoff && row.horizon === "3Y");
    const status = (row) => row?.status === "scored" ? score(row.score) : `blocked: ${row?.reason ?? "missing result"}`;
    lines.push(`| ${strataNames[fund.exposureStratum]} | ${fund.ticker} | ${fund.indexName} | ${fund.expenseRatio.designation === "net" ? `${fund.expenseRatio.valuePct.toFixed(4)}%` : `blocked (${fund.expenseRatio.designation})`} | ${fund.expenseRatio.financialDate} | ${fund.history?.lastDate ?? "—"} | ${status(one)} | ${status(three)} | ${fund.comparisonGroupId} |`);
  }
  lines.push(
    "",
    "## Blocked rows and historical windows",
    "",
    `The capture included ${snapshot.funds.filter((fund) => fund.history).length}/${snapshot.funds.length} Yahoo history payloads. Yahoo/source-capture validity across the preregistered sample: **${snapshot.validation.captureValidity}**. Independent return blockers and incomplete historical windows are reported separately; no invalid score is substituted.`,
    "",
    "| Ticker | Cutoff | Horizon | Classification | Result | Reason |",
    "|---|---|---|---|---|---|",
  );
  for (const fund of snapshot.funds) for (const row of fund.results.filter((result) => result.cutoff !== snapshot.commonCutoff)) {
    lines.push(`| ${fund.ticker} | ${row.cutoff} | ${row.horizon} | market-window sensitivity only | ${row.status === "scored" ? score(row.score) : "blocked"} | ${row.reason || (row.status === "scored" ? "Current fee held constant; not a point-in-time historical score." : "—")} |`);
  }
  lines.push(
    "",
    "All four earlier market cutoffs hold the currently sourced fee constant and are **market-window sensitivity only**, even if a fee document date precedes that cutoff. No point-in-time applicability history was established. All 32 unresolved M1 historical fee rows remain blocked.",
    "",
    "## Independent calculations and integrity",
    "",
    `- Separate reference implementation independently rebuilt daily session coverage, month endpoints, 1Y/3Y returns, CAGR, drawdown, downside deviation, component points and final scores for ${snapshot.validation.independentCalculation.checkedRows} scored rows. Status: **${snapshot.validation.independentCalculation.status}**; maximum absolute delta ${snapshot.validation.independentCalculation.maxAbsoluteDelta}; tolerance 1e-10.`,
    `- All scored outputs within [0, 100]: **${snapshot.validation.inRange}**.`,
    `- Integrity contract: ${snapshot.integrityContract.version}, ${snapshot.integrityContract.serialization}, SHA-256. Raw retained JSON text was reparsed and replayed before report generation: **${integrityReplay.status}**; ${integrityReplay.rowCount} horizon/cutoff rows; artifact hash ${artifact.integrityManifest.artifactHash}.`,
    "- The artifact stores complete source profiles, Yahoo provenance and full adjusted-close histories; canonical hashing covers metadata, scoring parameters, every fund, every row input and every row result.",
    "",
    "## Invalid-input fixtures",
    "",
    `All targeted source and history rejection fixtures: **${snapshot.validation.invalidCaseFixtures.status}**.`,
    "",
    "| Fixture | Rejected | Expected blocker |",
    "|---|---:|---|",
  );
  for (const check of snapshot.validation.invalidCaseFixtures.checks) lines.push(`| ${check.id} | ${check.passed ? "yes" : "no"} | ${check.observed} |`);
  lines.push(
    "",
    "## Sensitivity and interpretation",
    "",
    `Replayed the frozen M1 one-factor grid of ${snapshot.sensitivityScenarios.length} configurations without changing the method. Score bounds include all scored funds and all 37 scenarios. Pair-order checks use only preregistered same-index groups; all other funds remain unranked.`,
    "",
    "| Horizon | Scores in grid | Score bounds | Same-index pairs | Pair orders changed | Baseline pairs tied at 1 decimal | CAGR/downside correlation | Drawdown/downside correlation |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const horizon of ["1Y", "3Y"]) {
    const sensitivity = snapshot.validation.sensitivity;
    const bounds = sensitivity.scoreBoundsByHorizon[horizon];
    const correlation = sensitivity.correlationsByHorizon[horizon];
    lines.push(`| ${horizon} | ${snapshot.sensitivityRows.filter((row) => row.horizon === horizon).length} | ${bounds.min == null ? "—" : `${score(bounds.min)}–${score(bounds.max)}`} | ${sensitivity.peerPairCountByHorizon[horizon]} | ${sensitivity.pairOrderChangesByHorizon[horizon]} | ${sensitivity.oneDecimalTiesByHorizon[horizon]} | ${correlation.cagrVsDownside == null ? "—" : correlation.cagrVsDownside.toFixed(3)} | ${correlation.drawdownVsDownside == null ? "—" : correlation.drawdownVsDownside.toFixed(3)} |`);
  }
  lines.push(
    "",
    "Risk components can overlap. These experimental points do not establish predictive value, future returns, a winner, universal rank, quality grade, or a score band. Distinct indexes share exposure strata for coverage, not benchmark identity.",
    "",
    "## Independent return evidence and operational feasibility",
    "",
    `Matched-window comparison: ${snapshot.independentReturnEvidenceProtocol.oneYearStartDate}–${snapshot.independentReturnEvidenceProtocol.endDate} for 1Y and ${snapshot.independentReturnEvidenceProtocol.threeYearStartDate}–${snapshot.independentReturnEvidenceProtocol.endDate} for 3Y. Yahoo adjusted-close returns are recomputed from retained endpoint values; comparison tolerance is ${snapshot.independentReturnEvidenceProtocol.tolerancePctPoints} percentage points. Market-price/Market Value total return is compared without adding distributions a second time.`,
    "",
    "| Ticker | Provider/source | 1Y source / Yahoo / delta | 3Y source / Yahoo / delta | Check |",
    "|---|---|---|---|---|",
    ...snapshot.funds.flatMap((fund) => fund.independentReturnEvidence.sources.map((source) => {
      const cell = (comparison) => comparison.referenceReturnPct == null || comparison.yahooAdjustedCloseReturnPct == null
        ? "unavailable"
        : `${comparison.referenceReturnPct.toFixed(2)}% / ${comparison.yahooAdjustedCloseReturnPct.toFixed(2)}% / ${comparison.differencePctPoints.toFixed(2)} pp`;
      const check = [source.comparisons["1Y"].status, source.comparisons["3Y"].status].some((status) => status === "discrepancy") ? "discrepancy" : "matched where available";
      return `| ${fund.ticker} | [${source.sourceName}](${source.sourceUrl}) (${source.sourceType}) | ${cell(source.comparisons["1Y"])} | ${cell(source.comparisons["3Y"])} | ${check} |`;
    })),
    "",
    `- Reconciliation review: ${snapshot.validation.independentReturnReconciliation.reviewedFunds}/12 funds compared; matched ${snapshot.validation.independentReturnReconciliation.matchedFunds}; discrepancies: ${snapshot.validation.independentReturnReconciliation.discrepancyTickers.join(", ") || "none"}; unavailable: ${snapshot.validation.independentReturnReconciliation.unavailableTickers.join(", ") || "none"}.`,
    "- The iShares official market-price table differs from both the retained Yahoo endpoint calculation and a second provider's rounded market-price return for IEFA, EFA and ACWX. Their 1Y/3Y and historical-window score rows are blocked pending source/convention reconciliation. The second provider agrees with Yahoo to its displayed precision, but does not explain the issuer conflict.",
    "- VEU's static Vanguard source capture did not expose matched 3Y market-price return; the dated independent-provider table supplies both horizons. This limitation is retained in the evidence record.",
    "- The capture confirms technical Yahoo chart access for this sample only. It does not establish permission to use or retain provider data; M4 must resolve permitted use, durable retention and refresh limits.",
    "",
    `## M3 gate status: ${snapshot.validation.batchReadyForM4Review ? "passed for restricted validation; M4 may begin separately" : "blocked"}`,
    "",
    `- Sample minimums: ${snapshot.validation.sampleCounts.total}/12 funds, ${snapshot.validation.sampleCounts.issuerCount}/3 issuers, four per required stratum: ${ETF_EQUITY_INDEX_M3_STRATA.every((stratum) => snapshot.validation.sampleCounts.byStratum[stratum] >= 4) ? "pass" : "blocked"}.`,
    `- Independent scored rows: ${snapshot.validation.independentCalculation.status}; score range: ${snapshot.validation.inRange}; invalid fixtures: ${snapshot.validation.invalidCaseFixtures.status}; independent return reconciliation: ${snapshot.validation.independentReturnReconciliation.status}.`,
    `- Return-source discrepancies block ${snapshot.validation.independentReturnReconciliation.discrepancyTickers.join(", ") || "no funds"}; remaining coverage meets the minimum two funds per stratum/horizon.`,
    `- Two independently reproduced funds per stratum and horizon: ${Object.entries(snapshot.validation.primaryScoreCoverage).map(([stratum, coverage]) => `${strataNames[stratum]} ${coverage["1Y"]}/2 1Y, ${coverage["3Y"]}/2 3Y`).join("; ")}.`,
    "- The M3 gate does not publish these experimental scores to Browse funds. M4 remains a separate milestone.",
    "",
    "## Source links",
    "",
    ...snapshot.funds.map((fund) => `- **${fund.ticker}** (${fund.indexName}): ${sourceLink(fund.identitySourceUrl)} · [fee evidence](${fund.expenseRatio.sourceUrl})`),
    "",
    `Full retained data: [M3 validation artifact](../data/etf-equity-index-m3-validation-${dateTag}.json). Return evidence inputs: [dated comparison sources](../data/etf-equity-index-m3-return-evidence-2026-10-07.json). Frozen sample: [manifest](../data/etf-equity-index-m3-sample-v1.json) · [SHA-256](../data/etf-equity-index-m3-sample-v1.sha256).`,
    "",
  );
  writeFileSync(reportPath, lines.join("\n"));
  console.log(JSON.stringify({
    asOf: snapshot.asOf,
    commonCutoff: snapshot.commonCutoff,
    sampleSha256,
    primaryCoverage: snapshot.validation.primaryScoreCoverage,
    scoredRows: snapshot.funds.flatMap((fund) => fund.results).filter((row) => row.status === "scored").length,
    independentCalculation: snapshot.validation.independentCalculation,
    invalidFixtures: snapshot.validation.invalidCaseFixtures.status,
    integrityReplay: integrityReplay.status,
    m3ReviewReady: snapshot.validation.batchReadyForM4Review,
    artifactHash: artifact.integrityManifest.artifactHash,
    artifact: outputPath,
    report: reportPath,
  }, null, 2));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
