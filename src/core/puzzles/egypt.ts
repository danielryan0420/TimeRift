import { mulberry32, pickFrom } from '../rng';

/** Real techniques Egyptians used to raise pyramid stones. */
export type Tool = 'ramp' | 'lever' | 'sled' | 'water';

export const TOOLS: Tool[] = ['ramp', 'lever', 'sled', 'water'];

export const TOOL_INFO: Record<Tool, { label: string; fact: string }> = {
  ramp: { label: 'Ramp', fact: 'Long mudbrick ramps let workers drag blocks upward gradually.' },
  lever: { label: 'Lever', fact: 'Wooden levers pried heavy blocks up a few inches at a time.' },
  sled: { label: 'Sledge', fact: 'Stones were lashed to wooden sledges to spread the load.' },
  water: { label: 'Wet Sand', fact: 'Wetting the sand in front of a sledge cut friction nearly in half.' },
};

export interface BlockChallenge {
  id: number;
  /** Situation shown to the player, e.g. "This block must go UP a ramp" */
  situation: BlockSituation;
  correctTool: Tool;
}

export type BlockSituation = 'steep-rise' | 'tight-gap' | 'long-haul' | 'final-lift';

const SITUATION_TOOL: Record<BlockSituation, Tool> = {
  'steep-rise': 'ramp',
  'tight-gap': 'lever',
  'long-haul': 'water',
  'final-lift': 'lever',
};

const SITUATIONS: BlockSituation[] = ['steep-rise', 'tight-gap', 'long-haul', 'final-lift'];

export function generateBlocks(count: number, seed: number): BlockChallenge[] {
  const rand = mulberry32(seed);
  const blocks: BlockChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const situation = pickFrom(rand, SITUATIONS);
    blocks.push({ id: i, situation, correctTool: SITUATION_TOOL[situation] });
  }
  return blocks;
}

export function checkAnswer(block: BlockChallenge, chosenTool: Tool): boolean {
  return block.correctTool === chosenTool;
}
