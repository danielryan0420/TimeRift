import { mulberry32 } from '../rng';

/** Real goods that moved west along the Silk Road out of Han-dynasty China. */
export type Good = 'silk' | 'paper' | 'tea' | 'porcelain';

export const GOODS: Good[] = ['silk', 'paper', 'tea', 'porcelain'];

export const GOOD_INFO: Record<Good, { label: string; fact: string }> = {
  silk: { label: 'Silk', fact: 'Shimmering silk cloth was so prized in Rome that some senators tried to ban it as a wasteful luxury.' },
  paper: { label: 'Paper', fact: 'Papermaking spread west after the Battle of Talas in 751 CE, when Chinese papermakers were captured and shared the technique.' },
  tea: { label: 'Tea', fact: 'Dried tea leaves kept for months on the road and became a staple trade good across Central Asia.' },
  porcelain: { label: 'Porcelain', fact: "Chinese porcelain was so fine that Europeans called all fine ceramics 'china' after its source." },
};

/** Per-bundle weight (kg) and trade value (silver pieces) for each good — the two stats a stop's request compares against. */
export const GOOD_STATS: Record<Good, { weightKg: number; valueSilver: number }> = {
  paper: { weightKg: 1, valueSilver: 15 },
  silk: { weightKg: 3, valueSilver: 55 },
  tea: { weightKg: 5, valueSilver: 70 },
  porcelain: { weightKg: 8, valueSilver: 95 },
};

/**
 * Per-good threshold ranges chosen so a (maxWeightKg, minValueSilver) pair rolled from a
 * target good's own range always excludes the other 3 goods — see tests/puzzles-china.test.ts
 * for the exhaustive check. Unlike the old 1:1 "request word → good" lookup, the player has
 * to compare two numbers against every good's stats, not just recognize a keyword.
 */
const THRESHOLD_RANGES: Record<Good, { weight: [number, number]; value: [number, number] }> = {
  paper: { weight: [1, 2], value: [5, 15] },
  silk: { weight: [3, 4], value: [20, 55] },
  tea: { weight: [5, 7], value: [56, 70] },
  porcelain: { weight: [8, 10], value: [71, 95] },
};

export interface CaravanStop {
  id: number;
  maxWeightKg: number;
  minValueSilver: number;
  correctGood: Good;
}

/** Which good (if any) uniquely satisfies both the weight cap and the value floor. */
export function goodForStop(maxWeightKg: number, minValueSilver: number): Good | null {
  const candidates = GOODS.filter(
    (g) => GOOD_STATS[g].weightKg <= maxWeightKg && GOOD_STATS[g].valueSilver >= minValueSilver,
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function generateStops(count: number, seed: number): CaravanStop[] {
  const rand = mulberry32(seed);
  const stops: CaravanStop[] = [];
  for (let i = 0; i < count; i++) {
    const correctGood = GOODS[Math.floor(rand() * GOODS.length)];
    const [wLo, wHi] = THRESHOLD_RANGES[correctGood].weight;
    const [vLo, vHi] = THRESHOLD_RANGES[correctGood].value;
    const maxWeightKg = wLo + Math.floor(rand() * (wHi - wLo + 1));
    const minValueSilver = vLo + Math.floor(rand() * (vHi - vLo + 1));
    stops.push({ id: i, maxWeightKg, minValueSilver, correctGood });
  }
  return stops;
}

export function checkGood(stop: CaravanStop, chosenGood: Good): boolean {
  return stop.correctGood === chosenGood;
}
