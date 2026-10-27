/** Simplified real rocket physics: thrust-to-weight ratio and the Tsiolkovsky rocket equation. */

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
