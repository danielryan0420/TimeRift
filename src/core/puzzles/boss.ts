import type { EraId } from '../types';
import { ERA_ORDER } from '../types';

/** The final showdown cycles through one puzzle round per era, in chronological order. */
export const BOSS_ROUND_ORDER: EraId[] = ERA_ORDER;
export const BOSS_MAX_HP = BOSS_ROUND_ORDER.length;
export const PLAYER_MAX_HP = 5;

export interface BossState {
  roundIndex: number;
  bossHp: number;
  playerHp: number;
}

export function initBossFight(): BossState {
  return { roundIndex: 0, bossHp: BOSS_MAX_HP, playerHp: PLAYER_MAX_HP };
}

export function currentRoundEra(state: BossState): EraId | null {
  return state.roundIndex < BOSS_ROUND_ORDER.length ? BOSS_ROUND_ORDER[state.roundIndex] : null;
}

export function isBossDefeated(state: BossState): boolean {
  return state.bossHp <= 0;
}

export function isPlayerDefeated(state: BossState): boolean {
  return state.playerHp <= 0;
}

export function isFightOver(state: BossState): boolean {
  return isBossDefeated(state) || isPlayerDefeated(state);
}

/** A correct answer chips the boss and advances the round; a mistake costs the player a heart. */
export function applyRoundOutcome(state: BossState, success: boolean): BossState {
  if (isFightOver(state)) return state;
  if (success) {
    return {
      ...state,
      bossHp: Math.max(0, state.bossHp - 1),
      roundIndex: Math.min(state.roundIndex + 1, BOSS_ROUND_ORDER.length),
    };
  }
  return { ...state, playerHp: Math.max(0, state.playerHp - 1) };
}

/** One-line reminder of how to interact with each trial, shown when its round starts. */
export const BOSS_ROUND_HOWTO: Record<EraId, string> = {
  egypt: 'Tap the tool that matches the situation below.',
  rome: 'Tap numeral tiles in order, then tap Open Lock.',
  china: 'Tap the trade good the caravan is asking for.',
  vikings: 'Drag inside the dial to aim toward the clue.',
  castle: 'Drag the slider into the green zone, then Fire.',
  florence: 'Drag the line left or right, then set the composition.',
  revolution: 'Drag inside the wheel until the green preview reads clearly.',
  industrial: 'Drag the slider into the green zone, then Engage.',
  flight: 'Drag the slider into the green zone, then Take Off.',
  moon: 'Drag the slider into the green zone, then Launch.',
};

/** The current objective for the HUD goal banner, specific to whichever trial is active. */
export const BOSS_ROUND_GOAL: Record<EraId, string> = {
  egypt: 'Pick the right tool to break this round\'s shield.',
  rome: 'Build the Roman numeral lock, then open it.',
  china: 'Load the trade good this merchant demands.',
  vikings: 'Steer to the bearing Polaris points out.',
  castle: 'Drag into the green zone to hit the target.',
  florence: 'Drag the focal line to the golden ratio spot.',
  revolution: 'Rotate the wheel to decode the message.',
  industrial: 'Drag into the green zone to hit the target RPM.',
  flight: 'Drag into the green zone for a safe takeoff.',
  moon: 'Drag into the green zone to reach escape velocity safely.',
};

/**
 * Boss trials reuse the exact same tiered hints (nudge, bigger clue, worked example) as the
 * standalone eras, instead of a second hand-written copy that could drift out of sync — a
 * player stuck in the final fight gets the same kind of help they got the first time they
 * met that skill.
 */
export { egyptHints as egyptBossHints } from './egypt';
export { romeHints as romeBossHints } from './rome';
export { chinaHints as chinaBossHints } from './china';
export { vikingsHints as vikingsBossHints } from './vikings';
export { castleHints as castleBossHints } from './castle';
export { florenceHints as florenceBossHints } from './florence';
export { revolutionHints as revolutionBossHints } from './revolution';
export { industrialHints as industrialBossHints } from './industrial';
export { flightHints as flightBossHints } from './flight';
export { moonHints as moonBossHints } from './moon';
