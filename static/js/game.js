export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
export const FLIP_DURATION = 500;
export const FLIP_DELAY = 375;
export const REVEAL_DURATION = FLIP_DELAY * (WORD_LENGTH - 1) + FLIP_DURATION;
export const STATE_NAMES = ["absent", "present", "correct"];

export function parseWords(text) {
  return text
    .toUpperCase()
    .split(/\s+/)
    .filter((word) => /^[A-Z]{5}$/.test(word));
}

export function chooseAnswer(answers) {
  return answers[Math.floor(Math.random() * answers.length)];
}

// Reserve exact matches first so repeated letters cannot consume them.
export function scoreGuess(answer, guess) {
  const scores = Array(WORD_LENGTH).fill(0);
  const remaining = new Map();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) scores[i] = 2;
    else remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (scores[i] !== 2 && (remaining.get(guess[i]) ?? 0) > 0) {
      scores[i] = 1;
      remaining.set(guess[i], remaining.get(guess[i]) - 1);
    }
  }
  return scores;
}

export function createGame(answer = "") {
  return {
    answer,
    guess: "",
    entries: [],
    keyboard: {},
    status: answer ? "playing" : "loading",
    message: "",
  };
}

export function gameReducer(state, action) {
  if (action.type === "START") return createGame(action.answer);
  if (action.type === "LOAD_ERROR") {
    return {
      ...state,
      status: "error",
      message: "Could not load the word lists. Refresh to try again.",
    };
  }
  if (action.type === "REVEAL_FINISHED" && state.status === "revealing") {
    const entry = state.entries.at(-1);
    const keyboard = { ...state.keyboard };
    [...entry.word].forEach((letter, i) => {
      keyboard[letter] = Math.max(keyboard[letter] ?? -1, entry.scores[i]);
    });
    const won = entry.word === state.answer;
    const lost = !won && state.entries.length === MAX_GUESSES;
    return {
      ...state,
      keyboard,
      status: won ? "won" : lost ? "lost" : "playing",
      message: won
        ? "You win! Well done."
        : lost
          ? `The word was ${state.answer}.`
          : "",
    };
  }
  if (state.status !== "playing" || action.type !== "KEY") return state;
  const key = action.key.toUpperCase();
  if (/^[A-Z]$/.test(key)) {
    return {
      ...state,
      guess: (state.guess + key).slice(0, WORD_LENGTH),
      message: "",
    };
  }
  if (key === "BACKSPACE" || key === "DELETE") {
    return { ...state, guess: state.guess.slice(0, -1), message: "" };
  }
  if (key !== "ENTER") return state;
  if (state.guess.length !== WORD_LENGTH)
    return { ...state, message: "Not enough letters." };
  if (!action.dictionary.has(state.guess))
    return { ...state, message: "Not in word list." };
  return {
    ...state,
    guess: "",
    entries: [
      ...state.entries,
      { word: state.guess, scores: scoreGuess(state.answer, state.guess) },
    ],
    status: "revealing",
    message: "",
  };
}
