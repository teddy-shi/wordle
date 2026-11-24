import {
  createElement as h,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  WORD_LENGTH,
  MAX_GUESSES,
  FLIP_DELAY,
  FLIP_DURATION,
  REVEAL_DURATION,
  STATE_NAMES,
  parseWords,
  chooseAnswer,
  createGame,
  gameReducer,
} from "./game.js";
import {
  loadStatistics,
  saveStatistics,
  recordResult,
  winRate,
} from "./statistics.js";

function Icon({ name, size = 28 }) {
  const shapes = {
    info: [
      h("circle", { key: "circle", cx: 12, cy: 12, r: 9 }),
      h("path", { key: "stem", d: "M12 11v6" }),
      h("circle", {
        key: "dot",
        cx: 12,
        cy: 7.5,
        r: 0.75,
        fill: "currentColor",
        stroke: "none",
      }),
    ],
    stats: [
      h("path", { key: "bars", d: "M4 21V11h5v10m0 0V3h6v18m0 0V7h5v14H4" }),
    ],
    backspace: [
      h("path", {
        key: "outline",
        d: "M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-7-7 7-7Z",
      }),
      h("path", { key: "cross", d: "m12 9 6 6m0-6-6 6" }),
    ],
  };
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
      focusable: "false",
    },
    shapes[name],
  );
}
const KEY_ROWS = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  ["ENTER", ..."ZXCVBNM", "BACKSPACE"],
];
let dictionariesPromise;

function loadDictionaries() {
  // Share one request pair across mounts, including React StrictMode checks.
  dictionariesPromise ??= Promise.all(
    ["answers", "guesses"].map(async (name) => {
      const response = await fetch(
        new URL(`../../dictionary/${name}.txt`, import.meta.url),
      );
      if (!response.ok)
        throw new Error(`Failed to fetch ${name}: ${response.status}`);
      return parseWords(await response.text());
    }),
  ).then(([answers, guesses]) => {
    if (!answers.length || !guesses.length) throw new Error("Empty word list");
    return { answers, dictionary: new Set([...answers, ...guesses]) };
  });
  return dictionariesPromise;
}

