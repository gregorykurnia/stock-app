import test from "node:test";
import assert from "node:assert/strict";
import { changeBp, findCloseOnOrBefore, periodReturnPct, positionInRange, previousCloseFromBars, trendFromCloses } from "../lib/markets/calc";
import { classifyRegimes } from "../lib/markets/regime";
import { buildCrossMarketSignals } from "../lib/markets/signals";
import type { MarketInstrument } from "../lib/markets/types";

function instrument(id: string, overrides: Partial<MarketInstrument> = {}): MarketInstrument {
  return {
    id, symbol: id.toUpperCase(), name: id, shortName: id, category: "us-equities",
    instrumentType: "index", currency: "USD", unit: "Index points", price: 100,
    previousClose: 99, change: 1, changePct: 1.0101, return1w: 2, return1m: 4,
    returnYtd: 8, high52w: 110, low52w: 80, position52w: 66.67, ma20: 98,
    ma50: 95, trend: "rising", timestamp: "2026-09-11T16:00:00.000Z", sparkline: [],
    ...overrides,
  };
}

test("period returns use the nearest prior trading close", () => {
  const bars = [{ date: "2026-09-01", close: 100 }, { date: "2026-09-04", close: 105 }, { date: "2026-09-08", close: 110 }];
  assert.deepEqual(findCloseOnOrBefore(bars, "2026-09-06"), bars[1]);
  assert.equal(periodReturnPct(bars, "2026-09-06"), (110 / 105 - 1) * 100);
  assert.equal(previousCloseFromBars(bars), 105);
});

test("range position rejects a flat range and calculates a valid position", () => {
  assert.equal(positionInRange(100, 100, 100), null);
  assert.equal(positionInRange(75, 50, 100), 50);
});

test("trend requires price and a rising or falling 20-day average to agree", () => {
  assert.equal(trendFromCloses(Array.from({ length: 21 }, (_, index) => 80 + index)), "rising");
  assert.equal(trendFromCloses(Array.from({ length: 21 }, (_, index) => 120 - index)), "falling");
  assert.equal(trendFromCloses(Array(20).fill(100)), "unavailable");
});

test("yield change converts percentage points to basis points", () => {
  assert.equal(changeBp(4.95, 4.8), 15.000000000000036);
});

test("regimes return unavailable when their required inputs are missing", () => {
  const cards = classifyRegimes({});
  assert.equal(cards.length, 4);
  assert.ok(cards.every((card) => card.state === "unavailable"));
});

test("regime classification exposes its source signals", () => {
  const map: Record<string, MarketInstrument> = {
    sp500: instrument("sp500"), russell2000: instrument("russell2000", { return1m: 6 }),
    vix: instrument("vix", { price: 14, return1w: -8 }), dxy: instrument("dxy", { return1m: -2 }),
    hyg: instrument("hyg", { price: 80, return1m: 3 }), lqd: instrument("lqd", { price: 100, return1m: 1 }),
  };
  const risk = classifyRegimes(map)[0];
  assert.notEqual(risk.state, "unavailable");
  assert.ok(risk.signals.length >= 3);
});

test("cross-market signals compute oil and precious-metal relationships", () => {
  const map: Record<string, MarketInstrument> = {
    brent: instrument("brent", { price: 85 }), wti: instrument("wti", { price: 80 }),
    gold: instrument("gold", { price: 2400 }), silver: instrument("silver", { price: 30 }),
  };
  const signals = buildCrossMarketSignals(map);
  assert.equal(signals.find((signal) => signal.key === "brent-wti-spread")?.value, "$5.00");
  assert.equal(signals.find((signal) => signal.key === "gold-silver-ratio")?.value, "80.0");
});
