export type EraId =
  | 'egypt'
  | 'rome'
  | 'vikings'
  | 'castle'
  | 'florence'
  | 'revolution'
  | 'industrial'
  | 'moon';

export const ERA_ORDER: EraId[] = [
  'egypt',
  'rome',
  'vikings',
  'castle',
  'florence',
  'revolution',
  'industrial',
  'moon',
];

export type Stars = 0 | 1 | 2 | 3;

export interface EraProgress {
  completed: boolean;
  stars: Stars;
  bestTimeSeconds: number | null;
  hintsUsedBest: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: string;
  gadgetSkin: string;
  unlockedSkins: string[];
  muted: boolean;
  eraProgress: Record<EraId, EraProgress>;
  artifactsCollected: string[];
  bossDefeated: boolean;
}

export interface SaveData {
  version: 1;
  profiles: PlayerProfile[];
  activeProfileId: string | null;
}

export interface EraAttemptResult {
  mistakes: number;
  hintsUsed: number;
  timeSeconds: number;
}
