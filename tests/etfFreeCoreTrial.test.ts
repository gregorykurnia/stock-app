import assert from "node:assert/strict";
import test from "node:test";
import { isUsEquityTradingSession } from "../lib/etfCorePipeline";
import { calculateETFFreeCoreTrial, type ETFFreeCoreTrialHistory } from "../lib/etfFreeCoreTrial";

const now = new Date("2026-10-07T12:00:00Z");
function history(): ETFFreeCoreTrialHistory {
  const bars: ETFFreeCoreTrialHistory["bars"] = [];
  const cursor = new Date("2023-09-01T00:00:00Z");
  while (cursor <= new Date("2026-10-06T00:00:00Z")) {
    const date = cursor.toISOString().slice(0, 10);
    if (isUsEquityTradingSession(date)) bars.push({ date, close: 100, adjustedClose: 100 * Math.exp(bars.length * 0.0004), dividendCash: 0, splitFactor: 1 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { provider: "Yahoo Finance", sourceId: "fixture:yahoo", sourceUrl: "https://finance.yahoo.com/quote/VOO/history/", retrievedAt: now.toISOString(), currency: "USD", bars };
}
function calculate(input: ETFFreeCoreTrialHistory) {
  return calculateETFFreeCoreTrial({ ticker: "VOO", history: input, historyHash: "fixture", now });
}

test("Free Core trial reproduces the fixed formula from adjusted prices without a spread", () => {
  const input = history();
  const snapshot = calculate(input);
  for (const result of snapshot.results) {
    assert.equal(result.status, "trial");
    const start = input.bars.find((bar) => bar.date === result.window.startDate)!;
    const end = input.bars.find((bar) => bar.date === result.window.cutoff)!;
    const years = (Date.parse(end.date) - Date.parse(start.date)) / (365.2425 * 86_400_000);
    const cagr = ((end.adjustedClose / start.adjustedClose) ** (1 / years) - 1) * 100;
    const growth = 100 / (1 + Math.exp(-(cagr - 8) / 4));
    const historical = 100 * (growth / 100) ** 0.4;
    const feePoints = 100 * Math.exp(-0.03 / 0.5);
    const expected = (0.3 * feePoints + 0.4 * historical) / 0.7;
    assert.ok(Math.abs(result.score! - expected) < 1e-10);
    assert.equal(result.historicalComponents.downside.inputValue, 0);
    assert.equal(result.window.maxDrawdownMagnitudePct, 0);
    assert.equal(result.window.monthlyReturns.length, result.horizon === "3Y" ? 36 : 12);
    assert.equal(result.window.cutoff, "2026-09-30");
  }
  const rawPriceChange = { ...input, bars: input.bars.map((bar, index) => ({ ...bar, close: 50 + index * 3 })) };
  assert.deepEqual(calculate(rawPriceChange).results.map((result) => result.score), snapshot.results.map((result) => result.score));
  assert.deepEqual(calculate({ ...input, bars: [...input.bars].reverse() }).results, snapshot.results);
});

test("trial refuses incomplete windows, duplicate dates, malformed prices, wrong currency and stale retrieval", () => {
  const base = history();
  const cases = [
    { ...base, bars: base.bars.filter((bar) => bar.date !== "2026-06-15") },
    { ...base, bars: [...base.bars, base.bars[0]] },
    { ...base, bars: base.bars.map((bar, index) => index === 0 ? { ...bar, adjustedClose: Number.NaN } : bar) },
    { ...base, bars: base.bars.map((bar, index) => index === 0 ? { ...bar, date: "2026-99-01" } : bar) },
    { ...base, currency: "EUR" },
    { ...base, retrievedAt: "2026-09-20T00:00:00Z" },
    { ...base, retrievedAt: "2026-10-08T00:00:00Z" },
  ];
  for (const input of cases) assert.ok(calculate(input).results.every((result) => result.score == null && result.status === "unavailable"));
});

test("worse historical outcomes reduce the trial score and output stays bounded", () => {
  const base = history();
  const declining = { ...base, bars: base.bars.map((bar, index) => ({ ...bar, adjustedClose: 100 * Math.exp(-index * 0.0004) })) };
  const strong = calculate(base);
  const weak = calculate(declining);
  for (let index = 0; index < strong.results.length; index++) {
    assert.ok(weak.results[index].score! < strong.results[index].score!);
    assert.ok(weak.results[index].score! >= 0 && strong.results[index].score! <= 100);
  }
});
