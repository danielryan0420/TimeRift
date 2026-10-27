import { mulberry32 } from '../rng';

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
