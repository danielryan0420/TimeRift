import { describe, expect, it } from 'vitest';
// Raw-text imports (Vite's `?raw` suffix) so this test can check the scene source without
// needing @types/node (not installed in this project) for fs/path APIs.
import egyptEraSource from '../src/eras/EgyptEraScene.ts?raw';
import romeEraSource from '../src/eras/RomeEraScene.ts?raw';
import chinaEraSource from '../src/eras/ChinaEraScene.ts?raw';
import vikingsEraSource from '../src/eras/VikingsEraScene.ts?raw';
import castleEraSource from '../src/eras/CastleEraScene.ts?raw';
import florenceEraSource from '../src/eras/FlorenceEraScene.ts?raw';
import revolutionEraSource from '../src/eras/RevolutionEraScene.ts?raw';
import industrialEraSource from '../src/eras/IndustrialEraScene.ts?raw';
import flightEraSource from '../src/eras/FlightEraScene.ts?raw';
import moonEraSource from '../src/eras/MoonEraScene.ts?raw';
import { castleHints, generateTargets, LEARN_GOAL as CASTLE_GOAL } from '../src/core/puzzles/castle';
import { chinaHints, generateStops, LEARN_GOAL as CHINA_GOAL } from '../src/core/puzzles/china';
import { egyptHints, generateBlocks, LEARN_GOAL as EGYPT_GOAL } from '../src/core/puzzles/egypt';
import { flightHints, generateAttempts, LEARN_GOAL as FLIGHT_GOAL } from '../src/core/puzzles/flight';
import { florenceHints, generateCanvases, LEARN_GOAL as FLORENCE_GOAL } from '../src/core/puzzles/florence';
import { generateOrders, industrialHints, LEARN_GOAL as INDUSTRIAL_GOAL } from '../src/core/puzzles/industrial';
import { ENGINES, generateMissions, LEARN_GOAL as MOON_GOAL, moonHints } from '../src/core/puzzles/moon';
import { generateCiphers, LEARN_GOAL as REVOLUTION_GOAL, revolutionHints } from '../src/core/puzzles/revolution';
import { generateLockPuzzle, LEARN_GOAL as ROME_GOAL, romeHints } from '../src/core/puzzles/rome';
import { generateVoyage, LEARN_GOAL as VIKINGS_GOAL, vikingsHints } from '../src/core/puzzles/vikings';
import { ERA_ORDER, type EraId } from '../src/core/types';

/** Every puzzle module's "what you'll learn" line, keyed the same way as ERA_ORDER. */
const LEARN_GOALS: Record<EraId, string> = {
  egypt: EGYPT_GOAL,
  rome: ROME_GOAL,
  china: CHINA_GOAL,
  vikings: VIKINGS_GOAL,
  castle: CASTLE_GOAL,
  florence: FLORENCE_GOAL,
  revolution: REVOLUTION_GOAL,
  industrial: INDUSTRIAL_GOAL,
  flight: FLIGHT_GOAL,
  moon: MOON_GOAL,
};

/** One representative tiered-hint set per era, built from a fixed seed so this stays deterministic. */
function hintSetsByEra(): Record<EraId, { level: number; text: string }[]> {
  return {
    egypt: egyptHints(generateBlocks(1, 3)[0]),
    rome: romeHints(generateLockPuzzle(3, 1, 500).target),
    china: chinaHints(generateStops(1, 3)[0]),
    vikings: vikingsHints(generateVoyage(1, 3)[0]),
    castle: castleHints(generateTargets(1, 3)[0]),
    florence: florenceHints(generateCanvases(1, 3)[0]),
    revolution: revolutionHints(generateCiphers(1, 3)[0]),
    industrial: industrialHints(generateOrders(1, 3)[0], 20),
    flight: flightHints(generateAttempts(1, 3)[0]),
    moon: moonHints(generateMissions(3)[0], ENGINES[1]),
  };
}

describe('every era has a non-empty, kid-readable "what you\'ll learn" goal', () => {
  for (const era of ERA_ORDER) {
    it(`${era}: LEARN_GOAL is a real sentence`, () => {
      const goal = LEARN_GOALS[era];
      expect(typeof goal).toBe('string');
      expect(goal.length).toBeGreaterThan(20);
      expect(goal.length).toBeLessThan(220);
    });
  }
});

describe('every era exposes exactly 3 hint tiers (nudge, bigger clue, worked example)', () => {
  const hintSets = hintSetsByEra();
  for (const era of ERA_ORDER) {
    it(`${era}: 3 non-empty tiers in order, each more specific than the last`, () => {
      const hints = hintSets[era];
      expect(hints).toHaveLength(3);
      expect(hints.map((h) => h.level)).toEqual([1, 2, 3]);
      for (const hint of hints) {
        expect(hint.text.length).toBeGreaterThan(0);
      }
      // Tiers must be distinct text, not three copies of the same nudge.
      const texts = new Set(hints.map((h) => h.text));
      expect(texts.size).toBe(3);
    });
  }
});

describe('every era scene shows a learning goal and a how-to-play card before the puzzle starts', () => {
  const sourceByEra: Record<EraId, string> = {
    egypt: egyptEraSource,
    rome: romeEraSource,
    china: chinaEraSource,
    vikings: vikingsEraSource,
    castle: castleEraSource,
    florence: florenceEraSource,
    revolution: revolutionEraSource,
    industrial: industrialEraSource,
    flight: flightEraSource,
    moon: moonEraSource,
  };
  for (const era of ERA_ORDER) {
    it(`${era} era scene wires LEARN_GOAL into showHowToPlayCard`, () => {
      const source = sourceByEra[era];
      expect(source).toContain('showHowToPlayCard');
      expect(source).toContain('learnGoal: LEARN_GOAL');
      expect(source).toContain('quiz:');
    });
  }
});
