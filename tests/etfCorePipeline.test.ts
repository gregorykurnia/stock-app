import assert from "node:assert/strict";
import test from "node:test";
import { ETF_CATALOG } from "../lib/etfCatalog";
import {
  buildETFCoreAssessments,
  buildETFCoreMarketWindow,
  coreSourceReadiness,
  isUsEquityTradingSession,
  normalizeIssuerSpreadPctToBps,
  validateETFCoreIssuerInput,
} from "../lib/etfCorePipeline";
import type { TiingoDailyBar } from "../lib/etfTiingo";

function sessionBars(startDate: string, endDate: string): TiingoDailyBar[] {
  const result: TiingoDailyBar[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (isUsEquityTradingSession(date)) {
      const adjustedClose = 100 + result.length / 10;
      result.push({ date, close: adjustedClose, adjustedClose, dividendCash: 0, splitFactor: 1 });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

test("US market session calendar excludes observed closures and Good Friday", () => {
  assert.equal(isUsEquityTradingSession("2025-01-09"), false);
  assert.equal(isUsEquityTradingSession("2024-03-29"), false);
  assert.equal(isUsEquityTradingSession("2026-09-30"), true);
});

test("Core windows use exactly 36 or 12 monthly returns and adjusted closes", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const bars = sessionBars("2023-09-01", "2026-10-02");
  const threeYear = buildETFCoreMarketWindow(bars, "3Y", now);
  const oneYear = buildETFCoreMarketWindow(bars, "1Y", now);

  assert.equal(threeYear.cutoff, "2026-09-30");
  assert.equal(threeYear.monthlyReturns.length, 36);
  assert.equal(threeYear.monthEndDates.length, 37);
  assert.equal(threeYear.complete, true);
  assert.equal(threeYear.missingSessionDates.length, 0);
  assert.equal(threeYear.maxDrawdownMagnitudePct, 0);
  assert.equal(oneYear.monthlyReturns.length, 12);
  assert.equal(oneYear.monthEndDates.length, 13);
  assert.equal(oneYear.complete, true);
});

test("Core history rejects a missing expected trading session and a missing month-end", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const bars = sessionBars("2023-09-01", "2026-10-02");
  const missingSession = bars.filter((bar) => bar.date !== "2024-06-14");
  const missingMonthEnd = bars.filter((bar) => bar.date !== "2025-06-30");

  const incompleteSessions = buildETFCoreMarketWindow(missingSession, "3Y", now);
  const incompleteMonthEnd = buildETFCoreMarketWindow(missingMonthEnd, "3Y", now);
  assert.equal(incompleteSessions.complete, false);
  assert.ok(incompleteSessions.missingSessionDates.includes("2024-06-14"));
  assert.equal(incompleteMonthEnd.complete, false);
  assert.equal(incompleteMonthEnd.monthEndDates.length, 36);
});

test("issuer inputs validate and normalize spread percentages to basis points", () => {
  assert.deepEqual(validateETFCoreIssuerInput("VOO"), []);
  assert.deepEqual(validateETFCoreIssuerInput("VTI"), []);
  assert.deepEqual(validateETFCoreIssuerInput("VXUS"), []);
  assert.equal(validateETFCoreIssuerInput("SPY").length, 1);
  assert.equal(normalizeIssuerSpreadPctToBps(0.01), 1);
  assert.equal(normalizeIssuerSpreadPctToBps(0.004), 0.4);
  assert.equal(normalizeIssuerSpreadPctToBps(-0.01), null);
});

test("issuer sample spreads remain stale under the two-day rule and cannot publish scores", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const readiness = coreSourceReadiness(now);
  assert.equal(readiness.length, 3);
  assert.ok(readiness.every((input) => input.feeFresh));
  assert.ok(readiness.every((input) => !input.spreadFresh));

  const record = ETF_CATALOG.find((item) => item.ticker === "VTI");
  assert.ok(record);
  const assessments = buildETFCoreAssessments({
    record,
    bars: sessionBars("2023-09-01", "2026-10-02"),
    now,
    runId: "fixture-run",
    historyHash: "fixture-hash",
  });
  const core3Y = assessments.find((assessment) => assessment.kind === "core" && assessment.horizon === "3Y");
  const costOnly = assessments.find((assessment) => assessment.kind === "cost-only");
  assert.equal(core3Y?.status, "staleInput");
  assert.equal(core3Y?.score, null);
  assert.match(core3Y?.reason ?? "", /spread disclosure is stale/i);
  assert.equal(costOnly?.status, "staleInput");
  assert.equal(costOnly?.score, null);
});
