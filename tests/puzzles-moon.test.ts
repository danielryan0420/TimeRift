import { describe, expect, it } from 'vitest';
import { canLiftOff, deltaV, evaluateLaunch, thrustToWeightRatio } from '../src/core/puzzles/moon';

const base = { thrustN: 2_000_000, dryMassKg: 5000, fuelMassKg: 15000, exhaustVelocityMs: 3000 };

describe('rocket force balance', () => {
  it('computes thrust-to-weight ratio', () => {
    const ratio = thrustToWeightRatio(base);
    expect(ratio).toBeCloseTo(2_000_000 / (20000 * 9.81), 5);
  });

  it('cannot lift off when overloaded with fuel', () => {
    const heavy = { ...base, fuelMassKg: 500_000 };
    expect(canLiftOff(heavy)).toBe(false);
  });

  it('can lift off with a healthy thrust-to-weight ratio', () => {
    expect(canLiftOff(base)).toBe(true);
  });

  it('computes delta-v via the rocket equation', () => {
    const dv = deltaV(base);
    expect(dv).toBeCloseTo(3000 * Math.log(20000 / 5000), 5);
  });

  it('fails the launch if too little fuel for required delta-v', () => {
    const lowFuel = { ...base, fuelMassKg: 500 };
    const result = evaluateLaunch(lowFuel, 9000);
    expect(result.reachedOrbit).toBe(false);
    expect(result.success).toBe(false);
  });

  it('fails the launch if overweight even though it has fuel', () => {
    const tooHeavy = { ...base, fuelMassKg: 500_000 };
    const result = evaluateLaunch(tooHeavy, 9000);
    expect(result.overweight).toBe(true);
    expect(result.success).toBe(false);
  });

  it('succeeds when thrust and fuel are balanced for the target orbit', () => {
    const tuned = { thrustN: 2_000_000, dryMassKg: 5000, fuelMassKg: 12000, exhaustVelocityMs: 3000 };
    const result = evaluateLaunch(tuned, 3000);
    expect(result.success).toBe(true);
  });
});
