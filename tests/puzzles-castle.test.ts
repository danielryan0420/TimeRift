import { describe, expect, it } from 'vitest';
import { evaluateShot, generateTargets, launchSpeedMs, projectileRangeM } from '../src/core/puzzles/castle';

describe('trebuchet physics', () => {
  it('increases launch speed with more counterweight', () => {
    expect(launchSpeedMs(2000)).toBeGreaterThan(launchSpeedMs(500));
  });

  it('matches v^2 * sin(2*theta) / g', () => {
    const cfg = { counterweightKg: 1000, releaseAngleDeg: 45 };
    const v = launchSpeedMs(1000);
    expect(projectileRangeM(cfg)).toBeCloseTo((v * v * Math.sin(Math.PI / 2)) / 9.81, 5);
  });

  it('maximizes range at a 45 degree release angle for a fixed counterweight', () => {
    const at45 = projectileRangeM({ counterweightKg: 1200, releaseAngleDeg: 45 });
    const at20 = projectileRangeM({ counterweightKg: 1200, releaseAngleDeg: 20 });
    const at70 = projectileRangeM({ counterweightKg: 1200, releaseAngleDeg: 70 });
    expect(at45).toBeGreaterThan(at20);
    expect(at45).toBeGreaterThan(at70);
  });
});

describe('siege target generation', () => {
  it('is deterministic for a given seed', () => {
    const a = generateTargets(5, 99);
    const b = generateTargets(5, 99);
    expect(a).toEqual(b);
  });

  it('tightens tolerance on later targets', () => {
    const targets = generateTargets(4, 99);
    expect(targets[3].toleranceM).toBeLessThanOrEqual(targets[0].toleranceM);
  });

  it('evaluateShot reports success within tolerance and failure outside it', () => {
    const [target] = generateTargets(1, 3);
    const goodCfg = { counterweightKg: 1500, releaseAngleDeg: 45 };
    const good = evaluateShot(target, goodCfg);
    expect(good.distanceM).toBeCloseTo(projectileRangeM(goodCfg), 5);

    const bad = evaluateShot(target, { counterweightKg: 500, releaseAngleDeg: 10 });
    expect(bad.diffM).toBeGreaterThan(target.toleranceM);
    expect(bad.success).toBe(false);
  });

  it('flags tooShort when the shot lands short and tooFar when it overshoots', () => {
    const [target] = generateTargets(1, 3);
    const short = evaluateShot(target, { counterweightKg: 500, releaseAngleDeg: 10 });
    expect(short.distanceM).toBeLessThan(target.targetDistanceM);
    expect(short.tooShort).toBe(true);
    expect(short.tooFar).toBe(false);

    const far = evaluateShot(target, { counterweightKg: 3000, releaseAngleDeg: 45 });
    expect(far.distanceM).toBeGreaterThan(target.targetDistanceM);
    expect(far.tooFar).toBe(true);
    expect(far.tooShort).toBe(false);

    const hit = evaluateShot(target, { counterweightKg: 1500, releaseAngleDeg: 45 });
    if (hit.success) {
      expect(hit.tooShort).toBe(false);
      expect(hit.tooFar).toBe(false);
    }
  });
});
