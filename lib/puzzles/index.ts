/**
 * Word search, crossword and bingo cards built from the AI's word list. The AI only writes the
 * words, clues and bingo calls; the grids are laid out here so they are always solvable, and
 * the layout is seeded from the content so the screen, print, Word and PowerPoint versions match.
 * Pure: safe to run on the server and in the browser.
 */
import type { PrimaryLevel } from "../curriculum/types";

/* ------------------------------- helpers ------------------------------- */

/** Small, fast seeded random number generator (mulberry32). */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Letters only, upper case ("ice-cream" → "ICECREAM"). */
export const puzzleWord = (w: string) =>
  w
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

/** Distinct usable words (2–15 letters) with their clues, in the order given. */
export function cleanEntries(words: { word: string; clue: string }[]) {
  const seen = new Set<string>();
  const out: { word: string; display: string; clue: string }[] = [];
  for (const w of words) {
    const word = puzzleWord(w.word);
    if (word.length < 2 || word.length > 15 || seen.has(word)) continue;
    seen.add(word);
    out.push({ word, display: w.word.trim(), clue: w.clue.trim() });
  }
  return out;
}

/* ------------------------------ word search ------------------------------ */

export interface WordSearch {
  grid: string[][];
  /** Where each word was hidden: start cell and step. */
  placed: { word: string; row: number; col: number; dr: number; dc: number }[];
  /** Words too long for the grid or that couldn't be fitted. */
  missing: string[];
  /** Plain-English list of the directions used, for the student instructions. */
  directions: string;
}

const LEVEL_INDEX: Record<PrimaryLevel, number> = { F: 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6 };

/** Younger students only read across and down; older ones get diagonals and backwards words. */
function directionsFor(level: PrimaryLevel) {
  const i = LEVEL_INDEX[level];
  if (i <= 2) return { steps: [[0, 1], [1, 0]], text: "across and down" };
  if (i <= 4) return { steps: [[0, 1], [1, 0], [1, 1]], text: "across, down and diagonally" };
  return {
    steps: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
    text: "across, down, diagonally and backwards",
  };
}

export function buildWordSearch(words: string[], level: PrimaryLevel, seed: string): WordSearch {
  const rand = seededRandom(`ws:${seed}`);
  const { steps, text } = directionsFor(level);
  const unique = [...new Set(words.map(puzzleWord).filter((w) => w.length >= 2))];
  const longest = Math.max(0, ...unique.map((w) => w.length));
  const base = LEVEL_INDEX[level] <= 1 ? 8 : LEVEL_INDEX[level] <= 3 ? 10 : 12;
  const size = Math.min(15, Math.max(base, longest, Math.ceil(Math.sqrt(unique.reduce((n, w) => n + w.length, 0) * 1.8))));
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(""));
  const placed: WordSearch["placed"] = [];
  const missing: string[] = [];

  // Longest first: they are the hardest to fit.
  for (const word of [...unique].sort((a, b) => b.length - a.length)) {
    if (word.length > size) {
      missing.push(word);
      continue;
    }
    let done = false;
    for (let attempt = 0; attempt < 400 && !done; attempt++) {
      const [dr, dc] = steps[Math.floor(rand() * steps.length)];
      const row = Math.floor(rand() * size);
      const col = Math.floor(rand() * size);
      const endR = row + dr * (word.length - 1);
      const endC = col + dc * (word.length - 1);
      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
      let fits = true;
      for (let i = 0; i < word.length && fits; i++) {
        const cell = grid[row + dr * i][col + dc * i];
        if (cell && cell !== word[i]) fits = false;
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) grid[row + dr * i][col + dc * i] = word[i];
      placed.push({ word, row, col, dr, dc });
      done = true;
    }
    if (!done) missing.push(word);
  }

  const ALPHABET = "ABCDEFGHIJKLMNOPRSTUWY"; // leaves out Q, V, X, Z: fewer accidental "rude" or confusing fillers
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = ALPHABET[Math.floor(rand() * ALPHABET.length)];
  // Keep the word list in the teacher's order.
  placed.sort((a, b) => unique.indexOf(a.word) - unique.indexOf(b.word));
  return { grid, placed, missing, directions: text };
}

/** "r,c" keys of every cell that is part of a hidden word (for the answer key). */
export function wordSearchAnswerCells(ws: WordSearch) {
  const cells = new Set<string>();
  for (const p of ws.placed) for (let i = 0; i < p.word.length; i++) cells.add(`${p.row + p.dr * i},${p.col + p.dc * i}`);
  return cells;
}

/* -------------------------------- crossword ------------------------------- */

export interface CrosswordClue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  length: number;
}

export interface Crossword {
  rows: number;
  cols: number;
  /** Letter in each cell, or null for a black square. */
  cells: (string | null)[][];
  /** Clue number shown in a cell, if any. */
  numbers: (number | null)[][];
  across: CrosswordClue[];
  down: CrosswordClue[];
  /** Words that couldn't be joined to the grid. */
  missing: string[];
}

