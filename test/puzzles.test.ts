import { describe, expect, it } from "vitest";
import {
  bingoAnswers,
  buildBingoCards,
  buildCrossword,
  buildPuzzles,
  buildWordSearch,
  cleanEntries,
  puzzleWarnings,
  puzzleWord,
  seededRandom,
  wordSearchAnswerCells,
} from "@/lib/puzzles";
import { SAMPLES } from "./fixtures/samples";
import type { PuzzlePack } from "@/lib/generator/schema";

const WORDS = [
  { word: "numerator", clue: "The top number" },
  { word: "denominator", clue: "The bottom number" },
  { word: "fraction", clue: "Part of a whole" },
  { word: "half", clue: "One of two equal parts" },
  { word: "quarter", clue: "One of four equal parts" },
  { word: "equal", clue: "The same size" },
  { word: "whole", clue: "All of it" },
  { word: "third", clue: "One of three equal parts" },
  { word: "eighth", clue: "One of eight equal parts" },
  { word: "part", clue: "A piece" },
];

/** Reads the word written in the grid from a placement. */
function readWord(grid: string[][], p: { row: number; col: number; dr: number; dc: number; word: string }) {
  return Array.from({ length: p.word.length }, (_, i) => grid[p.row + p.dr * i][p.col + p.dc * i]).join("");
}

describe("puzzle helpers", () => {
  it("normalises words to capital letters only", () => {
    expect(puzzleWord("Ice-cream")).toBe("ICECREAM");
    expect(puzzleWord("Café 2")).toBe("CAFE");
  });

  it("drops duplicates and words that are too short or long", () => {
    const out = cleanEntries([
      { word: "half", clue: "a" },
      { word: "HALF", clue: "b" },
      { word: "a", clue: "c" },
      { word: "x".repeat(16), clue: "d" },
    ]);
    expect(out.map((e) => e.word)).toEqual(["HALF"]);
  });

  it("random numbers repeat for the same seed", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("word search", () => {
  it("hides every word so it reads correctly in the grid", () => {
    const ws = buildWordSearch(WORDS.map((w) => w.word), "5", "seed");
    expect(ws.missing).toEqual([]);
    expect(ws.placed).toHaveLength(WORDS.length);
    for (const p of ws.placed) expect(readWord(ws.grid, p)).toBe(p.word);
    expect(ws.grid.every((row) => row.length === ws.grid.length && row.every((c) => /^[A-Z]$/.test(c)))).toBe(true);
    expect(wordSearchAnswerCells(ws).size).toBeGreaterThan(20);
  });

  it("only goes across and down for Prep to Year 2", () => {
    const ws = buildWordSearch(["cat", "dog", "sun", "hat", "big"], "F", "seed");
    expect(ws.directions).toBe("across and down");
    for (const p of ws.placed) expect([[0, 1], [1, 0]]).toContainEqual([p.dr, p.dc]);
  });

  it("is the same every time for the same content", () => {
    expect(buildWordSearch(["fraction", "half"], "3", "s")).toEqual(buildWordSearch(["fraction", "half"], "3", "s"));
  });
});

describe("crossword", () => {
  it("joins the words with crossings and numbers the clues", () => {
    const cw = buildCrossword(WORDS, "seed");
    const placed = cw.across.length + cw.down.length;
    expect(placed + cw.missing.length).toBe(WORDS.length);
    expect(placed).toBeGreaterThanOrEqual(8);
    for (const c of [...cw.across, ...cw.down]) {
      expect(cw.numbers[c.row][c.col]).toBe(c.number);
    }
    // Every answer reads correctly in the grid.
    for (const c of cw.across) expect(cw.cells[c.row].slice(c.col, c.col + c.length).join("")).toBe(c.answer);
    for (const c of cw.down) expect(Array.from({ length: c.length }, (_, i) => cw.cells[c.row + i][c.col]).join("")).toBe(c.answer);
  });

  it("makes no stray words: every run of two or more letters is an answer", () => {
    const cw = buildCrossword(WORDS, "seed");
    const answers = new Set([...cw.across, ...cw.down].map((c) => c.answer));
    const runs: string[] = [];
    for (const row of cw.cells) runs.push(...row.map((c) => c ?? " ").join("").split(" "));
    for (let c = 0; c < cw.cols; c++) runs.push(...cw.cells.map((r) => r[c] ?? " ").join("").split(" "));
    for (const run of runs.filter((r) => r.length > 1)) expect(answers.has(run)).toBe(true);
  });

  it("reports a word that shares no letters", () => {
    const cw = buildCrossword([{ word: "cat", clue: "a" }, { word: "dog", clue: "b" }], "s");
    expect(cw.missing).toEqual(["DOG"]);
  });
});

describe("bingo", () => {
  it("makes different cards from distinct answers", () => {
    const items = Array.from({ length: 24 }, (_, i) => ({ call: `${i} + 1`, answer: String(i + 1) }));
    const answers = bingoAnswers([...items, { call: "dup", answer: "1" }]);
    expect(answers).toHaveLength(24);
    const cards = buildBingoCards(answers, 4, 24, "s");
    expect(cards).toHaveLength(24);
    for (const card of cards) {
      expect(card.flat()).toHaveLength(16);
      expect(new Set(card.flat()).size).toBe(16);
    }
    expect(new Set(cards.map((c) => c.flat().sort().join())).size).toBe(24);
  });

  it("uses 3×3 cards for Prep and Year 1", () => {
    const items = Array.from({ length: 24 }, (_, i) => ({ call: `c${i}`, answer: `a${i}` }));
    expect(buildPuzzles({ title: "t", words: WORDS, bingo: { instructions: "", items } }, "1").bingo.size).toBe(3);
    expect(buildPuzzles({ title: "t", words: WORDS, bingo: { instructions: "", items } }, "4").bingo.size).toBe(4);
  });

  it("warns when there are too few answers", () => {
    const w = puzzleWarnings({ title: "t", words: WORDS, bingo: { instructions: "", items: [{ call: "a", answer: "b" }] } }, "4");
    expect(w.some((x) => x.startsWith("Bingo needs at least 9"))).toBe(true);
  });
});

describe("sample pack", () => {
  it("builds without warnings", () => {
    const pack = SAMPLES.puzzles as PuzzlePack;
    expect(puzzleWarnings(pack, "3")).toEqual([]);
  });
});
