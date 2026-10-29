import { mulberry32 } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = 'Cryptography: Caesar ciphers, where every letter shifts by the same fixed amount through the alphabet.';

/** Colonial spy networks like the Culper Ring used simple letter-shift codes to hide messages. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function caesarShift(text: string, shift: number): string {
  const normalizedShift = ((shift % 26) + 26) % 26;
  return text
    .toUpperCase()
    .split('')
    .map((ch) => {
      const idx = ALPHABET.indexOf(ch);
      if (idx === -1) return ch;
      return ALPHABET[(idx + normalizedShift) % 26];
    })
    .join('');
}

export function caesarDecode(text: string, shift: number): string {
  return caesarShift(text, -shift);
}

export interface CipherChallenge {
  id: number;
  plaintext: string;
  shift: number;
  ciphertext: string;
  hint: string;
}

const MESSAGES: [string, string][] = [
  ['REDCOATS MOVE AT DAWN', 'A rider from the Culper Ring passed this along.'],
  ['MEET AT THE OLD MILL', 'Scrawled on a note passed hand to hand.'],
  ['SUPPLIES HIDDEN IN BARN', 'Written in invisible ink, warmed over a candle to read.'],
  ['GENERAL CROSSES TONIGHT', 'Confirmed by letter after the lantern signal.'],
];

export function generateCiphers(count: number, seed: number): CipherChallenge[] {
  const rand = mulberry32(seed);
  const challenges: CipherChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const [plaintext, hint] = MESSAGES[i % MESSAGES.length];
    const shift = 1 + Math.floor(rand() * 25);
    challenges.push({ id: i, plaintext, shift, ciphertext: caesarShift(plaintext, shift), hint });
  }
  return challenges;
}

export function checkShift(challenge: CipherChallenge, triedShift: number): boolean {
  return ((triedShift % 26) + 26) % 26 === challenge.shift;
}

/** Tier 1: the conceptual rule. Tier 2: what the first letter should decode to. Tier 3: the exact shift. */
export function revolutionHints(challenge: CipherChallenge): HintDef[] {
  return [
    { level: 1, text: 'Every letter in the real message shifts by the same number of letters. Turn the wheel and watch the green preview below the code.' },
    { level: 2, text: `The real message starts with the letter "${challenge.plaintext[0]}" — turn the wheel until the preview's first letter matches.` },
    { level: 3, text: `The shift is ${challenge.shift}.` },
  ];
}
