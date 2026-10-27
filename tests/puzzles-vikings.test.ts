import { describe, expect, it } from 'vitest';
import { bearingDiff, evaluateLeg, generateVoyage, isOnCourse } from '../src/core/puzzles/vikings';

describe('bearingDiff', () => {
  it('handles wraparound correctly', () => {
    expect(bearingDiff(350, 10)).toBe(20);
    expect(bearingDiff(10, 350)).toBe(20);
    expect(bearingDiff(0, 180)).toBe(180);
    expect(bearingDiff(90, 90)).toBe(0);
  });
});

describe('isOnCourse', () => {
  it('accepts headings within tolerance', () => {
    expect(isOnCourse(95, 90, 10)).toBe(true);
    expect(isOnCourse(105, 90, 10)).toBe(false);
  });
});

describe('voyage generation', () => {
  it('is deterministic for a seed', () => {
    const a = generateVoyage(5, 123);
    const b = generateVoyage(5, 123);
    expect(a).toEqual(b);
  });

  it('tightens tolerance on later legs', () => {
    const legs = generateVoyage(4, 123);
    expect(legs[3].toleranceDeg).toBeLessThanOrEqual(legs[0].toleranceDeg);
  });

  it('evaluateLeg reports success within tolerance', () => {
    const [leg] = generateVoyage(1, 5);
    const good = evaluateLeg(leg, leg.targetBearing);
    expect(good.success).toBe(true);
    const bad = evaluateLeg(leg, (leg.targetBearing + 170) % 360);
    expect(bad.success).toBe(false);
  });
});