interface Cell {
  letter: string;
  across: boolean;
  down: boolean;
}
type Placement = { word: string; clue: string; row: number; col: number; across: boolean };

/** Tries to lay out every word with crossings; returns the placements and the leftovers. */
function layout(entries: { word: string; clue: string }[]): { placed: Placement[]; missing: string[] } {
  const grid = new Map<string, Cell>();
  const key = (r: number, c: number) => `${r},${c}`;
  const at = (r: number, c: number) => grid.get(key(r, c));
  const placed: Placement[] = [];
  const missing: string[] = [];

  function score(word: string, row: number, col: number, across: boolean): number {
    const [dr, dc] = across ? [0, 1] : [1, 0];
    // The squares just before and after the word must be empty.
    if (at(row - dr, col - dc) || at(row + dr * word.length, col + dc * word.length)) return -1;
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = at(r, c);
      if (cell) {
        if (cell.letter !== word[i] || (across ? cell.across : cell.down)) return -1;
        crossings++;
      } else {
        // A new letter must not touch a letter alongside it, or it would make a stray word.
        const side = across ? [at(r - 1, c), at(r + 1, c)] : [at(r, c - 1), at(r, c + 1)];
        if (side.some(Boolean)) return -1;
      }
    }
    return crossings;
  }

  function put(p: Placement) {
    const [dr, dc] = p.across ? [0, 1] : [1, 0];
    for (let i = 0; i < p.word.length; i++) {
      const k = key(p.row + dr * i, p.col + dc * i);
      const cell = grid.get(k) ?? { letter: p.word[i], across: false, down: false };
      if (p.across) cell.across = true;
      else cell.down = true;
      grid.set(k, cell);
    }
    placed.push(p);
  }

  function bounds() {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const k of grid.keys()) {
      const [r, c] = k.split(",").map(Number);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    return { minR, maxR, minC, maxC };
  }

  const [first, ...rest] = entries;
  if (!first) return { placed, missing };
  put({ ...first, row: 0, col: 0, across: true });
  let pending = rest;
  // A word that can't cross anything yet may fit once more words are down, so loop until stuck.
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    const next: typeof pending = [];
    for (const e of pending) {
      let best: { p: Placement; score: number } | null = null;
      for (const [k, cell] of grid) {
        const [r, c] = k.split(",").map(Number);
        for (let i = 0; i < e.word.length; i++) {
          if (e.word[i] !== cell.letter) continue;
          for (const across of [true, false]) {
            if (across ? cell.across : cell.down) continue;
            const row = across ? r : r - i;
            const col = across ? c - i : c;
            const s = score(e.word, row, col, across);
            if (s < 1) continue;
            // Prefer more crossings, then a squarer, smaller grid.
            const b = bounds();
            const [dr, dc] = across ? [0, 1] : [1, 0];
            const h = Math.max(b.maxR, row + dr * (e.word.length - 1)) - Math.min(b.minR, row) + 1;
            const w = Math.max(b.maxC, col + dc * (e.word.length - 1)) - Math.min(b.minC, col) + 1;
            const total = s * 100 - Math.max(h, w) * 2 - Math.abs(h - w);
            if (!best || total > best.score) best = { p: { ...e, row, col, across }, score: total };
          }
        }
      }
      if (best) put(best.p);
      else next.push(e);
    }
    if (next.length === pending.length) {
      pending = next;
      break;
    }
    pending = next;
  }
  missing.push(...pending.map((e) => e.word));
  return { placed, missing };
}

