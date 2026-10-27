import { createDefaultProfile } from './progression';
import type { PlayerProfile, SaveData } from './types';

export const STORAGE_KEY = 'timerift:save:v1';

function emptySave(): SaveData {
  return { version: 1, profiles: [], activeProfileId: null };
}

export function loadSave(storage: Storage = localStorage): SaveData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.profiles)) return emptySave();
    return parsed;
  } catch {
    return emptySave();
  }
}

export function persistSave(data: SaveData, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createProfile(
  save: SaveData,
  name: string,
  idFactory: () => string = () => crypto.randomUUID(),
): { save: SaveData; profile: PlayerProfile } {
  const profile = createDefaultProfile(idFactory(), name.trim().slice(0, 24) || 'Explorer');
  const next: SaveData = {
    ...save,
    profiles: [...save.profiles, profile],
    activeProfileId: profile.id,
  };
  return { save: next, profile };
}

export function deleteProfile(save: SaveData, id: string): SaveData {
  const profiles = save.profiles.filter((p) => p.id !== id);
  const activeProfileId = save.activeProfileId === id ? profiles[0]?.id ?? null : save.activeProfileId;
  return { ...save, profiles, activeProfileId };
}

export function selectProfile(save: SaveData, id: string): SaveData {
  if (!save.profiles.some((p) => p.id === id)) return save;
  return { ...save, activeProfileId: id };
}

export function updateProfile(save: SaveData, profile: PlayerProfile): SaveData {
  return {
    ...save,
    profiles: save.profiles.map((p) => (p.id === profile.id ? profile : p)),
  };
}

export function getActiveProfile(save: SaveData): PlayerProfile | null {
  if (!save.activeProfileId) return null;
  return save.profiles.find((p) => p.id === save.activeProfileId) ?? null;
}
