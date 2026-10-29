import { mulberry32 } from '../rng';
import type { HintDef } from '../hints';

/** The real-world idea this puzzle teaches, shown in the "What you'll learn" line before play. */
export const LEARN_GOAL = 'Ratio and proportion: the golden ratio (~1.618), an unevenly weighted split artists use for pleasing compositions.';

/** Renaissance artists composed paintings around the golden ratio for pleasing proportions. */
export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

/** The point along a span of `width` that divides it in the golden ratio (long part on the left). */
export function goldenSectionPoint(width: number): number {
  return width / GOLDEN_RATIO;
}

export interface CanvasChallenge {
  id: number;
  widthPx: number;
  targetXPx: number;
  tolerancePx: number;
  subject: string;
}

const SUBJECTS = ['a portrait', 'the altarpiece', 'a fresco panel', 'the courtyard mural'];

export function generateCanvases(count: number, seed: number): CanvasChallenge[] {
  const rand = mulberry32(seed);
  const challenges: CanvasChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const widthPx = 420 + Math.floor(rand() * 220);
    const tolerancePx = Math.max(10, 26 - i * 5);
    challenges.push({
      id: i,
      widthPx,
      targetXPx: goldenSectionPoint(widthPx),
      tolerancePx,
      subject: SUBJECTS[i % SUBJECTS.length],
    });
  }
  return challenges;
}

export interface PlacementOutcome {
  challengeId: number;
  diffPx: number;
  success: boolean;
}

export function evaluatePlacement(challenge: CanvasChallenge, chosenXPx: number): PlacementOutcome {
  const diffPx = Math.abs(chosenXPx - challenge.targetXPx);
  return { challengeId: challenge.id, diffPx, success: diffPx <= challenge.tolerancePx };
}

/** Tier 1: the ratio's definition. Tier 2: the rough percentage, no pixels. Tier 3: the exact pixel offset for this canvas. */
export function florenceHints(challenge: CanvasChallenge): HintDef[] {
  return [
    { level: 1, text: `The golden ratio splits a span of ${challenge.widthPx}px so the whole is to the long part as the long part is to the short part.` },
    { level: 2, text: "That works out to about 62% of the way across — not the middle, favor one side." },
    { level: 3, text: `Aim for about ${Math.round(challenge.targetXPx)}px from the left edge.` },
  ];
}
