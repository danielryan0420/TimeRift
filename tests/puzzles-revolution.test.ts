import { describe, expect, it } from 'vitest';
import { caesarDecode, caesarShift, checkShift, generateCiphers } from '../src/core/puzzles/revolution';

describe('caesar cipher wheel', () => {
  it('shifts letters and wraps around the alphabet', () => {
    expect(caesarShift('ABZ', 1)).toBe('BCA');
    expect(caesarShift('HELLO', 0)).toBe('HELLO');
  });

  it('decode reverses shift', () => {
    const encoded = caesarShift('MEET AT DAWN', 7);
    expect(caesarDecode(encoded, 7)).toBe('MEET AT DAWN');
  });

  it('leaves non-letters untouched', () => {
    expect(caesarShift('A B!', 2)).toBe('C D!');
  });

  it('generates deterministic ciphers for a given seed', () => {
    const a = generateCiphers(4, 7);
    const b = generateCiphers(4, 7);
    expect(a).toEqual(b);
  });

  it('each generated cipher decodes back to its own plaintext with the stored shift', () => {
    const challenges = generateCiphers(4, 7);
    for (const c of challenges) {
      expect(caesarDecode(c.ciphertext, c.shift)).toBe(c.plaintext);
    }
  });

  it('checkShift only accepts the correct shift, including wraparound equivalents', () => {
    const [challenge] = generateCiphers(1, 2);
    expect(checkShift(challenge, challenge.shift)).toBe(true);
    expect(checkShift(challenge, challenge.shift + 26)).toBe(true);
    expect(checkShift(challenge, challenge.shift + 1)).toBe(false);
  });
});
