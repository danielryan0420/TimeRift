import { mulberry32 } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = 'Navigation: reading a compass bearing (0-360°) off a fixed star like Polaris to steer a steady heading.';

/** Shortest angular distance between two compass bearings, in degrees [0,180]. */
export function bearingDiff(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

export function isOnCourse(current: number, target: number, toleranceDeg: number): boolean {
  return bearingDiff(current, target) <= toleranceDeg;
}

export interface VoyageLeg {
  id: number;
  /** Bearing to the destination star/landmark, 0-359 degrees. */
  targetBearing: number;
  /** Description of the celestial clue used to find the bearing. */
  clue: string;
  toleranceDeg: number;
}

const CLUE_TEMPLATES = (bearing: number): string => {
  if (bearing === 0) return 'Polaris sits dead ahead over the bow.';
  if (bearing === 180) return 'Polaris is directly behind the stern.';
  if (bearing < 180) return `Polaris is ${bearing} degrees to starboard (right).`;
  return `Polaris is ${360 - bearing} degrees to port (left).`;
};

export function generateVoyage(legCount: number, seed: number): VoyageLeg[] {
  const rand = mulberry32(seed);
  const legs: VoyageLeg[] = [];
  for (let i = 0; i < legCount; i++) {
    const targetBearing = Math.floor(rand() * 36) * 10;
    const toleranceDeg = Math.max(8, 20 - i * 3);
    legs.push({ id: i, targetBearing, clue: CLUE_TEMPLATES(targetBearing), toleranceDeg });
  }
  return legs;
}

export interface VoyageOutcome {
  legId: number;
  success: boolean;
  diffDeg: number;
}

export function evaluateLeg(leg: VoyageLeg, chosenBearing: number): VoyageOutcome {
  const diffDeg = bearingDiff(chosenBearing, leg.targetBearing);
  return { legId: leg.id, success: diffDeg <= leg.toleranceDeg, diffDeg };
}

/** Tier 1: how to read the clue. Tier 2: a 60°-wide range to aim within. Tier 3: the exact heading. */
export function vikingsHints(leg: VoyageLeg): HintDef[] {
  const lo = ((leg.targetBearing - 30) % 360 + 360) % 360;
  const hi = (leg.targetBearing + 30) % 360;
  return [
    { level: 1, text: "Polaris marks true north — read the clue to figure out which way your bow should point relative to it." },
    { level: 2, text: `That's somewhere between ${lo}° and ${hi}° — drag the dial into that range.` },
    { level: 3, text: `Aim for exactly ${leg.targetBearing}°.` },
  ];
}
