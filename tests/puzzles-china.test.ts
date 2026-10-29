import { describe, expect, it } from 'vitest';
import { checkGood, generateStops, goodForStop, GOOD_STATS, GOODS } from '../src/core/puzzles/china';

describe('silk road caravan puzzle', () => {
  it('generates a deterministic sequence for a given seed', () => {
    const a = generateStops(10, 42);
    const b = generateStops(10, 42);
    expect(a).toEqual(b);
  });

  it('generates different sequences for different seeds (usually)', () => {
    const a = generateStops(10, 1);
    const b = generateStops(10, 2);
    expect(a).not.toEqual(b);
  });

  it('accepts the correct good for a request', () => {
    const [stop] = generateStops(1, 7);
    expect(checkGood(stop, stop.correctGood)).toBe(true);
  });

  it('rejects an incorrect good', () => {
    const [stop] = generateStops(1, 7);
    const wrongGood = GOODS.find((g) => g !== stop.correctGood)!;
    expect(checkGood(stop, wrongGood)).toBe(false);
  });

  it('always has some good in the roster that matches the rolled request', () => {
    for (let seed = 0; seed < 100; seed++) {
      const [stop] = generateStops(1, seed);
      expect(GOODS.some((g) => checkGood(stop, g))).toBe(true);
    }
  });

  it('every generated stop has exactly one good that fits both the weight cap and the price floor', () => {
    for (let seed = 0; seed < 300; seed++) {
      const [stop] = generateStops(1, seed);
      const matching = GOODS.filter(
        (g) => GOOD_STATS[g].weightKg <= stop.maxWeightKg && GOOD_STATS[g].valueSilver >= stop.minValueSilver,
      );
      expect(matching).toEqual([stop.correctGood]);
      expect(goodForStop(stop.maxWeightKg, stop.minValueSilver)).toBe(stop.correctGood);
    }
  });

  it('replays with different seeds produce different weight/price thresholds (not a static lookup)', () => {
    const a = generateStops(5, 10).map((s) => [s.maxWeightKg, s.minValueSilver]);
    const b = generateStops(5, 11).map((s) => [s.maxWeightKg, s.minValueSilver]);
    expect(a).not.toEqual(b);
  });
});
