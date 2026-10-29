import { mulberry32 } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = 'Projectile motion: how launch angle and stored energy (counterweight) trade off to control how far something flies.';

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
  tooShort: boolean;
  tooFar: boolean;
}

export function evaluateShot(target: SiegeTarget, cfg: TrebuchetConfig): ShotOutcome {
  const distanceM = projectileRangeM(cfg);
  const diffM = Math.abs(distanceM - target.targetDistanceM);
  const success = diffM <= target.toleranceM;
  return {
    targetId: target.id,
    distanceM,
    success,
    diffM,
    tooShort: !success && distanceM < target.targetDistanceM,
    tooFar: !success && distanceM > target.targetDistanceM,
  };
}

/** The counterweight that lands closest to the target distance at a 45° release angle (inverting projectileRangeM/launchSpeedMs). */
function counterweightFor45(targetDistanceM: number): number {
  const v = Math.sqrt(targetDistanceM * GRAVITY_MS2);
  const exact = Math.max(MIN_COUNTERWEIGHT_KG, Math.min(MAX_COUNTERWEIGHT_KG, (v / 1.2) ** 2));
  return Math.round(exact / 50) * 50;
}

/** Tier 1: a conceptual nudge about the angle. Tier 2: a counterweight range around the ideal. Tier 3: the exact counterweight worked out for this target. */
export function castleHints(target: SiegeTarget): HintDef[] {
  const exact = counterweightFor45(target.targetDistanceM);
  return [
    { level: 1, text: 'A 45° release angle gives the longest range for a given counterweight — heavier counterweights fling the stone farther.' },
    { level: 2, text: `At 45°, try a counterweight somewhere around ${Math.max(MIN_COUNTERWEIGHT_KG, exact - 300)}-${Math.min(MAX_COUNTERWEIGHT_KG, exact + 300)} kg.` },
    { level: 3, text: `At 45°, about ${exact} kg of counterweight should land right around ${target.targetDistanceM} m.` },
  ];
}
