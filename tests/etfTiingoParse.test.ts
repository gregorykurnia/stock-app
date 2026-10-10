import assert from "node:assert/strict";
import test from "node:test";
import { parseTiingoDailyBars } from "../lib/etfTiingoParse";

function row(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-10-08T00:00:00.000Z",
    close: 711.28,
    adjClose: 711.28,
    volume: 4_763_330,
    adjVolume: 4_763_330,
    divCash: 0,
    splitFactor: 1,
    ...overrides,
  };
}

test("parser keeps the raw session volume with close and adjusted close", () => {
  const result = parseTiingoDailyBars([row()]);
  assert.deepEqual("bars" in result && result.bars, [
    { date: "2026-10-08", close: 711.28, adjustedClose: 711.28, volume: 4_763_330, dividendCash: 0, splitFactor: 1 },
  ]);
});

test("parser sorts by date and rejects duplicate session dates", () => {
  const sorted = parseTiingoDailyBars([row({ date: "2026-10-08T00:00:00.000Z" }), row({ date: "2026-10-07T00:00:00.000Z" })]);
  assert.deepEqual("bars" in sorted && sorted.bars.map((bar) => bar.date), ["2026-10-07", "2026-10-08"]);
  assert.deepEqual(parseTiingoDailyBars([row(), row()]), { error: "Tiingo EOD response contains duplicate session dates." });
});

test("parser rejects a bar with no volume rather than storing it without one", () => {
  const withoutVolume = { ...row(), volume: undefined };
  assert.deepEqual(parseTiingoDailyBars([withoutVolume]), { error: "Tiingo EOD response contains a malformed daily bar." });
});

test("parser accepts a zero-volume session and rejects negative volume", () => {
  assert.equal("bars" in parseTiingoDailyBars([row({ volume: 0 })]), true);
  assert.deepEqual(parseTiingoDailyBars([row({ volume: -1 })]), { error: "Tiingo EOD response contains a malformed daily bar." });
});

test("parser rejects a non-array payload", () => {
  assert.deepEqual(parseTiingoDailyBars({ detail: "Not found" }), { error: "Tiingo EOD response did not contain a daily-bar array." });
});
