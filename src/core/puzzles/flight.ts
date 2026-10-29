import { mulberry32, pickFrom } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = 'Aerodynamics: lift grows with the square of airspeed, so there is a safe speed window between "too slow to lift" and "too fast to survive."';

/** Simplified lift equation: L = 1/2 * air density * CL * wing area * speed^2. */
export const AIR_DENSITY_KGM3 = 1.225;

export interface FlightConfig {
  airspeedMs: number;
  wingAreaM2: number;
  liftCoefficient: number;
}

export function liftForceN(cfg: FlightConfig): number {
  return 0.5 * AIR_DENSITY_KGM3 * cfg.liftCoefficient * cfg.wingAreaM2 * cfg.airspeedMs * cfg.airspeedMs;
}

export interface FlightAttempt {
  id: number;
  wingAreaM2: number;
  liftCoefficient: number;
  weightN: number;
  /** Slowest speed that generates enough lift to leave the ground. */
  minSpeedMs: number;
  /** Fastest speed the wood-and-fabric frame can take before it risks breaking apart. */
  maxSafeSpeedMs: number;
  windLabel: string;
}

const WIND_LABELS = [
  'a calm morning at Kitty Hawk',
  'a brisk headwind off the dunes',
  'a gusty afternoon on the beach',
  'a steady onshore breeze',
];

export const MAX_SLIDER_SPEED_MS = 30;

export function generateAttempts(count: number, seed: number): FlightAttempt[] {
  const rand = mulberry32(seed);
  const attempts: FlightAttempt[] = [];
  for (let i = 0; i < count; i++) {
    const wingAreaM2 = 30 + Math.floor(rand() * 20);
    const liftCoefficient = Math.round((0.8 + rand() * 0.4) * 100) / 100;
    const minSpeedMs = 8 + Math.floor(rand() * 6);
    const weightN = liftForceN({ airspeedMs: minSpeedMs, wingAreaM2, liftCoefficient });
    const maxSafeSpeedMs = minSpeedMs + 6 + Math.floor(rand() * 3);
    attempts.push({
      id: i,
      wingAreaM2,
      liftCoefficient,
      weightN,
      minSpeedMs,
      maxSafeSpeedMs,
      windLabel: pickFrom(rand, WIND_LABELS),
    });
  }
  return attempts;
}

export interface FlightOutcome {
  attemptId: number;
  liftN: number;
  tooSlow: boolean;
  tooFast: boolean;
  success: boolean;
}

export function evaluateFlight(attempt: FlightAttempt, airspeedMs: number): FlightOutcome {
  const liftN = liftForceN({ airspeedMs, wingAreaM2: attempt.wingAreaM2, liftCoefficient: attempt.liftCoefficient });
  const tooSlow = liftN < attempt.weightN;
  const tooFast = airspeedMs > attempt.maxSafeSpeedMs;
  return { attemptId: attempt.id, liftN, tooSlow, tooFast, success: !tooSlow && !tooFast };
}

/** Tier 1: the lift-vs-speed relationship. Tier 2: the safe speed range. Tier 3: one exact speed in the middle of that range. */
export function flightHints(attempt: FlightAttempt): HintDef[] {
  const mid = Math.round(((attempt.minSpeedMs + attempt.maxSafeSpeedMs) / 2) * 2) / 2;
  return [
    { level: 1, text: 'Lift grows with the square of airspeed — small speed increases matter a lot.' },
    { level: 2, text: `Try somewhere between ${attempt.minSpeedMs} and ${attempt.maxSafeSpeedMs} m/s.` },
    { level: 3, text: `Try about ${mid} m/s — right in the middle of the safe window.` },
  ];
}
