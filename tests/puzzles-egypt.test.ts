import { describe, expect, it } from 'vitest';
import { checkAnswer, generateBlocks, toolForBlock, TOOLS } from '../src/core/puzzles/egypt';

describe('egypt pyramid puzzle', () => {
  it('generates a deterministic sequence for a given seed', () => {
    const a = generateBlocks(10, 42);
    const b = generateBlocks(10, 42);
    expect(a).toEqual(b);
  });

  it('generates different sequences for different seeds (usually)', () => {
    const a = generateBlocks(10, 1);
    const b = generateBlocks(10, 2);
    expect(a).not.toEqual(b);
  });

  it('accepts the correct tool for a situation', () => {
    const [block] = generateBlocks(1, 7);
    expect(checkAnswer(block, block.correctTool)).toBe(true);
  });

  it('rejects an incorrect tool', () => {
    const [block] = generateBlocks(1, 7);
    const wrongTool = block.correctTool === 'ramp' ? 'lever' : 'ramp';
    expect(checkAnswer(block, wrongTool)).toBe(false);
  });

  it('weighs distance over weight (a long haul is always water, regardless of weight)', () => {
    expect(toolForBlock(300, 41)).toBe('water');
    expect(toolForBlock(1400, 80)).toBe('water');
  });

  it('splits the short-haul case by weight into ramp/lever/sled', () => {
    expect(toolForBlock(1400, 10)).toBe('ramp');
    expect(toolForBlock(700, 10)).toBe('lever');
    expect(toolForBlock(350, 10)).toBe('sled');
  });

  it('every generated block has a reachable, unambiguous answer among the 4 tools', () => {
    for (let seed = 0; seed < 300; seed++) {
      const [block] = generateBlocks(1, seed);
      const matching = TOOLS.filter((tool) => checkAnswer(block, tool));
      expect(matching).toEqual([block.correctTool]);
    }
  });

  it('replays with different seeds produce different weight/distance pairs (not a static lookup)', () => {
    const a = generateBlocks(5, 10).map((b) => [b.weightKg, b.distanceM]);
    const b = generateBlocks(5, 11).map((b) => [b.weightKg, b.distanceM]);
    expect(a).not.toEqual(b);
  });
});
