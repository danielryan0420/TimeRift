/** Pure helpers for the always-visible goal banner, streak callouts, and the first-era tutorial. */

export function goalBannerText(goal: string): string {
  return `🎯 Goal: ${goal}`;
}

export function nextActionText(action: string): string {
  return `👉 ${action}`;
}

/** Steps shown once, in order, the first time a player plays the guided first era (Egypt). */
export interface TutorialStep {
  title: string;
  line: string;
}

export const EGYPT_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome, Rift Runner!',
    line: 'Each block below needs the right tool to move it. Read the situation, then pick a tool.',
  },
  {
    title: 'Tap a Tool',
    line: 'Tap one of the tool buttons at the bottom of the screen to try it on the current block.',
  },
  {
    title: 'Stuck? We got you.',
    line: 'Tap the glowing Hint button near the top any time — and if you miss twice in a row, a hint pops up for you automatically.',
  },
];

/** The first-era tutorial only plays once per profile; profiles saved before this feature existed default to not-done. */
export function isTutorialPending(tutorialDone: boolean | undefined): boolean {
  return !tutorialDone;
}

/** A short celebratory line for a correct-answer streak, or null when the streak isn't milestone-worthy. */
export function comboMessage(streak: number): string | null {
  if (streak < 3) return null;
  if (streak % 5 === 0) return `🔥🔥 ${streak} in a row! On fire!`;
  if (streak === 3) return `🔥 3 in a row!`;
  return null;
}
