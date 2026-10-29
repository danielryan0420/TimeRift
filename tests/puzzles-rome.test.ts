import { describe, expect, it } from 'vitest';
import { checkLock, fromRoman, generateLockPuzzle, isValidRomanNumeral, layoutTileRow, toRoman } from '../src/core/puzzles/rome';

describe('roman numeral conversion', () => {
  it.each([
    [1, 'I'],
    [4, 'IV'],
    [9, 'IX'],
    [40, 'XL'],
    [90, 'XC'],
    [444, 'CDXLIV'],
    [1994, 'MCMXCIV'],
    [3999, 'MMMCMXCIX'],
  ])('converts %i to %s and back', (num, roman) => {
    expect(toRoman(num)).toBe(roman);
    expect(fromRoman(roman)).toBe(num);
  });

  it('throws for out-of-range input', () => {
    expect(() => toRoman(0)).toThrow();
    expect(() => toRoman(4000)).toThrow();
  });

  it('rejects malformed numerals', () => {
    expect(isValidRomanNumeral('IIII')).toBe(false);
    expect(isValidRomanNumeral('VX')).toBe(false);
    expect(isValidRomanNumeral('')).toBe(false);
    expect(fromRoman('IIII')).toBeNull();
  });
});

describe('lock puzzle', () => {
  it('checkLock validates the correct answer for the target', () => {
    const target = 444;
    expect(checkLock(target, 'CDXLIV')).toBe(true);
    expect(checkLock(target, 'CDXLIII')).toBe(false);
  });

  it('generateLockPuzzle is deterministic and solvable from its own tiles', () => {
    const puzzle = generateLockPuzzle(99);
    const answer = toRoman(puzzle.target);
    for (const ch of answer) {
      expect(puzzle.tiles).toContain(ch);
    }
    expect(checkLock(puzzle.target, answer)).toBe(true);

    const again = generateLockPuzzle(99);
    expect(again.target).toBe(puzzle.target);
  });
});

describe('tile row layout', () => {
  // Portrait design width (440) and landscape/desktop design width (960); worst-case tile
  // count is a 12-symbol numeral (e.g. 888 = DCCCLXXXVIII) plus 3 distractors = 15.
  const GAME_WIDTHS = [440, 960];
  const MARGIN = 20;

  it.each(GAME_WIDTHS)('keeps every tile fully inside [margin, width - margin] at gameWidth %i, for any tile count', (gameWidth) => {
    for (let count = 1; count <= 15; count++) {
      const { tileSize, spacing, startX } = layoutTileRow(count, gameWidth);
      const leftEdge = startX - tileSize / 2;
      const rightEdge = startX + spacing * (count - 1) + tileSize / 2;
      expect(leftEdge).toBeGreaterThanOrEqual(MARGIN - 1e-9);
      expect(rightEdge).toBeLessThanOrEqual(gameWidth - MARGIN + 1e-9);
    }
  });

  it('caps tile size at 64px and keeps it positive for every tile count', () => {
    for (let count = 1; count <= 15; count++) {
      const { tileSize } = layoutTileRow(count, 960);
      expect(tileSize).toBeGreaterThan(0);
      expect(tileSize).toBeLessThanOrEqual(64);
    }
  });

  it('regression: a 9-tile row at the portrait design width used to overflow by ~2px', () => {
    const { tileSize, spacing, startX } = layoutTileRow(9, 440);
    const rightEdge = startX + spacing * 8 + tileSize / 2;
    expect(rightEdge).toBeLessThanOrEqual(440 - MARGIN + 1e-9);
  });
});
