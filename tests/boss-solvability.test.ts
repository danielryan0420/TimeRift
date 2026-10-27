import { describe, expect, it } from 'vitest';
import { checkAnswer, generateBlocks, TOOLS } from '../src/core/puzzles/egypt';
import { checkLock, generateLockPuzzle, toRoman } from '../src/core/puzzles/rome';
import { evaluateLeg, generateVoyage } from '../src/core/puzzles/vikings';
import { evaluateShot, generateTargets, MAX_COUNTERWEIGHT_KG, MIN_COUNTERWEIGHT_KG } from '../src/core/puzzles/castle';
import { evaluatePlacement, generateCanvases } from '../src/core/puzzles/florence';
import { checkShift, generateCiphers } from '../src/core/puzzles/revolution';
import { generateSolvableOrder, isOrderSolvable } from '../src/core/puzzles/industrial';
import { evaluateLaunch } from '../src/core/puzzles/moon';

/**
 * Regression guard for the final boss fight: every per-era trial it can roll (count=1,
 * using whichever fixed/simplified controls BossEraScene exposes) must have a reachable
 * solution, or the fight can soft-lock a player on an unlucky seed. This is how the
 * industrial-trial bug (see tests/puzzles-industrial.test.ts) was caught.
 */
const SEEDS = 300;

describe('boss trial solvability sweep', () => {
  it('egypt: some tool always matches the rolled situation', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const block = generateBlocks(1, seed)[0];
      expect(TOOLS.some((tool) => checkAnswer(block, tool))).toBe(true);
    }
  });

  it('rome: the tile set always contains every symbol needed to build the answer (range 1-40)', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const puzzle = generateLockPuzzle(seed, 1, 40);
      const answer = toRoman(puzzle.target);
      const available = [...puzzle.tiles];
      for (const symbol of answer) {
        const idx = available.indexOf(symbol);
        expect(idx).toBeGreaterThanOrEqual(0);
        available.splice(idx, 1);
      }
      expect(checkLock(puzzle.target, answer)).toBe(true);
    }
  });

  it('vikings: the dial (5-degree snap) can always reach the target bearing exactly', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const leg = generateVoyage(1, seed)[0];
      const snapped = Math.round(leg.targetBearing / 5) * 5;
      expect(evaluateLeg(leg, snapped).success).toBe(true);
    }
  });

  it('castle: some counterweight on the slider hits the target at the boss\'s fixed angle', () => {
    // Must match BOSS_CASTLE_ANGLE_DEG in BossEraScene.ts. 45deg (optimal range) was the
    // bug: it can't reach short-distance targets at any counterweight, so the boss fixes
    // a shallower angle that still spans the full generated target-distance range.
    const BOSS_CASTLE_ANGLE_DEG = 20;
    for (let seed = 0; seed < SEEDS; seed++) {
      const target = generateTargets(1, seed)[0];
      let solved = false;
      for (let cw = MIN_COUNTERWEIGHT_KG; cw <= MAX_COUNTERWEIGHT_KG; cw += 50) {
        if (evaluateShot(target, { counterweightKg: cw, releaseAngleDeg: BOSS_CASTLE_ANGLE_DEG }).success) {
          solved = true;
          break;
        }
      }
      expect(solved).toBe(true);
    }
  });

  it('florence: the exact golden-ratio point is always a valid line position', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const canvas = generateCanvases(1, seed)[0];
      expect(evaluatePlacement(canvas, canvas.targetXPx).success).toBe(true);
      expect(canvas.targetXPx).toBeGreaterThanOrEqual(0);
      expect(canvas.targetXPx).toBeLessThanOrEqual(canvas.widthPx);
    }
  });

  it('revolution: the cipher wheel (26 exact stops) always reaches the real shift', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const cipher = generateCiphers(1, seed)[0];
      expect(checkShift(cipher, cipher.shift)).toBe(true);
    }
  });

  it('industrial: generateSolvableOrder guarantees a reachable order with drive fixed at 20', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const order = generateSolvableOrder(seed, 20);
      expect(isOrderSolvable(order, 20)).toBe(true);
    }
  });

  it('moon: the fixed-thrust boss mission is reachable within the fuel slider range', () => {
    const mission = { dryMassKg: 5500, requiredDeltaVMs: 3400, thrustN: 300_000 };
    let solved = false;
    for (let fuel = 0; fuel <= 24_000; fuel += 200) {
      if (evaluateLaunch({ thrustN: mission.thrustN, dryMassKg: mission.dryMassKg, fuelMassKg: fuel, exhaustVelocityMs: 3000 }, mission.requiredDeltaVMs).success) {
        solved = true;
        break;
      }
    }
    expect(solved).toBe(true);
  });
});