export function buildCrossword(words: { word: string; clue: string }[], seed: string): Crossword {
  const entries = cleanEntries(words).map(({ word, clue }) => ({ word, clue }));
  // Try a few orders and keep the one that joins the most words into the grid.
  const rand = seededRandom(`cw:${seed}`);
  const byLength = [...entries].sort((a, b) => b.word.length - a.word.length);
  const orders = [byLength, ...Array.from({ length: 7 }, () => {
    const [head, ...tail] = byLength;
    return head ? [head, ...shuffle(tail, rand)] : [];
  })];
  let best = layout(byLength);
  for (const order of orders.slice(1)) {
    if (!best.missing.length) break;
    const attempt = layout(order);
    if (attempt.placed.length > best.placed.length) best = attempt;
  }

  const { placed, missing } = best;
  if (!placed.length) return { rows: 0, cols: 0, cells: [], numbers: [], across: [], down: [], missing };
  const minR = Math.min(...placed.map((p) => p.row));
  const minC = Math.min(...placed.map((p) => p.col));
  const maxR = Math.max(...placed.map((p) => (p.across ? p.row : p.row + p.word.length - 1)));
  const maxC = Math.max(...placed.map((p) => (p.across ? p.col + p.word.length - 1 : p.col)));
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const cells: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      cells[p.row - minR + (p.across ? 0 : i)][p.col - minC + (p.across ? i : 0)] = p.word[i];
    }
  }
  // Number the starting squares in reading order, as printed crosswords do.
  const starts = new Map<string, number>();
  const sorted = [...placed].sort((a, b) => a.row - b.row || a.col - b.col);
  let n = 0;
  for (const p of sorted) {
    const k = `${p.row - minR},${p.col - minC}`;
    if (!starts.has(k)) starts.set(k, ++n);
  }
  const numbers: (number | null)[][] = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => starts.get(`${r},${c}`) ?? null));
  const clue = (p: Placement): CrosswordClue => {
    const row = p.row - minR;
    const col = p.col - minC;
    return { number: starts.get(`${row},${col}`)!, clue: p.clue, answer: p.word, row, col, length: p.word.length };
  };
  const byNumber = (a: CrosswordClue, b: CrosswordClue) => a.number - b.number;
  return {
    rows,
    cols,
    cells,
    numbers,
    across: placed.filter((p) => p.across).map(clue).sort(byNumber),
    down: placed.filter((p) => !p.across).map(clue).sort(byNumber),
    missing,
  };
}

/* --------------------------------- bingo --------------------------------- */

/** Default number of bingo cards: one per student in a typical class. */
export const BINGO_CARDS = 24;

/** 3×3 cards for Prep to Year 1 or a short list, otherwise 4×4. */
export function bingoSize(level: PrimaryLevel, answers: number) {
  return LEVEL_INDEX[level] <= 1 || answers < 16 ? 3 : 4;
}

/**
 * Distinct answers to put on the cards (each answer once). Calls with the same answer are
 * merged, since a student couldn't tell which one to mark.
 */
export function bingoAnswers(items: { call: string; answer: string }[]) {
  const seen = new Set<string>();
  return items.map((i) => i.answer.trim()).filter((a) => {
    const k = a.toLowerCase();
    if (!a || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** `count` different cards, each a grid of `size × size` answers drawn from the list. */
export function buildBingoCards(answers: string[], size: number, count: number, seed: string): string[][][] {
  const n = size * size;
  if (answers.length < n) return [];
  const rand = seededRandom(`bingo:${seed}`);
  const cards: string[][][] = [];
  const seen = new Set<string>();
  for (let attempt = 0; cards.length < count && attempt < count * 20; attempt++) {
    const pick = shuffle(answers, rand).slice(0, n);
    const id = [...pick].sort().join("|");
    // Allow repeats only when the list is too short to make enough different cards.
    if (seen.has(id) && attempt < count * 10) continue;
    seen.add(id);
    cards.push(Array.from({ length: size }, (_, r) => pick.slice(r * size, r * size + size)));
  }
  return cards;
}

/* ------------------------------ whole pack ------------------------------ */

export interface PuzzleInput {
  title: string;
  words: { word: string; clue: string }[];
  bingo: { instructions: string; items: { call: string; answer: string }[] };
}

/** Everything the views and exports draw, built the same way everywhere. */
export function buildPuzzles(x: PuzzleInput, level: PrimaryLevel, cards = BINGO_CARDS) {
  const seed = `${x.title}|${level}`;
  const entries = cleanEntries(x.words);
  const wordSearch = buildWordSearch(entries.map((e) => e.word), level, seed);
  const crossword = buildCrossword(x.words, seed);
  const answers = bingoAnswers(x.bingo.items);
  const size = bingoSize(level, answers.length);
  const bingoCards = buildBingoCards(answers, size, cards, seed);
  return { entries, wordSearch, crossword, bingo: { size, answers, cards: bingoCards } };
}

/** Problems a teacher should know about (prefixes are listed in validate.ts). */
export function puzzleWarnings(x: PuzzleInput, level: PrimaryLevel): string[] {
  const p = buildPuzzles(x, level, 1);
  const out: string[] = [];
  const dropped = x.words.filter((w) => {
    const word = puzzleWord(w.word);
    return word.length < 2 || word.length > 15;
  });
  if (dropped.length) out.push(`Some words can't go in a puzzle (they need 2–15 letters): ${dropped.map((w) => w.word).join(", ")}.`);
  if (p.crossword.missing.length) out.push(`Some words didn't fit in the crossword (they are still in the word search): ${p.crossword.missing.join(", ")}.`);
  if (p.wordSearch.missing.length) out.push(`Some words didn't fit in the word search: ${p.wordSearch.missing.join(", ")}.`);
  const need = bingoSize(level, p.bingo.answers.length) ** 2;
  if (p.bingo.answers.length < need) out.push(`Bingo needs at least ${need} different answers; there are ${p.bingo.answers.length}. Add more calls.`);
  return out;
}
