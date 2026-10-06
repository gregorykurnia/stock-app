import assert from "node:assert/strict";
import test from "node:test";
import { calculateETFMetrics, type ETFPriceBar } from "../lib/etfMetricCalculations";
import type { ETFMetricSnapshot } from "../lib/etfCatalog";
import { preferredETFTableReturn } from "../lib/etfReturnDisplay";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.2425 * DAY_MS;

function dailyBars(startDate: string, endDate: string): ETFPriceBar[] {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const bars: ETFPriceBar[] = [];
  for (let timestamp = start; timestamp <= end; timestamp += DAY_MS) {
    const elapsedYears = (timestamp - start) / YEAR_MS;
    const adjustedClose = 100 * 1.1 ** elapsedYears;
    bars.push({
      date: new Date(timestamp).toISOString().slice(0, 10),
      close: adjustedClose,
      adjustedClose,
    });
  }
  return bars;
}

function metricsFromHistory(startDate: string, endDate: string) {
  return calculateETFMetrics({
    ticker: "TEST",
    bars: dailyBars(startDate, endDate),
    distributions: [],
    distributionEventsAvailable: true,
    currency: "USD",
    observedAt: endDate,
  });
}

function snapshotWith(values: ETFMetricSnapshot["values"], sinceInceptionReturn?: ETFMetricSnapshot["sinceInceptionReturn"]): ETFMetricSnapshot {
  return {
    ticker: "TEST",
    values,
    states: {},
    sinceInceptionReturn,
    holdings: [],
    source: "test",
    currency: "USD",
    observedAt: "2026-06-01",
    lastAttemptAt: "2026-06-01",
  };
}

test("uses the 5Y CAGR when it is available", () => {
  const snapshot = metricsFromHistory("2020-06-01", "2026-06-01");
  const selected = preferredETFTableReturn(snapshot);

  assert.equal(selected.metricKey, "cagr5Y");
  assert.equal(selected.periodLabel, "5Y CAGR");
  assert.equal(typeof snapshot.values.cagr5Y, "number");
});

test("falls back to 3Y CAGR when a fund has between three and five years of history", () => {
  const snapshot = metricsFromHistory("2022-06-01", "2026-06-01");
  const selected = preferredETFTableReturn(snapshot);

  assert.equal(snapshot.values.cagr5Y, undefined);
  assert.equal(typeof snapshot.values.cagr3Y, "number");
  assert.equal(selected.metricKey, "cagr3Y");
  assert.equal(selected.periodLabel, "3Y CAGR");
});

test("uses since-inception CAGR for a fund with at least one year but less than three years of history", () => {
  const snapshot = metricsFromHistory("2024-06-01", "2026-06-01");
  const selected = preferredETFTableReturn(snapshot);

  assert.equal(snapshot.values.cagr3Y, undefined);
  assert.equal(snapshot.sinceInceptionReturn?.annualized, true);
  assert.equal(selected.metricKey, "cagr5Y");
  assert.equal(selected.periodLabel, "Since inception CAGR");
  assert.equal(selected.valueOverride, 10);
});

test("treats a full 365-day history as at least one year", () => {
  const snapshot = metricsFromHistory("2025-06-01", "2026-06-01");
  const selected = preferredETFTableReturn(snapshot);

  assert.equal(snapshot.sinceInceptionReturn?.annualized, true);
  assert.equal(selected.periodLabel, "Since inception CAGR");
});

test("uses since-inception total return for a fund with less than one year of history", () => {
  const snapshot = metricsFromHistory("2025-10-01", "2026-06-01");
  const selected = preferredETFTableReturn(snapshot);

  assert.equal(snapshot.sinceInceptionReturn?.annualized, false);
  assert.equal(selected.metricKey, "totalReturn1Y");
  assert.equal(selected.periodLabel, "Since inception total return");
  assert.ok(typeof selected.valueOverride === "number" && selected.valueOverride > 0);
});

test("keeps identity-warning funds out of the fallback calculation", () => {
  const snapshot = snapshotWith({ cagr5Y: 12, cagr3Y: 15 });
  const selected = preferredETFTableReturn(snapshot, "Confirm fund identity");

  assert.equal(selected.metricKey, "cagr5Y");
  assert.equal(selected.valueOverride, undefined);
  assert.equal(selected.periodLabel, "Identity review");
});
