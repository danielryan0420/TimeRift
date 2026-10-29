/** Simplified real rocket physics: thrust-to-weight ratio and the Tsiolkovsky rocket equation. */
import { mulberry32 } from '../rng';

export interface RocketConfig {
  thrustN: number;
  dryMassKg: number;
  fuelMassKg: number;
  exhaustVelocityMs: number;
}

const GRAVITY_MS2 = 9.81;
const MAX_STRUCTURAL_MASS_KG = 30000;

export function totalMass(cfg: RocketConfig): number {
  return cfg.dryMassKg + cfg.fuelMassKg;
}

export function thrustToWeightRatio(cfg: RocketConfig): number {
  return cfg.thrustN / (totalMass(cfg) * GRAVITY_MS2);
}

export function canLiftOff(cfg: RocketConfig): boolean {
  return thrustToWeightRatio(cfg) > 1;
}

/** Tsiolkovsky rocket equation: deltaV = v_e * ln(m0/m1) */
export function deltaV(cfg: RocketConfig): number {
  const m0 = totalMass(cfg);
  const m1 = cfg.dryMassKg;
  if (m1 <= 0) return 0;
  return cfg.exhaustVelocityMs * Math.log(m0 / m1);
}

export interface LaunchResult {
  liftoff: boolean;
  deltaVMs: number;
  reachedOrbit: boolean;
  overweight: boolean;
  success: boolean;
  reason: string;
}

export function evaluateLaunch(cfg: RocketConfig, requiredDeltaVMs: number): LaunchResult {
  const overweight = totalMass(cfg) > MAX_STRUCTURAL_MASS_KG;
  const liftoff = !overweight && canLiftOff(cfg);
  const dv = deltaV(cfg);
  const reachedOrbit = dv >= requiredDeltaVMs;
  const success = liftoff && reachedOrbit;

  let reason = 'Launch successful! Orbit achieved.';
  if (overweight) reason = 'Too heavy for the launch frame — reduce fuel or payload.';
  else if (!liftoff) reason = 'Thrust cannot overcome weight — add more thrust or less mass.';
  else if (!reachedOrbit) reason = 'Ran out of fuel before reaching orbital speed — add more fuel.';

  return { liftoff, deltaVMs: dv, reachedOrbit, overweight, success, reason };
}

export { MAX_STRUCTURAL_MASS_KG, GRAVITY_MS2 };

export interface MoonEngine {
  id: string;
  label: string;
  thrustN: number;
}

/**
 * Thrust is sized so the Small engine can lift the easy missions but physically cannot
 * reach Trans-Lunar Injection's required delta-v within the structural mass cap — the
 * engine pick has to matter, not just the fuel slider (see tests/puzzles-moon.test.ts).
 */
export const ENGINES: MoonEngine[] = [
  { id: 'small', label: 'Small', thrustN: 150_000 },
  { id: 'medium', label: 'Medium', thrustN: 300_000 },
  { id: 'large', label: 'Large', thrustN: 600_000 },
];

export interface MoonMission {
  label: string;
  dryMassKg: number;
  requiredDeltaVMs: number;
}

export const EXHAUST_VELOCITY_MS = 3000;
export const MAX_FUEL_KG = 24_000;

/** The most delta-v an engine can produce for a given dry mass, capped by both the fuel tank and the structural mass limit, with one slider step (200kg) of safety margin so quantized fuel values don't fall just outside the feasible range. */
function maxDeltaVForEngine(dryMassKg: number, thrustN: number): number {
  const maxMassForLiftoff = thrustN / GRAVITY_MS2;
  const maxTotalMass = Math.min(maxMassForLiftoff, MAX_STRUCTURAL_MASS_KG);
  const rawFuel = Math.min(MAX_FUEL_KG, maxTotalMass - dryMassKg);
  const fuelKg = Math.max(0, Math.floor(rawFuel / 200) * 200 - 200);
  if (fuelKg <= 0) return 0;
  return EXHAUST_VELOCITY_MS * Math.log((dryMassKg + fuelKg) / dryMassKg);
}

/**
 * Randomizes the 3 mission targets per play while preserving the design invariant tests
 * in tests/puzzles-moon.test.ts rely on: the easiest mission must be solvable with the Small
 * engine, the hardest must NOT be (engine pick has to matter, not just the fuel slider), and
 * the Large engine must clear every mission. Dry-mass ranges per tier are chosen wide enough
 * apart that those properties hold for any roll, then required delta-v is sampled as a
 * fraction of the relevant engine's max-achievable delta-v (with margin) instead of a fixed
 * number, so it's always correct for whatever dry mass was rolled.
 */
export function generateMissions(seed: number): MoonMission[] {
  const rand = mulberry32(seed);
  const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const randIn = (min: number, max: number) => min + rand() * (max - min);
  const roundTo50 = (n: number) => Math.round(n / 50) * 50;

  const small = ENGINES.find((e) => e.id === 'small')!.thrustN;
  const large = ENGINES.find((e) => e.id === 'large')!.thrustN;

  const dryMassEasy = randInt(3200, 4200);
  const dryMassMid = randInt(4300, 5200);
  const dryMassHard = randInt(5500, 7000);

  const hardLo = maxDeltaVForEngine(dryMassHard, small) * 1.15;
  const hardHi = maxDeltaVForEngine(dryMassHard, large) * 0.85;
  const requiredHard = roundTo50(randIn(hardLo, hardHi));

  // Clamped below requiredHard (not sampled independently) so the 3 missions always come out
  // in strictly increasing difficulty, even though their dry-mass tiers' delta-v ranges overlap.
  const easyRaw = roundTo50(randIn(0.55, 0.8) * maxDeltaVForEngine(dryMassEasy, small));
  const requiredEasy = Math.min(requiredHard - 400, Math.max(1200, easyRaw));
  const requiredMid = roundTo50(randIn(requiredEasy + 200, requiredHard - 200));

  return [
    { label: 'Test Hop', dryMassKg: dryMassEasy, requiredDeltaVMs: requiredEasy },
    { label: 'Orbit Insertion', dryMassKg: dryMassMid, requiredDeltaVMs: requiredMid },
    { label: 'Trans-Lunar Injection', dryMassKg: dryMassHard, requiredDeltaVMs: requiredHard },
  ];
}
