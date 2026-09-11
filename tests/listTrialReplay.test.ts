import test from "node:test";
import assert from "node:assert/strict";
import { calculateListTrialReplay, type ListTrialReplayBar } from "../lib/listTrialReplay";

function bars(length: number): ListTrialReplayBar[] {
  const start = new Date("2024-01-01T00:00:00.000Z");
  return Array.from({ length }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const close = index < 100 ? 100 + index * 0.1 : index < 120 ? 70 - (index - 100) * 0.5 : 58 - (index - 120) * 0.2;
    return { date, time: Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000), open: close, high: close + 1, low: close - 1, close, volume: 1_000_000 };
  });
}

test("replay score dates and values do not change when future bars are appended", () => {
  const base = bars(150);
  const extended = [...base, ...bars(20).map((bar, index) => ({ ...bar, date: `2024-06-${String(index + 1).padStart(2, "0")}`, time: Math.floor(new Date(`2024-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`).getTime() / 1000), close: 150, open: 150, high: 151, low: 149 }))];
  const start = "2024-05-01";
  const end = "2024-05-29";
  const baseReplay = calculateListTrialReplay(base, start, end, 0);
  const extendedReplay = calculateListTrialReplay(extended, start, end, 0);
  assert.ok(baseReplay.signals.length > 0);
  assert.deepEqual(
    extendedReplay.signals.map((signal) => ({ date: signal.date, score: signal.score })),
    baseReplay.signals.map((signal) => ({ date: signal.date, score: signal.score }))
  );
});
