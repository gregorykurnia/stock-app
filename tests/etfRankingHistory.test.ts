import assert from "node:assert/strict";
import test from "node:test";
import { barsThrough, groupBarsByYear, rankingBarsFrom } from "../lib/etfRankingHistory";
import type { TiingoDailyBar } from "../lib/etfTiingoParse";

const bar = (date: string, close = 100, volume = 1_000): TiingoDailyBar => ({
  date,
  close,
  adjustedClose: close,
  volume,
  dividendCash: 0,
  splitFactor: 1,
});

test("years: bars are grouped by calendar year, in year order, with nothing dropped", () => {
  const docs = groupBarsByYear("VOO", [bar("2010-12-31"), bar("2011-01-03"), bar("2011-01-04")], "2026-10-10T00:00:00.000Z");
  assert.deepEqual(docs.map((doc) => [doc.year, doc.bars.length]), [[2010, 1], [2011, 2]]);
  assert.equal(docs[0].ticker, "VOO");
  assert.equal(docs[0].sourceId, "tiingo-eod-full");
});

test("years: volume is kept on every stored bar", () => {
  const [doc] = groupBarsByYear("VOO", [bar("2011-01-03", 99, 4_321)], "2026-10-10T00:00:00.000Z");
  assert.deepEqual(doc.bars, [{ date: "2011-01-03", close: 99, adjustedClose: 99, volume: 4_321 }]);
});

test("rebuild: stored years come back as one date-ordered series", () => {
  const docs = groupBarsByYear("VOO", [bar("2012-01-03"), bar("2011-06-01"), bar("2013-02-01")], "2026-10-10T00:00:00.000Z");
  assert.deepEqual(rankingBarsFrom([...docs].reverse()).map((item) => item.date), ["2011-06-01", "2012-01-03", "2013-02-01"]);
});

test("cutoff: bars after the cutoff are left out, the cutoff day is kept", () => {
  const series = rankingBarsFrom(groupBarsByYear("VOO", [bar("2026-09-29"), bar("2026-09-30"), bar("2026-10-01")], "2026-10-10T00:00:00.000Z"));
  assert.deepEqual(barsThrough(series, "2026-09-30").map((item) => item.date), ["2026-09-29", "2026-09-30"]);
});
