import { mulberry32 } from '../rng';

/** Simplified trebuchet physics: counterweight falls, swings an arm, slings a projectile. */
export const GRAVITY_MS2 = 9.81;
export const MIN_COUNTERWEIGHT_KG = 500;
export const MAX_COUNTERWEIGHT_KG = 3000;
export const MIN_ANGLE_DEG = 10;
export const MAX_ANGLE_DEG = 80;

export interface TrebuchetConfig {
  counterweightKg: number;
  releaseAngleDeg: number;
}

/** More counterweight mass means more stored energy, so a faster sling release (simplified sqrt scaling). */
export function launchSpeedMs(counterweightKg: number): number {
  return Math.sqrt(counterweightKg) * 1.2;
}

/** Projectile range on level ground: v^2 * sin(2*theta) / g. */
export function projectileRangeM(cfg: TrebuchetConfig): number {
  const v = launchSpeedMs(cfg.counterweightKg);
  const rad = (cfg.releaseAngleDeg * Math.PI) / 180;
  return (v * v * Math.sin(2 * rad)) / GRAVITY_MS2;
}

export interface SiegeTarget {
  id: number;
  targetDistanceM: number;
  toleranceM: number;
  wallLabel: string;
}

const WALL_LABELS = ['the outer gatehouse', 'the north barbican', 'the keep wall', 'the drawbridge tower'];

export function generateTargets(count: number, seed: number): SiegeTarget[] {
  const rand = mulberry32(seed);
  const targets: SiegeTarget[] = [];
  for (let i = 0; i < count; i++) {
    const targetDistanceM = 40 + Math.floor(rand() * 120);
    const toleranceM = Math.max(6, 16 - i * 3);
    targets.push({ id: i, targetDistanceM, toleranceM, wallLabel: WALL_LABELS[i % WALL_LABELS.length] });
  }
  return targets;
}

export interface ShotOutcome {
  targetId: number;
  distanceM: number;
  success: boolean;
  diffM: number;
}

export function evaluateShot(target: SiegeTarget, cfg: TrebuchetConfig): ShotOutcome {
  const distanceM = projectileRangeM(cfg);
  const diffM = Math.abs(distanceM - target.targetDistanceM);
  return { targetId: target.id, distanceM, success: diffM <= target.toleranceM, diffM };
}
