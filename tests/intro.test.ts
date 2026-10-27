import { beforeEach, describe, expect, it } from 'vitest';
import { hasSeenIntro, markIntroSeen } from '../src/core/intro';

describe('story intro flag', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to not seen for a fresh browser', () => {
    expect(hasSeenIntro()).toBe(false);
  });

  it('remembers the intro was seen across loads', () => {
    markIntroSeen();
    expect(hasSeenIntro()).toBe(true);
  });

  it('is skippable repeatedly without error', () => {
    markIntroSeen();
    markIntroSeen();
    expect(hasSeenIntro()).toBe(true);
  });
});
