import test from "node:test";
import assert from "node:assert/strict";
import { groupListTrialEpisodes, type ListTrialEpisodeObservation } from "../lib/listTrialEpisodes";
import { calculateListTrialEvidenceAt } from "../lib/listTrialEvidence";
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

function observations(qualifyingIndexes: number[], total = 15): ListTrialEpisodeObservation[] {
  return Array.from({ length: total }, (_, index) => ({
    date: `2024-01-${String(index + 1).padStart(2, "0")}`,
    qualifyingDay: qualifyingIndexes.includes(index) ? {
      date: `2024-01-${String(index + 1).padStart(2, "0")}`,
      score: 60 + index,
      anchors: {
        allTimeHigh: 100 + index,
        currentRollingLow: { date: "2023-12-20", index: 10, close: 50 + index },
        priorSellingLow: { date: "2023-10-20", index: 1, close: 70 },
      },
    } : null,
  }));
}

test("episode grouping collapses consecutive qualifying days and freezes the first trigger", () => {
  const source = observations([1, 2, 3]);
  const episodes = groupListTrialEpisodes(source);
  assert.deepEqual(episodes, [{
    triggerDate: "2024-01-02",
    triggerScore: 61,
    triggerAnchors: { allTimeHigh: 101, currentRollingLow: { date: "2023-12-20", index: 10, close: 51 }, priorSellingLow: { date: "2023-10-20", index: 1, close: 70 } },
    firstQualifyingDate: "2024-01-02",
    lastQualifyingDate: "2024-01-04",
    qualifyingDayCount: 3,
  }]);
  source[1].qualifyingDay!.anchors.currentRollingLow!.close = 0;
  assert.equal(episodes[0].triggerAnchors.currentRollingLow!.close, 51);
});

test("episode grouping re-arms only after ten consecutive non-qualifying trading days", () => {
  assert.equal(groupListTrialEpisodes(observations([0, 10], 11)).length, 1);
  const episodes = groupListTrialEpisodes(observations([0, 11], 12));
  assert.equal(episodes.length, 2);
  assert.equal(episodes[1].triggerDate, "2024-01-12");
});

test("episode grouping emits a trailing active episode", () => {
  const episodes = groupListTrialEpisodes(observations([14]));
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].lastQualifyingDate, "2024-01-15");
});

test("evidence trigger score and anchors are prefix-stable when future bars are appended", () => {
  const base = bars(150);
  const extended = [...base, ...bars(20).map((bar, index) => ({ ...bar, date: `2024-06-${String(index + 1).padStart(2, "0")}`, time: 1_717_200_000 + index * 86_400, close: 150, open: 150, high: 151, low: 149 }))];
  const index = 140;
  const baseEvidence = calculateListTrialEvidenceAt(base, index)!;
  const extendedEvidence = calculateListTrialEvidenceAt(extended, index)!;
  assert.notEqual(baseEvidence.score.score, null);
  assert.notEqual(extendedEvidence.score.score, null);
  const episodeFrom = (evidence: typeof baseEvidence) => groupListTrialEpisodes([{
    date: evidence.date,
    qualifyingDay: { date: evidence.date, score: evidence.score.score!, anchors: evidence.anchors },
  }])[0];
  assert.deepEqual(
    episodeFrom(extendedEvidence),
    episodeFrom(baseEvidence)
  );
});

test("replay exposes raw qualifying days separately from grouped episodes", () => {
  const replay = calculateListTrialReplay(bars(180), "2024-05-01", "2024-05-29", 55);
  assert.ok(replay.rawQualifyingDayCount >= replay.episodeCount);
  assert.equal(replay.episodes.length, replay.episodeCount);
  assert.equal(replay.signals.length, replay.episodeCount);
  for (const episode of replay.episodes) {
    assert.equal(episode.triggerDate, episode.date);
    assert.equal(episode.triggerScore, episode.score);
    assert.ok(episode.qualifyingDayCount >= 1);
    assert.ok(episode.entryPlan == null || episode.entryPlan.triggerDate === episode.triggerDate);
  }
});

test("replay bands count entered episodes and keep non-entered states outside outcomes", () => {
  const replay = calculateListTrialReplay(bars(180), "2024-05-01", "2024-05-29", 55);
  const entered = replay.episodes.filter((episode) => episode.entry.status === "entered").length;
  const bandEntered = replay.bands.reduce((sum, band) => sum + band.total, 0);
  assert.equal(bandEntered, entered);
  for (const episode of replay.episodes) {
    if (episode.entry.status !== "entered") {
      assert.equal(episode.primaryOutcome, "not_entered");
      assert.equal(episode.daysToTarget, null);
    }
  }
});
