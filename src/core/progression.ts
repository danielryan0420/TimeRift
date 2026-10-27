import type { EraAttemptResult, EraId, EraProgress, PlayerProfile, Stars } from './types';
import { ERA_ORDER } from './types';

/** Star rating: start at 3 and lose one for hints, one for too many mistakes, one for being slow. */
export function computeStars(
  result: EraAttemptResult,
  opts: { mistakeLimit: number; timeTargetSeconds: number },
): Stars {
  let stars = 3;
  if (result.hintsUsed > 0) stars -= 1;
  if (result.mistakes > opts.mistakeLimit) stars -= 1;
  if (result.timeSeconds > opts.timeTargetSeconds) stars -= 1;
  return Math.max(0, Math.min(3, stars)) as Stars;
}

export interface ArtifactDef {
  id: string;
  eraId: EraId;
  name: string;
  blurb: string;
}

export const ARTIFACTS: ArtifactDef[] = [
  { id: 'egypt-scarab', eraId: 'egypt', name: 'Golden Scarab', blurb: 'A lucky charm buried with pharaohs.' },
  { id: 'rome-seal', eraId: 'rome', name: 'Legion Signet Ring', blurb: "A centurion's wax-stamp ring." },
  { id: 'vikings-compass', eraId: 'vikings', name: 'Sunstone', blurb: 'A crystal said to reveal the sun through clouds.' },
  { id: 'castle-key', eraId: 'castle', name: 'Iron Keep Key', blurb: 'Opens the castle armory.' },
  { id: 'florence-brush', eraId: 'florence', name: "Painter's Brush", blurb: 'Used in a Florence workshop.' },
  { id: 'revolution-quill', eraId: 'revolution', name: "Founder's Quill", blurb: 'Ink still dried on the nib.' },
  { id: 'industrial-gear', eraId: 'industrial', name: 'Factory Gearwheel', blurb: 'From an early steam engine.' },
  { id: 'moon-flag', eraId: 'moon', name: 'Mission Patch', blurb: 'Stitched for a journey to the Moon.' },
];

export interface GadgetSkin {
  id: string;
  name: string;
  requiredStars: number;
}

export const GADGET_SKINS: GadgetSkin[] = [
  { id: 'default', name: 'Classic Chronometer', requiredStars: 0 },
  { id: 'bronze', name: 'Bronze Gearwork', requiredStars: 6 },
  { id: 'silver', name: 'Silver Astrolabe', requiredStars: 12 },
  { id: 'gold', name: 'Golden Paradox Engine', requiredStars: 18 },
  { id: 'cosmic', name: 'Cosmic Rift Core', requiredStars: 24 },
];

export function totalStars(profile: PlayerProfile): number {
  return ERA_ORDER.reduce((sum, era) => sum + profile.eraProgress[era].stars, 0);
}

export function availableSkins(profile: PlayerProfile): GadgetSkin[] {
  const stars = totalStars(profile);
  return GADGET_SKINS.filter((skin) => skin.requiredStars <= stars);
}

export function newlyUnlockedSkins(profile: PlayerProfile): GadgetSkin[] {
  const unlocked = new Set(profile.unlockedSkins);
  return availableSkins(profile).filter((skin) => !unlocked.has(skin.id));
}

export function makeEmptyEraProgress(): EraProgress {
  return { completed: false, stars: 0, bestTimeSeconds: null, hintsUsedBest: 0 };
}

export function createDefaultProfile(id: string, name: string): PlayerProfile {
  const eraProgress = {} as Record<EraId, EraProgress>;
  for (const era of ERA_ORDER) eraProgress[era] = makeEmptyEraProgress();
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    gadgetSkin: 'default',
    unlockedSkins: ['default'],
    muted: false,
    eraProgress,
    artifactsCollected: [],
  };
}

/** Apply an era completion result to a profile, returning a new updated profile (immutable). */
export function recordEraCompletion(
  profile: PlayerProfile,
  eraId: EraId,
  stars: Stars,
  result: EraAttemptResult,
): PlayerProfile {
  const prev = profile.eraProgress[eraId];
  const better = !prev.completed || stars > prev.stars;
  const nextProgress: EraProgress = {
    completed: true,
    stars: better ? stars : prev.stars,
    bestTimeSeconds:
      prev.bestTimeSeconds === null ? result.timeSeconds : Math.min(prev.bestTimeSeconds, result.timeSeconds),
    hintsUsedBest: prev.completed ? Math.min(prev.hintsUsedBest, result.hintsUsed) : result.hintsUsed,
  };
  const artifact = ARTIFACTS.find((a) => a.eraId === eraId);
  const artifactsCollected = artifact && !profile.artifactsCollected.includes(artifact.id)
    ? [...profile.artifactsCollected, artifact.id]
    : profile.artifactsCollected;

  const updated: PlayerProfile = {
    ...profile,
    eraProgress: { ...profile.eraProgress, [eraId]: nextProgress },
    artifactsCollected,
  };

  const unlocked = newlyUnlockedSkins(updated);
  if (unlocked.length > 0) {
    updated.unlockedSkins = [...updated.unlockedSkins, ...unlocked.map((s) => s.id)];
  }

  return updated;
}

export function isEraUnlocked(profile: PlayerProfile, eraId: EraId): boolean {
  const idx = ERA_ORDER.indexOf(eraId);
  if (idx === 0) return true;
  const prevEra = ERA_ORDER[idx - 1];
  return profile.eraProgress[prevEra].completed;
}
