import { beforeEach, describe, expect, it } from 'vitest';
import { createProfile, deleteProfile, getActiveProfile, loadSave, persistSave, selectProfile, updateProfile } from '../src/core/save';

describe('save persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty save when nothing is stored', () => {
    const save = loadSave();
    expect(save.profiles).toEqual([]);
    expect(save.activeProfileId).toBeNull();
  });

  it('round-trips through localStorage', () => {
    let save = loadSave();
    let id = 0;
    ({ save } = createProfile(save, 'Max', () => `id-${id++}`));
    persistSave(save);
    const reloaded = loadSave();
    expect(reloaded.profiles).toHaveLength(1);
    expect(reloaded.profiles[0].name).toBe('Max');
    expect(reloaded.activeProfileId).toBe('id-0');
  });

  it('supports multiple profiles and switching the active one', () => {
    let save = loadSave();
    let id = 0;
    ({ save } = createProfile(save, 'Max', () => `id-${id++}`));
    ({ save } = createProfile(save, 'Jo', () => `id-${id++}`));
    expect(save.profiles).toHaveLength(2);
    save = selectProfile(save, 'id-0');
    expect(getActiveProfile(save)?.name).toBe('Max');
  });

  it('deletes a profile and falls back to another active profile', () => {
    let save = loadSave();
    let id = 0;
    ({ save } = createProfile(save, 'Max', () => `id-${id++}`));
    ({ save } = createProfile(save, 'Jo', () => `id-${id++}`));
    save = deleteProfile(save, 'id-1');
    expect(save.profiles).toHaveLength(1);
    expect(getActiveProfile(save)?.name).toBe('Max');
  });

  it('updates a profile in place', () => {
    let save = loadSave();
    const { save: save2, profile } = createProfile(save, 'Max', () => 'id-0');
    save = save2;
    const renamed = { ...profile, muted: true };
    save = updateProfile(save, renamed);
    expect(getActiveProfile(save)?.muted).toBe(true);
  });

  it('falls back to an empty save on corrupt JSON', () => {
    localStorage.setItem('timerift:save:v1', '{not json');
    const save = loadSave();
    expect(save.profiles).toEqual([]);
  });
});
