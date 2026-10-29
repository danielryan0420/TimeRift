import { mulberry32 } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = 'Simple machines: how a block\'s weight and the distance it must travel decide whether you need a ramp, lever, sledge, or wet sand.';

/** Real techniques Egyptians used to raise pyramid stones. */
export type Tool = 'ramp' | 'lever' | 'sled' | 'water';

export const TOOLS: Tool[] = ['ramp', 'lever', 'sled', 'water'];

export const TOOL_INFO: Record<Tool, { label: string; fact: string }> = {
  ramp: { label: 'Ramp', fact: 'Long mudbrick ramps let workers drag very heavy blocks upward gradually.' },
  lever: { label: 'Lever', fact: 'Wooden levers pried mid-weight blocks up a few inches at a time.' },
  sled: { label: 'Sledge', fact: 'Light stones were lashed to wooden sledges and dragged short distances.' },
  water: { label: 'Wet Sand', fact: 'Wetting the sand ahead of a sledge cut friction nearly in half over long hauls.' },
};

export const MIN_WEIGHT_KG = 300;
export const MAX_WEIGHT_KG = 1400;
export const MIN_DISTANCE_M = 5;
export const MAX_DISTANCE_M = 80;

/** Distance beyond which friction (not raw force) is the dominant problem — wetting the sand wins. */
const LONG_HAUL_DISTANCE_M = 40;
/** Weight above which a block needs a ramp's mechanical advantage rather than a simple pry. */
const RAMP_WEIGHT_KG = 900;
/** Weight below which a block is light enough to just drag on a sledge. */
const SLED_WEIGHT_KG = 500;

export interface BlockChallenge {
  id: number;
  weightKg: number;
  distanceM: number;
  correctTool: Tool;
}

/**
 * The right tool depends on BOTH numbers, checked in order — distance dominates first
 * (friction over a long haul beats any amount of brute force), then weight splits the
 * short-haul case into ramp/lever/sledge. Every (weight, distance) pair has exactly one
 * correct tool, so there's always a right answer to reason toward, never a coin flip.
 */
export function toolForBlock(weightKg: number, distanceM: number): Tool {
  if (distanceM > LONG_HAUL_DISTANCE_M) return 'water';
  if (weightKg > RAMP_WEIGHT_KG) return 'ramp';
  if (weightKg > SLED_WEIGHT_KG) return 'lever';
  return 'sled';
}

export function generateBlocks(count: number, seed: number): BlockChallenge[] {
  const rand = mulberry32(seed);
  const blocks: BlockChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const weightKg = MIN_WEIGHT_KG + Math.floor(rand() * (MAX_WEIGHT_KG - MIN_WEIGHT_KG + 1));
    const distanceM = MIN_DISTANCE_M + Math.floor(rand() * (MAX_DISTANCE_M - MIN_DISTANCE_M + 1));
    blocks.push({ id: i, weightKg, distanceM, correctTool: toolForBlock(weightKg, distanceM) });
  }
  return blocks;
}

export function checkAnswer(block: BlockChallenge, chosenTool: Tool): boolean {
  return block.correctTool === chosenTool;
}

/** Nudges the player toward the reasoning (distance first, then weight) without giving the tool away. */
export function conceptHint(block: BlockChallenge): string {
  if (block.distanceM > LONG_HAUL_DISTANCE_M) return 'That is a long haul — think about cutting friction on the sand...';
  if (block.weightKg > RAMP_WEIGHT_KG) return 'That is very heavy for a short move — think about mechanical advantage...';
  if (block.weightKg > SLED_WEIGHT_KG) return 'Medium weight, short move — think about something short you can pry with...';
  return 'Light enough for a short move — the simplest drag will do...';
}

/** Tier 1: a conceptual nudge. Tier 2: the full rule of thumb, no numbers plugged in yet. Tier 3: the rule worked through with this block's real numbers. */
export function egyptHints(block: BlockChallenge): HintDef[] {
  const why = block.distanceM > LONG_HAUL_DISTANCE_M
    ? 'that long haul means friction is the real problem'
    : block.weightKg > RAMP_WEIGHT_KG
      ? "that's too heavy to pry or just drag"
      : block.weightKg > SLED_WEIGHT_KG
        ? "that's a job for prying, not dragging"
        : "it's light enough to just drag";
  return [
    { level: 1, text: conceptHint(block) },
    {
      level: 2,
      text: `Rule of thumb: over ${LONG_HAUL_DISTANCE_M}m → Wet Sand. 40m or under: over ${RAMP_WEIGHT_KG}kg → Ramp, over ${SLED_WEIGHT_KG}kg → Lever, else → Sledge.`,
    },
    {
      level: 3,
      text: `This block is ${block.weightKg}kg and travels ${block.distanceM}m — ${why}, so use the ${TOOL_INFO[block.correctTool].label}!`,
    },
  ];
}
