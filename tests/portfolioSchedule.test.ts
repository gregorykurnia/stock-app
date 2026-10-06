import test from "node:test";
import assert from "node:assert/strict";
import { newYorkMarketContext, completedSessionCutoff, sessionEndTimestamp } from "../lib/portfolioSchedule";

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

test("overnight and pre-close retries retain the previous completed session cutoff", () => {
  assert.equal(completedSessionCutoff(new Date("2026-10-06T05:00:00Z")), "2026-10-05");
  assert.equal(completedSessionCutoff(new Date("2026-10-06T20:09:00Z")), "2026-10-05");
  assert.equal(completedSessionCutoff(new Date("2026-10-06T20:10:00Z")), "2026-10-06");
  assert.equal(completedSessionCutoff(new Date("2026-12-10T20:15:00Z")), "2026-12-09");
});

test("historical ledger cutoff includes late New York transactions in summer and winter", () => {
  assert.equal(sessionEndTimestamp("2026-10-05"), "2026-10-06T03:59:59.999Z");
  assert.equal(sessionEndTimestamp("2026-12-10"), "2026-12-11T04:59:59.999Z");
});
