import test from "node:test";
import assert from "node:assert/strict";
import {
  createStatistics,
  recordResult,
  winRate,
  loadStatistics,
  saveStatistics,
  STATISTICS_KEY,
} from "../static/js/statistics.js";

test("new players have zero statistics and a six-row empty distribution", () => {
  const statistics = createStatistics();
  assert.equal(statistics.played, 0);
  assert.equal(winRate(statistics), 0);
  assert.deepEqual(statistics.distribution, [0, 0, 0, 0, 0, 0]);
});

test("wins update the matching guess row, streaks, and win rate", () => {
  const original = createStatistics();
  let statistics = recordResult(original, "won", 1);
  statistics = recordResult(statistics, "won", 6);
  statistics = recordResult(statistics, "won", 6);
  assert.equal(statistics.played, 3);
  assert.equal(statistics.currentStreak, 3);
  assert.equal(statistics.maxStreak, 3);
  assert.equal(winRate(statistics), 100);
  assert.deepEqual(statistics.distribution, [1, 0, 0, 0, 0, 2]);
  assert.deepEqual(original, createStatistics());
});

test("losses count as played and reset current streak while preserving maximum", () => {
  let statistics = recordResult(createStatistics(), "won", 3);
  statistics = recordResult(statistics, "won", 2);
  statistics = recordResult(statistics, "lost", 6);
  assert.equal(statistics.played, 3);
  assert.equal(winRate(statistics), 67);
  assert.equal(statistics.currentStreak, 0);
  assert.equal(statistics.maxStreak, 2);
  assert.deepEqual(statistics.distribution, [0, 1, 1, 0, 0, 0]);
  statistics = recordResult(statistics, "won", 5);
  assert.equal(statistics.currentStreak, 1);
  assert.equal(statistics.maxStreak, 2);
});

test("unfinished games do not affect statistics", () => {
  const statistics = createStatistics();
  for (const status of ["loading", "playing", "revealing", "error"]) {
    assert.equal(recordResult(statistics, status, 2), statistics);
  }
});

test("statistics survive a storage round trip", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.deepEqual(loadStatistics(storage), createStatistics());
  const statistics = recordResult(createStatistics(), "won", 4);
  assert.equal(saveStatistics(statistics, storage), true);
  assert.ok(values.has(STATISTICS_KEY));
  assert.deepEqual(loadStatistics(storage), statistics);
});

test("invalid stored data or unavailable storage does not break the game", () => {
  const invalid = [
    "not json",
    "null",
    "{}",
    JSON.stringify({
      played: -1,
      currentStreak: 0,
      maxStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0],
    }),
    JSON.stringify({
      played: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: [1, 0, 0, 0, 0, 0],
    }),
  ];
  for (const value of invalid) {
    assert.deepEqual(
      loadStatistics({ getItem: () => value }),
      createStatistics(),
    );
  }
  const blocked = {
    getItem() {
      throw new Error("Storage blocked");
    },
    setItem() {
      throw new Error("Storage blocked");
    },
  };
  assert.deepEqual(loadStatistics(blocked), createStatistics());
  assert.equal(saveStatistics(createStatistics(), blocked), false);
});
