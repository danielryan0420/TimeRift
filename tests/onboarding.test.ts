import { describe, expect, it } from 'vitest';
import {
  EGYPT_TUTORIAL_STEPS,
  comboMessage,
  goalBannerText,
  isTutorialPending,
  nextActionText,
} from '../src/core/onboarding';

describe('goal banner', () => {
  it('always shows the current goal with a recognizable prefix', () => {
    expect(goalBannerText('Move all 6 blocks')).toBe('🎯 Goal: Move all 6 blocks');
  });

  it('formats the next action callout', () => {
    expect(nextActionText('Tap a tool below')).toBe('👉 Tap a tool below');
  });
});

describe('first-era guided tutorial', () => {
  it('is pending for a brand-new profile', () => {
    expect(isTutorialPending(undefined)).toBe(true);
    expect(isTutorialPending(false)).toBe(true);
  });

  it('is not pending once the profile has finished it', () => {
    expect(isTutorialPending(true)).toBe(false);
  });

  it('has at least one step explaining the goal, the action, and the hint button', () => {
    expect(EGYPT_TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(3);
    for (const step of EGYPT_TUTORIAL_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.line.length).toBeGreaterThan(0);
    }
    expect(EGYPT_TUTORIAL_STEPS.some((s) => /hint/i.test(s.line))).toBe(true);
  });
});

describe('combo streak messages', () => {
  it('stays quiet below the first milestone', () => {
    expect(comboMessage(0)).toBeNull();
    expect(comboMessage(2)).toBeNull();
  });

  it('celebrates at 3 and every 5th streak after that', () => {
    expect(comboMessage(3)).toMatch(/3 in a row/);
    expect(comboMessage(4)).toBeNull();
    expect(comboMessage(5)).toMatch(/5 in a row/);
    expect(comboMessage(10)).toMatch(/10 in a row/);
  });
});
