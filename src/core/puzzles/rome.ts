import { mulberry32 } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = "Roman numerals: how symbols like I, V, X, L, C, D, M are added or subtracted in place-value chunks, since Rome had no zero.";

const VALUES: [string, number][] = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n > 3999) {
    throw new RangeError('toRoman supports integers 1-3999');
  }
  let remaining = n;
  let result = '';
  for (const [symbol, value] of VALUES) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

const ROMAN_PATTERN =
  /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** Strict validity check: rejects malformed numerals like "IIII" or "VX". */
export function isValidRomanNumeral(s: string): boolean {
  return s.length > 0 && ROMAN_PATTERN.test(s);
}

export function fromRoman(s: string): number | null {
  if (!isValidRomanNumeral(s)) return null;
  let total = 0;
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const twoEntry = VALUES.find(([sym]) => sym === two && sym.length === 2);
    if (twoEntry) {
      total += twoEntry[1];
      i += 2;
      continue;
    }
    const one = s[i];
    const oneEntry = VALUES.find(([sym]) => sym === one && sym.length === 1);
    if (!oneEntry) return null;
    total += oneEntry[1];
    i += 1;
  }
  return total;
}

export function checkLock(target: number, attempt: string): boolean {
  return fromRoman(attempt) === target;
}

/** Splits a number into its nonzero thousands/hundreds/tens/ones chunks, e.g. 594 -> [500, 90, 4]. */
function placeValueChunks(n: number): number[] {
  const chunks = [Math.floor(n / 1000) * 1000, Math.floor((n % 1000) / 100) * 100, Math.floor((n % 100) / 10) * 10, n % 10];
  return chunks.filter((c) => c > 0);
}

/** Tier 1: how many symbols to expect. Tier 2: the place-value chunks to convert separately. Tier 3: the chunks converted and combined into the answer. */
export function romeHints(target: number): HintDef[] {
  const roman = toRoman(target);
  const chunks = placeValueChunks(target);
  return [
    { level: 1, text: `It uses ${roman.length} symbols.` },
    { level: 2, text: `Break ${target} into place values: ${chunks.join(' + ')}. Convert each chunk to numerals on its own, then combine them in order.` },
    { level: 3, text: `${target} = ${chunks.join(' + ')} = ${chunks.map((c) => toRoman(c)).join('')} = ${roman}.` },
  ];
}

export interface LockPuzzle {
  target: number;
  /** Shuffled symbol tiles the player drags into order to build the answer. */
  tiles: string[];
}

export interface TileRowLayout {
  tileSize: number;
  spacing: number;
  startX: number;
}

/**
 * Lays out `count` equal-size square tiles in a single centered row that always fits inside
 * [margin, gameWidth - margin], however many tiles there are (anywhere from a few to the
 * worst case of a long numeral plus distractors). Solves tileSize from the available width
 * inward instead of starting from a fixed tile size and hoping the row fits — a fixed size
 * floor is what let the row run ~2px past the screen edge for larger tile counts.
 */
export function layoutTileRow(count: number, gameWidth: number, margin = 20, gap = 8, maxTileSize = 64): TileRowLayout {
  const tileSize = Math.min(maxTileSize, (gameWidth - margin * 2 - gap * (count - 1)) / count);
  const spacing = tileSize + gap;
  const startX = gameWidth / 2 - (spacing * (count - 1)) / 2;
  return { tileSize, spacing, startX };
}

const SYMBOL_CHARS = ['I', 'V', 'X', 'L', 'C', 'D', 'M'];

export function generateLockPuzzle(seed: number, min = 1, max = 500): LockPuzzle {
  const rand = mulberry32(seed);
  const target = min + Math.floor(rand() * (max - min + 1));
  const answer = toRoman(target);
  const correctTiles = answer.split('');
  const distractorCount = Math.min(3, SYMBOL_CHARS.length);
  const tiles = [...correctTiles];
  for (let i = 0; i < distractorCount; i++) {
    const extra = SYMBOL_CHARS[Math.floor(rand() * SYMBOL_CHARS.length)];
    tiles.push(extra);
  }
  // simple shuffle using same rand stream
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return { target, tiles };
}
