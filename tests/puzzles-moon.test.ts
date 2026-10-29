import { describe, expect, it } from 'vitest';
import { canLiftOff, deltaV, ENGINES, evaluateLaunch, generateMissions, thrustToWeightRatio } from '../src/core/puzzles/moon';

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

describe('moon mission balance: engine choice must matter', () => {
  const MAX_FUEL = 24_000;
  const FUEL_STEP = 200;
  const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 1);

  type Mission = ReturnType<typeof generateMissions>[number];

  function anyFuelWorks(thrustN: number, mission: Mission): boolean {
    for (let fuel = 0; fuel <= MAX_FUEL; fuel += FUEL_STEP) {
      const result = evaluateLaunch(
        { thrustN, dryMassKg: mission.dryMassKg, fuelMassKg: fuel, exhaustVelocityMs: 3000 },
        mission.requiredDeltaVMs,
      );
      if (result.success) return true;
    }
    return false;
  }

  it('generateMissions is deterministic for a given seed', () => {
    expect(generateMissions(42)).toEqual(generateMissions(42));
  });

  it.each(SEEDS)('seed %i: every mission is solvable with at least one engine', (seed) => {
    for (const mission of generateMissions(seed)) {
      const solvable = ENGINES.some((engine) => anyFuelWorks(engine.thrustN, mission));
      expect(solvable).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: the Small engine cannot reach the hardest mission (engine pick is not cosmetic)', (seed) => {
    const small = ENGINES.find((e) => e.id === 'small')!;
    const missions = generateMissions(seed);
    const hardest = missions[missions.length - 1];
    expect(anyFuelWorks(small.thrustN, hardest)).toBe(false);
  });

  it.each(SEEDS)('seed %i: the Small engine still clears the easiest mission', (seed) => {
    const small = ENGINES.find((e) => e.id === 'small')!;
    const easiest = generateMissions(seed)[0];
    expect(anyFuelWorks(small.thrustN, easiest)).toBe(true);
  });

  it.each(SEEDS)('seed %i: the Large engine clears every mission', (seed) => {
    const large = ENGINES.find((e) => e.id === 'large')!;
    for (const mission of generateMissions(seed)) {
      expect(anyFuelWorks(large.thrustN, mission)).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: mission dry mass and required delta-v both increase with difficulty', (seed) => {
    const missions = generateMissions(seed);
    expect(missions[0].dryMassKg).toBeLessThan(missions[1].dryMassKg);
    expect(missions[1].dryMassKg).toBeLessThan(missions[2].dryMassKg);
    expect(missions[0].requiredDeltaVMs).toBeLessThan(missions[1].requiredDeltaVMs);
    expect(missions[1].requiredDeltaVMs).toBeLessThan(missions[2].requiredDeltaVMs);
  });

  it('different seeds produce different mission targets', () => {
    const a = generateMissions(1);
    const b = generateMissions(2);
    expect(a).not.toEqual(b);
  });
});
