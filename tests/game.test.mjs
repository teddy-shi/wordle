import test from "node:test";
import assert from "node:assert/strict";
import {
  parseWords,
  scoreGuess,
  createGame,
  gameReducer,
} from "../static/js/game.js";

const dictionary = new Set([
  "APPLE",
  "ALLEY",
  "LEVEL",
  "EERIE",
  "CRANE",
  "SHEEP",
]);
function type(state, word) {
  for (const key of word)
    state = gameReducer(state, { type: "KEY", key, dictionary });
  return state;
}
function submit(state, word) {
  return gameReducer(type(state, word), {
    type: "KEY",
    key: "ENTER",
    dictionary,
  });
}
const finish = (state) => gameReducer(state, { type: "REVEAL_FINISHED" });

test("exact matches reserve repeated letters before partial matches", () => {
  assert.deepEqual(scoreGuess("APPLE", "ALLEY"), [2, 1, 0, 1, 0]);
  assert.deepEqual(scoreGuess("LEVEL", "EERIE"), [1, 2, 0, 0, 0]);
  assert.deepEqual(scoreGuess("SHEEP", "EERIE"), [1, 1, 0, 0, 0]);
  assert.deepEqual(scoreGuess("APPLE", "APPLE"), [2, 2, 2, 2, 2]);
});

test("word list parsing excludes empty and invalid entries", () => {
  assert.deepEqual(parseWords(" apple\r\ncrane\n\n12345 a "), [
    "APPLE",
    "CRANE",
  ]);
});

test("input is blocked during loading and reveal, and limited to five letters", () => {
  const loading = createGame();
  assert.equal(type(loading, "APPLE"), loading);
  let state = type(createGame("APPLE"), "CRANEX");
  assert.equal(state.guess, "CRANE");
  state = gameReducer(state, { type: "KEY", key: "ENTER", dictionary });
  assert.equal(state.status, "revealing");
  assert.equal(type(state, "APPLE"), state);
  assert.equal(state.entries.length, 1);
});

test("incomplete and invalid guesses do not consume an attempt; deletion works", () => {
  let state = submit(createGame("APPLE"), "AB");
  assert.equal(state.message, "Not enough letters.");
  assert.equal(state.entries.length, 0);
  state = gameReducer(state, { type: "KEY", key: "Backspace" });
  assert.equal(state.guess, "A");
  state = submit(createGame("APPLE"), "ZZZZZ");
  assert.equal(state.message, "Not in word list.");
  assert.equal(state.entries.length, 0);
});

test("keyboard feedback never downgrades a letter", () => {
  let state = finish(submit(createGame("APPLE"), "ALLEY"));
  assert.equal(state.keyboard.L, 1);
  assert.equal(state.keyboard.A, 2);
  state = finish(submit(state, "CRANE"));
  assert.equal(state.keyboard.A, 2);
  assert.equal(state.keyboard.E, 2);
});

test("sixth guess can win; a sixth incorrect guess loses and reveals the answer", () => {
  let state = createGame("APPLE");
  for (let i = 0; i < 5; i++) state = finish(submit(state, "CRANE"));
  const win = finish(submit(state, "APPLE"));
  assert.equal(win.status, "won");
  assert.equal(type(win, "A"), win);
  const loss = finish(submit(state, "CRANE"));
  assert.equal(loss.status, "lost");
  assert.match(loss.message, /APPLE/);
  assert.equal(type(loss, "A"), loss);
});

test("new game clears previous guesses, keyboard feedback, and finished state", () => {
  const won = finish(submit(createGame("APPLE"), "APPLE"));
  const reset = gameReducer(won, { type: "START", answer: "CRANE" });
  assert.deepEqual(reset, createGame("CRANE"));
});
