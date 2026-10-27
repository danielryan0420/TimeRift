import { describe, expect, it } from 'vitest';
import {
  evaluateFlight,
  generateAttempts,
  liftForceN,
  MAX_SLIDER_SPEED_MS,
} from '../src/core/puzzles/flight';

describe('lift equation', () => {
  it('computes lift with the standard lift equation', () => {
    const lift = liftForceN({ airspeedMs: 10, wingAreaM2: 40, liftCoefficient: 1 });
    expect(lift).toBeCloseTo(0.5 * 1.225 * 1 * 40 * 100, 5);
  });

  it('scales with the square of airspeed', () => {
    const slow = liftForceN({ airspeedMs: 5, wingAreaM2: 40, liftCoefficient: 1 });
    const fast = liftForceN({ airspeedMs: 10, wingAreaM2: 40, liftCoefficient: 1 });
    expect(fast).toBeCloseTo(slow * 4, 5);
  });
});

describe('flight attempt generation', () => {
  it('is deterministic for a given seed', () => {
    const a = generateAttempts(10, 42);
    const b = generateAttempts(10, 42);
    expect(a).toEqual(b);
  });

  it('differs for different seeds (usually)', () => {
    const a = generateAttempts(10, 1);
    const b = generateAttempts(10, 2);
    expect(a).not.toEqual(b);
  });

  it('always leaves a safe speed window below the slider max', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [attempt] = generateAttempts(1, seed);
      expect(attempt.minSpeedMs).toBeLessThanOrEqual(attempt.maxSafeSpeedMs);
      expect(attempt.maxSafeSpeedMs).toBeLessThanOrEqual(MAX_SLIDER_SPEED_MS);
    }
  });
});

describe('evaluateFlight', () => {
  it('fails to take off below the minimum speed', () => {
    const [attempt] = generateAttempts(1, 5);
    const outcome = evaluateFlight(attempt, Math.max(0, attempt.minSpeedMs - 2));
    expect(outcome.tooSlow).toBe(true);
    expect(outcome.success).toBe(false);
  });

  it('succeeds at exactly the minimum speed', () => {
    const [attempt] = generateAttempts(1, 5);
    const outcome = evaluateFlight(attempt, attempt.minSpeedMs);
    expect(outcome.tooSlow).toBe(false);
    expect(outcome.success).toBe(true);
  });

  it('succeeds anywhere inside the safe window', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [attempt] = generateAttempts(1, seed);
      const mid = (attempt.minSpeedMs + attempt.maxSafeSpeedMs) / 2;
      expect(evaluateFlight(attempt, mid).success).toBe(true);
    }
  });

  it('fails above the max safe speed even with plenty of lift', () => {
    const [attempt] = generateAttempts(1, 5);
    const outcome = evaluateFlight(attempt, attempt.maxSafeSpeedMs + 5);
    expect(outcome.tooFast).toBe(true);
    expect(outcome.success).toBe(false);
  });
});
