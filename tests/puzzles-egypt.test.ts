import { describe, expect, it } from 'vitest';
import { checkAnswer, generateBlocks } from '../src/core/puzzles/egypt';

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
});
