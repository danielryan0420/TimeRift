const INTRO_SEEN_KEY = 'timerift:introSeen:v1';

/** Whether the skippable story intro has already played in this browser. */
export function hasSeenIntro(storage: Storage = localStorage): boolean {
  try {
    return storage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(storage: Storage = localStorage): void {
  try {
    storage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* if storage is unavailable the intro just replays next time, which is fine */
  }
}
