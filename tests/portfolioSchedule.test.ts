import test from "node:test";
import assert from "node:assert/strict";
import { newYorkMarketContext } from "../lib/portfolioSchedule";

test("20:15 UTC is after the New York close buffer during daylight saving time", () => {
  const context = newYorkMarketContext(new Date("2026-07-10T20:15:00.000Z"));
  assert.equal(context.sessionDate, "2026-07-10");
  assert.equal(context.isAfterCloseBuffer, true);
});

test("20:15 UTC is before close in winter and 21:15 UTC is after it", () => {
  assert.equal(newYorkMarketContext(new Date("2026-12-10T20:15:00.000Z")).isAfterCloseBuffer, false);
  assert.equal(newYorkMarketContext(new Date("2026-12-10T21:15:00.000Z")).isAfterCloseBuffer, true);
});

test("weekends are not eligible market sessions", () => {
  assert.equal(newYorkMarketContext(new Date("2026-09-12T20:15:00.000Z")).isWeekday, false);
});
