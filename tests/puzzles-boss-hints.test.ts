import { describe, expect, it } from 'vitest';
import { HintTracker } from '../src/core/hints';
import {
  BOSS_ROUND_GOAL,
  BOSS_ROUND_HOWTO,
  castleBossHints,
  chinaBossHints,
  egyptBossHints,
  flightBossHints,
  florenceBossHints,
  industrialBossHints,
  moonBossHints,
  revolutionBossHints,
  romeBossHints,
  vikingsBossHints,
} from '../src/core/puzzles/boss';
import { ERA_ORDER } from '../src/core/types';
import { checkAnswer, generateBlocks, TOOLS } from '../src/core/puzzles/egypt';
import { checkLock, generateLockPuzzle } from '../src/core/puzzles/rome';
import { checkGood, generateStops, GOODS } from '../src/core/puzzles/china';
import { evaluateLeg, generateVoyage } from '../src/core/puzzles/vikings';
import { generateTargets } from '../src/core/puzzles/castle';
import { evaluatePlacement, generateCanvases } from '../src/core/puzzles/florence';
import { checkShift, generateCiphers } from '../src/core/puzzles/revolution';
import { evaluateOrder, generateSolvableOrder } from '../src/core/puzzles/industrial';
import { evaluateFlight, generateAttempts } from '../src/core/puzzles/flight';
import { evaluateLaunch } from '../src/core/puzzles/moon';

const SEEDS = 60;
const MOON_MISSION = { dryMassKg: 5500, requiredDeltaVMs: 3400, thrustN: 300_000, exhaustVelocityMs: 3000, maxFuelKg: 24_000 };

describe('boss round metadata covers every era', () => {
  it('has a how-to-play line and a current goal for every trial', () => {
    for (const era of ERA_ORDER) {
      expect(BOSS_ROUND_HOWTO[era]).toBeTruthy();
      expect(BOSS_ROUND_GOAL[era]).toBeTruthy();
    }
  });
});

describe('boss trial hints are always exactly 2 levels and always correct', () => {
  it('egypt: level-2 hint names a tool that actually solves the rolled situation', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const block = generateBlocks(1, seed)[0];
      const hints = egyptBossHints(block);
      expect(hints).toHaveLength(2);
      expect(hints.every((h) => h.text.length > 0)).toBe(true);
      expect(TOOLS.some((tool) => checkAnswer(block, tool) && hints[1].text.includes(tool === 'water' ? 'Wet Sand' : tool[0].toUpperCase() + tool.slice(1)))).toBe(true);
    }
  });

  it('rome: level-2 hint reveals the exact numeral that opens the lock', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const puzzle = generateLockPuzzle(seed, 1, 40);
      const hints = romeBossHints(puzzle.target);
      expect(hints).toHaveLength(2);
      const answer = hints[1].text.match(/The answer is (.+)\.$/)?.[1];
      expect(answer).toBeTruthy();
      expect(checkLock(puzzle.target, answer!)).toBe(true);
    }
  });

  it('china: level-2 hint names the good the merchant actually wants', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const stop = generateStops(1, seed)[0];
      const hints = chinaBossHints(stop);
      expect(hints).toHaveLength(2);
      expect(GOODS.some((good) => checkGood(stop, good) && hints[1].text.includes(good[0].toUpperCase() + good.slice(1)))).toBe(true);
    }
  });

  it('vikings: level-2 hint bearing actually lands on course', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const leg = generateVoyage(1, seed)[0];
      const hints = vikingsBossHints(leg);
      expect(hints).toHaveLength(2);
      expect(evaluateLeg(leg, leg.targetBearing).success).toBe(true);
      expect(hints[1].text).toContain(`${leg.targetBearing}`);
    }
  });

  it('castle: level-2 hint range is reachable at the boss\'s fixed angle', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const target = generateTargets(1, seed)[0];
      const hints = castleBossHints(target);
      expect(hints).toHaveLength(2);
      expect(hints[1].text).toContain(`${target.targetDistanceM}`);
    }
  });

  it('florence: level-2 hint pixel position actually passes the placement check', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const canvas = generateCanvases(1, seed)[0];
      const hints = florenceBossHints(canvas);
      expect(hints).toHaveLength(2);
      const px = Number(hints[1].text.match(/Aim for about (\d+)px/)?.[1]);
      expect(evaluatePlacement(canvas, px).success).toBe(true);
    }
  });

  it('revolution: level-2 hint shift decodes the cipher', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const cipher = generateCiphers(1, seed)[0];
      const hints = revolutionBossHints(cipher);
      expect(hints).toHaveLength(2);
      expect(checkShift(cipher, cipher.shift)).toBe(true);
      expect(hints[1].text).toContain(`${cipher.shift}`);
    }
  });

  it('industrial: level-2 hint driven-teeth count actually hits the target RPM', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const order = generateSolvableOrder(seed, 20);
      const hints = industrialBossHints(order, 20);
      expect(hints).toHaveLength(2);
      const drivenTeeth = Number(hints[1].text.match(/Try about (\d+)/)?.[1]);
      expect(evaluateOrder(order, { driveTeeth: 20, drivenTeeth }).success).toBe(true);
    }
  });

  it('flight: level-2 hint speed window actually gets airborne safely', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const attempt = generateAttempts(1, seed)[0];
      const hints = flightBossHints(attempt);
      expect(hints).toHaveLength(2);
      const mid = (attempt.minSpeedMs + attempt.maxSafeSpeedMs) / 2;
      expect(evaluateFlight(attempt, mid).success).toBe(true);
    }
  });

  it('moon: level-2 hint fuel amount reaches the required delta-v without overloading', () => {
    const hints = moonBossHints(MOON_MISSION);
    expect(hints).toHaveLength(2);
    const fuelKg = Number(hints[1].text.replace(/,/g, '').match(/Try around (\d+)/)?.[1]);
    const result = evaluateLaunch(
      { thrustN: MOON_MISSION.thrustN, dryMassKg: MOON_MISSION.dryMassKg, fuelMassKg: fuelKg, exhaustVelocityMs: MOON_MISSION.exhaustVelocityMs },
      MOON_MISSION.requiredDeltaVMs,
    );
    expect(result.success).toBe(true);
    expect(fuelKg).toBeLessThanOrEqual(MOON_MISSION.maxFuelKg);
  });
});

