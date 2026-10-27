import { loadSave, persistSave, getActiveProfile, updateProfile } from '../core/save';
import type { PlayerProfile, SaveData } from '../core/types';

/** Thin wrapper around SaveData kept in Phaser's registry so any scene can read/write it. */
export class GameState {
  save: SaveData;

  constructor() {
    this.save = loadSave();
  }

  get activeProfile(): PlayerProfile | null {
    return getActiveProfile(this.save);
  }

  requireProfile(): PlayerProfile {
    const profile = this.activeProfile;
    if (!profile) throw new Error('No active profile selected');
    return profile;
  }

  setSave(next: SaveData): void {
    this.save = next;
    persistSave(this.save);
  }

  updateActiveProfile(updater: (profile: PlayerProfile) => PlayerProfile): PlayerProfile {
    const profile = this.requireProfile();
    const next = updater(profile);
    this.setSave(updateProfile(this.save, next));
    return next;
  }
}

export const GAME_STATE_KEY = 'gameState';
