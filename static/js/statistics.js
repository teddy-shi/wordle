import { MAX_GUESSES } from "./game.js";

export const STATISTICS_KEY = "wordle.statistics.v1";

export function createStatistics() {
  return {
    played: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: Array(MAX_GUESSES).fill(0),
  };
}

export function recordResult(statistics, status, guesses) {
  if (status !== "won" && status !== "lost") return statistics;
  const distribution = [...statistics.distribution];
  const currentStreak = status === "won" ? statistics.currentStreak + 1 : 0;
  if (status === "won") distribution[guesses - 1]++;
  return {
    played: statistics.played + 1,
    currentStreak,
    maxStreak: Math.max(statistics.maxStreak, currentStreak),
    distribution,
  };
}

export function winRate(statistics) {
  const wins = statistics.distribution.reduce(
    (total, count) => total + count,
    0,
  );
  return statistics.played ? Math.round((wins / statistics.played) * 100) : 0;
}

export function loadStatistics(storage) {
  try {
    const saved = JSON.parse(
      (storage ?? globalThis.localStorage).getItem(STATISTICS_KEY),
    );
    const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
    if (
      saved &&
      [saved.played, saved.currentStreak, saved.maxStreak].every(isCount) &&
      Array.isArray(saved.distribution) &&
      saved.distribution.length === MAX_GUESSES &&
      saved.distribution.every(isCount)
    ) {
      const wins = saved.distribution.reduce(
        (total, count) => total + count,
        0,
      );
      if (
        wins <= saved.played &&
        saved.currentStreak <= saved.maxStreak &&
        saved.maxStreak <= wins
      ) {
        return saved;
      }
    }
  } catch {
    // Missing or invalid browser storage falls back to empty statistics.
  }
  return createStatistics();
}

export function saveStatistics(statistics, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(
      STATISTICS_KEY,
      JSON.stringify(statistics),
    );
    return true;
  } catch {
    return false;
  }
}