function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createGame);
  const [keyPresses, setKeyPresses] = useState({});
  const lists = useRef(null);

  useEffect(() => {
    let active = true;
    loadDictionaries()
      .then((result) => {
        if (!active) return;
        lists.current = result;
        dispatch({ type: "START", answer: chooseAnswer(result.answers) });
      })
      .catch((error) => {
        if (active) {
          console.error(error);
          dispatch({ type: "LOAD_ERROR" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "revealing") return;
    const timer = setTimeout(
      () => dispatch({ type: "REVEAL_FINISHED" }),
      REVEAL_DURATION,
    );
    return () => clearTimeout(timer);
  }, [state.status]);

  const onKey = useCallback(
    (key) => {
      if (state.status !== "playing") return;
      const normalized =
        key.toUpperCase() === "DELETE" ? "BACKSPACE" : key.toUpperCase();
      setKeyPresses((previous) => ({
        ...previous,
        [normalized]: (previous[normalized] ?? 0) + 1,
      }));
      dispatch({
        type: "KEY",
        key: normalized,
        dictionary: lists.current?.dictionary,
      });
    },
    [state.status],
  );
  const newGame = () => {
    if (lists.current && ["won", "lost"].includes(state.status)) {
      setKeyPresses({});
      dispatch({ type: "START", answer: chooseAnswer(lists.current.answers) });
    }
  };
  return { state, onKey, newGame, keyPresses };
}

function Board({ state }) {
  return h(
    "div",
    {
      className: "grid-container",
      role: "group",
      "aria-label": "Wordle board",
    },
    Array.from({ length: MAX_GUESSES }, (_, row) => {
      const entry = state.entries[row];
      const word =
        entry?.word ?? (row === state.entries.length ? state.guess : "");
      const revealing =
        state.status === "revealing" && row === state.entries.length - 1;
      return h(
        "div",
        {
          className: "board-row",
          key: row,
          role: "group",
          "aria-label": `Guess ${row + 1}`,
        },
        Array.from({ length: WORD_LENGTH }, (_, col) => {
          const letter = word[col] ?? "";
          const result = entry ? STATE_NAMES[entry.scores[col]] : "";
          return h(
            "div",
            {
              key: `${col}-${letter}-${Boolean(entry)}`,
              className: `cell${letter ? " filled" : ""}${revealing ? " revealing" : ""}${letter && !entry ? " typing" : ""}`,
              "data-state": result || undefined,
              "aria-label": `${letter || "Empty"}${result ? `, ${result}` : ""}`,
              style: {
                "--flip-delay": `${col * FLIP_DELAY}ms`,
                "--flip-duration": `${FLIP_DURATION}ms`,
              },
            },
            letter,
          );
        }),
      );
    }),
  );
}

function Keyboard({ keyboard, onKey, disabled, keyPresses }) {
  return h(
    "div",
    { className: "keyboard", "aria-label": "On-screen keyboard" },
    KEY_ROWS.map((row, index) =>
      h(
        "div",
        { className: "keyboard_row", key: index },
        row.map((key) =>
          h(
            "button",
            {
              key,
              type: "button",
              className: `key${key.length > 1 ? " wide-key" : ""}`,
              "data-state":
                keyboard[key] === undefined
                  ? undefined
                  : STATE_NAMES[keyboard[key]],
              "aria-label": `${key === "BACKSPACE" ? "Backspace" : key}${keyboard[key] === undefined ? "" : `, ${STATE_NAMES[keyboard[key]]}`}`,
              disabled,
              onClick: () => onKey(key),
            },
            key === "BACKSPACE" ? h(Icon, { name: "backspace" }) : key,
            keyPresses[key] &&
              h("span", {
                key: keyPresses[key],
                className: "key-press-highlight",
                "aria-hidden": true,
              }),
          ),
        ),
      ),
    ),
  );
}

function Statistics({ statistics, state }) {
  const largestCount = Math.max(1, ...statistics.distribution);
  const metrics = [
    [statistics.played, "Played"],
    [`${winRate(statistics)}%`, "Win rate"],
    [statistics.currentStreak, "Current streak"],
    [statistics.maxStreak, "Max streak"],
  ];
  return h(
    "section",
    { className: "statistics", "aria-label": "Lifetime statistics" },
    h(
      "dl",
      { className: "statistics-metrics" },
      metrics.map(([value, label]) =>
        h(
          "div",
          { className: "statistics-metric", key: label },
          h("dt", null, label),
          h("dd", null, value),
        ),
      ),
    ),
    h("h3", { id: "distribution-title" }, "Guess distribution"),
    h(
      "ol",
      {
        className: "guess-distribution",
        "aria-labelledby": "distribution-title",
      },
      statistics.distribution.map((count, index) =>
        h(
          "li",
          {
            key: index,
            className: "distribution-row",
            "aria-label": `${index + 1} ${index === 0 ? "guess" : "guesses"}: ${count} ${count === 1 ? "win" : "wins"}`,
          },
          h(
            "span",
            { className: "distribution-label", "aria-hidden": true },
            index + 1,
          ),
          h(
            "div",
            { className: "distribution-track", "aria-hidden": true },
            h("div", {
              className: `distribution-bar${state.status === "won" && state.entries.length === index + 1 ? " latest-win" : ""}`,
              style: { width: `${(count / largestCount) * 100}%` },
            }),
            h("span", { className: "distribution-count" }, count),
          ),
        ),
      ),
    ),
  );
}

function GameDialog({ kind, onClose, state, statistics, onNewGame }) {
  const ref = useRef(null);
  const finished = ["won", "lost"].includes(state.status);
  useEffect(() => {
    ref.current.showModal();
    ref.current.focus({ preventScroll: true });
  }, []);
  return h(
    "dialog",
    {
      ref,
      tabIndex: -1,
      className: "game-dialog",
      "aria-labelledby": "dialog-title",
      onClose,
      onClick: (event) => {
        if (event.target === ref.current) ref.current.close();
      },
    },
    h(
      "h2",
      { id: "dialog-title" },
      kind === "info" ? "How to play" : "Statistics",
    ),
    kind === "stats" && finished && h("p", { role: "status" }, state.message),
    kind === "info"
      ? h(
          "div",
          null,
          h("p", null, "Guess the hidden five-letter word in six tries."),
          h(
            "p",
            null,
            "Use your keyboard or tap the letters, then press Enter.",
          ),
          h(
            "p",
            null,
            h("span", { className: "legend correct" }, "Green"),
            " means the letter is in the correct spot.",
          ),
          h(
            "p",
            null,
            h("span", { className: "legend present" }, "Yellow"),
            " means the letter is in a different spot.",
          ),
          h(
            "p",
            null,
            h("span", { className: "legend absent" }, "Gray"),
            " means no unmatched copies of that letter remain.",
          ),
        )
      : h(Statistics, { statistics, state }),
    h(
      "div",
      { className: "dialog-actions" },
      h(
        "button",
        {
          type: "button",
          className: "action-button",
          onClick: () => ref.current.close(),
        },
        "Close",
      ),
      kind === "stats" &&
        finished &&
        h(
          "button",
          {
            type: "button",
            className: "action-button new-game-button",
            onClick: () => {
              ref.current.close();
              onNewGame();
            },
          },
          "New game",
        ),
    ),
  );
}

function App() {
  const { state, onKey, newGame, keyPresses } = useGame();
  const [dialog, setDialog] = useState(null);
  const [statistics, setStatistics] = useState(loadStatistics);
  const resultRecorded = useRef(false);

  useEffect(() => {
    if (state.status === "playing") resultRecorded.current = false;
    if (!["won", "lost"].includes(state.status) || resultRecorded.current)
      return;
    // Dialog changes and repeated renders must not record the same game twice.
    resultRecorded.current = true;
    const next = recordResult(statistics, state.status, state.entries.length);
    setStatistics(next);
    saveStatistics(next);
    setDialog("stats");
  }, [state.status, state.entries.length, statistics]);

  useEffect(() => {
    const handleKey = (event) => {
      if (dialog) {
        // Enter must not activate a dialog button left focused by the browser.
        if (event.key === "Enter") event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
        return;
      if (
        event.target.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      if (
        /^[a-z]$/i.test(event.key) ||
        ["Enter", "Backspace", "Delete"].includes(event.key)
      ) {
        event.preventDefault();
        onKey(event.key);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onKey, dialog]);

  return h(
    "main",
    {
      onMouseDownCapture: (event) => {
        if (event.target.closest("button")) event.preventDefault();
      },
      onClickCapture: (event) => {
        event.target.closest("button")?.blur();
      },
    },
    h(
      "header",
      { className: "header" },
      h("h1", { id: "Teddle-title" }, "Wordle"),
      h(
        "div",
        { className: "top_buttons" },
        ...["info", "stats"].map((kind) =>
          h(
            "button",
            {
              key: kind,
              type: "button",
              className: "icon-button",
              "aria-label": kind === "info" ? "How to play" : "Statistics",
              onClick: () => setDialog(kind),
            },
            h(Icon, { name: kind, size: 30 }),
          ),
        ),
      ),
    ),
    h(Board, { state }),
    h(
      "p",
      { className: "game-message", role: "status", "aria-live": "polite" },
      state.status === "loading"
        ? "Loading word lists…"
        : state.message || "\u00a0",
    ),
    h(Keyboard, {
      keyboard: state.keyboard,
      keyPresses,
      onKey,
      disabled: state.status !== "playing",
    }),
    dialog &&
      h(GameDialog, {
        kind: dialog,
        state,
        statistics,
        onClose: () => setDialog(null),
        onNewGame: newGame,
      }),
  );
}

createRoot(document.getElementById("root")).render(h(App));
