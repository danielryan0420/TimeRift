import { describe, expect, it } from 'vitest';
import { computeStars, createDefaultProfile, isEraUnlocked, recordEraCompletion, totalStars } from '../src/core/progression';

describe('computeStars', () => {
  const opts = { mistakeLimit: 1, timeTargetSeconds: 60 };

  it('awards 3 stars for a clean fast run', () => {
    expect(computeStars({ mistakes: 0, hintsUsed: 0, timeSeconds: 30 }, opts)).toBe(3);
  });

  it('loses a star for using a hint', () => {
    expect(computeStars({ mistakes: 0, hintsUsed: 1, timeSeconds: 30 }, opts)).toBe(2);
  });

  it('loses a star for too many mistakes', () => {
    expect(computeStars({ mistakes: 3, hintsUsed: 0, timeSeconds: 30 }, opts)).toBe(2);
  });

  it('loses a star for being slow', () => {
    expect(computeStars({ mistakes: 0, hintsUsed: 0, timeSeconds: 90 }, opts)).toBe(2);
  });

  it('never drops below zero', () => {
    expect(computeStars({ mistakes: 5, hintsUsed: 3, timeSeconds: 200 }, opts)).toBe(0);
  });
});

describe('profile progression', () => {
  it('starts with all eras locked except the first', () => {
    const profile = createDefaultProfile('p1', 'Rin');
    expect(isEraUnlocked(profile, 'egypt')).toBe(true);
    expect(isEraUnlocked(profile, 'rome')).toBe(false);
  });

  it('unlocks the next era after completing one', () => {
    let profile = createDefaultProfile('p1', 'Rin');
    profile = recordEraCompletion(profile, 'egypt', 3, { mistakes: 0, hintsUsed: 0, timeSeconds: 10 });
    expect(isEraUnlocked(profile, 'rome')).toBe(true);
    expect(profile.eraProgress.egypt.completed).toBe(true);
    expect(profile.eraProgress.egypt.stars).toBe(3);
    expect(profile.artifactsCollected).toContain('egypt-scarab');
  });

  it('keeps the best star rating across repeated attempts', () => {
    let profile = createDefaultProfile('p1', 'Rin');
    profile = recordEraCompletion(profile, 'egypt', 1, { mistakes: 3, hintsUsed: 1, timeSeconds: 90 });
    profile = recordEraCompletion(profile, 'egypt', 3, { mistakes: 0, hintsUsed: 0, timeSeconds: 10 });
    profile = recordEraCompletion(profile, 'egypt', 2, { mistakes: 1, hintsUsed: 1, timeSeconds: 40 });
    expect(profile.eraProgress.egypt.stars).toBe(3);
  });

  it('does not duplicate artifacts on repeat completion', () => {
    let profile = createDefaultProfile('p1', 'Rin');
    profile = recordEraCompletion(profile, 'egypt', 3, { mistakes: 0, hintsUsed: 0, timeSeconds: 10 });
    profile = recordEraCompletion(profile, 'egypt', 2, { mistakes: 1, hintsUsed: 1, timeSeconds: 40 });
    expect(profile.artifactsCollected.filter((a) => a === 'egypt-scarab')).toHaveLength(1);
  });

  it('unlocks gadget skins once enough total stars are earned', () => {
    let profile = createDefaultProfile('p1', 'Rin');
    expect(profile.unlockedSkins).toEqual(['default']);
    profile = recordEraCompletion(profile, 'egypt', 3, { mistakes: 0, hintsUsed: 0, timeSeconds: 10 });
    profile = recordEraCompletion(profile, 'rome', 3, { mistakes: 0, hintsUsed: 0, timeSeconds: 10 });
    expect(totalStars(profile)).toBe(6);
    expect(profile.unlockedSkins).toContain('bronze');
  });
});
