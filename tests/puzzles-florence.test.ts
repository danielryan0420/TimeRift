import { describe, expect, it } from 'vitest';
import { evaluatePlacement, generateCanvases, GOLDEN_RATIO, goldenSectionPoint } from '../src/core/puzzles/florence';

describe('golden ratio composition', () => {
  it('divides a span so the whole is to the long part as the long part is to the short part', () => {
    const width = 500;
    const x = goldenSectionPoint(width);
    const long = x;
    const short = width - x;
    expect(width / long).toBeCloseTo(long / short, 5);
    expect(long / short).toBeCloseTo(GOLDEN_RATIO, 5);
  });

  it('generates deterministic canvases for a given seed', () => {
    const a = generateCanvases(4, 11);
    const b = generateCanvases(4, 11);
    expect(a).toEqual(b);
  });

  it('tightens tolerance on later canvases', () => {
    const canvases = generateCanvases(4, 11);
    expect(canvases[3].tolerancePx).toBeLessThanOrEqual(canvases[0].tolerancePx);
  });

  it('accepts a placement within tolerance and rejects one outside it', () => {
    const [challenge] = generateCanvases(1, 5);
    const good = evaluatePlacement(challenge, challenge.targetXPx);
    expect(good.success).toBe(true);
    const bad = evaluatePlacement(challenge, challenge.targetXPx + challenge.tolerancePx + 50);
    expect(bad.success).toBe(false);
  });
});