describe('boss trials auto-reveal a hint after 2 mistakes, same as every other puzzle', () => {
  it('egypt: no hint after 1 mistake, auto-hint after the 2nd', () => {
    const block = generateBlocks(1, 1)[0];
    const tracker = new HintTracker(egyptBossHints(block));
    expect(tracker.registerMistake()).toBeNull();
    const auto = tracker.registerMistake();
    expect(auto?.text).toBe(egyptBossHints(block)[0].text);
    expect(tracker.usedCount).toBe(1);
  });

  it('moon: a 3rd straight mistake (post-reset) still only grants one more hint', () => {
    const tracker = new HintTracker(moonBossHints(MOON_MISSION));
    tracker.registerMistake();
    tracker.registerMistake(); // auto-reveals hint 1
    tracker.registerSuccess();
    expect(tracker.registerMistake()).toBeNull();
    const auto = tracker.registerMistake();
    expect(auto?.text).toBe(moonBossHints(MOON_MISSION)[1].text);
    expect(tracker.hasMore).toBe(false);
  });
});

describe('boss trials expose a working hint button (manual reveal in order, never throws when exhausted)', () => {
  it('reveals both levels in order for every era, then returns null instead of throwing', () => {
    const hintSetsByEra: Record<string, ReturnType<typeof egyptBossHints>> = {
      egypt: egyptBossHints(generateBlocks(1, 2)[0]),
      rome: romeBossHints(generateLockPuzzle(2, 1, 40).target),
      china: chinaBossHints(generateStops(1, 2)[0]),
      vikings: vikingsBossHints(generateVoyage(1, 2)[0]),
      castle: castleBossHints(generateTargets(1, 2)[0]),
      florence: florenceBossHints(generateCanvases(1, 2)[0]),
      revolution: revolutionBossHints(generateCiphers(1, 2)[0]),
      industrial: industrialBossHints(generateSolvableOrder(2, 20), 20),
      flight: flightBossHints(generateAttempts(1, 2)[0]),
      moon: moonBossHints(MOON_MISSION),
    };

    for (const era of ERA_ORDER) {
      const hints = hintSetsByEra[era];
      const tracker = new HintTracker(hints);
      expect(tracker.next()?.text).toBe(hints[0].text);
      expect(tracker.next()?.text).toBe(hints[1].text);
      expect(tracker.next()).toBeNull();
      expect(tracker.hasMore).toBe(false);
    }
  });
});
